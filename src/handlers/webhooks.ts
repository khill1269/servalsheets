/**
 * ServalSheets - Webhook Handler
 *
 * Thin dispatcher for sheets_webhook MCP tool (10 actions).
 * Action implementations live in src/handlers/webhook-actions/.
 *
 * @category Handlers
 */

import { ErrorCodes } from './error-codes.js';
import { isWebhookRedisConfigured, WEBHOOK_DURABILITY_MODE } from '../services/webhook-manager.js';
import { WorkspaceEventsService } from '../services/workspace-events.js';
import type { SheetsWebhookInput, SheetsWebhookOutput } from '../schemas/webhook.js';
import { logger } from '../utils/logger.js';
import type { drive_v3 } from 'googleapis';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { ServiceError } from '../core/errors.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { getApiSpecificCircuitBreakerConfig } from '../config/env.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import {
  handleRegister,
  handleUnregister,
  handleList,
  handleGet,
} from './webhook-actions/management.js';
import { handleTest, handleGetStats } from './webhook-actions/delivery.js';
import {
  handleWatchChanges,
  handleSubscribeWorkspace,
  handleUnsubscribeWorkspace,
  handleListWorkspaceSubscriptions,
} from './webhook-actions/integrations.js';
import type { WebhookHandlerAccess } from './webhook-actions/internal.js';

const REDIS_REQUIRED_WEBHOOK_ACTIONS = new Set([
  'register',
  'unregister',
  'list',
  'get',
  'test',
  'get_stats',
]);

type ErrorResponse = Extract<SheetsWebhookOutput['response'], { success: false }>['error'];

/**
 * Webhook handler
 */
export class WebhookHandler {
  driveApi?: drive_v3.Drive;
  deliveryCircuitBreaker: CircuitBreaker;
  workspaceEventsService?: WorkspaceEventsService;

  constructor(options?: {
    driveApi?: drive_v3.Drive;
    workspaceEventsService?: WorkspaceEventsService;
  }) {
    this.driveApi = options?.driveApi;
    this.workspaceEventsService = options?.workspaceEventsService;

    // 16-S4: Initialize circuit breaker for webhook delivery operations
    const deliveryConfig = getApiSpecificCircuitBreakerConfig('webhook_delivery');
    this.deliveryCircuitBreaker = new CircuitBreaker({
      failureThreshold: deliveryConfig.failureThreshold,
      successThreshold: deliveryConfig.successThreshold,
      timeout: deliveryConfig.timeout,
      name: 'webhook-delivery',
    });

    // Register fallback strategy for delivery circuit breaker
    this.deliveryCircuitBreaker.registerFallback({
      name: 'webhook-delivery-unavailable-fallback',
      priority: 1,
      shouldUse: () => true,
      execute: async () => {
        throw new ServiceError(
          'Webhook delivery service temporarily unavailable due to repeated delivery failures',
          'UNAVAILABLE',
          'webhook-delivery',
          true,
          { resetTimeMs: 30000, reason: 'repeated_delivery_failures' }
        );
      },
    });

    // Register with global registry
    circuitBreakerRegistry.register('webhook-delivery', this.deliveryCircuitBreaker);
  }

  createErrorDetail(error: unknown, fallbackMessage: string, action: string): ErrorResponse {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();
    const isRedisConfigError =
      lowerMessage.includes('redis required') ||
      (lowerMessage.includes('redis') &&
        (lowerMessage.includes('not initialized') ||
          lowerMessage.includes('not configured') ||
          lowerMessage.includes('not available')));

    if (isRedisConfigError) {
      return {
        code: ErrorCodes.CONFIG_ERROR,
        message: 'Redis required: Redis backend is required for sheets_webhook operations',
        details: {
          action,
          dependency: 'redis',
          durabilityMode: WEBHOOK_DURABILITY_MODE,
          originalError: message,
        },
        retryable: false,
        resolution:
          'Configure a reachable Redis instance, then retry webhook registration, listing, or delivery tests.',
        resolutionSteps: [
          '1. Set REDIS_URL (or equivalent Redis connection env vars)',
          '2. Ensure Redis is reachable from this ServalSheets process',
          '3. Restart ServalSheets so webhook services initialize with Redis',
          '4. Retry the webhook operation',
        ],
      };
    }

    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: message || fallbackMessage,
      details: { action, error: String(error) },
      retryable: false,
    };
  }

  createRedisUnavailableError(action: string): ErrorResponse {
    return {
      code: ErrorCodes.CONFIG_ERROR,
      message: `Redis required: ${action} depends on the Redis-backed webhook store`,
      details: {
        action,
        dependency: 'redis',
        durabilityMode: WEBHOOK_DURABILITY_MODE,
      },
      retryable: false,
      resolution:
        'Configure a reachable Redis instance before using Redis-backed sheets_webhook actions.',
      resolutionSteps: [
        '1. Set REDIS_URL (or equivalent Redis connection env vars)',
        '2. Ensure Redis is reachable from this ServalSheets process',
        '3. Restart ServalSheets so webhook services initialize with Redis',
        '4. Retry register, list, get, test, get_stats, or unregister',
      ],
    };
  }

  /**
   * Handle sheets_webhook tool calls
   */
  async handle(input: SheetsWebhookInput): Promise<SheetsWebhookOutput> {
    const req = input.request;
    // Build access object for submodule functions (avoids `this` narrowing issues)
    const access: WebhookHandlerAccess = this as WebhookHandlerAccess;
    try {
      if (REDIS_REQUIRED_WEBHOOK_ACTIONS.has(req.action) && !isWebhookRedisConfigured()) {
        return {
          response: {
            success: false,
            error: this.createRedisUnavailableError(req.action),
          },
        };
      }

      switch (req.action) {
        case 'register':
          return { response: await handleRegister(access, req) };
        case 'unregister':
          return { response: await handleUnregister(access, req) };
        case 'list':
          return { response: await handleList(access, req) };
        case 'get':
          return { response: await handleGet(access, req) };
        case 'test':
          return { response: await handleTest(access, req) };
        case 'get_stats':
          return { response: await handleGetStats(access, req) };
        case 'watch_changes':
          return {
            response: await handleWatchChanges(
              access,
              req as import('../schemas/webhook.js').WebhookWatchChangesInput
            ),
          };
        case 'subscribe_workspace':
          return { response: await handleSubscribeWorkspace(access, req) };
        case 'unsubscribe_workspace':
          return { response: await handleUnsubscribeWorkspace(access, req) };
        case 'list_workspace_subscriptions':
          return { response: await handleListWorkspaceSubscriptions(access, req) };

        default: {
          const _exhaustiveCheck: never = req;
          return {
            response: {
              success: false,
              error: {
                code: ErrorCodes.INVALID_PARAMS,
                message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
                retryable: false,
                suggestedFix:
                  "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
              },
            },
          };
        }
      }
    } catch (error) {
      logger.error('Webhook handler error', {
        action: req.action,
        error,
      });

      // 16-S4/16-S5: Use structured error mapping for top-level catch
      const mapped = mapStandaloneError(error);
      return {
        response: {
          success: false,
          error: mapped,
        },
      };
    }
  }
}

/**
 * Create webhook handler
 */
export function createWebhookHandler(options?: {
  driveApi?: drive_v3.Drive;
  workspaceEventsService?: WorkspaceEventsService;
}): WebhookHandler {
  return new WebhookHandler(options);
}
