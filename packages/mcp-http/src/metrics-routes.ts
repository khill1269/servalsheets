import type { Request, Response } from 'express';

export interface HttpMetricsRoutesLogger {
  error(message: string, meta?: unknown): void;
}

export interface CircuitBreakerEntryLike {
  readonly name: string;
  readonly description?: string;
  readonly breaker: {
    getStats(): {
      state: string;
      failureCount: number;
      successCount: number;
      totalRequests: number;
      lastFailure?: unknown;
      nextAttempt?: unknown;
      fallbackUsageCount: number;
      registeredFallbacks: number;
    };
  };
}

export interface RegisterHttpMetricsRoutesOptions<TApp, TAdminMiddleware = unknown, TMetricsHandler = unknown> {
  readonly app: TApp;
  readonly adminMiddleware: TAdminMiddleware;
  readonly metricsHandler: TMetricsHandler;
  readonly getCircuitBreakers: () => CircuitBreakerEntryLike[];
  readonly log?: HttpMetricsRoutesLogger;
}

const defaultLogger: HttpMetricsRoutesLogger = {
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function registerHttpMetricsRoutes<
  TApp extends Pick<
    {
      get(path: string, ...handlers: unknown[]): void;
    },
    'get'
  >,
  TAdminMiddleware,
  TMetricsHandler,
>(options: RegisterHttpMetricsRoutesOptions<TApp, TAdminMiddleware, TMetricsHandler>): void {
  const {
    app,
    adminMiddleware,
    metricsHandler,
    getCircuitBreakers,
    log = defaultLogger,
  } = options;

  app.get('/metrics', adminMiddleware, metricsHandler);

  app.get('/metrics/circuit-breakers', adminMiddleware, async (_req: Request, res: Response) => {
    try {
      const metrics = getCircuitBreakers().map((entry) => {
        const stats = entry.breaker.getStats();
        return {
          name: entry.name,
          description: entry.description,
          state: stats.state,
          isOpen: stats.state === 'open',
          isHalfOpen: stats.state === 'half_open',
          isClosed: stats.state === 'closed',
          failureCount: stats.failureCount,
          successCount: stats.successCount,
          totalRequests: stats.totalRequests,
          lastFailure: stats.lastFailure,
          nextAttempt: stats.nextAttempt,
          fallbackUsageCount: stats.fallbackUsageCount,
          registeredFallbacks: stats.registeredFallbacks,
        };
      });

      res.json({
        timestamp: new Date().toISOString(),
        circuitBreakers: metrics,
        summary: {
          total: metrics.length,
          open: metrics.filter((metric) => metric.isOpen).length,
          halfOpen: metrics.filter((metric) => metric.isHalfOpen).length,
          closed: metrics.filter((metric) => metric.isClosed).length,
        },
      });
    } catch (error) {
      log.error('Failed to fetch circuit breaker metrics', { error });
      res.status(500).json({ error: 'Failed to fetch circuit breaker metrics' });
    }
  });
}
