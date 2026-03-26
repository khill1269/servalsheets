import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { registerHttpStatsRoutes } from '../../src/http-server/stats-routes.js';

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

describe('http stats routes', () => {
  it('returns aggregated runtime stats and hashed user quota usage', async () => {
    const get = vi.fn();
    const adminMiddleware = vi.fn();
    const getUsage = vi.fn(async () => ({
      minuteUsage: 12,
      minuteLimit: 100,
      minuteRemaining: 88,
      hourUsage: 50,
      hourLimit: 5000,
      hourRemaining: 4950,
    }));

    registerHttpStatsRoutes(
      {
        get,
      } as never,
      {
        adminMiddleware: adminMiddleware as never,
        getSessionCount: () => 3,
        getUserRateLimiter: () => ({ getUsage }) as never,
        getCacheStats: () => ({
          totalEntries: 10,
          totalSize: 5 * 1024 * 1024,
          hits: 80,
          misses: 20,
          hitRate: 80,
          byNamespace: { formulas: 5 },
          oldestEntry: Date.parse('2026-03-23T00:00:00.000Z'),
          newestEntry: Date.parse('2026-03-24T00:00:00.000Z'),
        }),
        getDeduplicationStats: () => ({
          totalRequests: 100,
          deduplicatedRequests: 25,
          savedRequests: 25,
          deduplicationRate: 25,
          pendingCount: 2,
          oldestRequestAge: 1500,
        }),
        getConnectionStats: () => ({
          status: 'healthy',
          uptimeSeconds: 3600,
          totalHeartbeats: 40,
          disconnectWarnings: 1,
          timeSinceLastActivity: 500,
          lastActivity: Date.parse('2026-03-24T00:00:00.000Z'),
        }),
        getTracingStats: () => ({
          totalSpans: 1000,
          averageDuration: 42.4242,
          spansByKind: { server: 800 },
          spansByStatus: { ok: 950, error: 50 },
        }),
        getCircuitBreakerStats: () => ({
          sheets: {
            state: 'closed',
          },
        }),
        getUptimeSeconds: () => 90061,
        getMemoryUsage: () => ({
          heapUsed: 20 * 1024 * 1024,
          heapTotal: 40 * 1024 * 1024,
          rss: 80 * 1024 * 1024,
          external: 4 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        }),
      }
    );

    expect(get).toHaveBeenCalledWith('/stats', adminMiddleware, expect.any(Function));

    const handler = get.mock.calls.find(([path]) => path === '/stats')?.[2];
    const res = createJsonResponseDouble();
    const token = 'top-secret-token';
    await handler?.(
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as never,
      res as never
    );

    expect(getUsage).toHaveBeenCalledWith(
      `user:${createHash('sha256').update(token).digest('hex').substring(0, 16)}`
    );
    expect(res.body).toMatchObject({
      uptime: {
        seconds: 90061,
        formatted: '1d 1h 1m 1s',
      },
      cache: {
        enabled: true,
        totalEntries: 10,
        totalSizeMB: 5,
        hitRate: 80,
      },
      deduplication: {
        enabled: true,
        deduplicationRate: 25,
      },
      connection: {
        status: 'healthy',
      },
      tracing: {
        totalSpans: 1000,
        averageDurationMs: 42.42,
      },
      memory: {
        heapUsedMB: 20,
        heapTotalMB: 40,
        rssMB: 80,
        externalMB: 4,
        arrayBuffersMB: 2,
      },
      performance: {
        apiCallReduction: {
          deduplicationSavings: '25.0%',
          cacheSavings: '80.0%',
          estimatedTotalSavings: '~85.0%',
        },
      },
      sessions: {
        active: 3,
      },
      userQuota: {
        enabled: true,
        minuteUsage: 12,
        hourUsage: 50,
      },
      circuitBreakers: {
        sheets: {
          state: 'closed',
        },
      },
    });
  });

  it('returns a disabled quota payload when usage lookup fails', async () => {
    const get = vi.fn();
    const log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpStatsRoutes(
      {
        get,
      } as never,
      {
        adminMiddleware: vi.fn() as never,
        getSessionCount: () => 0,
        getUserRateLimiter: () =>
          ({
            getUsage: async () => {
              throw new Error('redis unavailable');
            },
          }) as never,
        getCacheStats: () => null,
        getDeduplicationStats: () => null,
        getConnectionStats: () => null,
        getTracingStats: () => null,
        getCircuitBreakerStats: () => ({}),
        log: log as never,
      }
    );

    const handler = get.mock.calls.find(([path]) => path === '/stats')?.[2];
    const res = createJsonResponseDouble();
    await handler?.(
      {
        headers: {},
      } as never,
      res as never
    );

    expect(log.error).toHaveBeenCalledWith('Failed to get per-user quota stats', {
      error: expect.any(Error),
    });
    expect(res.body).toMatchObject({
      cache: { enabled: false },
      deduplication: { enabled: false },
      userQuota: { enabled: false, error: 'Failed to fetch quota' },
    });
  });
});
