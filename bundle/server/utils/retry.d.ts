/**
 * ServalSheets - Retry Utilities
 *
 * Exponential backoff with jitter and request timeouts.
 */
export interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
    retryable?: (error: unknown) => boolean;
    timeoutMs?: number;
}
export declare function executeWithRetry<T>(operation: (signal: AbortSignal) => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map