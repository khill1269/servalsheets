/**
 * ServalSheets - Infrastructure Optimization
 *
 * Phase 5: Infrastructure optimizations for improved throughput and latency.
 *
 * Optimizations:
 * 1. Request coalescing - combine multiple requests to same spreadsheet
 * 2. Connection keep-alive management
 * 3. Prefetch hints for predictable access patterns
 * 4. Batch request queuing with smart scheduling
 *
 * @module utils/infrastructure
 */
import type { sheets_v4 } from 'googleapis';
export interface PendingRequest<T> {
    id: string;
    spreadsheetId: string;
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
    priority: number;
}
export interface CoalescedBatch {
    spreadsheetId: string;
    requests: PendingRequest<unknown>[];
    scheduledTime: number;
}
export interface RequestQueueStats {
    pending: number;
    coalesced: number;
    executed: number;
    avgCoalesceSize: number;
    avgLatencyMs: number;
}
/**
 * Coalesces multiple requests to the same spreadsheet into batches
 *
 * Instead of executing requests immediately, queues them and waits
 * a short window to combine with other requests to the same spreadsheet.
 */
export declare class RequestCoalescer {
    private pendingRequests;
    private scheduledFlushes;
    private stats;
    private coalesceWindowMs;
    private maxCoalesceSize;
    constructor(options?: {
        coalesceWindowMs?: number;
        maxCoalesceSize?: number;
    });
    /**
     * Queue a request for coalescing
     */
    queue<T>(spreadsheetId: string, operation: () => Promise<T>, priority?: number): Promise<T>;
    /**
     * Add request to pending queue
     */
    private addRequest;
    /**
     * Schedule a flush for the spreadsheet
     */
    private scheduleFlush;
    /**
     * Flush pending requests immediately
     */
    private flushNow;
    /**
     * Flush all pending requests
     */
    flushAll(): Promise<void>;
    /**
     * Get queue statistics
     */
    getStats(): RequestQueueStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Predicts and prefetches data based on access patterns
 */
export declare class PrefetchPredictor {
    private accessHistory;
    private maxHistory;
    private prefetchCache;
    private prefetchTtl;
    /**
     * Record an access and predict next accesses
     */
    recordAccess(spreadsheetId: string, range: string): string[];
    /**
     * Predict next ranges based on access patterns
     */
    private predictNextRanges;
    /**
     * Predict next sequential range
     */
    private predictSequentialRange;
    /**
     * Find patterns from history
     */
    private findHistoricalPatterns;
    /**
     * Store prefetched data
     */
    storePrefetch(key: string, data: unknown): void;
    /**
     * Get prefetched data if available and not expired
     */
    getPrefetch(key: string): unknown | undefined;
    /**
     * Clear expired prefetch entries
     */
    clearExpired(): number;
}
/**
 * Schedules and batches Google Sheets API requests
 */
export declare class BatchRequestScheduler {
    private pendingBatches;
    private scheduledFlushes;
    private sheetsApi;
    private batchWindowMs;
    private maxBatchSize;
    constructor(sheetsApi: sheets_v4.Sheets, options?: {
        batchWindowMs?: number;
        maxBatchSize?: number;
    });
    /**
     * Schedule requests for batching
     */
    scheduleRequests(spreadsheetId: string, requests: sheets_v4.Schema$Request[]): Promise<sheets_v4.Schema$Response[]>;
    /**
     * Schedule a flush
     */
    private scheduleFlush;
    /**
     * Flush a batch immediately
     */
    private flushBatch;
    /**
     * Flush all pending batches
     */
    flushAll(): Promise<void>;
}
/**
 * Simple connection state tracker for Google API clients
 * Note: googleapis handles actual HTTP connections internally
 */
export declare class ConnectionPool {
    private activeRequests;
    private maxConcurrent;
    private queue;
    constructor(maxConcurrent?: number);
    /**
     * Execute operation with concurrency limiting
     */
    execute<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Run operation and manage concurrency
     */
    private runOperation;
    /**
     * Process queued operations
     */
    private processQueue;
    /**
     * Get current stats
     */
    getStats(): {
        active: number;
        queued: number;
        maxConcurrent: number;
    };
}
/**
 * Get or create request coalescer singleton
 */
export declare function getRequestCoalescer(options?: {
    coalesceWindowMs?: number;
    maxCoalesceSize?: number;
}): RequestCoalescer;
/**
 * Get or create prefetch predictor singleton
 */
export declare function getPrefetchPredictor(): PrefetchPredictor;
/**
 * Get or create connection pool singleton
 */
export declare function getConnectionPool(maxConcurrent?: number): ConnectionPool;
export declare const Infrastructure: {
    RequestCoalescer: typeof RequestCoalescer;
    getRequestCoalescer: typeof getRequestCoalescer;
    PrefetchPredictor: typeof PrefetchPredictor;
    getPrefetchPredictor: typeof getPrefetchPredictor;
    BatchRequestScheduler: typeof BatchRequestScheduler;
    ConnectionPool: typeof ConnectionPool;
    getConnectionPool: typeof getConnectionPool;
    MAX_COALESCE_SIZE: number;
    COALESCE_WINDOW_MS: number;
    MAX_PENDING_PER_SPREADSHEET: number;
    PREFETCH_LOOKAHEAD: number;
};
//# sourceMappingURL=infrastructure.d.ts.map