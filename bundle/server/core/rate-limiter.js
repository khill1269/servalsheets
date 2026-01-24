/**
 * ServalSheets - Rate Limiter
 *
 * Enforces Google Sheets API rate limits
 */
import PQueue from 'p-queue';
/**
 * Get rate limits from environment variables or use defaults
 */
function getRateLimits() {
    const readsPerMinute = parseInt(process.env['RATE_LIMIT_READS_PER_MINUTE'] || '300');
    const writesPerMinute = parseInt(process.env['RATE_LIMIT_WRITES_PER_MINUTE'] || '60');
    return {
        readsPerMinute,
        writesPerMinute,
        readsPerSecond: Math.ceil(readsPerMinute / 60),
        writesPerSecond: Math.ceil(writesPerMinute / 60),
    };
}
const DEFAULT_LIMITS = getRateLimits();
/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
    readBucket;
    writeBucket;
    queue;
    baseReadRate;
    baseWriteRate;
    throttleUntil = 0;
    constructor(limits = DEFAULT_LIMITS) {
        this.baseReadRate = limits.readsPerSecond;
        this.baseWriteRate = limits.writesPerSecond;
        this.readBucket = {
            tokens: limits.readsPerSecond,
            lastRefill: Date.now(),
            capacity: limits.readsPerSecond * 2,
            refillRate: limits.readsPerSecond,
        };
        this.writeBucket = {
            tokens: limits.writesPerSecond,
            lastRefill: Date.now(),
            capacity: limits.writesPerSecond * 2,
            refillRate: limits.writesPerSecond,
        };
        this.queue = new PQueue({ concurrency: 1 });
    }
    /**
     * Acquire tokens for an operation
     */
    async acquire(type, count = 1) {
        return this.queue.add(async () => {
            const bucket = type === 'read' ? this.readBucket : this.writeBucket;
            // Refill bucket
            const now = Date.now();
            const elapsed = (now - bucket.lastRefill) / 1000;
            bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillRate);
            bucket.lastRefill = now;
            // Wait if not enough tokens (calculate exact wait time and sleep once)
            if (bucket.tokens < count) {
                const tokensNeeded = count - bucket.tokens;
                const waitTime = (tokensNeeded / bucket.refillRate) * 1000;
                await this.sleep(waitTime);
                // Refill tokens after waiting
                const elapsed = (Date.now() - bucket.lastRefill) / 1000;
                bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillRate);
                bucket.lastRefill = Date.now();
            }
            // Consume tokens
            bucket.tokens -= count;
        });
    }
    /**
     * Get current token counts
     */
    getStatus() {
        return {
            readTokens: this.readBucket.tokens,
            writeTokens: this.writeBucket.tokens,
        };
    }
    /**
     * Reset the limiter
     */
    reset() {
        this.readBucket.tokens = this.readBucket.capacity;
        this.writeBucket.tokens = this.writeBucket.capacity;
        this.readBucket.lastRefill = Date.now();
        this.writeBucket.lastRefill = Date.now();
    }
    /**
     * Temporarily throttle rate limits after receiving a 429 error
     * Reduces rates by 50% for the specified duration
     */
    throttle(durationMs = 60000) {
        this.throttleUntil = Date.now() + durationMs;
        // Reduce refill rates by 50%
        this.readBucket.refillRate = this.baseReadRate * 0.5;
        this.writeBucket.refillRate = this.baseWriteRate * 0.5;
        // Also reduce capacity temporarily
        this.readBucket.capacity = this.baseReadRate;
        this.writeBucket.capacity = this.baseWriteRate;
    }
    /**
     * Restore normal rate limits
     */
    restoreNormalLimits() {
        if (Date.now() >= this.throttleUntil) {
            this.readBucket.refillRate = this.baseReadRate;
            this.writeBucket.refillRate = this.baseWriteRate;
            this.readBucket.capacity = this.baseReadRate * 2;
            this.writeBucket.capacity = this.baseWriteRate * 2;
            this.throttleUntil = 0;
        }
    }
    /**
     * Check if currently throttled
     */
    isThrottled() {
        return Date.now() < this.throttleUntil;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=rate-limiter.js.map