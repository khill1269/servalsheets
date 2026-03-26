import type { Request, Response } from 'express';

export interface HttpWebhookDashboardLogger {
  error(message: string, meta?: unknown): void;
}

export interface WebhookDashboardWebhookLike {
  readonly webhookId: string;
  readonly spreadsheetId: string;
  readonly active: boolean;
  readonly deliveryCount: number;
  readonly failureCount: number;
  readonly avgDeliveryTimeMs?: number | null;
  readonly p95DeliveryTimeMs?: number | null;
  readonly p99DeliveryTimeMs?: number | null;
  readonly lastDelivery?: string | null;
  readonly lastFailure?: string | null;
}

export interface WebhookDashboardQueueStatsLike {
  readonly pendingCount: number;
  readonly retryCount: number;
  readonly dlqCount: number;
}

export interface RegisterHttpWebhookDashboardRoutesOptions<TApp, TAdminMiddleware = unknown> {
  readonly app: TApp;
  readonly adminMiddleware: TAdminMiddleware;
  readonly loadWebhookDashboardData: (spreadsheetId?: string) => Promise<{
    webhooks: WebhookDashboardWebhookLike[];
    queueStats: WebhookDashboardQueueStatsLike;
  }>;
  readonly log?: HttpWebhookDashboardLogger;
}

const defaultLogger: HttpWebhookDashboardLogger = {
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function registerHttpWebhookDashboardRoutes<
  TApp extends Pick<
    {
      get(path: string, ...handlers: unknown[]): void;
    },
    'get'
  >,
  TAdminMiddleware,
>(options: RegisterHttpWebhookDashboardRoutesOptions<TApp, TAdminMiddleware>): void {
  const {
    app,
    adminMiddleware,
    loadWebhookDashboardData,
    log = defaultLogger,
  } = options;

  app.get('/webhooks/dashboard', adminMiddleware, async (req: Request, res: Response) => {
    try {
      const spreadsheetId = req.query['spreadsheetId'] as string | undefined;
      const { webhooks, queueStats } = await loadWebhookDashboardData(spreadsheetId);

      const totalWebhooks = webhooks.length;
      const activeWebhooks = webhooks.filter((webhook) => webhook.active).length;
      const totalDeliveries = webhooks.reduce((sum, webhook) => sum + webhook.deliveryCount, 0);
      const totalFailures = webhooks.reduce((sum, webhook) => sum + webhook.failureCount, 0);
      const avgDeliveryRate = totalWebhooks > 0 ? totalDeliveries / totalWebhooks : 0;

      const webhookStats = webhooks.map((webhook) => {
        const successCount = webhook.deliveryCount - webhook.failureCount;
        const successRate =
          webhook.deliveryCount > 0 ? (successCount / webhook.deliveryCount) * 100 : 0;

        return {
          webhookId: webhook.webhookId,
          spreadsheetId: webhook.spreadsheetId,
          active: webhook.active,
          deliveryCount: webhook.deliveryCount,
          failureCount: webhook.failureCount,
          successRate: Math.round(successRate * 100) / 100,
          avgDeliveryTimeMs: webhook.avgDeliveryTimeMs,
          p95DeliveryTimeMs: webhook.p95DeliveryTimeMs,
          p99DeliveryTimeMs: webhook.p99DeliveryTimeMs,
          lastDelivery: webhook.lastDelivery,
          lastFailure: webhook.lastFailure,
        };
      });

      res.json({
        timestamp: new Date().toISOString(),
        summary: {
          totalWebhooks,
          activeWebhooks,
          totalDeliveries,
          totalFailures,
          avgDeliveryRate: Math.round(avgDeliveryRate * 100) / 100,
        },
        queue: {
          pending: queueStats.pendingCount,
          retry: queueStats.retryCount,
          dlq: queueStats.dlqCount,
        },
        webhooks: webhookStats,
      });
    } catch (error) {
      log.error('Failed to fetch webhook dashboard', { error });
      res.status(500).json({ error: 'Failed to fetch webhook dashboard' });
    }
  });
}
