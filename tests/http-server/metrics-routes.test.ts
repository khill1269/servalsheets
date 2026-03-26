import { describe, expect, it, vi } from 'vitest';
import { registerHttpMetricsRoutes } from '../../src/http-server/metrics-routes.js';

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

describe('http metrics routes', () => {
  it('registers the metrics handler and circuit breaker dashboard', async () => {
    const get = vi.fn();
    const adminMiddleware = vi.fn();
    const metricsHandler = vi.fn();

    registerHttpMetricsRoutes(
      {
        get,
      } as never,
      {
        adminMiddleware: adminMiddleware as never,
        metricsHandler: metricsHandler as never,
        getCircuitBreakers: () => [
          {
            name: 'sheets',
            description: 'Google Sheets API',
            breaker: {
              getStats: () => ({
                state: 'open',
                failureCount: 2,
                successCount: 8,
                totalRequests: 10,
                lastFailure: '2026-03-24T00:00:00.000Z',
                nextAttempt: '2026-03-24T00:01:00.000Z',
                fallbackUsageCount: 1,
                registeredFallbacks: 2,
              }),
            },
          },
        ] as never,
      }
    );

    expect(get).toHaveBeenCalledWith('/metrics', adminMiddleware, metricsHandler);
    expect(get).toHaveBeenCalledWith('/metrics/circuit-breakers', adminMiddleware, expect.any(Function));

    const handler = get.mock.calls.find(([path]) => path === '/metrics/circuit-breakers')?.[2];
    const res = createJsonResponseDouble();
    await handler?.({} as never, res as never);

    expect(res.body).toMatchObject({
      circuitBreakers: [
        {
          name: 'sheets',
          isOpen: true,
          isHalfOpen: false,
          isClosed: false,
          failureCount: 2,
          successCount: 8,
        },
      ],
      summary: {
        total: 1,
        open: 1,
        halfOpen: 0,
        closed: 0,
      },
    });
  });

  it('returns a 500 response when the circuit breaker registry lookup fails', async () => {
    const get = vi.fn();
    const log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpMetricsRoutes(
      {
        get,
      } as never,
      {
        adminMiddleware: vi.fn() as never,
        metricsHandler: vi.fn() as never,
        getCircuitBreakers: () => {
          throw new Error('registry unavailable');
        },
        log: log as never,
      }
    );

    const handler = get.mock.calls.find(([path]) => path === '/metrics/circuit-breakers')?.[2];
    const res = createJsonResponseDouble();
    await handler?.({} as never, res as never);

    expect(log.error).toHaveBeenCalledWith('Failed to fetch circuit breaker metrics', {
      error: expect.any(Error),
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: 'Failed to fetch circuit breaker metrics' });
  });
});
