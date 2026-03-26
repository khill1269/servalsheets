import type { Application, RequestHandler } from 'express';
import {
  registerHttpStatsRoutes as registerHttpStatsRoutesImpl,
  type HttpStatsRoutesLogger,
  type ProcessMemoryUsageLike,
  type RegisterHttpStatsRoutesOptions as PackagedRegisterHttpStatsRoutesOptions,
  type StatsUserRateLimiterLike,
} from '../../packages/mcp-http/dist/stats-routes.js';
import { requireAdminAuth } from '../admin/index.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import type { UserRateLimiter } from '../services/user-rate-limiter.js';
import {
  getCacheStats,
  getConnectionStats,
  getDeduplicationStats,
  getTracingStats,
} from '../startup/lifecycle.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type RegisterHttpStatsRoutesOptions = Omit<
  PackagedRegisterHttpStatsRoutesOptions<Pick<Application, 'get'>, RequestHandler>,
  | 'app'
  | 'adminMiddleware'
  | 'getCacheStats'
  | 'getDeduplicationStats'
  | 'getConnectionStats'
  | 'getTracingStats'
  | 'getCircuitBreakerStats'
> & {
  readonly adminMiddleware?: RequestHandler;
  readonly getSessionCount: () => number;
  readonly getUserRateLimiter: () =>
    | UserRateLimiter
    | Pick<StatsUserRateLimiterLike, 'getUsage'>
    | null;
  readonly getCacheStats?: PackagedRegisterHttpStatsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler
  >['getCacheStats'];
  readonly getDeduplicationStats?: PackagedRegisterHttpStatsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler
  >['getDeduplicationStats'];
  readonly getConnectionStats?: PackagedRegisterHttpStatsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler
  >['getConnectionStats'];
  readonly getTracingStats?: PackagedRegisterHttpStatsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler
  >['getTracingStats'];
  readonly getCircuitBreakerStats?: PackagedRegisterHttpStatsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler
  >['getCircuitBreakerStats'];
  readonly getUptimeSeconds?: () => number;
  readonly getMemoryUsage?: () => ProcessMemoryUsageLike;
  readonly createUserIdHash?: (token: string) => string;
  readonly log?: HttpStatsRoutesLogger;
};

export function registerHttpStatsRoutes(
  app: Pick<Application, 'get'>,
  options: RegisterHttpStatsRoutesOptions
): void {
  registerHttpStatsRoutesImpl({
    app,
    adminMiddleware: options.adminMiddleware ?? requireAdminAuth,
    getSessionCount: options.getSessionCount,
    getUserRateLimiter: options.getUserRateLimiter as () => StatsUserRateLimiterLike | null,
    getCacheStats:
      options.getCacheStats ??
      ((() => getCacheStats() as Record<string, unknown> | null) as () => Record<
        string,
        unknown
      > | null),
    getDeduplicationStats:
      options.getDeduplicationStats ??
      ((() => getDeduplicationStats() as Record<string, unknown> | null) as () => Record<
        string,
        unknown
      > | null),
    getConnectionStats:
      options.getConnectionStats ??
      ((() => getConnectionStats() as Record<string, unknown> | null) as () => Record<
        string,
        unknown
      > | null),
    getTracingStats:
      options.getTracingStats ??
      ((() => getTracingStats() as Record<string, unknown> | null) as () => Record<
        string,
        unknown
      > | null),
    getCircuitBreakerStats:
      options.getCircuitBreakerStats ?? (() => circuitBreakerRegistry.getAllStats()),
    getUptimeSeconds: options.getUptimeSeconds,
    getMemoryUsage: options.getMemoryUsage,
    createUserIdHash: options.createUserIdHash,
    log: options.log ?? defaultLogger,
  });
}
