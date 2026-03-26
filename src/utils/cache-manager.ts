/**
 * Cache Manager
 *
 * Intelligent caching layer with TTL, LRU eviction, range dependency tracking,
 * and stale-while-revalidate (SWR) pattern support.
 */

import Cache from 'lru-cache';
import { getRequestLogger } from './request-context.js';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  lastAccessed: number;
  byteSize: number;
}

export interface CacheOptions {
  maxSize?: number; // bytes (default: 50MB)
  maxItems?: number; // default: 10,000
  ttlMs?: number; // default: 5min
  enableSWR?: boolean; // stale-while-revalidate
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  itemCount: number;
  hitRate: number;
}

/**
 * Range-based cache dependency tracking
 * Allows invalidation of overlapping ranges efficiently
 */
interface RangeDependency {
  range: string; // "Sheet1!A1:D10"
  keys: Set<string>; // Cache keys that depend on this range
}

export class CacheManager<T> {
  private cache: Cache<string, CacheEntry<T>>;
  private rangeDependencies: Map<string, RangeDependency> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, currentSize: 0, itemCount: 0, hitRate: 0 };
  private runningByteSize: number = 0; // O(1) tracking instead of iterating all keys
  private maxSize: number;
  private options: CacheOptions;
  private logger = getRequestLogger();

  constructor(options: CacheOptions = {}) {
    this.options = options;
    this.maxSize = options.maxSize ?? 50 * 1024 * 1024; // 50MB default

    this.cache = new Cache<string, CacheEntry<T>>({
      max: options.maxItems ?? 10000,
      maxSize: this.maxSize,
      sizeCalculation: (entry) => entry.byteSize,
      ttl: options.ttlMs ?? 5 * 60 * 1000, // 5min default
      allowStale: options.enableSWR ?? false,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      dispose: (value, key) => {
        this.runningByteSize -= value.byteSize;
        this.stats.evictions++;
        this.logger.debug('Cache eviction', { key, size: value.byteSize });
      },
    });
  }

  /**
   * Get from cache, return undefined if miss or expired (unless SWR enabled)
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.hits++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.value;
    }
    this.stats.misses++;
    this.updateHitRate();
    return undefined;
  }

  /**
   * Set value in cache with optional range dependency
   */
  set(key: string, value: T, options?: { ttlMs?: number; rangeKey?: string; byteSize?: number }): void {
    const byteSize = options?.byteSize ?? this.estimateSize(value);
    const expiresAt = Date.now() + (options?.ttlMs ?? this.options.ttlMs ?? 5 * 60 * 1000);

    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      hits: 0,
      lastAccessed: Date.now(),
      byteSize,
    };

    this.cache.set(key, entry);
    this.runningByteSize += byteSize;
    this.stats.currentSize = this.runningByteSize;
    this.stats.itemCount = this.cache.size;

    if (options?.rangeKey) {
      this.trackRangeDependency(options.rangeKey, key);
    }
  }

  /**
   * Get or compute: if cache miss, call fn and cache result
   */
  async getOrSet(key: string, fn: () => Promise<T>, options?: { ttlMs?: number; rangeKey?: string }): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const value = await fn();
    this.set(key, value, options);
    return value;
  }

  /**
   * Stale-while-revalidate: return stale value immediately, revalidate in background
   */
  async getOrSetSWR(
    key: string,
    fn: () => Promise<T>,
    options?: { ttlMs?: number; staleTtlMs?: number; rangeKey?: string }
  ): Promise<T> {
    const entry = this.cache.get(key, { allowStale: true });
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        // Fresh
        entry.hits++;
        this.stats.hits++;
        return entry.value;
      }
      // Stale: return immediately, revalidate in background
      setImmediate(() => {
        fn().then((fresh) => this.set(key, fresh, options)).catch((err) => {
          this.logger.warn('SWR revalidation failed', { key, error: err instanceof Error ? err.message : String(err) });
        });
      });
      return entry.value;
    }

    // Cache miss
    const value = await fn();
    this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate a range and all dependent keys
   * Example: invalidateRange("Sheet1!A1:D10") clears all keys that depend on that range
   */
  invalidateRange(range: string): void {
    const normalized = this.normalizeRange(range);
    const dep = this.rangeDependencies.get(normalized);
    if (!dep) return;

    dep.keys.forEach((key) => {
      const entry = this.cache.get(key);
      if (entry) {
        this.runningByteSize -= entry.byteSize;
      }
      this.cache.delete(key);
    });
    this.rangeDependencies.delete(normalized);
    this.stats.currentSize = this.runningByteSize;
    this.stats.itemCount = this.cache.size;
    this.logger.debug('Range invalidation', { range: normalized, keysCleared: dep.keys.size });
  }

  /**
   * Invalidate overlapping ranges
   * Example: invalidateOverlapping("Sheet1!A1:E15") clears ranges that overlap with A1:E15
   */
  invalidateOverlapping(range: string): void {
    const target = this.normalizeRange(range);
    const [targetSheet, targetA1, targetB1] = this.parseRange(target);

    const keysToDelete: string[] = [];

    for (const [depRange, dep] of this.rangeDependencies.entries()) {
      const [depSheet, depA1, depB1] = this.parseRange(depRange);
      if (depSheet !== targetSheet) continue; // Different sheet

      if (this.rangesOverlap(targetA1, targetB1, depA1, depB1)) {
        keysToDelete.push(...Array.from(dep.keys));
      }
    }

    keysToDelete.forEach((key) => {
      const entry = this.cache.get(key);
      if (entry) {
        this.runningByteSize -= entry.byteSize;
      }
      this.cache.delete(key);
    });

    this.stats.currentSize = this.runningByteSize;
    this.stats.itemCount = this.cache.size;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.rangeDependencies.clear();
    this.runningByteSize = 0;
    this.stats.itemCount = 0;
    this.stats.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateHitRate();
    return { ...this.stats };
  }

  // Private helpers

  private trackRangeDependency(rangeKey: string, cacheKey: string): void {
    const normalized = this.normalizeRange(rangeKey);
    if (!this.rangeDependencies.has(normalized)) {
      this.rangeDependencies.set(normalized, { range: normalized, keys: new Set() });
    }
    this.rangeDependencies.get(normalized)!.keys.add(cacheKey);
  }

  private normalizeRange(range: string): string {
    // "Sheet1!A1:D10" or "A1:D10"
    return range.toUpperCase().trim();
  }

  private parseRange(range: string): [sheet: string, a1: string, b1: string] {
    const parts = range.split('!');
    if (parts.length === 2) {
      const [a1, b1] = parts[1]!.split(':');
      return [parts[0]!, a1!, b1!];
    }
    const [a1, b1] = parts[0]!.split(':');
    return ['', a1!, b1!];
  }

  private rangesOverlap(
    a1: string,
    a2: string,
    b1: string,
    b2: string
  ): boolean {
    const { row: aRow1, col: aCol1 } = this.parseA1(a1);
    const { row: aRow2, col: aCol2 } = this.parseA1(a2);
    const { row: bRow1, col: bCol1 } = this.parseA1(b1);
    const { row: bRow2, col: bCol2 } = this.parseA1(b2);

    return aRow1 <= bRow2 && aRow2 >= bRow1 && aCol1 <= bCol2 && aCol2 >= bCol1;
  }

  private parseA1(a1: string): { row: number; col: number } {
    const match = a1.match(/^\$?([A-Z]+)\$?(\d+)$/);
    if (!match) return { row: 0, col: 0 };

    const col = match[1]!.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
    const row = parseInt(match[2]!, 10);
    return { row, col };
  }

  private estimateSize(value: T): number {
    // Rough estimate: JSON.stringify length
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (Array.isArray(value)) return value.reduce((sum, v) => sum + this.estimateSize(v), 0);
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value).length * 2;
    }
    return 0;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Singleton cache manager instance
 */
let globalCache: CacheManager<unknown> | null = null;

export function getGlobalCache(): CacheManager<unknown> {
  if (!globalCache) {
    globalCache = new CacheManager();
  }
  return globalCache;
}
