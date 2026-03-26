import { createHash } from 'crypto';
import type { RequestHandler } from 'express';

export interface HttpRateLimiterLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export type RedisClientLike = {
  connect(): Promise<unknown>;
  on?: (event: 'error', listener: (error: unknown) => void) => unknown;
};

export interface UserRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  minuteUsage?: number;
  hourUsage?: number;
}

export interface UserRateLimiterLike {
  checkLimit(userId: string): Promise<UserRateLimitResult>;
}

type UserRateLimitChecker = Pick<UserRateLimiterLike, 'checkLimit'>;

const defaultLogger: HttpRateLimiterLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
  debug(message: string, meta?: unknown) {
    console.debug(message, meta);
  },
};

export interface HttpRateLimiterBootstrap<TRateLimiter extends UserRateLimiterLike> {
  readonly rateLimiterReady: Promise<void>;
  readonly getUserRateLimiter: () => TRateLimiter | null;
  readonly middleware: RequestHandler;
}

export function deriveHttpRateLimitUserId(params: {
  authorizationHeader?: string | null;
  ip?: string;
}): string {
  const token = params.authorizationHeader?.startsWith('Bearer ')
    ? params.authorizationHeader.slice(7)
    : null;

  if (token) {
    return `user:${createHash('sha256').update(token).digest('hex').substring(0, 16)}`;
  }

  return params.ip
    ? `anon:${Buffer.from(params.ip).toString('base64').slice(0, 16)}`
    : 'anon:unknown';
}

export function maskRedisUrl(redisUrl: string): string {
  return redisUrl.replace(/:[^:]*@/, ':***@');
}

export function createHttpPerUserRateLimitMiddleware(params: {
  getUserRateLimiter: () => UserRateLimitChecker | null;
  log?: HttpRateLimiterLogger;
  now?: () => number;
}): RequestHandler {
  const { getUserRateLimiter, log = defaultLogger, now = Date.now } = params;

  return async (req, res, next) => {
    if (req.path.startsWith('/health')) {
      return next();
    }

    const userRateLimiter = getUserRateLimiter();
    if (!userRateLimiter) {
      return next();
    }

    try {
      const userId = deriveHttpRateLimitUserId({
        authorizationHeader: req.headers.authorization,
        ip: req.ip,
      });
      const limitCheck = await userRateLimiter.checkLimit(userId);

      if (!limitCheck.allowed) {
        const retryAfterSecs = Math.ceil((limitCheck.resetAt.getTime() - now()) / 1000);
        res.setHeader('Retry-After', retryAfterSecs.toString());
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Per-user rate limit exceeded',
          retryAfter: limitCheck.resetAt.toISOString(),
          remaining: 0,
          minuteUsage: limitCheck.minuteUsage,
          hourUsage: limitCheck.hourUsage,
        });
        return;
      }

      res.setHeader('X-RateLimit-User-Remaining', limitCheck.remaining.toString());
      res.setHeader('X-RateLimit-User-Reset', limitCheck.resetAt.toISOString());
      next();
    } catch (error) {
      log.error('Per-user rate limit check failed', { error });
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Rate limiter temporarily unavailable' },
      });
      return;
    }
  };
}

async function defaultCreateRedisClient(redisUrl: string): Promise<RedisClientLike> {
  const { createClient } = await import('redis');
  return createClient({ url: redisUrl });
}

async function defaultInitializeSessionRedis(_redis: RedisClientLike): Promise<void> {
  return;
}

function defaultCreateUserRateLimiter(_redis: RedisClientLike): never {
  throw new Error(
    'createUserRateLimiter must be provided when using mcp-http rate-limit-bootstrap'
  );
}

export function prepareHttpRateLimiter<TRateLimiter extends UserRateLimiterLike>(params: {
  redisUrl?: string;
  sessionStoreType?: string;
  createRedisClient?: (redisUrl: string) => Promise<RedisClientLike>;
  createUserRateLimiter?: (redis: RedisClientLike) => TRateLimiter;
  initializeSessionRedis?: (redis: RedisClientLike) => Promise<void>;
  log?: HttpRateLimiterLogger;
  now?: () => number;
} = {}): HttpRateLimiterBootstrap<TRateLimiter> {
  const {
    redisUrl = process.env['REDIS_URL'],
    sessionStoreType = process.env['SESSION_STORE_TYPE'],
    createRedisClient = defaultCreateRedisClient,
    createUserRateLimiter = defaultCreateUserRateLimiter as (
      redis: RedisClientLike
    ) => TRateLimiter,
    initializeSessionRedis = defaultInitializeSessionRedis,
    log = defaultLogger,
    now,
  } = params;

  let userRateLimiter: TRateLimiter | null = null;

  const rateLimiterReady = redisUrl
    ? (async () => {
        try {
          const redis = await createRedisClient(redisUrl);
          redis.on?.('error', (error) => {
            log.error('Redis connection error', { error });
          });
          await redis.connect();

          userRateLimiter = createUserRateLimiter(redis);
          log.info('Per-user rate limiter initialized with Redis', {
            redisUrl: maskRedisUrl(redisUrl),
          });

          if (sessionStoreType === 'redis') {
            await initializeSessionRedis(redis);
            log.info('Session store initialized with Redis backend (HTTP mode)');
          }
        } catch (error) {
          log.error('Failed to initialize Redis for rate limiting', { error });
          log.warn('Continuing without per-user rate limiting');
        }
      })()
    : Promise.resolve();

  if (!redisUrl) {
    log.debug('REDIS_URL not set, per-user rate limiting disabled');
  }

  return {
    rateLimiterReady,
    getUserRateLimiter: () => userRateLimiter,
    middleware: createHttpPerUserRateLimitMiddleware({
      getUserRateLimiter: () => userRateLimiter,
      log,
      now,
    }),
  };
}
