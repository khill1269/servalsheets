/**
 * Webhook management actions: register, unregister, list, get
 */

import { getWebhookManager } from '../../services/webhook-manager.js';
import { recordWebhookId } from '../../mcp/completions.js';
import { resourceNotifications } from '../../resources/notifications.js';
import type { SheetsWebhookInput } from '../../schemas/webhook.js';
import type { WebhookResponse, WebhookHandlerAccess } from './internal.js';
import { ErrorCodes } from './internal.js';

export async function handleRegister(
  handler: WebhookHandlerAccess,
  input: Extract<SheetsWebhookInput['request'], { action: 'register' }>
): Promise<WebhookResponse> {
  try {
    const manager = getWebhookManager();

    // ISSUE-140: Reject duplicate URL registration to prevent double event delivery
    try {
      const existingWebhooks = await manager.list(input.spreadsheetId, true);
      const duplicate = existingWebhooks.find((w) => w.webhookUrl === input.webhookUrl);
      if (duplicate) {
        return {
          success: false,
          error: {
            code: ErrorCodes.FAILED_PRECONDITION,
            message: `A webhook with URL "${input.webhookUrl}" is already registered for this spreadsheet (existing ID: ${duplicate.webhookId}). Unregister the existing webhook first or use a different URL.`,
            retryable: false,
          },
        };
      }
    } catch {
      // Non-blocking: if duplicate check fails (e.g. Redis unavailable), proceed with registration
    }

    const result = await manager.register(input);

    // Notify MCP clients that webhook was registered (Feature 1: Real-Time Notifications)
    resourceNotifications.notifyResourceListChanged('webhook registered');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: handler.createErrorDetail(error, 'Failed to register webhook', input.action),
    };
  }
}

export async function handleUnregister(
  handler: WebhookHandlerAccess,
  input: Extract<SheetsWebhookInput['request'], { action: 'unregister' }>
): Promise<WebhookResponse> {
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
      error: handler.createErrorDetail(error, 'Failed to unregister webhook', input.action),
    };
  }
}

export async function handleList(
  handler: WebhookHandlerAccess,
  input: Extract<SheetsWebhookInput['request'], { action: 'list' }>
): Promise<WebhookResponse> {
  try {
    const manager = getWebhookManager();
    const webhooks = await manager.list(input.spreadsheetId, input.active);

    // Wire completions: cache webhook IDs for argument autocompletion (ISSUE-062)
    for (const wh of webhooks) {
      if (wh.webhookId) recordWebhookId(wh.webhookId);
    }

    return {
      success: true,
      data: { webhooks },
    };
  } catch (error) {
    return {
      success: false,
      error: handler.createErrorDetail(error, 'Failed to list webhooks', input.action),
    };
  }
}

export async function handleGet(
  handler: WebhookHandlerAccess,
  input: Extract<SheetsWebhookInput['request'], { action: 'get' }>
): Promise<WebhookResponse> {
  try {
    const manager = getWebhookManager();
    const webhook = await manager.get(input.webhookId);

    if (!webhook) {
      return {
        success: false,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: `Webhook ${input.webhookId} not found`,
          retryable: false,
          suggestedFix: 'Verify the spreadsheet ID is correct and the spreadsheet exists',
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
      error: handler.createErrorDetail(error, 'Failed to get webhook', input.action),
    };
  }
}
