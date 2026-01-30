/**
 * Memoization Utilities
 *
 * Provides performance optimization through function result caching.
 * Use for expensive, pure functions with predictable inputs.
 *
 * @module utils/memoization
 */
/**
 * Simple LRU cache for memoization
 */
class LRUCache {
    cache = new Map();
    maxSize;
    ttl;
    constructor(maxSize = 100, ttl = 60000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }
    get(key) {
        const entry = this.cache.get(key);
        // OK: Explicit empty - cache miss is expected behavior
        if (!entry)
            return undefined;
        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            // OK: Explicit empty - expired entries return undefined
            return undefined;
        }
        // Update hits and move to end (most recently used)
        entry.hits++;
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }
    set(key, value) {
        // Evict least recently used if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            hits: 0,
        });
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
    getStats() {
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
export function memoize(fn, options = {}) {
    const { maxSize = 100, ttl = 60000, keyFn = (arg) => JSON.stringify(arg) } = options;
    const cache = new LRUCache(maxSize, ttl);
    const memoized = (arg) => {
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
export function memoizeMulti(fn, options = {}) {
    const { maxSize = 100, ttl = 60000, keyFn = (...args) => JSON.stringify(args) } = options;
    const cache = new LRUCache(maxSize, ttl);
    const memoized = (...args) => {
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
export function memoizeWeak(fn) {
    const cache = new WeakMap();
    return (key) => {
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
export function memoizeDebounce(fn, delay, options = {}) {
    const memoized = memoize(fn, options);
    const pending = new Map();
    const timers = new Map();
    return (arg) => {
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
        const promise = new Promise((resolve) => {
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
 * Create a memoized function with statistics tracking
 *
 * @param fn - Function to memoize
 * @param options - Cache options
 * @returns Memoized function with stats
 */
export function memoizeWithStats(fn, options = {}) {
    const memoized = memoize(fn, options);
    let hits = 0;
    let misses = 0;
    const wrapper = (arg) => {
        const stats = memoized.cache.stats();
        const prevHits = stats.totalHits;
        const result = memoized(arg);
        const newStats = memoized.cache.stats();
        if (newStats.totalHits > prevHits) {
            hits++;
        }
        else {
            misses++;
        }
        return result;
    };
    return Object.assign(wrapper, {
        getStats: () => {
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
//# sourceMappingURL=memoization.js.map