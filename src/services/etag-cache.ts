/**
 * ServalSheets - ETag Cache Service
 *
 * Implements Google API ETag caching for conditional requests.
 * Reduces bandwidth and quota usage with 304 Not Modified responses.
 *
 * Benefits:
 * - 304 responses don't count against quota
 * - Saves bandwidth (no response body)
 * - Faster response times
 *
 * @category Services
 */

import { logger } from '../utils/logger.js';

/**
 * Cached ETag entry
 */
interface ETagEntry {
  etag: string;
  cachedAt: number;
  cachedData?: unknown; // Optional cached response data
}

/**
 * ETag cache key components
 */
interface CacheKey {
  spreadsheetId: string;
  endpoint: 'metadata' | 'values' | 'properties' | 'sheets';
  range?: string;
  params?: Record<string, unknown>;
}

/**
 * ETag Cache Service
 *
 * Caches ETags from Google API responses to enable conditional requests.
 * Uses If-None-Match header to get 304 Not Modified when data hasn't changed.
 */
export class ETagCache {
  private cache: Map<string, ETagEntry>;
  private readonly maxAge: number; // milliseconds
  private readonly maxSize: number;

  constructor(options: { maxAge?: number; maxSize?: number } = {}) {
    this.cache = new Map();
    this.maxAge = options.maxAge ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 1000; // Max 1000 entries
  }

  /**
   * Generate cache key from request parameters
   */
  private getCacheKey(key: CacheKey): string {
    const parts = [key.spreadsheetId, key.endpoint];

    if (key.range) {
      parts.push(key.range);
    }

    if (key.params) {
      // Sort keys for consistent hashing
      const sortedParams = Object.keys(key.params)
        .sort()
        .map((k) => `${k}=${JSON.stringify(key.params![k])}`)
        .join('&');
      parts.push(sortedParams);
    }

    return parts.join(':');
  }

  /**
   * Get cached ETag for request
   *
   * Returns ETag if:
   * - Entry exists
   * - Entry is not expired
   * - Entry has valid ETag
   *
   * @returns ETag string or null if not cached/expired
   */
  getETag(key: CacheKey): string | null {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.cachedAt;
    if (age > this.maxAge) {
      this.cache.delete(cacheKey);
      logger.debug('ETag expired', { key: cacheKey, ageMs: age });
      return null;
    }

    logger.debug('ETag cache hit', {
      key: cacheKey,
      etag: entry.etag.substring(0, 16),
      ageMs: age,
    });

    return entry.etag;
  }

  /**
   * Get cached data (if available)
   *
   * Returns cached response data if:
   * - Entry exists and is not expired
   * - Entry has cached data
   */
  getCachedData(key: CacheKey): unknown | null {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry || !entry.cachedData) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.cachedAt;
    if (age > this.maxAge) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.cachedData;
  }

  /**
   * Store ETag from response
   *
   * Extracts ETag from response headers and stores it for future requests.
   *
   * @param key - Request parameters
   * @param etag - ETag from response headers
   * @param data - Optional response data to cache
   */
  setETag(key: CacheKey, etag: string, data?: unknown): void {
    if (!etag) {
      logger.warn('Attempted to cache empty ETag', { key });
      return;
    }

    const cacheKey = this.getCacheKey(key);

    // Enforce max size (LRU-style: delete oldest if at capacity)
    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug('ETag cache eviction (max size)', { evicted: oldestKey });
      }
    }

    this.cache.set(cacheKey, {
      etag,
      cachedAt: Date.now(),
      cachedData: data,
    });

    logger.debug('ETag cached', {
      key: cacheKey,
      etag: etag.substring(0, 16),
      hasCachedData: !!data,
    });
  }

  /**
   * Invalidate cache entry (e.g., after mutation)
   *
   * @param key - Request parameters to invalidate
   */
  invalidate(key: CacheKey): void {
    const cacheKey = this.getCacheKey(key);
    const deleted = this.cache.delete(cacheKey);

    if (deleted) {
      logger.debug('ETag invalidated', { key: cacheKey });
    }
  }

  /**
   * Invalidate all entries for a spreadsheet
   *
   * Called after mutations to ensure fresh data on next read.
   */
  invalidateSpreadsheet(spreadsheetId: string): void {
    let count = 0;
    for (const [key] of this.cache) {
      if (key.startsWith(`${spreadsheetId}:`)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug('Invalidated spreadsheet ETags', { spreadsheetId, count });
    }
  }

  /**
   * Clear all cached ETags
   */
  clear(): void {
    this.cache.clear();
    logger.debug('ETag cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    maxAge: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.cachedAt,
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge,
      entries,
    };
  }
}

// Singleton instance
let instance: ETagCache | null = null;

/**
 * Get ETag cache singleton
 */
export function getETagCache(): ETagCache {
  if (!instance) {
    instance = new ETagCache({
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000, // 1000 entries
    });
  }
  return instance;
}

/**
 * Reset ETag cache (for testing)
 */
export function resetETagCache(): void {
  instance = null;
}
