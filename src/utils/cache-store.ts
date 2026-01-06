/**
 * ServalSheets - Cache Store Interface
 *
 * Abstraction layer for cache storage backends (in-memory, Redis)
 * Follows the same pattern as task-store for consistency
 */

import { logger as baseLogger } from './logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any; // Dynamically imported, avoid compile-time dependency

export interface CacheEntry<T = unknown> {
  value: T;
  expires: number;
  size: number;
  namespace?: string;
}

export interface CacheStore {
  get<T = unknown>(key: string): Promise<CacheEntry<T> | null>;
  set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(namespace?: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  size(): Promise<number>;
  dispose(): void;
}

/**
 * In-memory cache store
 * Single-process only, data lost on restart
 */
export class InMemoryCacheStore implements CacheStore {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(namespace?: string): Promise<void> {
    if (!namespace) {
      this.cache.clear();
      return;
    }

    // Delete all keys in namespace
    for (const key of this.cache.keys()) {
      const entry = this.cache.get(key);
      if (entry?.namespace === namespace) {
        this.cache.delete(key);
      }
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    if (!pattern) return allKeys;

    // Simple glob pattern matching (* wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  dispose(): void {
    this.cache.clear();
  }
}

/**
 * Redis cache store
 * Multi-process safe, persistent across restarts
 */
export class RedisCacheStore implements CacheStore {
  private redis: RedisClient;
  private logger = baseLogger.child({ component: 'RedisCacheStore' });
  private keyPrefix = 'cache:';

  constructor(redisUrl: string) {
    // Dynamic import to avoid loading ioredis unless Redis is actually used
     
    const Redis = require('ioredis');

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.redis.on('error', (error: Error) => {
      this.logger.error('Redis cache error', { error });
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis cache connected');
    });
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const data = await this.redis.get(this.prefixKey(key));
      if (!data) return null;

      const entry: CacheEntry<T> = JSON.parse(data);

      // Check expiration
      if (entry.expires < Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry;
    } catch (error) {
      this.logger.error('Redis cache get error', { key, error });
      return null;
    }
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const ttlMs = entry.expires - Date.now();
      if (ttlMs <= 0) return; // Already expired

      const data = JSON.stringify(entry);
      const ttlSeconds = Math.ceil(ttlMs / 1000);

      await this.redis.setex(this.prefixKey(key), ttlSeconds, data);
    } catch (error) {
      this.logger.error('Redis cache set error', { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.prefixKey(key));
    } catch (error) {
      this.logger.error('Redis cache delete error', { key, error });
    }
  }

  async clear(namespace?: string): Promise<void> {
    try {
      if (!namespace) {
        // Clear all cache keys
        const keys = await this.redis.keys(`${this.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      }

      // Clear keys in specific namespace
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const keysToDelete: string[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const entry: CacheEntry = JSON.parse(data);
          if (entry.namespace === namespace) {
            keysToDelete.push(key);
          }
        }
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (error) {
      this.logger.error('Redis cache clear error', { namespace, error });
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern
        ? `${this.keyPrefix}${pattern}`
        : `${this.keyPrefix}*`;
      const keys = await this.redis.keys(searchPattern);
      // Remove prefix from returned keys
      return keys.map((key: string) => key.substring(this.keyPrefix.length));
    } catch (error) {
      this.logger.error('Redis cache keys error', { pattern, error });
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      return keys.length;
    } catch (error) {
      this.logger.error('Redis cache size error', { error });
      return 0;
    }
  }

  dispose(): void {
    this.redis.disconnect();
  }
}
