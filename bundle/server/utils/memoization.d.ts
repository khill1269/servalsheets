/**
 * Memoization Utilities
 *
 * Provides performance optimization through function result caching.
 * Use for expensive, pure functions with predictable inputs.
 *
 * @module utils/memoization
 */
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
export declare function memoize<T, R>(fn: (arg: T) => R, options?: {
    maxSize?: number;
    ttl?: number;
    keyFn?: (arg: T) => string;
}): ((arg: T) => R) & {
    cache: {
        clear: () => void;
        stats: () => {
            size: number;
            totalHits: number;
        };
    };
};
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
export declare function memoizeMulti<Args extends unknown[], R>(fn: (...args: Args) => R, options?: {
    maxSize?: number;
    ttl?: number;
    keyFn?: (...args: Args) => string;
}): ((...args: Args) => R) & {
    cache: {
        clear: () => void;
        stats: () => {
            size: number;
            totalHits: number;
        };
    };
};
/**
 * Memoize with weak reference for objects
 *
 * Useful for memoizing functions that operate on objects
 * without preventing garbage collection.
 *
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export declare function memoizeWeak<K extends object, R>(fn: (key: K) => R): (key: K) => R;
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
export declare function memoizeDebounce<T, R>(fn: (arg: T) => R, delay: number, options?: {
    maxSize?: number;
    ttl?: number;
}): (arg: T) => Promise<R>;
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
export declare function memoizeWithStats<T, R>(fn: (arg: T) => R, options?: {
    maxSize?: number;
    ttl?: number;
}): ((arg: T) => R) & {
    getStats: () => MemoStats;
    clearCache: () => void;
};
//# sourceMappingURL=memoization.d.ts.map