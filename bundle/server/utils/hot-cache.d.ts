/**
 * ServalSheets - Hot Cache
 *
 * Two-tier caching system for maximum performance:
 * - Hot Tier: In-memory Map for most recent items (O(1) access, ~100 items)
 * - Warm Tier: LRU cache for older items (O(1) amortized, ~1000 items)
 *
 * Performance characteristics:
 * - Hot tier: ~50ns access time
 * - Warm tier: ~500ns access time
 * - Cold (no cache): ~50-200ms API call
 *
 * Automatic promotion/demotion:
 * - Items accessed frequently stay in hot tier
 * - Less accessed items demote to warm tier
 * - Least recently used warm items evict
 */
/**
 * Hot cache configuration
 */
export interface HotCacheConfig {
    /** Maximum items in hot tier (default: 100) */
    hotTierSize?: number;
    /** Maximum items in warm tier (default: 1000) */
    warmTierSize?: number;
    /** Default TTL in milliseconds (default: 300000 = 5min) */
    defaultTtl?: number;
    /** Minimum access count for hot tier promotion (default: 2) */
    hotPromotionThreshold?: number;
    /** Enable statistics tracking (default: true) */
    trackStats?: boolean;
    /** Cleanup interval in milliseconds (default: 60000 = 1min) */
    cleanupIntervalMs?: number;
}
/**
 * Cache statistics
 */
export interface HotCacheStats {
    hotTierSize: number;
    warmTierSize: number;
    hotHits: number;
    warmHits: number;
    misses: number;
    hitRate: number;
    promotions: number;
    demotions: number;
    evictions: number;
    totalMemoryBytes: number;
}
/**
 * Two-tier hot cache implementation
 */
export declare class HotCache<T = unknown> {
    private hotTier;
    private warmTier;
    private config;
    private cleanupTimer;
    private stats;
    constructor(config?: HotCacheConfig);
    /**
     * Get value from cache
     *
     * @returns Value if found and not expired, undefined otherwise
     */
    get(key: string): T | undefined;
    /**
     * Set value in cache
     *
     * New items go to warm tier, frequently accessed items promote to hot tier
     */
    set(key: string, value: T, ttl?: number): void;
    /**
     * Delete value from cache
     */
    delete(key: string): boolean;
    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern: RegExp): number;
    /**
     * Invalidate entries by prefix
     */
    invalidatePrefix(prefix: string): number;
    /**
     * Get cache statistics
     */
    getStats(): HotCacheStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
    /**
     * Promote entry from warm to hot tier
     */
    private promoteToHot;
    /**
     * Demote least-accessed entry from hot to warm tier
     */
    private demoteFromHot;
    /**
     * Evict least recently used entry from warm tier
     */
    private evictFromWarm;
    /**
     * Estimate memory size of a value
     */
    private estimateSize;
    /**
     * Start periodic cleanup timer
     */
    private startCleanupTimer;
    /**
     * Clean up expired entries
     */
    private cleanup;
}
/**
 * Get global hot cache instance
 */
export declare function getHotCache(): HotCache;
/**
 * Reset global hot cache (for testing)
 */
export declare function resetHotCache(): void;
/**
 * Create namespaced cache key
 */
export declare function createHotCacheKey(namespace: string, ...parts: (string | number | boolean)[]): string;
/**
 * Get value from hot cache with namespace
 */
export declare function hotCacheGet<T>(namespace: string, key: string): T | undefined;
/**
 * Set value in hot cache with namespace
 */
export declare function hotCacheSet<T>(namespace: string, key: string, value: T, ttl?: number): void;
/**
 * Delete value from hot cache with namespace
 */
export declare function hotCacheDelete(namespace: string, key: string): boolean;
/**
 * Invalidate all entries in a namespace
 */
export declare function hotCacheInvalidateNamespace(namespace: string): number;
//# sourceMappingURL=hot-cache.d.ts.map