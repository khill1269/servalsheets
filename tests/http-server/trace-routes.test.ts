import { describe, expect, it, vi } from 'vitest';
import { registerHttpTraceRoutes } from '../../src/http-server/trace-routes.js';

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

describe('http trace routes', () => {
  it('registers trace endpoints and optional tracing UI routes', async () => {
    const get = vi.fn();
    const use = vi.fn();
    const addTracingUIRoutes = vi.fn();
    const aggregator = {
      isEnabled: vi.fn(() => true),
      searchTraces: vi.fn(() => [{ requestId: 'trace-1' }, { requestId: 'trace-2' }]),
      getRecentTraces: vi.fn(() => []),
      getSlowestTraces: vi.fn(() => []),
      getErrorTraces: vi.fn(() => []),
      getStats: vi.fn(() => ({
        totalTraces: 5,
        successCount: 4,
        errorCount: 1,
        averageDuration: 42.42,
        p50Duration: 20,
        p95Duration: 100,
        p99Duration: 150,
        byTool: {
          core: { count: 5, averageDuration: 42.42, errorRate: 0.2 },
        },
        byError: { INTERNAL: 1 },
      })),
      getCacheStats: vi.fn(() => ({ size: 10 })),
      getTrace: vi.fn(() => ({ requestId: 'trace-1' })),
    };
    const adminMiddleware = vi.fn();

    registerHttpTraceRoutes(
      {
        get,
        use,
      } as never,
      {
        adminMiddleware: adminMiddleware as never,
        getTraceAggregator: () => aggregator as never,
        importTracingUiModule: async () => ({
          addTracingUIRoutes: addTracingUIRoutes as never,
        }),
      }
    );

    expect(get).toHaveBeenCalledWith('/traces', adminMiddleware, expect.any(Function));
    expect(get).toHaveBeenCalledWith('/traces/recent', adminMiddleware, expect.any(Function));
    expect(get).toHaveBeenCalledWith('/traces/slow', adminMiddleware, expect.any(Function));
    expect(get).toHaveBeenCalledWith('/traces/errors', adminMiddleware, expect.any(Function));
    expect(get).toHaveBeenCalledWith('/traces/stats', adminMiddleware, expect.any(Function));
    expect(get).toHaveBeenCalledWith('/traces/:requestId', adminMiddleware, expect.any(Function));
    expect(use).toHaveBeenCalledWith('/ui/tracing', adminMiddleware);
    expect(use).toHaveBeenCalledWith('/traces/stream', adminMiddleware);

    await vi.waitFor(() => {
      expect(addTracingUIRoutes).toHaveBeenCalledWith({ get, use });
    });

    const tracesHandler = get.mock.calls.find(([path]) => path === '/traces')?.[2];
    const tracesRes = createJsonResponseDouble();
    tracesHandler?.(
      {
        query: {
          tool: 'core',
          success: 'true',
          limit: '1',
        },
      } as never,
      tracesRes as never
    );

    expect(aggregator.searchTraces).toHaveBeenCalledWith({
      tool: 'core',
      success: true,
    });
    expect(tracesRes.body).toEqual({
      count: 2,
      traces: [{ requestId: 'trace-1' }],
      filters: {
        tool: 'core',
        success: true,
      },
      _links: {
        self: '/traces',
        recent: '/traces/recent',
        slow: '/traces/slow',
        errors: '/traces/errors',
        stats: '/traces/stats',
      },
    });
  });

  it('returns disabled responses and not-found trace errors', () => {
    const get = vi.fn();
    const use = vi.fn();
    const disabledAggregator = {
      isEnabled: vi.fn(() => false),
      searchTraces: vi.fn(() => []),
      getRecentTraces: vi.fn(() => []),
      getSlowestTraces: vi.fn(() => []),
      getErrorTraces: vi.fn(() => []),
      getStats: vi.fn(),
      getCacheStats: vi.fn(),
      getTrace: vi.fn(() => null),
    };

    registerHttpTraceRoutes(
      {
        get,
        use,
      } as never,
      {
        adminMiddleware: vi.fn() as never,
        getTraceAggregator: () => disabledAggregator as never,
        importTracingUiModule: async () => ({
          addTracingUIRoutes: vi.fn() as never,
        }),
      }
    );

    const disabledHandler = get.mock.calls.find(([path]) => path === '/traces/stats')?.[2];
    const disabledRes = createJsonResponseDouble();
    disabledHandler?.({ query: {} } as never, disabledRes as never);

    expect(disabledRes.body).toEqual({
      enabled: false,
      message: 'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
    });

    const enabledAggregator = {
      ...disabledAggregator,
      isEnabled: vi.fn(() => true),
      getTrace: vi.fn(() => null),
    };
    get.mockClear();
    use.mockClear();

    registerHttpTraceRoutes(
      {
        get,
        use,
      } as never,
      {
        adminMiddleware: vi.fn() as never,
        getTraceAggregator: () => enabledAggregator as never,
        importTracingUiModule: async () => ({
          addTracingUIRoutes: vi.fn() as never,
        }),
      }
    );

    const traceHandler = get.mock.calls.find(([path]) => path === '/traces/:requestId')?.[2];
    const traceRes = createJsonResponseDouble();
    traceHandler?.(
      {
        params: { requestId: 'missing-trace' },
      } as never,
      traceRes as never
    );

    expect(traceRes.status).toHaveBeenCalledWith(404);
    expect(traceRes.body).toEqual({
      error: 'Trace not found',
      requestId: 'missing-trace',
      hint: 'Traces are kept in memory for 5 minutes. Check /traces/recent for available traces.',
    });
  });
});
