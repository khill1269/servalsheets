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
import type { RequestMerger } from '../services/request-merger.js';
export interface CacheEntry<T = unknown> {
    value: T;
    expires: number;
    size: number;
    namespace?: string;
}
export interface ParsedRange {
    sheetName: string | null;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
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
export declare class CacheManager {
    private cache;
    private cleanupTimer?;
    private rangeDependencies;
    private requestMerger?;
    private readonly enabled;
    private readonly defaultTTL;
    private readonly maxSizeBytes;
    private readonly cleanupInterval;
    private hits;
    private misses;
    constructor(options?: {
        enabled?: boolean;
        defaultTTL?: number;
        maxSizeMB?: number;
        cleanupInterval?: number;
    });
    /**
     * Start periodic cleanup task
     */
    startCleanupTask(): void;
    /**
     * Stop periodic cleanup task
     */
    stopCleanupTask(): void;
    /**
     * Get a value from cache
     */
    get<T>(key: string, namespace?: string): T | undefined;
    /**
     * Set a value in cache
     */
    set<T>(key: string, value: T, options?: CacheOptions): void;
    /**
     * Delete a value from cache
     */
    delete(key: string, namespace?: string): boolean;
    /**
     * Check if a key exists in cache
     */
    has(key: string, namespace?: string): boolean;
    /**
     * Get or set a value in cache
     * If the key exists and is not expired, returns the cached value
     * Otherwise, calls the factory function and caches the result
     */
    getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>;
    /**
     * Invalidate all entries matching a pattern
     */
    invalidatePattern(pattern: RegExp | string, namespace?: string): number;
    /**
     * Clear all cache entries in a namespace
     */
    clearNamespace(namespace: string): number;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Clean up expired entries
     */
    cleanup(): void;
    /**
     * Get cache entries that are expiring soon
     * @param thresholdMs Time threshold in milliseconds (entries expiring within this time)
     * @param namespace Optional namespace filter
     * @returns Array of cache keys that are expiring soon
     */
    getExpiringEntries(thresholdMs: number, namespace?: string): Array<{
        key: string;
        expiresIn: number;
    }>;
    /**
     * Evict oldest entries to free up space
     */
    private evictOldest;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Set request merger for read optimization
     * @param merger RequestMerger instance
     */
    setRequestMerger(merger: RequestMerger): void;
    /**
     * Get request merger if configured
     */
    getRequestMerger(): RequestMerger | undefined;
    /**
     * Build a cache key with optional namespace
     */
    private buildKey;
    /**
     * Estimate the size of a value in bytes
     */
    private estimateSize;
    /**
     * Get total cache size in bytes
     */
    private getTotalSize;
    /**
     * Track range dependency for cache invalidation
     * Associates a cache key with a spreadsheet range
     */
    trackRangeDependency(spreadsheetId: string, range: string, cacheKey: string): void;
    /**
     * Invalidate cache entries for a specific range
     * Only invalidates overlapping ranges, not the entire spreadsheet
     */
    invalidateRange(spreadsheetId: string, range: string): number;
    /**
     * Find ranges that overlap with the given range
     * Uses precise intersection algorithm to minimize false positives
     */
    private findOverlappingRanges;
    /**
     * Check if two A1 ranges overlap
     * Uses precise range intersection algorithm
     */
    private rangesOverlap;
    /**
     * Parse A1 notation into structured range
     * Handles: A1, A:A, 1:1, A1:B10, Sheet!A1:B10, 'Sheet Name'!A1:B10
     */
    private parseA1Notation;
    /**
     * Parse a single cell reference like "A1" into row and column numbers
     */
    private parseCell;
    /**
     * Convert column letter(s) to number (A=1, B=2, ..., Z=26, AA=27, etc.)
     */
    private columnToNumber;
    /**
     * Check if two parsed ranges intersect
     */
    private rangesIntersect;
}
/**
 * Global cache manager instance
 */
export declare const cacheManager: CacheManager;
/**
 * Helper: Create a cache key for API operations
 */
export declare function createCacheKey(operation: string, params: Record<string, unknown>): string;
//# sourceMappingURL=cache-manager.d.ts.map