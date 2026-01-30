/**
 * PrefetchingSystem
 *
 * @purpose Intelligently prefetches data based on access patterns (adjacent ranges, predicted next access) to reduce latency by 30-50%
 * @category Performance
 * @usage Use with high cache hit rate scenarios; prefetches adjacent ranges, refreshes before cache expiry, priority queue (max 2 concurrent)
 * @dependencies sheets_v4, AccessPatternTracker, cache-manager, logger, p-queue
 * @stateful Yes - maintains prefetch queue, background refresh timers, access pattern tracker, metrics (hits, misses, prefetch efficiency)
 * @singleton Yes - one instance per process to coordinate prefetching and prevent duplicate requests
 *
 * @example
 * const prefetch = new PrefetchingSystem(sheetsClient, { enabled: true, concurrency: 2, refreshBeforeExpiry: 60000 });
 * await prefetch.prefetchAdjacent(spreadsheetId, 'Sheet1!A1:Z10'); // Prefetches A1:Z20, A1:Z100
 * prefetch.scheduleRefresh(cacheKey, expiryTime); // Auto-refresh before expiry
 */
import type { sheets_v4 } from 'googleapis';
export interface PrefetchOptions {
    /** Enable/disable prefetching (default: true) */
    enabled?: boolean;
    /** Maximum concurrent prefetch requests (default: 2) */
    concurrency?: number;
    /** Minimum confidence threshold for prefetching (default: 0.5) */
    minConfidence?: number;
    /** Enable background refresh (default: true) */
    backgroundRefresh?: boolean;
    /** Refresh TTL threshold in ms (default: 60000 = 1 min before expiry) */
    refreshThreshold?: number;
}
export interface PrefetchTask {
    spreadsheetId: string;
    range?: string;
    sheetId?: number;
    comprehensive?: boolean;
    confidence: number;
    reason: string;
    priority: number;
}
export interface RefreshTask {
    cacheKey: string;
    spreadsheetId: string;
    range?: string;
    sheetId?: number;
    comprehensive?: boolean;
    priority: number;
    lastAccessed: number;
    accessCount: number;
}
export interface RefreshMetadata {
    spreadsheetId: string;
    range?: string;
    comprehensive?: boolean;
    lastAccessed: number;
    accessCount: number;
}
export interface PrefetchStats {
    totalPrefetches: number;
    successfulPrefetches: number;
    failedPrefetches: number;
    cacheHitsFromPrefetch: number;
    prefetchHitRate: number;
    totalRefreshes: number;
    successfulRefreshes: number;
    failedRefreshes: number;
    refreshHitRate: number;
}
/**
 * Predictive Prefetching System
 */
export declare class PrefetchingSystem {
    private sheetsApi;
    private enabled;
    private minConfidence;
    private backgroundRefresh;
    private refreshThreshold;
    private queue;
    private refreshTimer?;
    private prefetchedKeys;
    private refreshMetadata;
    private refreshCheckInterval;
    private stats;
    constructor(sheetsApi: sheets_v4.Sheets, options?: PrefetchOptions);
    /**
     * Prefetch data based on current access
     */
    prefetch(current: {
        spreadsheetId: string;
        sheetId?: number;
        range?: string;
    }): Promise<void>;
    /**
     * Prefetch common resources on spreadsheet open
     * Phase 2: Enhanced to prefetch COMPREHENSIVE metadata
     */
    prefetchOnOpen(spreadsheetId: string): Promise<void>;
    /**
     * Create prefetch task from prediction
     */
    private createPrefetchTask;
    /**
     * Queue a prefetch task
     */
    private queuePrefetch;
    /**
     * Execute prefetch task
     * Phase 2: Enhanced to support comprehensive metadata prefetching
     */
    private executePrefetch;
    /**
     * Track refresh metadata for a cache entry
     *
     * Stores metadata needed to reconstruct refresh tasks
     */
    private trackRefreshMetadata;
    /**
     * Start background refresh worker
     */
    private startBackgroundRefresh;
    /**
     * Refresh cache entries that are expiring soon
     *
     * This method detects cache entries expiring within the refresh threshold
     * and proactively refreshes them to prevent cache misses on hot paths.
     */
    private refreshExpiringSoon;
    /**
     * Create a refresh task from a cache key
     *
     * Parses the cache key to reconstruct the original request parameters
     * and determines refresh priority based on access patterns.
     */
    private createRefreshTask;
    /**
     * Calculate refresh priority based on access patterns
     *
     * Hot data (frequently accessed, recently used) gets higher priority
     */
    private calculateRefreshPriority;
    /**
     * Parse cache key to extract request parameters
     *
     * Cache keys are in format: "operation:param1=value1&param2=value2"
     */
    private parseCacheKey;
    /**
     * Refresh a cache entry
     *
     * Re-fetches the data and updates the cache
     */
    private refreshCacheEntry;
    /**
     * Generate cache key for prefetch
     * Phase 2: Updated to handle comprehensive metadata
     */
    private getPrefetchCacheKey;
    /**
     * Mark that a cache hit came from prefetch
     */
    markPrefetchHit(cacheKey: string): void;
    /**
     * Get prefetch statistics
     */
    getStats(): PrefetchStats;
    /**
     * Stop background refresh
     */
    destroy(): void;
}
/**
 * Initialize the prefetching system
 */
export declare function initPrefetchingSystem(sheetsApi: sheets_v4.Sheets): PrefetchingSystem;
/**
 * Get the prefetching system singleton
 */
export declare function getPrefetchingSystem(): PrefetchingSystem | null;
/**
 * Reset the prefetching system (for testing only)
 * @internal
 */
export declare function resetPrefetchingSystem(): void;
//# sourceMappingURL=prefetching-system.d.ts.map