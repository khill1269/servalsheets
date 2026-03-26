/**
 * Unified LRU cache implementation using npm lru-cache
 * Provides typed cache with TTL support and statistics
 */

import LRU from 'lru-cache';

export interface CacheOptions<K, V> {
  max?: number; // max number of items
  ttl?: number; // milliseconds
  updateAgeOnGet?: boolean;
  allowStale?: boolean;
}

export class LRUCache<K, V> {
  private lru: LRU<K, V>;

  constructor(options: CacheOptions<K, V> = {}) {
    this.lru = new LRU<K, V>({
      max: options.max || 100,
      ttl: options.ttl || 5 * 60 * 1000,
      updateAgeOnGet: options.updateAgeOnGet !== false,
      allowStale: options.allowStale || false,
    });
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    return this.lru.get(key);
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    this.lru.set(key, value);
  }

  /**
   * Delete entry from cache
   */
  delete(key: K): boolean {
    return this.lru.delete(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.lru.has(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.lru.clear();
  }

  /**
   * Get all keys
   */
  keys(): K[] {
    return this.lru.keys();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.lru.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.lru.getRemovedCount();
  }
}
