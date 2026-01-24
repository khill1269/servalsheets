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
import { logger } from '../utils/logger.js';
/**
 * Parallel Request Executor
 *
 * Executes multiple async tasks in parallel with concurrency control
 */
export class ParallelExecutor {
    concurrency;
    verboseLogging;
    retryOnError;
    maxRetries;
    retryDelayMs;
    // Statistics
    stats = {
        totalExecuted: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        totalRetries: 0,
        totalDuration: 0,
        durations: [], // Track individual durations for percentile calculations
    };
    constructor(options = {}) {
        // Default concurrency increased to 20 to better utilize Google Sheets API quotas
        const DEFAULT_CONCURRENCY = 20;
        // Support PARALLEL_CONCURRENCY environment variable
        const envConcurrency = process.env['PARALLEL_CONCURRENCY']
            ? parseInt(process.env['PARALLEL_CONCURRENCY'], 10)
            : undefined;
        // Use options.concurrency, then env var, then default
        this.concurrency = options.concurrency ?? envConcurrency ?? DEFAULT_CONCURRENCY;
        // Ensure reasonable bounds: minimum 1, maximum 100
        this.concurrency = Math.max(1, Math.min(100, this.concurrency));
        this.verboseLogging = options.verboseLogging ?? false;
        this.retryOnError = options.retryOnError ?? true;
        this.maxRetries = options.maxRetries ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
        if (this.verboseLogging) {
            logger.info('Parallel executor initialized', {
                concurrency: this.concurrency,
                retryOnError: this.retryOnError,
                maxRetries: this.maxRetries,
            });
        }
    }
    /**
     * Execute tasks in parallel with concurrency control
     */
    async executeAll(tasks, onProgress) {
        if (tasks.length === 0) {
            return [];
        }
        // Sort by priority (higher first)
        const sortedTasks = [...tasks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        const results = [];
        const executing = [];
        let completed = 0;
        let failed = 0;
        // Progress reporting helper
        const reportProgress = () => {
            if (onProgress) {
                onProgress({
                    total: tasks.length,
                    completed,
                    failed,
                    running: executing.length,
                    percentComplete: (completed / tasks.length) * 100,
                });
            }
        };
        // Execute task with retry logic
        const executeTask = async (task) => {
            const startTime = Date.now();
            let retries = 0;
            let lastError;
            while (retries <= this.maxRetries) {
                try {
                    const result = await task.fn();
                    const duration = Date.now() - startTime;
                    results.push({
                        id: task.id,
                        result,
                        success: true,
                        duration,
                        retries,
                    });
                    this.stats.totalExecuted++;
                    this.stats.totalSucceeded++;
                    this.stats.totalDuration += duration;
                    this.stats.totalRetries += retries;
                    this.stats.durations.push(duration);
                    completed++;
                    if (this.verboseLogging) {
                        logger.debug('Task completed successfully', {
                            id: task.id,
                            duration,
                            retries,
                        });
                    }
                    reportProgress();
                    return;
                }
                catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    retries++;
                    if (retries <= this.maxRetries && this.retryOnError) {
                        const delay = this.retryDelayMs * Math.pow(2, retries - 1); // Exponential backoff
                        logger.warn('Task failed, retrying', {
                            id: task.id,
                            attempt: retries,
                            maxRetries: this.maxRetries,
                            delayMs: delay,
                            error: lastError.message,
                        });
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                    else {
                        break;
                    }
                }
            }
            // All retries exhausted
            const duration = Date.now() - startTime;
            results.push({
                id: task.id,
                error: lastError,
                success: false,
                duration,
                retries: retries - 1,
            });
            this.stats.totalExecuted++;
            this.stats.totalFailed++;
            this.stats.totalDuration += duration;
            this.stats.totalRetries += retries - 1;
            this.stats.durations.push(duration);
            completed++;
            failed++;
            logger.error('Task failed after retries', {
                id: task.id,
                retries: retries - 1,
                error: lastError?.message,
            });
            reportProgress();
        };
        // Execute with concurrency control
        for (const task of sortedTasks) {
            // Wait if we're at max concurrency
            if (executing.length >= this.concurrency) {
                await Promise.race(executing);
            }
            // Start task execution
            const promise = executeTask(task).then(() => {
                // Remove from executing array when done
                const index = executing.indexOf(promise);
                if (index > -1) {
                    executing.splice(index, 1);
                }
            });
            executing.push(promise);
        }
        // Wait for all remaining tasks
        await Promise.all(executing);
        // Final progress report
        reportProgress();
        return results;
    }
    /**
     * Execute tasks and return only successful results
     */
    async executeAllSuccessful(tasks, onProgress) {
        const results = await this.executeAll(tasks, onProgress);
        return results.filter((r) => r.success && r.result !== undefined).map((r) => r.result);
    }
    /**
     * Execute tasks and throw if any fail
     */
    async executeAllOrFail(tasks, onProgress) {
        const results = await this.executeAll(tasks, onProgress);
        const failures = results.filter((r) => !r.success);
        if (failures.length > 0) {
            const errorMessages = failures.map((f) => `${f.id}: ${f.error?.message}`).join('; ');
            throw new Error(`${failures.length} task(s) failed: ${errorMessages}`);
        }
        return results.map((r) => r.result);
    }
    /**
     * Get execution statistics with percentile metrics
     */
    getStats() {
        const sortedDurations = [...this.stats.durations].sort((a, b) => a - b);
        const p50 = this.getPercentile(sortedDurations, 50);
        const p95 = this.getPercentile(sortedDurations, 95);
        const p99 = this.getPercentile(sortedDurations, 99);
        return {
            totalExecuted: this.stats.totalExecuted,
            totalSucceeded: this.stats.totalSucceeded,
            totalFailed: this.stats.totalFailed,
            totalRetries: this.stats.totalRetries,
            totalDuration: this.stats.totalDuration,
            successRate: this.stats.totalExecuted > 0
                ? (this.stats.totalSucceeded / this.stats.totalExecuted) * 100
                : 0,
            averageDuration: this.stats.totalExecuted > 0 ? this.stats.totalDuration / this.stats.totalExecuted : 0,
            p50Duration: p50,
            p95Duration: p95,
            p99Duration: p99,
            minDuration: sortedDurations[0] ?? 0,
            maxDuration: sortedDurations[sortedDurations.length - 1] ?? 0,
            averageRetries: this.stats.totalExecuted > 0 ? this.stats.totalRetries / this.stats.totalExecuted : 0,
        };
    }
    /**
     * Calculate percentile from sorted array
     */
    getPercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[Math.max(0, index)] ?? 0;
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalExecuted: 0,
            totalSucceeded: 0,
            totalFailed: 0,
            totalRetries: 0,
            totalDuration: 0,
            durations: [],
        };
    }
}
// Singleton instance
let parallelExecutor = null;
/**
 * Get or create the parallel executor singleton
 */
export function getParallelExecutor() {
    if (!parallelExecutor) {
        parallelExecutor = new ParallelExecutor({
            verboseLogging: process.env['PARALLEL_VERBOSE'] === 'true',
            // Concurrency will be determined by constructor's env var handling
        });
    }
    return parallelExecutor;
}
/**
 * Set the parallel executor (for testing or custom configuration)
 */
export function setParallelExecutor(executor) {
    parallelExecutor = executor;
}
/**
 * Reset the parallel executor (for testing only)
 * @internal
 */
export function resetParallelExecutor() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetParallelExecutor() can only be called in test environment');
    }
    parallelExecutor = null;
}
//# sourceMappingURL=parallel-executor.js.map