/**
 * Cache Manager Service
 *
 * Provides intelligent caching for frequently accessed data
 * to reduce API calls and improve response times.
 *
 * Features:
 * - TTL-based expiration (configurable per entry)
 * - Automatic cache invalidation
 * - Memory-efficient storage with size limits
 * - Namespace support for organization
 * - Cache statistics and monitoring
 *
 * Environment Variables:
 * - CACHE_ENABLED: 'true' to enable caching (default: true)
 * - CACHE_DEFAULT_TTL: Default TTL in ms (default: 300000 = 5min)
 * - CACHE_MAX_SIZE: Max cache size in MB (default: 100)
 * - CACHE_CLEANUP_INTERVAL: Cleanup interval in ms (default: 300000 = 5min)
 *
 * Note: For multi-instance Redis caching, use cache-store.ts and cache-factory.ts
 */

import { logger } from './logger.js';

export interface CacheEntry<T = unknown> {
  value: T;
  expires: number;
  size: number;
  namespace?: string;
}

export interface CacheOptions {
  /** TTL in milliseconds (default: 5 minutes) */
  ttl?: number;

  /** Namespace for organizing cache entries */
  namespace?: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  byNamespace: Record<string, number>;
}

/**
 * Cache Manager
 * Manages cache with TTL, size limits, and multi-instance support
 */
export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private cleanupTimer?: NodeJS.Timeout;
  private rangeDependencies: Map<string, Set<string>>; // spreadsheetId:range -> cache keys

  // Configuration
  private readonly enabled: boolean;
  private readonly defaultTTL: number;
  private readonly maxSizeBytes: number;
  private readonly cleanupInterval: number;

  // Statistics
  private hits = 0;
  private misses = 0;

  constructor(options: {
    enabled?: boolean;
    defaultTTL?: number;
    maxSizeMB?: number;
    cleanupInterval?: number;
  } = {}) {
    this.cache = new Map();
    this.rangeDependencies = new Map();

    const envEnabled = process.env['CACHE_ENABLED'];
    const isTestEnv = process.env['NODE_ENV'] === 'test';
    this.enabled = options.enabled ?? (envEnabled !== undefined ? envEnabled !== 'false' : !isTestEnv);
    this.defaultTTL = options.defaultTTL ?? parseInt(process.env['CACHE_DEFAULT_TTL'] || '300000', 10);
    this.maxSizeBytes = (options.maxSizeMB ?? parseInt(process.env['CACHE_MAX_SIZE'] || '100', 10)) * 1024 * 1024;
    this.cleanupInterval = options.cleanupInterval ?? parseInt(process.env['CACHE_CLEANUP_INTERVAL'] || '300000', 10);

    if (this.enabled) {
      logger.info('Cache manager initialized', {
        defaultTTL: `${this.defaultTTL}ms`,
        maxSize: `${(this.maxSizeBytes / 1024 / 1024).toFixed(0)}MB`,
        cleanupInterval: `${this.cleanupInterval}ms`,
      });
    } else {
      logger.info('Cache manager disabled');
    }
  }

  /**
   * Start periodic cleanup task
   */
  startCleanupTask(): void {
    if (this.cleanupTimer || !this.enabled) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // Don't keep process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.debug('Cache cleanup task started', {
      intervalMs: this.cleanupInterval,
    });
  }

  /**
   * Stop periodic cleanup task
   */
  stopCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.debug('Cache cleanup task stopped');
    }
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string, namespace?: string): T | undefined {
    if (!this.enabled) {
      this.misses++;
      return undefined;
    }

    const cacheKey = this.buildKey(key, namespace);
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(cacheKey);
      this.misses++;
      logger.debug('Cache entry expired', { key, namespace });
      return undefined;
    }

    this.hits++;
    logger.debug('Cache hit', { key, namespace });
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    if (!this.enabled) {
      return;
    }

    const cacheKey = this.buildKey(key, options.namespace);
    const ttl = options.ttl ?? this.defaultTTL;
    const size = this.estimateSize(value);

    // Check if adding this entry would exceed max size
    const currentSize = this.getTotalSize();
    if (currentSize + size > this.maxSizeBytes) {
      logger.warn('Cache size limit approaching, cleaning up', {
        currentSize: `${(currentSize / 1024 / 1024).toFixed(2)}MB`,
        maxSize: `${(this.maxSizeBytes / 1024 / 1024).toFixed(0)}MB`,
      });
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      value,
      expires: Date.now() + ttl,
      size,
      namespace: options.namespace,
    };

    this.cache.set(cacheKey, entry);
    logger.debug('Cache entry set', {
      key,
      namespace: options.namespace,
      ttl,
      size: `${(size / 1024).toFixed(2)}KB`,
    });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string, namespace?: string): boolean {
    const cacheKey = this.buildKey(key, namespace);
    const deleted = this.cache.delete(cacheKey);

    if (deleted) {
      logger.debug('Cache entry deleted', { key, namespace });
    }

    return deleted;
  }

  /**
   * Check if a key exists in cache
   */
  has(key: string, namespace?: string): boolean {
    const cacheKey = this.buildKey(key, namespace);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * Get or set a value in cache
   * If the key exists and is not expired, returns the cached value
   * Otherwise, calls the factory function and caches the result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key, options.namespace);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern: RegExp | string, namespace?: string): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const [key] of this.cache) {
      const matches = regex.test(key);
      const inNamespace = !namespace || key.startsWith(`${namespace}:`);

      if (matches && inNamespace) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug('Cache pattern invalidated', { pattern: pattern.toString(), namespace, count });
    }

    return count;
  }

  /**
   * Clear all cache entries in a namespace
   */
  clearNamespace(namespace: string): number {
    let count = 0;
    const prefix = `${namespace}:`;

    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug('Cache namespace cleared', { namespace, count });
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.debug('Cache cleared', { entriesCleared: count });
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let expired = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
        expired++;
      }
    }

    if (expired > 0) {
      logger.debug('Cache cleanup completed', {
        expired,
        remaining: this.cache.size,
      });
    }
  }

  /**
   * Get cache entries that are expiring soon
   * @param thresholdMs Time threshold in milliseconds (entries expiring within this time)
   * @param namespace Optional namespace filter
   * @returns Array of cache keys that are expiring soon
   */
  getExpiringEntries(thresholdMs: number, namespace?: string): Array<{ key: string; expiresIn: number }> {
    const now = Date.now();
    const expiringThreshold = now + thresholdMs;
    const expiring: Array<{ key: string; expiresIn: number }> = [];

    for (const [key, entry] of this.cache) {
      // Skip if namespace filter provided and doesn't match
      if (namespace && entry.namespace !== namespace) {
        continue;
      }

      // Check if entry is expiring soon (but not already expired)
      if (entry.expires > now && entry.expires <= expiringThreshold) {
        expiring.push({
          key,
          expiresIn: entry.expires - now,
        });
      }
    }

    return expiring;
  }

  /**
   * Evict oldest entries to free up space
   */
  private evictOldest(): void {
    // Remove oldest 10% of entries
    const countToRemove = Math.max(1, Math.ceil(this.cache.size * 0.1));

    const sortedByExpiry = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expires - b[1].expires)
      .slice(0, countToRemove);

    sortedByExpiry.forEach(([key]) => {
      this.cache.delete(key);
    });

    logger.debug('Evicted oldest cache entries', {
      removed: countToRemove,
      remaining: this.cache.size,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalSize = 0;
    let oldestExpiry: number | null = null;
    let newestExpiry: number | null = null;
    const byNamespace: Record<string, number> = {};

    for (const [, entry] of this.cache) {
      totalSize += entry.size;

      if (oldestExpiry === null || entry.expires < oldestExpiry) {
        oldestExpiry = entry.expires;
      }
      if (newestExpiry === null || entry.expires > newestExpiry) {
        newestExpiry = entry.expires;
      }

      const ns = entry.namespace || 'default';
      byNamespace[ns] = (byNamespace[ns] || 0) + 1;
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      totalSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      oldestEntry: oldestExpiry,
      newestEntry: newestExpiry,
      byNamespace,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Build a cache key with optional namespace
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Estimate the size of a value in bytes
   */
  private estimateSize(value: unknown): number {
    try {
      // Accurate UTF-8 byte length calculation
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      // Fallback to a conservative estimate
      return 1024; // 1KB default
    }
  }

  /**
   * Get total cache size in bytes
   */
  private getTotalSize(): number {
    let total = 0;
    for (const [, entry] of this.cache) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Track range dependency for cache invalidation
   * Associates a cache key with a spreadsheet range
   */
  trackRangeDependency(spreadsheetId: string, range: string, cacheKey: string): void {
    const depKey = `${spreadsheetId}:${range}`;
    if (!this.rangeDependencies.has(depKey)) {
      this.rangeDependencies.set(depKey, new Set());
    }
    this.rangeDependencies.get(depKey)!.add(cacheKey);
  }

  /**
   * Invalidate cache entries for a specific range
   * Only invalidates overlapping ranges, not the entire spreadsheet
   */
  invalidateRange(spreadsheetId: string, range: string): number {
    const affected = this.findOverlappingRanges(spreadsheetId, range);
    let count = 0;

    for (const affectedRange of affected) {
      const depKey = `${spreadsheetId}:${affectedRange}`;
      const deps = this.rangeDependencies.get(depKey);
      if (deps) {
        for (const cacheKey of deps) {
          if (this.cache.delete(cacheKey)) {
            count++;
          }
        }
        this.rangeDependencies.delete(depKey);
      }
    }

    if (count > 0) {
      logger.debug('Range-specific cache invalidation', {
        spreadsheetId,
        range,
        keysInvalidated: count,
        rangesAffected: affected.length,
      });
    }

    return count;
  }

  /**
   * Find ranges that overlap with the given range
   * Simple implementation: exact match + full sheet invalidation
   */
  private findOverlappingRanges(spreadsheetId: string, range: string): string[] {
    const overlapping: string[] = [range];

    // If range is "Sheet1!A1:D10", also invalidate "Sheet1" (full sheet)
    if (range.includes('!')) {
      const [sheetName] = range.split('!');
      if (sheetName) {
        overlapping.push(sheetName);

        // Also check for other ranges on the same sheet
        for (const depKey of this.rangeDependencies.keys()) {
          if (depKey.startsWith(`${spreadsheetId}:${sheetName}!`)) {
            const existingRange = depKey.split(':')[1];
            if (existingRange && this.rangesOverlap(range, existingRange)) {
              overlapping.push(existingRange);
            }
          }
        }
      }
    }

    return [...new Set(overlapping)]; // Deduplicate
  }

  /**
   * Check if two A1 ranges overlap
   * Simplified check: exact match or both on same sheet
   */
  private rangesOverlap(range1: string, range2: string): boolean {
    if (range1 === range2) return true;

    // Extract sheet names
    const sheet1 = range1.includes('!') ? range1.split('!')[0] : range1;
    const sheet2 = range2.includes('!') ? range2.split('!')[0] : range2;

    // If on different sheets, no overlap
    if (sheet1 !== sheet2) return false;

    // If either is just a sheet name (no cell range), they overlap
    if (!range1.includes('!') || !range2.includes('!')) return true;

    // For simplicity, assume all ranges on same sheet overlap
    // A more sophisticated implementation would parse A1 notation and check bounds
    return true;
  }
}

/**
 * Global cache manager instance
 */
export const cacheManager = new CacheManager();

/**
 * Helper: Create a cache key for API operations
 */
export function createCacheKey(
  operation: string,
  params: Record<string, unknown>
): string {
  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${operation}:${serialized}`;
}
