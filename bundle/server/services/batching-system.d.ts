/**
 * BatchingSystem
 *
 * @purpose Collects operations within 50-100ms time windows and merges them into single API calls for 20-40% API reduction
 * @category Performance
 * @usage Use for high-volume operations where multiple writes/updates occur rapidly; automatically batches batchUpdate requests
 * @dependencies logger, googleapis (sheets_v4)
 * @stateful Yes - maintains pending operation queues, active timers, metrics (batches processed, operations merged, API calls saved)
 * @singleton Yes - one instance per process to coordinate batching across all requests
 *
 * @example
 * const batching = new BatchingSystem({ windowMs: 75, maxBatchSize: 100 });
 * // Multiple operations submitted within window are automatically batched
 * await batching.queue({ type: 'values:update', spreadsheetId, range, values });
 * await batching.queue({ type: 'format:update', spreadsheetId, range, format });
 * // Both operations sent in single batchUpdate call
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Supported operation types that can be batched
 */
export type BatchableOperationType = 'values:update' | 'values:append' | 'values:clear' | 'format:update' | 'cells:update' | 'sheet:update';
/**
 * Operation to be batched
 */
export interface BatchableOperation<T = unknown> {
    /** Unique operation ID */
    id: string;
    /** Operation type */
    type: BatchableOperationType;
    /** Spreadsheet ID */
    spreadsheetId: string;
    /** Operation-specific parameters (varies by operation type) */
    params: any;
    /** Promise resolver */
    resolve: (result: T) => void;
    /** Promise rejecter */
    reject: (error: Error) => void;
    /** Timestamp when queued */
    queuedAt: number;
}
/**
 * Batch execution result
 */
export interface BatchResult {
    /** Number of operations in batch */
    operationCount: number;
    /** API calls made (should be 1) */
    apiCalls: number;
    /** Execution duration in ms */
    duration: number;
    /** Success status */
    success: boolean;
}
/**
 * Adaptive batch window configuration
 */
export interface AdaptiveBatchWindowConfig {
    /** Minimum window size in ms (default: 20) */
    minWindowMs?: number;
    /** Maximum window size in ms (default: 200) */
    maxWindowMs?: number;
    /** Initial window size in ms (default: 50) */
    initialWindowMs?: number;
    /** Low threshold - increase window if below this (default: 3) */
    lowThreshold?: number;
    /** High threshold - decrease window if above this (default: 50) */
    highThreshold?: number;
    /** Rate to increase window (default: 1.2) */
    increaseRate?: number;
    /** Rate to decrease window (default: 0.8) */
    decreaseRate?: number;
}
/**
 * Batching system configuration
 */
export interface BatchingSystemOptions {
    /** Collection window in ms (default: 50) - ignored if adaptive is enabled */
    windowMs?: number;
    /** Maximum operations per batch (default: 100) */
    maxBatchSize?: number;
    /** Enable batching (default: true) */
    enabled?: boolean;
    /** Verbose logging (default: false) */
    verboseLogging?: boolean;
    /** Enable adaptive window sizing (default: true) */
    adaptiveWindow?: boolean;
    /** Adaptive window configuration */
    adaptiveConfig?: AdaptiveBatchWindowConfig;
}
/**
 * Batching system statistics
 */
export interface BatchingStats {
    /** Total operations received */
    totalOperations: number;
    /** Total batches executed */
    totalBatches: number;
    /** Total API calls made */
    totalApiCalls: number;
    /** API calls saved by batching */
    apiCallsSaved: number;
    /** API call reduction percentage */
    reductionPercentage: number;
    /** Average batch size */
    avgBatchSize: number;
    /** Average batch duration */
    avgBatchDuration: number;
    /** Max batch size */
    maxBatchSize: number;
    /** Min batch size */
    minBatchSize: number;
    /** Current window size (ms) - only for adaptive mode */
    currentWindowMs?: number;
    /** Average window size (ms) - only for adaptive mode */
    avgWindowMs?: number;
}
/**
 * Adaptive Batch Window
 *
 * Dynamically adjusts batch collection window based on queue depth:
 * - Low traffic (< 3 ops): Increase window to collect more operations
 * - High traffic (> 50 ops): Decrease window to flush faster
 * - Optimal traffic: Maintain current window
 */
export declare class AdaptiveBatchWindow {
    private minWindowMs;
    private maxWindowMs;
    private currentWindowMs;
    private lowThreshold;
    private highThreshold;
    private increaseRate;
    private decreaseRate;
    private windowHistory;
    constructor(config?: AdaptiveBatchWindowConfig);
    /**
     * Get current window size
     */
    getCurrentWindow(): number;
    /**
     * Get average window size over history
     */
    getAverageWindow(): number;
    /**
     * Adjust window size based on operations in window
     */
    adjust(operationsInWindow: number): void;
    /**
     * Reset window to initial size
     */
    reset(): void;
    /**
     * Get configuration
     */
    getConfig(): Required<AdaptiveBatchWindowConfig>;
}
/**
 * Batch Request Time Windows System
 *
 * Collects operations within a time window and executes them as batched API calls
 */
export declare class BatchingSystem {
    private sheetsApi;
    private enabled;
    private windowMs;
    private maxBatchSize;
    private verboseLogging;
    private useAdaptiveWindow;
    private adaptiveWindow;
    private pendingBatches;
    private batchTimers;
    private stats;
    constructor(sheetsApi: sheets_v4.Sheets, options?: BatchingSystemOptions);
    /**
     * Execute an operation (with batching if enabled)
     */
    execute<T>(operation: Omit<BatchableOperation<T>, 'resolve' | 'reject' | 'queuedAt'>): Promise<T>;
    /**
     * Generate batch key for grouping operations
     */
    private getBatchKey;
    /**
     * Start timer for batch execution
     */
    private startBatchTimer;
    /**
     * Cancel batch timer
     */
    private cancelBatchTimer;
    /**
     * Execute a batch of operations
     */
    private executeBatch;
    /**
     * Execute batch of values.update operations
     */
    private executeBatchValuesUpdate;
    /**
     * Execute batch of values.append operations
     *
     * Converts multiple append operations into a single batchUpdate call with appendCells requests.
     * This is the critical fix for the 80-90% quota waste bug.
     */
    private executeBatchValuesAppend;
    /**
     * Execute batch of values.clear operations
     */
    private executeBatchValuesClear;
    /**
     * Execute batch using batchUpdate (for format/cell/sheet operations)
     */
    private executeBatchBatchUpdate;
    /**
     * Execute operation immediately (without batching)
     */
    private executeImmediate;
    /**
     * Get batching statistics
     */
    getStats(): BatchingStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Flush all pending batches immediately
     */
    flush(): Promise<void>;
    /**
     * Destroy the batching system
     */
    destroy(): void;
}
/**
 * Initialize the batching system
 */
export declare function initBatchingSystem(sheetsApi: sheets_v4.Sheets): BatchingSystem;
/**
 * Get the batching system singleton
 */
export declare function getBatchingSystem(): BatchingSystem | null;
/**
 * Reset batching system (for testing only)
 * @internal
 */
export declare function resetBatchingSystem(): void;
//# sourceMappingURL=batching-system.d.ts.map