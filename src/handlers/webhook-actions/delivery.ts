/**
 * Webhook delivery actions: test, get_stats
 */

import { getWebhookManager } from '../../services/webhook-manager.js';
import { getWebhookQueue } from '../../services/webhook-queue.js';
import type { SheetsWebhookInput } from '../../schemas/webhook.js';
import type { WebhookEventType } from '../../schemas/webhook.js';
import type { WebhookResponse, WebhookHandlerAccess } from './internal.js';
import { ErrorCodes } from './internal.js';

/**
 * Send test webhook delivery.
 * 16-S4: Wrapped with circuit breaker protection.
 */
export async function handleTest(
  handler: WebhookHandlerAccess,
  input: Extract<SheetsWebhookInput['request'], { action: 'test' }>
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

    // 16-S4: Wrap webhook delivery with circuit breaker
    const queue = await handler.deliveryCircuitBreaker.execute(async () => {
      return getWebhookQueue();
    });

    // Enqueue test delivery
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
      error: handler.createErrorDetail(error, 'Failed to send test webhook', input.action),
    };
  }
}

export async function handleGetStats(
  handler: WebhookHandlerAccess,
  input: Extract<SheetsWebhookInput['request'], { action: 'get_stats' }>
): Promise<WebhookResponse> {
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

    // Phase 4.2A: Get event type breakdown for specific webhook
    let eventTypeBreakdown;
    if (input.webhookId) {
      const eventStats = await manager.getEventStats(input.webhookId);
      if (eventStats) {
        eventTypeBreakdown = Object.entries(eventStats).map(([eventType, counts]) => ({
          eventType,
          detectedCount: counts.detected,
          deliveredCount: counts.delivered,
          filteringEfficiency:
            counts.detected > 0
              ? ((counts.detected - counts.delivered) / counts.detected) * 100
              : 0,
        }));
      }
    }

    const stats = {
      totalWebhooks: webhooks.length,
      activeWebhooks,
      totalDeliveries,
      successfulDeliveries: totalDeliveries - totalFailures,
      failedDeliveries: totalFailures,
      pendingDeliveries: queueStats.pendingCount,
      averageDeliveryTimeMs: 0, // Would need to track delivery times
      eventTypeBreakdown, // Phase 4.2A: Event type stats (only for specific webhook)
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
      error: handler.createErrorDetail(error, 'Failed to get webhook stats', input.action),
    };
  }
}
