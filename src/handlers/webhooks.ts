/**
 * ServalSheets - Webhook Handler
 *
 * Handles sheets_webhook MCP tool for webhook management.
 *
 * Actions:
 * - register: Register new webhook
 * - unregister: Remove webhook
 * - list: List webhooks
 * - get: Get webhook details
 * - test: Send test delivery
 * - get_stats: Get webhook statistics
 *
 * @category Handlers
 */

import { getWebhookManager } from '../services/webhook-manager.js';
import { getWebhookQueue } from '../services/webhook-queue.js';
import type {
  SheetsWebhookInput,
  SheetsWebhookOutput,
  WebhookEventType,
} from '../schemas/webhook.js';
import { logger } from '../utils/logger.js';

/**
 * Webhook handler
 */
export class WebhookHandler {
  /**
   * Handle sheets_webhook tool calls
   */
  async handle(input: SheetsWebhookInput): Promise<SheetsWebhookOutput> {
    const req = input.request;
    try {
      switch (req.action) {
        case 'register':
          return await this.handleRegister(req);

        case 'unregister':
          return await this.handleUnregister(req);

        case 'list':
          return await this.handleList(req);

        case 'get':
          return await this.handleGet(req);

        case 'test':
          return await this.handleTest(req);

        case 'get_stats':
          return await this.handleGetStats(req);

        default:
          return {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${(req as { action: string }).action}`,
            },
          };
      }
    } catch (error) {
      logger.error('Webhook handler error', {
        action: req.action,
        error,
      });

      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { error: String(error) },
        },
      };
    }
  }

  /**
   * Register webhook
   */
  private async handleRegister(
    input: Extract<SheetsWebhookInput['request'], { action: 'register' }>
  ): Promise<SheetsWebhookOutput> {
    try {
      const manager = getWebhookManager();
      const result = await manager.register(input);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to register webhook',
          details: { error: String(error) },
        },
      };
    }
  }

  /**
   * Unregister webhook
   */
  private async handleUnregister(
    input: Extract<SheetsWebhookInput['request'], { action: 'unregister' }>
  ): Promise<SheetsWebhookOutput> {
    try {
      const manager = getWebhookManager();
      const result = await manager.unregister(input.webhookId);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_UNREGISTER_FAILED',
          message: error instanceof Error ? error.message : 'Failed to unregister webhook',
          details: { error: String(error) },
        },
      };
    }
  }

  /**
   * List webhooks
   */
  private async handleList(
    input: Extract<SheetsWebhookInput['request'], { action: 'list' }>
  ): Promise<SheetsWebhookOutput> {
    try {
      const manager = getWebhookManager();
      const webhooks = await manager.list(input.spreadsheetId, input.active);

      return {
        success: true,
        data: { webhooks },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Failed to list webhooks',
          details: { error: String(error) },
        },
      };
    }
  }

  /**
   * Get webhook details
   */
  private async handleGet(
    input: Extract<SheetsWebhookInput['request'], { action: 'get' }>
  ): Promise<SheetsWebhookOutput> {
    try {
      const manager = getWebhookManager();
      const webhook = await manager.get(input.webhookId);

      if (!webhook) {
        return {
          success: false,
          error: {
            code: 'WEBHOOK_NOT_FOUND',
            message: `Webhook ${input.webhookId} not found`,
          },
        };
      }

      return {
        success: true,
        data: { webhook },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_GET_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get webhook',
          details: { error: String(error) },
        },
      };
    }
  }

  /**
   * Send test webhook delivery
   */
  private async handleTest(
    input: Extract<SheetsWebhookInput['request'], { action: 'test' }>
  ): Promise<SheetsWebhookOutput> {
    try {
      const manager = getWebhookManager();
      const webhook = await manager.get(input.webhookId);

      if (!webhook) {
        return {
          success: false,
          error: {
            code: 'WEBHOOK_NOT_FOUND',
            message: `Webhook ${input.webhookId} not found`,
          },
        };
      }

      // Enqueue test delivery
      const queue = getWebhookQueue();
      const deliveryId = await queue.enqueue({
        webhookId: webhook.webhookId,
        webhookUrl: webhook.webhookUrl,
        eventType: 'all' as WebhookEventType,
        payload: {
          test: true,
          message: 'Test webhook delivery',
          timestamp: new Date().toISOString(),
        },
        maxAttempts: 1, // Don't retry test deliveries
        scheduledAt: Date.now(),
      });

      return {
        success: true,
        data: {
          delivery: {
            deliveryId,
            webhookId: webhook.webhookId,
            timestamp: new Date().toISOString(),
            eventType: 'all' as WebhookEventType,
            payload: {
              test: true,
              message: 'Test webhook delivery',
            },
            status: 'pending' as const,
            attemptCount: 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_TEST_FAILED',
          message: error instanceof Error ? error.message : 'Failed to send test webhook',
          details: { error: String(error) },
        },
      };
    }
  }

  /**
   * Get webhook statistics
   */
  private async handleGetStats(
    input: Extract<SheetsWebhookInput['request'], { action: 'get_stats' }>
  ): Promise<SheetsWebhookOutput> {
    try {
      const manager = getWebhookManager();
      const queue = getWebhookQueue();

      // Get queue stats
      const queueStats = await queue.getStats();

      // Get webhook stats
      const webhooks = input.webhookId
        ? [await manager.get(input.webhookId)].filter(Boolean)
        : await manager.list();

      const totalDeliveries = webhooks.reduce((sum, w) => sum + (w?.deliveryCount || 0), 0);
      const totalFailures = webhooks.reduce((sum, w) => sum + (w?.failureCount || 0), 0);
      const activeWebhooks = webhooks.filter((w) => w?.active).length;

      const stats = {
        totalWebhooks: webhooks.length,
        activeWebhooks,
        totalDeliveries,
        successfulDeliveries: totalDeliveries - totalFailures,
        failedDeliveries: totalFailures,
        pendingDeliveries: queueStats.pendingCount,
        averageDeliveryTimeMs: 0, // Would need to track delivery times
        webhookStats: input.webhookId
          ? undefined
          : webhooks.map((w) => ({
              webhookId: w?.webhookId || '',
              deliveryCount: w?.deliveryCount || 0,
              successRate:
                (w?.deliveryCount || 0) > 0
                  ? ((w?.deliveryCount || 0) - (w?.failureCount || 0)) / (w?.deliveryCount || 0)
                  : 0,
              averageLatencyMs: 0,
            })),
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_STATS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get webhook stats',
          details: { error: String(error) },
        },
      };
    }
  }
}

/**
 * Create webhook handler
 */
export function createWebhookHandler(): WebhookHandler {
  return new WebhookHandler();
}
