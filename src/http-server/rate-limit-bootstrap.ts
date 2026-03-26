import {
  createUserRateLimiterFromEnv,
  type UserRateLimiter,
} from '../services/user-rate-limiter.js';
import { logger as defaultLogger } from '../utils/logger.js';
import {
  createHttpPerUserRateLimitMiddleware as createHttpPerUserRateLimitMiddlewareImpl,
  deriveHttpRateLimitUserId,
  maskRedisUrl,
  prepareHttpRateLimiter as prepareHttpRateLimiterImpl,
  type HttpRateLimiterBootstrap,
  type HttpRateLimiterLogger,
  type RedisClientLike,
  type UserRateLimiterLike,
} from '../../packages/mcp-http/dist/rate-limit-bootstrap.js';

export type {
  HttpRateLimiterBootstrap,
  HttpRateLimiterLogger,
  RedisClientLike,
  UserRateLimiterLike,
};

export { deriveHttpRateLimitUserId, maskRedisUrl };

async function defaultInitializeSessionRedis(redis: RedisClientLike): Promise<void> {
  const { initSessionRedis } = await import('../services/session-context.js');
  initSessionRedis(redis as never);
}

export function createHttpPerUserRateLimitMiddleware(params: {
  getUserRateLimiter: () => Pick<UserRateLimiter, 'checkLimit'> | null;
  log?: typeof defaultLogger;
  now?: () => number;
}): ReturnType<typeof createHttpPerUserRateLimitMiddlewareImpl> {
  return createHttpPerUserRateLimitMiddlewareImpl({
    getUserRateLimiter: params.getUserRateLimiter,
    log: (params.log ?? defaultLogger) as HttpRateLimiterLogger,
    now: params.now,
  });
}

export function prepareHttpRateLimiter(
  params: {
    redisUrl?: string;
    sessionStoreType?: string;
    createRedisClient?: (redisUrl: string) => Promise<RedisClientLike>;
    createUserRateLimiter?: (redis: RedisClientLike) => UserRateLimiter;
    initializeSessionRedis?: (redis: RedisClientLike) => Promise<void>;
    log?: typeof defaultLogger;
    now?: () => number;
  } = {}
): HttpRateLimiterBootstrap<UserRateLimiter> {
  return prepareHttpRateLimiterImpl<UserRateLimiter>({
    redisUrl: params.redisUrl,
    sessionStoreType: params.sessionStoreType,
    createRedisClient: params.createRedisClient,
    createUserRateLimiter:
      params.createUserRateLimiter ?? ((redis) => createUserRateLimiterFromEnv(redis)),
    initializeSessionRedis: params.initializeSessionRedis ?? defaultInitializeSessionRedis,
    log: (params.log ?? defaultLogger) as HttpRateLimiterLogger,
    now: params.now,
  });
}
