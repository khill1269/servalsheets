/**
 * ServalSheets - Cache Factory
 *
 * Factory function for creating cache stores with environment-based configuration
 * Supports both in-memory (development/single-instance) and Redis (production/multi-instance) backends
 *
 * Follows the same pattern as task-store-factory for consistency
 */

import { CacheStore, InMemoryCacheStore, RedisCacheStore } from './cache-store.js';
import { logger as baseLogger } from './logger.js';

export interface CacheStoreConfig {
  /**
   * Force a specific store type (useful for testing)
   * If not specified, determined by environment variables
   */
  type?: 'memory' | 'redis';

  /**
   * Redis connection URL (overrides REDIS_URL env var)
   */
  redisUrl?: string;
}

/**
 * Create a cache store based on environment configuration
 *
 * Decision Logic:
 * 1. If config.type is specified, use that
 * 2. If REDIS_URL is set, use Redis
 * 3. Otherwise, use in-memory store
 *
 * Production Considerations:
 * - In-memory store: Single-process only, data lost on restart
 * - Redis store: Multi-process safe, persistent, requires Redis server
 *
 * @param config Optional configuration overrides
 * @returns CacheStore implementation (in-memory or Redis)
 */
export async function createCacheStore(config: CacheStoreConfig = {}): Promise<CacheStore> {
  const logger = baseLogger.child({ component: 'CacheFactory' });

  // Determine store type
  let storeType: 'memory' | 'redis';

  if (config.type) {
    storeType = config.type;
    logger.info(`Cache store type forced: ${storeType}`);
  } else {
    const redisUrl = config.redisUrl ?? process.env['REDIS_URL'];
    storeType = redisUrl ? 'redis' : 'memory';
    logger.info(`Cache store type determined from environment: ${storeType}`);
  }

  // Create appropriate store
  if (storeType === 'redis') {
    const redisUrl = config.redisUrl ?? process.env['REDIS_URL'];

    if (!redisUrl) {
      throw new Error(
        'Redis cache store requested but REDIS_URL not configured. ' +
          'Set REDIS_URL environment variable or use in-memory store for single-instance deployments.'
      );
    }

    try {
      const redisStore = new RedisCacheStore(redisUrl);

      logger.info('Cache store created', {
        type: 'redis',
        url: redisUrl.replace(/:\/\/.*@/, '://*****@'), // Mask credentials
      });

      return redisStore;
    } catch (error) {
      logger.error('Failed to create Redis cache store, falling back to in-memory', { error });

      const memoryStore = new InMemoryCacheStore();

      logger.warn(
        'Cache store fallback to in-memory. ' +
          'Multi-instance deployments will have separate caches per instance. ' +
          'This may result in higher API usage.'
      );

      return memoryStore;
    }
  } else {
    // In-memory store
    const memoryStore = new InMemoryCacheStore();

    logger.info('Cache store created', {
      type: 'memory',
      warning:
        process.env['NODE_ENV'] === 'production'
          ? 'In-memory cache in production - not shared across instances'
          : undefined,
    });

    return memoryStore;
  }
}

/**
 * Get recommended cache store type for current environment
 *
 * @returns Recommended store type based on environment
 */
export function getRecommendedCacheStoreType(): 'memory' | 'redis' {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const hasRedis = Boolean(process.env['REDIS_URL']);

  if (isProduction && !hasRedis) {
    baseLogger.warn(
      'Production environment detected without Redis. ' +
        'Cache store will use in-memory storage (not shared across instances). ' +
        'Set REDIS_URL to enable shared caching for multi-instance deployments.'
    );
  }

  return hasRedis ? 'redis' : 'memory';
}
