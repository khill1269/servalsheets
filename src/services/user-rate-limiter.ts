/**
 * ServalSheets - Per-User Rate Limiting with Redis
 *
 * Tracks API quota per user (identified by token hash) using Redis.
 * Implements sliding window algorithm with burst allowance.
 *
 * Features:
 * - Per-user request tracking (minute and hour windows)
 * - Burst allowance for temporary spikes
 * - Graceful degradation when Redis unavailable
 * - Automatic TTL management
 *
 * Usage:
 * ```typescript
 * import { UserRateLimiter } from './user-rate-limiter.js';
 * import { createClient } from 'redis';
 *
 * const redis = await createClient({ url: process.env.REDIS_URL }).connect();
 * const limiter = new UserRateLimiter(redis, {
 *   requestsPerMinute: 100,
 *   requestsPerHour: 5000,
 *   burstAllowance: 20,
 * });
 *
 * const result = await limiter.checkLimit(userId);
 * if (!result.allowed) {
 *   // Return 429 Too Many Requests
 * }
 * ```
 *
 * @category Services
 */

import { logger } from '../utils/logger.js';

// Use any for Redis client to avoid type conflicts between redis versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

/**
 * User rate limit configuration
 */
export interface UserRateLimitConfig {
  /** Maximum requests per minute (default: 100) */
  requestsPerMinute: number;
  /** Maximum requests per hour (default: 5000) */
  requestsPerHour: number;
  /** Extra requests allowed in burst (default: 20) */
  burstAllowance: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** When the rate limit resets */
  resetAt: Date;
  /** Current minute usage */
  minuteUsage?: number;
  /** Current hour usage */
  hourUsage?: number;
}

/**
 * User quota statistics
 */
export interface UserQuotaStats {
  /** Requests in current minute window */
  minuteUsage: number;
  /** Minute limit */
  minuteLimit: number;
  /** Requests in current hour window */
  hourUsage: number;
  /** Hour limit */
  hourLimit: number;
  /** Remaining requests in minute */
  minuteRemaining: number;
  /** Remaining requests in hour */
  hourRemaining: number;
}

/**
 * Per-user rate limiter with Redis backend
 *
 * Uses sliding window counters stored in Redis:
 * - `rate:{userId}:minute:{timestamp}` - Minute window counter
 * - `rate:{userId}:hour:{timestamp}` - Hour window counter
 *
 * TTL ensures automatic cleanup of old counters.
 */
export class UserRateLimiter {
  private redis: RedisClient | null;
  private config: UserRateLimitConfig;

  /**
   * Create a user rate limiter
   *
   * @param redis - Redis client (null = no rate limiting, allows all requests)
   * @param config - Rate limit configuration
   */
  constructor(redis: RedisClient | null, config: UserRateLimitConfig) {
    this.redis = redis;
    this.config = config;

    logger.info('User rate limiter initialized', {
      requestsPerMinute: config.requestsPerMinute,
      requestsPerHour: config.requestsPerHour,
      burstAllowance: config.burstAllowance,
      redisAvailable: redis !== null,
    });
  }

  /**
   * Check if user has exceeded rate limit
   *
   * @param userId - User identifier (e.g., token hash)
   * @returns Rate limit check result
   */
  async checkLimit(userId: string): Promise<RateLimitResult> {
    if (!this.redis) {
      // No Redis - allow all requests (graceful degradation)
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 60000),
      };
    }

    try {
      const now = Date.now();
      const minuteWindow = Math.floor(now / 60000); // 1-minute window
      const hourWindow = Math.floor(now / 3600000); // 1-hour window

      const minuteKey = `rate:${userId}:minute:${minuteWindow}`;
      const hourKey = `rate:${userId}:hour:${hourWindow}`;

      // Increment counters atomically
      const [minuteCount, hourCount] = await Promise.all([
        this.redis.incr(minuteKey),
        this.redis.incr(hourKey),
      ]);

      // Set TTL on first increment (idempotent)
      if (minuteCount === 1) {
        await this.redis.expire(minuteKey, 120); // 2 minutes (allow some clock skew)
      }
      if (hourCount === 1) {
        await this.redis.expire(hourKey, 7200); // 2 hours
      }

      // Check limits (burst allowance applies to minute limit only)
      const minuteLimit = this.config.requestsPerMinute + this.config.burstAllowance;
      const hourLimit = this.config.requestsPerHour;

      const minuteAllowed = minuteCount <= minuteLimit;
      const hourAllowed = hourCount <= hourLimit;

      const allowed = minuteAllowed && hourAllowed;

      // Calculate when limit resets (next minute boundary)
      const resetAt = new Date((minuteWindow + 1) * 60000);

      // Calculate remaining quota
      const remaining = Math.max(0, Math.min(minuteLimit - minuteCount, hourLimit - hourCount));

      if (!allowed) {
        logger.warn('User rate limit exceeded', {
          userId: userId.substring(0, 16) + '...',
          minuteCount,
          minuteLimit,
          hourCount,
          hourLimit,
          resetAt,
        });
      }

      return {
        allowed,
        remaining,
        resetAt,
        minuteUsage: minuteCount,
        hourUsage: hourCount,
      };
    } catch (error) {
      logger.error('Rate limit check failed', { userId, error });

      // On error, allow request (fail open for availability)
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 60000),
      };
    }
  }

  /**
   * Get current usage statistics for a user
   *
   * @param userId - User identifier
   * @returns User quota statistics
   */
  async getUsage(userId: string): Promise<UserQuotaStats> {
    if (!this.redis) {
      return {
        minuteUsage: 0,
        minuteLimit: this.config.requestsPerMinute,
        hourUsage: 0,
        hourLimit: this.config.requestsPerHour,
        minuteRemaining: this.config.requestsPerMinute,
        hourRemaining: this.config.requestsPerHour,
      };
    }

    try {
      const now = Date.now();
      const minuteWindow = Math.floor(now / 60000);
      const hourWindow = Math.floor(now / 3600000);

      const minuteKey = `rate:${userId}:minute:${minuteWindow}`;
      const hourKey = `rate:${userId}:hour:${hourWindow}`;

      const [minuteUsage, hourUsage] = await Promise.all([
        this.redis.get(minuteKey).then((v: string | null) => Number.parseInt(v || '0', 10)),
        this.redis.get(hourKey).then((v: string | null) => Number.parseInt(v || '0', 10)),
      ]);

      return {
        minuteUsage,
        minuteLimit: this.config.requestsPerMinute,
        hourUsage,
        hourLimit: this.config.requestsPerHour,
        minuteRemaining: Math.max(0, this.config.requestsPerMinute - minuteUsage),
        hourRemaining: Math.max(0, this.config.requestsPerHour - hourUsage),
      };
    } catch (error) {
      logger.error('Failed to get rate limit usage', { userId, error });

      return {
        minuteUsage: 0,
        minuteLimit: this.config.requestsPerMinute,
        hourUsage: 0,
        hourLimit: this.config.requestsPerHour,
        minuteRemaining: this.config.requestsPerMinute,
        hourRemaining: this.config.requestsPerHour,
      };
    }
  }

  /**
   * Reset rate limit counters for a user (admin operation)
   *
   * @param userId - User identifier
   */
  async resetUser(userId: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const now = Date.now();
      const minuteWindow = Math.floor(now / 60000);
      const hourWindow = Math.floor(now / 3600000);

      const minuteKey = `rate:${userId}:minute:${minuteWindow}`;
      const hourKey = `rate:${userId}:hour:${hourWindow}`;

      await Promise.all([this.redis.del(minuteKey), this.redis.del(hourKey)]);

      logger.info('User rate limit counters reset', { userId });
    } catch (error) {
      logger.error('Failed to reset user rate limit', { userId, error });
    }
  }

  /**
   * Get global rate limit statistics (all users)
   *
   * @returns Global statistics
   */
  async getGlobalStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
  }> {
    if (!this.redis) {
      return { totalUsers: 0, activeUsers: 0 };
    }

    try {
      const now = Date.now();
      const minuteWindow = Math.floor(now / 60000);

      // Count active users in current minute
      const keys = await this.redis.keys(`rate:*:minute:${minuteWindow}`);
      const activeUsers = keys.length;

      // Count total users (across all time windows)
      const allKeys = await this.redis.keys('rate:*:minute:*');
      const regex = /^rate:([^:]+):/;
      const uniqueUsers = new Set(
        allKeys.map((key: string) => {
          const match = regex.exec(key);
          return match ? match[1] : null;
        })
      ).size;

      return {
        totalUsers: uniqueUsers,
        activeUsers,
      };
    } catch (error) {
      logger.error('Failed to get global rate limit stats', { error });
      return { totalUsers: 0, activeUsers: 0 };
    }
  }
}

/**
 * Create user rate limiter from environment variables
 *
 * Environment variables:
 * - RATE_LIMIT_PER_MINUTE (default: 100)
 * - RATE_LIMIT_PER_HOUR (default: 5000)
 * - RATE_LIMIT_BURST (default: 20)
 */
export function createUserRateLimiterFromEnv(redis: RedisClient | null): UserRateLimiter {
  return new UserRateLimiter(redis, {
    requestsPerMinute: parseInt(process.env['RATE_LIMIT_PER_MINUTE'] || '100', 10),
    requestsPerHour: parseInt(process.env['RATE_LIMIT_PER_HOUR'] || '5000', 10),
    burstAllowance: parseInt(process.env['RATE_LIMIT_BURST'] || '20', 10),
  });
}
