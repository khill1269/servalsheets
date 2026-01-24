/**
 * ServalSheets - Rate Limiter
 *
 * Enforces Google Sheets API rate limits
 */
export interface RateLimits {
    readsPerMinute: number;
    writesPerMinute: number;
    readsPerSecond: number;
    writesPerSecond: number;
}
/**
 * Rate limiter using token bucket algorithm
 */
export declare class RateLimiter {
    private readBucket;
    private writeBucket;
    private queue;
    private baseReadRate;
    private baseWriteRate;
    private throttleUntil;
    constructor(limits?: RateLimits);
    /**
     * Acquire tokens for an operation
     */
    acquire(type: 'read' | 'write', count?: number): Promise<void>;
    /**
     * Get current token counts
     */
    getStatus(): {
        readTokens: number;
        writeTokens: number;
    };
    /**
     * Reset the limiter
     */
    reset(): void;
    /**
     * Temporarily throttle rate limits after receiving a 429 error
     * Reduces rates by 50% for the specified duration
     */
    throttle(durationMs?: number): void;
    /**
     * Restore normal rate limits
     */
    restoreNormalLimits(): void;
    /**
     * Check if currently throttled
     */
    isThrottled(): boolean;
    private sleep;
}
//# sourceMappingURL=rate-limiter.d.ts.map