/**
 * Memoization Utilities
 *
 * Provides performance optimization through function result caching.
 * Use for expensive, pure functions with predictable inputs.
 *
 * @module utils/memoization
 */

/**
 * Memoization cache entry
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

/**
 * Simple LRU cache for memoization
 */
class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update hits and move to end (most recently used)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict least recently used if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value as K;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; totalHits: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }
    return { size: this.cache.size, totalHits };
  }
}

/**
 * Memoize a function with a single argument
 *
 * Best for pure functions with expensive computations:
 * - Column letter to number conversion
 * - Range parsing
 * - Complex calculations
 *
 * @param fn - Function to memoize
 * @param options - Cache configuration
 * @returns Memoized function with cache
 *
 * @example
 * ```typescript
 * const expensiveCalc = memoize((x: number) => {
 *   // Complex calculation
 *   return result;
 * });
 *
 * expensiveCalc(5); // Calculated
 * expensiveCalc(5); // Cached (fast!)
 * ```
 */
export function memoize<T, R>(
  fn: (arg: T) => R,
  options: { maxSize?: number; ttl?: number; keyFn?: (arg: T) => string } = {}
): ((arg: T) => R) & { cache: { clear: () => void; stats: () => { size: number; totalHits: number } } } {
  const { maxSize = 100, ttl = 60000, keyFn = (arg: T) => JSON.stringify(arg) } = options;

  const cache = new LRUCache<string, R>(maxSize, ttl);

  const memoized = (arg: T): R => {
    const key = keyFn(arg);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(arg);
    cache.set(key, result);
    return result;
  };

  // Attach cache control methods
  return Object.assign(memoized, {
    cache: {
      clear: () => cache.clear(),
      stats: () => cache.getStats(),
    },
  });
}

/**
 * Memoize a function with multiple arguments
 *
 * @param fn - Function to memoize
 * @param options - Cache configuration
 * @returns Memoized function
 *
 * @example
 * ```typescript
 * const add = memoizeMulti((a: number, b: number) => a + b);
 * add(1, 2); // Calculated
 * add(1, 2); // Cached
 * ```
 */
export function memoizeMulti<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  options: { maxSize?: number; ttl?: number; keyFn?: (...args: Args) => string } = {}
): ((...args: Args) => R) & { cache: { clear: () => void; stats: () => { size: number; totalHits: number } } } {
  const { maxSize = 100, ttl = 60000, keyFn = (...args: Args) => JSON.stringify(args) } = options;

  const cache = new LRUCache<string, R>(maxSize, ttl);

  const memoized = (...args: Args): R => {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  return Object.assign(memoized, {
    cache: {
      clear: () => cache.clear(),
      stats: () => cache.getStats(),
    },
  });
}

/**
 * Memoize with weak reference for objects
 *
 * Useful for memoizing functions that operate on objects
 * without preventing garbage collection.
 *
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export function memoizeWeak<K extends object, R>(
  fn: (key: K) => R
): (key: K) => R {
  const cache = new WeakMap<K, R>();

  return (key: K): R => {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(key);
    cache.set(key, result);
    return result;
  };
}

/**
 * Create a debounced memoized function
 *
 * Combines debouncing with memoization for functions that:
 * - Are called rapidly with same inputs
 * - Have expensive computations
 * - Don't need immediate results
 *
 * @param fn - Function to memoize and debounce
 * @param delay - Debounce delay in ms
 * @param options - Memoization options
 * @returns Debounced memoized function
 */
export function memoizeDebounce<T, R>(
  fn: (arg: T) => R,
  delay: number,
  options: { maxSize?: number; ttl?: number } = {}
): (arg: T) => Promise<R> {
  const memoized = memoize(fn, options);
  const pending = new Map<string, Promise<R>>();
  const timers = new Map<string, NodeJS.Timeout>();

  return (arg: T): Promise<R> => {
    const key = JSON.stringify(arg);

    // Check cache first
    const cached = memoized(arg);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    // Check if already pending
    const existingPromise = pending.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new debounced promise
    const promise = new Promise<R>((resolve) => {
      // Clear existing timer
      const existingTimer = timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(() => {
        const result = fn(arg);
        resolve(result);
        pending.delete(key);
        timers.delete(key);
      }, delay);

      timers.set(key, timer);
    });

    pending.set(key, promise);
    return promise;
  };
}

/**
 * Statistics for memoization performance monitoring
 */
export interface MemoStats {
  hits: number;
  misses: number;
  hitRate: number;
  cacheSize: number;
}

/**
 * Create a memoized function with statistics tracking
 *
 * @param fn - Function to memoize
 * @param options - Cache options
 * @returns Memoized function with stats
 */
export function memoizeWithStats<T, R>(
  fn: (arg: T) => R,
  options: { maxSize?: number; ttl?: number } = {}
): ((arg: T) => R) & { getStats: () => MemoStats; clearCache: () => void } {
  const memoized = memoize(fn, options);
  let hits = 0;
  let misses = 0;

  const wrapper = (arg: T): R => {
    const key = JSON.stringify(arg);
    const stats = memoized.cache.stats();
    const prevHits = stats.totalHits;

    const result = memoized(arg);

    const newStats = memoized.cache.stats();
    if (newStats.totalHits > prevHits) {
      hits++;
    } else {
      misses++;
    }

    return result;
  };

  return Object.assign(wrapper, {
    getStats: (): MemoStats => {
      const cacheStats = memoized.cache.stats();
      const total = hits + misses;
      return {
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        cacheSize: cacheStats.size,
      };
    },
    clearCache: () => {
      memoized.cache.clear();
      hits = 0;
      misses = 0;
    },
  });
}
