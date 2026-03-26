import type { Request, Response } from 'express';

export interface HttpTraceRoutesLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface TraceAggregatorLike {
  isEnabled(): boolean;
  searchTraces(filters: Record<string, unknown>): unknown[];
  getRecentTraces(limit: number): unknown[];
  getSlowestTraces(limit: number): unknown[];
  getErrorTraces(limit: number): unknown[];
  getStats(): {
    totalTraces: number;
    successCount: number;
    errorCount: number;
    averageDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    byTool: Record<string, { count: number; averageDuration: number; errorRate: number }>;
    byError: Record<string, unknown>;
  };
  getCacheStats(): unknown;
  getTrace(requestId: string): unknown;
}

export interface RegisterHttpTraceRoutesOptions<TApp, TAdminMiddleware = unknown> {
  readonly app: TApp;
  readonly adminMiddleware: TAdminMiddleware;
  readonly getTraceAggregator: () => TraceAggregatorLike;
  readonly importTracingUiModule: () => Promise<{
    addTracingUIRoutes(app: TApp): void;
  }>;
  readonly log?: HttpTraceRoutesLogger;
}

const defaultLogger: HttpTraceRoutesLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

const TRACE_DISABLED_MESSAGE =
  'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.';

function respondWhenTraceAggregationDisabled(
  aggregator: TraceAggregatorLike,
  res: Response
): boolean {
  if (!aggregator.isEnabled()) {
    res.json({
      enabled: false,
      message: TRACE_DISABLED_MESSAGE,
    });
    return true;
  }

  return false;
}

export function registerHttpTraceRoutes<
  TApp extends Pick<
    {
      get(path: string, ...handlers: unknown[]): void;
      use(...args: unknown[]): void;
    },
    'get' | 'use'
  >,
  TAdminMiddleware,
>(options: RegisterHttpTraceRoutesOptions<TApp, TAdminMiddleware>): void {
  const {
    app,
    adminMiddleware,
    getTraceAggregator,
    importTracingUiModule,
    log = defaultLogger,
  } = options;

  app.get('/traces', adminMiddleware, (req: Request, res: Response) => {
    try {
      const aggregator = getTraceAggregator();
      if (respondWhenTraceAggregationDisabled(aggregator, res)) {
        return;
      }

      const filters: Record<string, unknown> = {};
      if (req.query['tool']) filters['tool'] = req.query['tool'] as string;
      if (req.query['action']) filters['action'] = req.query['action'] as string;
      if (req.query['errorCode']) filters['errorCode'] = req.query['errorCode'] as string;
      if (req.query['success']) filters['success'] = req.query['success'] === 'true';
      if (req.query['minDuration']) {
        const val = Number.parseInt(req.query['minDuration'] as string, 10);
        if (!Number.isNaN(val)) filters['minDuration'] = Math.max(val, 0);
      }
      if (req.query['maxDuration']) {
        const val = Number.parseInt(req.query['maxDuration'] as string, 10);
        if (!Number.isNaN(val)) filters['maxDuration'] = Math.max(val, 0);
      }
      if (req.query['startTime']) {
        const val = Number.parseInt(req.query['startTime'] as string, 10);
        if (!Number.isNaN(val)) filters['startTime'] = Math.max(val, 0);
      }
      if (req.query['endTime']) {
        const val = Number.parseInt(req.query['endTime'] as string, 10);
        if (!Number.isNaN(val)) filters['endTime'] = Math.max(val, 0);
      }

      const rawLimit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 100;
      const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 100 : rawLimit, 1), 1000);
      const traces = aggregator.searchTraces(filters);

      res.json({
        count: traces.length,
        traces: traces.slice(0, limit),
        filters,
        _links: {
          self: '/traces',
          recent: '/traces/recent',
          slow: '/traces/slow',
          errors: '/traces/errors',
          stats: '/traces/stats',
        },
      });
    } catch (error) {
      log.error('Failed to search traces', { error });
      res.status(500).json({ error: 'Failed to search traces' });
    }
  });

  app.get('/traces/recent', adminMiddleware, (req: Request, res: Response) => {
    try {
      const aggregator = getTraceAggregator();
      if (respondWhenTraceAggregationDisabled(aggregator, res)) {
        return;
      }

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 100;
      const traces = aggregator.getRecentTraces(limit);

      res.json({
        count: traces.length,
        traces,
      });
    } catch (error) {
      log.error('Failed to get recent traces', { error });
      res.status(500).json({ error: 'Failed to get recent traces' });
    }
  });

  app.get('/traces/slow', adminMiddleware, (req: Request, res: Response) => {
    try {
      const aggregator = getTraceAggregator();
      if (respondWhenTraceAggregationDisabled(aggregator, res)) {
        return;
      }

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 10;
      const traces = aggregator.getSlowestTraces(limit);

      res.json({
        count: traces.length,
        traces,
      });
    } catch (error) {
      log.error('Failed to get slowest traces', { error });
      res.status(500).json({ error: 'Failed to get slowest traces' });
    }
  });

  app.get('/traces/errors', adminMiddleware, (req: Request, res: Response) => {
    try {
      const aggregator = getTraceAggregator();
      if (respondWhenTraceAggregationDisabled(aggregator, res)) {
        return;
      }

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 100;
      const traces = aggregator.getErrorTraces(limit);

      res.json({
        count: traces.length,
        traces,
      });
    } catch (error) {
      log.error('Failed to get error traces', { error });
      res.status(500).json({ error: 'Failed to get error traces' });
    }
  });

  app.get('/traces/stats', adminMiddleware, (_req: Request, res: Response) => {
    try {
      const aggregator = getTraceAggregator();
      if (respondWhenTraceAggregationDisabled(aggregator, res)) {
        return;
      }

      const stats = aggregator.getStats();
      const cacheStats = aggregator.getCacheStats();

      res.json({
        timestamp: new Date().toISOString(),
        enabled: true,
        cache: cacheStats,
        statistics: {
          total: stats.totalTraces,
          success: stats.successCount,
          errors: stats.errorCount,
          errorRate:
            stats.totalTraces > 0 ? ((stats.errorCount / stats.totalTraces) * 100).toFixed(2) + '%' : '0%',
          averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
          p50Duration: `${stats.p50Duration.toFixed(2)}ms`,
          p95Duration: `${stats.p95Duration.toFixed(2)}ms`,
          p99Duration: `${stats.p99Duration.toFixed(2)}ms`,
        },
        byTool: Object.entries(stats.byTool).map(([tool, toolStats]) => ({
          tool,
          count: toolStats.count,
          averageDuration: `${toolStats.averageDuration.toFixed(2)}ms`,
          errorRate: `${(toolStats.errorRate * 100).toFixed(2)}%`,
        })),
        byError: stats.byError,
      });
    } catch (error) {
      log.error('Failed to get trace stats', { error });
      res.status(500).json({ error: 'Failed to get trace stats' });
    }
  });

  app.get('/traces/:requestId', adminMiddleware, (req: Request, res: Response) => {
    try {
      const aggregator = getTraceAggregator();
      if (respondWhenTraceAggregationDisabled(aggregator, res)) {
        return;
      }

      const requestId = req.params['requestId'] as string;
      const trace = aggregator.getTrace(requestId);

      if (!trace) {
        res.status(404).json({
          error: 'Trace not found',
          requestId,
          hint: 'Traces are kept in memory for 5 minutes. Check /traces/recent for available traces.',
        });
        return;
      }

      res.json(trace);
    } catch (error) {
      log.error('Failed to get trace', { error, requestId: req.params['requestId'] });
      res.status(500).json({ error: 'Failed to get trace' });
    }
  });

  app.use('/ui/tracing', adminMiddleware);
  app.use('/traces/stream', adminMiddleware);

  try {
    void importTracingUiModule()
      .then(({ addTracingUIRoutes }) => {
        addTracingUIRoutes(app);
        log.info('Tracing UI routes loaded successfully');
      })
      .catch((error) => {
        log.warn('Failed to load tracing UI routes', { error });
      });
  } catch (error) {
    log.warn('Failed to initialize tracing UI', { error });
  }
}
