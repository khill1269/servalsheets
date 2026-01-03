/**
 * ServalSheets - Rate Limiter
 * 
 * Enforces Google Sheets API rate limits
 */

import PQueue from 'p-queue';

export interface RateLimits {
  readsPerMinute: number;
  writesPerMinute: number;
  readsPerSecond: number;
  writesPerSecond: number;
}

const DEFAULT_LIMITS: RateLimits = {
  readsPerMinute: 300,
  writesPerMinute: 60,
  readsPerSecond: 10,
  writesPerSecond: 2,
};

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per second
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private readBucket: TokenBucket;
  private writeBucket: TokenBucket;
  private queue: PQueue;

  constructor(limits: RateLimits = DEFAULT_LIMITS) {
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
  async acquire(type: 'read' | 'write', count: number = 1): Promise<void> {
    return this.queue.add(async () => {
      const bucket = type === 'read' ? this.readBucket : this.writeBucket;
      
      // Refill bucket
      const now = Date.now();
      const elapsed = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(
        bucket.capacity,
        bucket.tokens + elapsed * bucket.refillRate
      );
      bucket.lastRefill = now;

      // Wait if not enough tokens
      while (bucket.tokens < count) {
        const waitTime = ((count - bucket.tokens) / bucket.refillRate) * 1000;
        await this.sleep(Math.min(waitTime, 1000));
        
        const elapsed = (Date.now() - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(
          bucket.capacity,
          bucket.tokens + elapsed * bucket.refillRate
        );
        bucket.lastRefill = Date.now();
      }

      // Consume tokens
      bucket.tokens -= count;
    });
  }

  /**
   * Get current token counts
   */
  getStatus(): { readTokens: number; writeTokens: number } {
    return {
      readTokens: this.readBucket.tokens,
      writeTokens: this.writeBucket.tokens,
    };
  }

  /**
   * Reset the limiter
   */
  reset(): void {
    this.readBucket.tokens = this.readBucket.capacity;
    this.writeBucket.tokens = this.writeBucket.capacity;
    this.readBucket.lastRefill = Date.now();
    this.writeBucket.lastRefill = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
