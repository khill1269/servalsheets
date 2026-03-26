import { describe, expect, it, vi } from 'vitest';
import { registerHttpWebhookDashboardRoutes } from '../../src/http-server/webhook-dashboard-routes.js';

function createJsonResponseDouble() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: any, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

describe('http webhook dashboard routes', () => {
  it('returns aggregated webhook delivery stats', async () => {
    const get = vi.fn();
    const adminMiddleware = vi.fn();
    const loadWebhookDashboardData = vi.fn(async () => ({
      webhooks: [
        {
          webhookId: 'wh-1',
          spreadsheetId: 'sheet-1',
          active: true,
          deliveryCount: 10,
          failureCount: 2,
          avgDeliveryTimeMs: 45,
          p95DeliveryTimeMs: 90,
          p99DeliveryTimeMs: 120,
          lastDelivery: '2026-03-24T00:00:00.000Z',
          lastFailure: '2026-03-23T00:00:00.000Z',
        },
      ],
      queueStats: {
        pendingCount: 3,
        retryCount: 1,
        dlqCount: 0,
      },
    }));

    registerHttpWebhookDashboardRoutes(
      {
        get,
      } as never,
      {
        adminMiddleware: adminMiddleware as never,
        loadWebhookDashboardData,
      }
    );

    expect(get).toHaveBeenCalledWith('/webhooks/dashboard', adminMiddleware, expect.any(Function));

    const handler = get.mock.calls.find(([path]) => path === '/webhooks/dashboard')?.[2];
    const res = createJsonResponseDouble();
    await handler?.(
      {
        query: {
          spreadsheetId: 'sheet-1',
        },
      } as never,
      res as never
    );

    expect(loadWebhookDashboardData).toHaveBeenCalledWith('sheet-1');
    expect(res.body).toMatchObject({
      summary: {
        totalWebhooks: 1,
        activeWebhooks: 1,
        totalDeliveries: 10,
        totalFailures: 2,
        avgDeliveryRate: 10,
      },
      queue: {
        pending: 3,
        retry: 1,
        dlq: 0,
      },
      webhooks: [
        {
          webhookId: 'wh-1',
          successRate: 80,
        },
      ],
    });
  });

  it('returns a 500 response when dashboard loading fails', async () => {
    const get = vi.fn();
    const log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpWebhookDashboardRoutes(
      {
        get,
      } as never,
      {
        adminMiddleware: vi.fn() as never,
        loadWebhookDashboardData: async () => {
          throw new Error('dashboard unavailable');
        },
        log: log as never,
      }
    );

    const handler = get.mock.calls.find(([path]) => path === '/webhooks/dashboard')?.[2];
    const res = createJsonResponseDouble();
    await handler?.({ query: {} } as never, res as never);

    expect(log.error).toHaveBeenCalledWith('Failed to fetch webhook dashboard', {
      error: expect.any(Error),
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: 'Failed to fetch webhook dashboard' });
  });
});
