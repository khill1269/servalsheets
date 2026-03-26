/**
 * Unified LRU Cache Implementation
 *
 * Consolidated cache abstraction that wraps the lru-cache npm package.
 * Provides a consistent interface across the codebase.
 */

import LRUCache from 'lru-cache';

export interface CacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

export interface CacheConfig {
  maxSize?: number; // Max items
  maxBytes?: number; // Max memory bytes
  ttlMs?: number; // Time-to-live in milliseconds
  updateAgeOnGet?: boolean;
}

export class Cache<K, V> {
  private cache: LRUCache<K, V>;
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };

  constructor(config: CacheConfig = {}) {
    this.cache = new LRUCache<K, V>({
      max: config.maxSize ?? 1000,
      maxSize: config.maxBytes ?? 10 * 1024 * 1024, // 10MB default
      ttl: config.ttlMs ?? 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: config.updateAgeOnGet ?? true,
      sizeCalculation: () => 1, // 1 item per entry for now
      dispose: () => this.stats.evictions++,
    });
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
    this.stats.sets++;
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  values(): IterableIterator<V> {
    return this.cache.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  getStats() {
    return { ...this.stats };
  }
}
