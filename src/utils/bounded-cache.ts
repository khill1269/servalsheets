/**
 * Bounded Cache with LRU Eviction - Phase 1.4: Fix Unbounded Caches
 *
 * Provides a memory-safe cache implementation with configurable size limits
 * and TTL support. Uses LRU (Least Recently Used) eviction policy to prevent
 * unbounded memory growth in long-running services.
 *
 * Usage:
 * ```typescript
 * const cache = new BoundedCache<string, AccessPattern>({
 *   maxSize: 10000,
 *   ttl: 24 * 60 * 60 * 1000, // 24 hours
 *   onEviction: (key, value) => logger.debug('Evicted', { key })
 * });
 *
 * cache.set('key', value);
 * const value = cache.get('key');
 * ```
 */

import { LRUCache } from 'lru-cache';

export interface BoundedCacheOptions {
  /** Maximum number of entries before LRU eviction */
  maxSize: number;
  /** Time to live in milliseconds (optional) */
  ttl?: number;
  /** Callback when entry is evicted (optional) */
  onEviction?: (key: string, value: unknown) => void;
}

/**
 * Bounded cache with LRU eviction policy
 *
 * Prevents unbounded memory growth in long-running services by:
 * - Limiting max entries (enforces maxSize via LRU eviction)
 * - Optional TTL for automatic expiration
 * - Eviction callbacks for cleanup/logging
 */
export class BoundedCache<K extends string, V extends object> {
  private cache: LRUCache<K, V>;

  constructor(options: BoundedCacheOptions) {
    this.cache = new LRUCache<K, V>({
      max: options.maxSize,
      ttl: options.ttl,
      dispose: (value, key) => {
        if (options.onEviction) {
          options.onEviction(key, value);
        }
      },
    });
  }

  /**
   * Get value from cache (updates LRU position)
   */
  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Set value in cache (may trigger LRU eviction if full)
   */
  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete specific key from cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Iterate over all keys in cache (in LRU order)
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * Iterate over all values in cache (in LRU order)
   */
  values(): IterableIterator<V> {
    return this.cache.values();
  }

  /**
   * Iterate over all entries in cache (in LRU order)
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilization: number; // 0-100%
  } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      utilization: (this.cache.size / this.cache.max) * 100,
    };
  }
}
