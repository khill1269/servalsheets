import { createHash } from 'crypto';
import type { Request, Response } from 'express';

export interface HttpStatsRoutesLogger {
  error(message: string, meta?: unknown): void;
}

export interface UserQuotaStatsLike {
  readonly minuteUsage: number;
  readonly minuteLimit: number;
  readonly minuteRemaining: number;
  readonly hourUsage: number;
  readonly hourLimit: number;
  readonly hourRemaining: number;
}

export interface StatsUserRateLimiterLike {
  getUsage(userId: string): Promise<UserQuotaStatsLike>;
}

export interface ProcessMemoryUsageLike {
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly rss: number;
  readonly external: number;
  readonly arrayBuffers: number;
}

export interface RegisterHttpStatsRoutesOptions<TApp, TAdminMiddleware = unknown> {
  readonly app: TApp;
  readonly adminMiddleware: TAdminMiddleware;
  readonly getSessionCount: () => number;
  readonly getUserRateLimiter: () => StatsUserRateLimiterLike | null;
  readonly getCacheStats: () => Record<string, unknown> | null;
  readonly getDeduplicationStats: () => Record<string, unknown> | null;
  readonly getConnectionStats: () => Record<string, unknown> | null;
  readonly getTracingStats: () => Record<string, unknown> | null;
  readonly getCircuitBreakerStats: () => Record<string, unknown>;
  readonly getUptimeSeconds?: () => number;
  readonly getMemoryUsage?: () => ProcessMemoryUsageLike;
  readonly createUserIdHash?: (token: string) => string;
  readonly log?: HttpStatsRoutesLogger;
}

const defaultLogger: HttpStatsRoutesLogger = {
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

function calculateTotalSavings(
  dedupStats: Record<string, unknown>,
  cacheStats: Record<string, unknown>
): string {
  const dedupRate = (dedupStats['deduplicationRate'] as number) / 100;
  const cacheRate = (cacheStats['hitRate'] as number) / 100;
  const combinedSavings = (dedupRate + (1 - dedupRate) * cacheRate) * 100;
  return `~${combinedSavings.toFixed(1)}%`;
}

function defaultCreateUserIdHash(token: string): string {
  return createHash('sha256').update(token).digest('hex').substring(0, 16);
}

export function registerHttpStatsRoutes<
  TApp extends Pick<
    {
      get(path: string, ...handlers: unknown[]): void;
    },
    'get'
  >,
  TAdminMiddleware,
>(options: RegisterHttpStatsRoutesOptions<TApp, TAdminMiddleware>): void {
  const {
    app,
    adminMiddleware,
    getSessionCount,
    getUserRateLimiter,
    getCacheStats,
    getDeduplicationStats,
    getConnectionStats,
    getTracingStats,
    getCircuitBreakerStats,
    getUptimeSeconds = () => process.uptime(),
    getMemoryUsage = () => process.memoryUsage(),
    createUserIdHash = defaultCreateUserIdHash,
    log = defaultLogger,
  } = options;

  app.get('/stats', adminMiddleware, async (req: Request, res: Response) => {
    const cacheStats = getCacheStats();
    const dedupStats = getDeduplicationStats();
    const connStats = getConnectionStats();
    const tracingStats = getTracingStats();
    const memUsage = getMemoryUsage();
    const uptimeSeconds = getUptimeSeconds();

    let userQuota: { enabled: boolean; error?: string } | (UserQuotaStatsLike & { enabled: true }) | null =
      null;
    const userRateLimiter = getUserRateLimiter();
    if (userRateLimiter) {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const userId = token ? `user:${createUserIdHash(token)}` : 'anonymous';

        const quotaStats = await userRateLimiter.getUsage(userId);
        userQuota = {
          enabled: true,
          minuteUsage: quotaStats.minuteUsage,
          minuteLimit: quotaStats.minuteLimit,
          minuteRemaining: quotaStats.minuteRemaining,
          hourUsage: quotaStats.hourUsage,
          hourLimit: quotaStats.hourLimit,
          hourRemaining: quotaStats.hourRemaining,
        };
      } catch (error) {
        log.error('Failed to get per-user quota stats', { error });
        userQuota = { enabled: false, error: 'Failed to fetch quota' };
      }
    }

    res.json({
      uptime: {
        seconds: Math.floor(uptimeSeconds),
        formatted: formatUptime(uptimeSeconds),
      },
      cache: cacheStats
        ? {
            enabled: true,
            totalEntries: cacheStats['totalEntries'] as number,
            totalSizeMB: parseFloat(((cacheStats['totalSize'] as number) / 1024 / 1024).toFixed(2)),
            hits: cacheStats['hits'] as number,
            misses: cacheStats['misses'] as number,
            hitRate: parseFloat((cacheStats['hitRate'] as number).toFixed(2)),
            byNamespace: cacheStats['byNamespace'] as Record<string, unknown>,
            oldestEntry: cacheStats['oldestEntry']
              ? new Date(cacheStats['oldestEntry'] as number).toISOString()
              : null,
            newestEntry: cacheStats['newestEntry']
              ? new Date(cacheStats['newestEntry'] as number).toISOString()
              : null,
          }
        : { enabled: false },
      deduplication: dedupStats
        ? {
            enabled: true,
            totalRequests: dedupStats['totalRequests'] as number,
            deduplicatedRequests: dedupStats['deduplicatedRequests'] as number,
            savedRequests: dedupStats['savedRequests'] as number,
            deduplicationRate: parseFloat((dedupStats['deduplicationRate'] as number).toFixed(2)),
            pendingCount: dedupStats['pendingCount'] as number,
            oldestRequestAgeMs: dedupStats['oldestRequestAge'] as number,
          }
        : { enabled: false },
      connection: connStats
        ? {
            status: connStats['status'] as string,
            uptimeSeconds: connStats['uptimeSeconds'] as number,
            totalHeartbeats: connStats['totalHeartbeats'] as number,
            disconnectWarnings: connStats['disconnectWarnings'] as number,
            timeSinceLastActivityMs: connStats['timeSinceLastActivity'] as number,
            lastActivity: new Date(connStats['lastActivity'] as number).toISOString(),
          }
        : null,
      tracing: tracingStats
        ? {
            totalSpans: tracingStats['totalSpans'] as number,
            averageDurationMs: parseFloat((tracingStats['averageDuration'] as number).toFixed(2)),
            spansByKind: tracingStats['spansByKind'] as Record<string, unknown>,
            spansByStatus: tracingStats['spansByStatus'] as Record<string, unknown>,
          }
        : null,
      memory: {
        heapUsedMB: parseFloat((memUsage.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMB: parseFloat((memUsage.heapTotal / 1024 / 1024).toFixed(2)),
        rssMB: parseFloat((memUsage.rss / 1024 / 1024).toFixed(2)),
        externalMB: parseFloat((memUsage.external / 1024 / 1024).toFixed(2)),
        arrayBuffersMB: parseFloat((memUsage.arrayBuffers / 1024 / 1024).toFixed(2)),
      },
      performance: {
        apiCallReduction:
          dedupStats && cacheStats
            ? {
                deduplicationSavings: `${(dedupStats['deduplicationRate'] as number).toFixed(1)}%`,
                cacheSavings: `${(cacheStats['hitRate'] as number).toFixed(1)}%`,
                estimatedTotalSavings: calculateTotalSavings(dedupStats, cacheStats),
              }
            : null,
      },
      sessions: {
        active: getSessionCount(),
      },
      userQuota: userQuota || { enabled: false },
      circuitBreakers: getCircuitBreakerStats(),
    });
  });
}
