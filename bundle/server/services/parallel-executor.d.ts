/**
 * ParallelExecutor
 *
 * @purpose Manages concurrent API requests with configurable concurrency (default: 5), automatic retry, and progress tracking
 * @category Performance
 * @usage Use for bulk operations requiring multiple API calls; executes in parallel up to limit, retries failures with backoff, aggregates errors
 * @dependencies logger, retry utility
 * @stateful Yes - maintains active request queue, concurrency counter, progress state, error aggregation
 * @singleton No - instantiate per bulk operation with specific concurrency needs
 *
 * @example
 * const executor = new ParallelExecutor({ concurrency: 5, retryAttempts: 3 });
 * const results = await executor.executeAll(operations, { onProgress: (done, total) => logger.info(`${done}/${total}`) });
 * if (results.errors.length > 0) logger.error('Some operations failed:', results.errors);
 * - Request deduplication integration
 */
export interface ParallelExecutorOptions {
    /** Maximum concurrent requests (default: 20) */
    concurrency?: number;
    /** Enable verbose logging (default: false) */
    verboseLogging?: boolean;
    /** Retry failed requests (default: true) */
    retryOnError?: boolean;
    /** Max retry attempts per request (default: 3) */
    maxRetries?: number;
    /** Initial retry delay in ms (default: 1000) */
    retryDelayMs?: number;
}
export interface ParallelTask<T> {
    /** Unique identifier for this task */
    id: string;
    /** Async function to execute */
    fn: () => Promise<T>;
    /** Optional priority (higher = earlier, default: 0) */
    priority?: number;
}
export interface ParallelResult<T> {
    /** Task ID */
    id: string;
    /** Task result (if successful) */
    result?: T;
    /** Error (if failed) */
    error?: Error;
    /** Whether task succeeded */
    success: boolean;
    /** Execution duration in ms */
    duration: number;
    /** Number of retries attempted */
    retries: number;
}
export interface ParallelProgress {
    /** Total tasks */
    total: number;
    /** Completed tasks */
    completed: number;
    /** Failed tasks */
    failed: number;
    /** Currently running tasks */
    running: number;
    /** Percentage complete (0-100) */
    percentComplete: number;
}
/**
 * Parallel Request Executor
 *
 * Executes multiple async tasks in parallel with concurrency control
 */
export declare class ParallelExecutor {
    private concurrency;
    private verboseLogging;
    private retryOnError;
    private maxRetries;
    private retryDelayMs;
    private stats;
    constructor(options?: ParallelExecutorOptions);
    /**
     * Execute tasks in parallel with concurrency control
     */
    executeAll<T>(tasks: ParallelTask<T>[], onProgress?: (progress: ParallelProgress) => void): Promise<ParallelResult<T>[]>;
    /**
     * Execute tasks and return only successful results
     */
    executeAllSuccessful<T>(tasks: ParallelTask<T>[], onProgress?: (progress: ParallelProgress) => void): Promise<T[]>;
    /**
     * Execute tasks and throw if any fail
     */
    executeAllOrFail<T>(tasks: ParallelTask<T>[], onProgress?: (progress: ParallelProgress) => void): Promise<T[]>;
    /**
     * Get execution statistics with percentile metrics
     */
    getStats(): unknown;
    /**
     * Calculate percentile from sorted array
     */
    private getPercentile;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Get or create the parallel executor singleton
 */
export declare function getParallelExecutor(): ParallelExecutor;
/**
 * Set the parallel executor (for testing or custom configuration)
 */
export declare function setParallelExecutor(executor: ParallelExecutor): void;
/**
 * Reset the parallel executor (for testing only)
 * @internal
 */
export declare function resetParallelExecutor(): void;
//# sourceMappingURL=parallel-executor.d.ts.map