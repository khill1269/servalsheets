import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHttpPerUserRateLimitMiddleware,
  deriveHttpRateLimitUserId,
  maskRedisUrl,
  prepareHttpRateLimiter,
} from '../../src/http-server/rate-limit-bootstrap.js';

function createMockResponse() {
  const response = {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: undefined as unknown,
    setHeader: vi.fn((key: string, value: string) => {
      response.headers.set(key, value);
    }),
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };

  return response;
}

describe('http rate limit bootstrap', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('derives stable user ids from bearer tokens and anonymous IPs', () => {
    expect(
      deriveHttpRateLimitUserId({
        authorizationHeader: 'Bearer secret-token',
        ip: '127.0.0.1',
      })
    ).toBe(`user:${createHash('sha256').update('secret-token').digest('hex').substring(0, 16)}`);
    expect(
      deriveHttpRateLimitUserId({
        authorizationHeader: undefined,
        ip: '127.0.0.1',
      })
    ).toBe(`anon:${Buffer.from('127.0.0.1').toString('base64').slice(0, 16)}`);
    expect(deriveHttpRateLimitUserId({})).toBe('anon:unknown');
    expect(maskRedisUrl('redis://user:secret@example.com:6379')).toBe(
      'redis://user:***@example.com:6379'
    );
  });

  it('initializes the HTTP rate limiter with Redis and optional session-store wiring', async () => {
    const connect = vi.fn(async () => undefined);
    const on = vi.fn();
    const redis = { connect, on };
    const limiter = { checkLimit: vi.fn() };
    const createRedisClient = vi.fn(async () => redis);
    const createUserRateLimiter = vi.fn(() => limiter as never);
    const initializeSessionRedis = vi.fn(async () => undefined);
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const bootstrap = prepareHttpRateLimiter({
      redisUrl: 'redis://user:secret@example.com:6379',
      sessionStoreType: 'redis',
      createRedisClient,
      createUserRateLimiter,
      initializeSessionRedis,
      log: log as never,
    });

    await bootstrap.rateLimiterReady;

    expect(createRedisClient).toHaveBeenCalledWith('redis://user:secret@example.com:6379');
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(connect).toHaveBeenCalledOnce();
    expect(createUserRateLimiter).toHaveBeenCalledWith(redis);
    expect(initializeSessionRedis).toHaveBeenCalledWith(redis);
    expect(bootstrap.getUserRateLimiter()).toBe(limiter);
    expect(log.info).toHaveBeenCalledWith('Per-user rate limiter initialized with Redis', {
      redisUrl: 'redis://user:***@example.com:6379',
    });
    expect(log.info).toHaveBeenCalledWith('Session store initialized with Redis backend (HTTP mode)');
  });

  it('degrades cleanly when Redis setup fails or is absent', async () => {
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const failingBootstrap = prepareHttpRateLimiter({
      redisUrl: 'redis://localhost:6379',
      createRedisClient: vi.fn(async () => {
        throw new Error('connect failed');
      }),
      log: log as never,
    });

    await failingBootstrap.rateLimiterReady;
    expect(failingBootstrap.getUserRateLimiter()).toBeNull();
    expect(log.error).toHaveBeenCalledWith('Failed to initialize Redis for rate limiting', {
      error: expect.any(Error),
    });
    expect(log.warn).toHaveBeenCalledWith('Continuing without per-user rate limiting');

    const noRedisLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const noRedisBootstrap = prepareHttpRateLimiter({
      redisUrl: undefined,
      log: noRedisLog as never,
    });
    await noRedisBootstrap.rateLimiterReady;
    expect(noRedisBootstrap.getUserRateLimiter()).toBeNull();
    expect(noRedisLog.debug).toHaveBeenCalledWith(
      'REDIS_URL not set, per-user rate limiting disabled'
    );
  });

  it('adds rate-limit headers for allowed requests and bypasses health checks', async () => {
    const checkLimit = vi.fn(async () => ({
      allowed: true,
      remaining: 7,
      resetAt: new Date('2026-03-23T20:00:00.000Z'),
    }));
    const middleware = createHttpPerUserRateLimitMiddleware({
      getUserRateLimiter: () => ({ checkLimit }),
    });
    const next = vi.fn();
    const healthResponse = createMockResponse();

    await middleware(
      {
        path: '/health',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      healthResponse as never,
      next
    );

    expect(checkLimit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    const response = createMockResponse();
    await middleware(
      {
        path: '/mcp',
        headers: { authorization: 'Bearer access-token' },
        ip: '127.0.0.1',
      } as never,
      response as never,
      next
    );

    expect(checkLimit).toHaveBeenCalledWith(
      `user:${createHash('sha256').update('access-token').digest('hex').substring(0, 16)}`
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-User-Remaining', '7');
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-User-Reset',
      '2026-03-23T20:00:00.000Z'
    );
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('returns 429 for exhausted users and 503 for limiter failures', async () => {
    const deniedResponse = createMockResponse();
    const next = vi.fn();
    const deniedMiddleware = createHttpPerUserRateLimitMiddleware({
      getUserRateLimiter: () => ({
        checkLimit: vi.fn(async () => ({
          allowed: false,
          remaining: 0,
          resetAt: new Date('2026-03-23T20:00:05.000Z'),
          minuteUsage: 10,
          hourUsage: 20,
        })),
      }),
      now: () => Date.parse('2026-03-23T20:00:00.000Z'),
    });

    await deniedMiddleware(
      {
        path: '/mcp',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      deniedResponse as never,
      next
    );

    expect(deniedResponse.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(deniedResponse.status).toHaveBeenCalledWith(429);
    expect(deniedResponse.body).toEqual({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Per-user rate limit exceeded',
      retryAfter: '2026-03-23T20:00:05.000Z',
      remaining: 0,
      minuteUsage: 10,
      hourUsage: 20,
    });
    expect(next).not.toHaveBeenCalled();

    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const failedResponse = createMockResponse();
    const failedMiddleware = createHttpPerUserRateLimitMiddleware({
      getUserRateLimiter: () => ({
        checkLimit: vi.fn(async () => {
          throw new Error('redis offline');
        }),
      }),
      log: log as never,
    });

    await failedMiddleware(
      {
        path: '/mcp',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      failedResponse as never,
      next
    );

    expect(log.error).toHaveBeenCalledWith('Per-user rate limit check failed', {
      error: expect.any(Error),
    });
    expect(failedResponse.status).toHaveBeenCalledWith(503);
    expect(failedResponse.body).toEqual({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Rate limiter temporarily unavailable',
      },
    });
  });
});
