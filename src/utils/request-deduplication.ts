/**
 * Request Deduplication Service
 *
 * Prevents duplicate API calls by caching in-flight requests.
 * If a duplicate request arrives while the first is pending,
 * returns the same promise instead of making another API call.
 *
 * Benefits:
 * - Reduces redundant API calls
 * - Saves quota and bandwidth
 * - Improves response time for duplicate requests
 *
 * Environment Variables:
 * - DEDUPLICATION_ENABLED: 'true' to enable (default: true)
 * - DEDUPLICATION_TIMEOUT: Request timeout in ms (default: 30000)
 * - DEDUPLICATION_MAX_PENDING: Max pending requests (default: 1000)
 */

import { createHash } from 'crypto';
import { logger } from './logger.js';

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  requestKey: string;
}

interface DeduplicationOptions {
  /** Enable/disable deduplication (default: true) */
  enabled?: boolean;

  /** Timeout in ms for pending requests (default: 30000 = 30s) */
  timeout?: number;

  /** Maximum number of pending requests to track (default: 1000) */
  maxPendingRequests?: number;
}

/**
 * Request Deduplication Manager
 * Tracks in-flight requests and prevents duplicates
 */
export class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest<unknown>>;
  private options: Required<DeduplicationOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  // Metrics
  private totalRequests = 0;
  private deduplicatedRequests = 0;

  constructor(options: DeduplicationOptions = {}) {
    this.pendingRequests = new Map();
    this.options = {
      enabled: options.enabled ?? true,
      timeout: options.timeout ?? 30000,
      maxPendingRequests: options.maxPendingRequests ?? 1000,
    };

    // Start cleanup timer if enabled
    if (this.options.enabled) {
      this.startCleanupTimer();
    }
  }

  /**
   * Execute a request with deduplication
   * If an identical request is in-flight, returns the existing promise
   */
  async deduplicate<T>(
    requestKey: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Skip deduplication if disabled
    if (!this.options.enabled) {
      return requestFn();
    }

    // Generate hash key
    const key = this.generateKey(requestKey);

    // Track total requests
    this.totalRequests++;

    // Check if request is already pending
    const existing = this.pendingRequests.get(key);
    if (existing) {
      this.deduplicatedRequests++;
      logger.debug('Request deduplicated', {
        key: requestKey,
        hash: key.substring(0, 8),
        age: Date.now() - existing.timestamp,
        savedRequests: this.deduplicatedRequests,
        deduplicationRate: `${this.getDeduplicationRate().toFixed(1)}%`,
      });
      return existing.promise as Promise<T>;
    }

    // Check if we've exceeded max pending requests
    if (this.pendingRequests.size >= this.options.maxPendingRequests) {
      logger.warn('Max pending requests reached, cleaning up oldest', {
        count: this.pendingRequests.size,
        max: this.options.maxPendingRequests,
      });
      this.cleanupOldestRequests();
    }

    logger.debug('New request registered', {
      key: requestKey,
      hash: key.substring(0, 8),
      pendingCount: this.pendingRequests.size,
    });

    // Create promise FIRST to prevent race condition
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key);
      logger.debug('Request completed, removed from cache', {
        key: requestKey,
        hash: key.substring(0, 8),
        remainingPending: this.pendingRequests.size,
      });
    });

    // Store the promise immediately - no window for race condition
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      requestKey,
    });

    return promise;
  }

  /**
   * Generate a hash key from request parameters
   * Uses SHA-256 truncated to 128 bits for collision resistance
   */
  private generateKey(requestKey: string): string {
    return createHash('sha256')
      .update(requestKey)
      .digest('hex')
      .substring(0, 32); // 128 bits (32 hex chars)
  }

  /**
   * Start periodic cleanup of stale requests
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleRequests();
    }, 5000); // Check every 5 seconds

    // Don't keep process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up requests that have exceeded timeout
   */
  private cleanupStaleRequests(): void {
    const now = Date.now();
    const staleKeys: string[] = [];

    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.options.timeout) {
        staleKeys.push(key);
      }
    }

    if (staleKeys.length > 0) {
      logger.warn('Cleaning up stale requests', {
        count: staleKeys.length,
        timeout: this.options.timeout,
      });

      staleKeys.forEach((key) => this.pendingRequests.delete(key));
    }
  }

  /**
   * Clean up oldest requests when max limit is reached
   */
  private cleanupOldestRequests(): void {
    // Remove oldest 10% of requests
    const countToRemove = Math.ceil(this.pendingRequests.size * 0.1);

    const sortedByAge = Array.from(this.pendingRequests.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, countToRemove);

    sortedByAge.forEach(([key]) => {
      this.pendingRequests.delete(key);
    });

    logger.debug('Removed oldest requests', {
      removed: countToRemove,
      remaining: this.pendingRequests.size,
    });
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    const count = this.pendingRequests.size;
    this.pendingRequests.clear();
    logger.debug('Cleared all pending requests', { count });
  }

  /**
   * Get statistics about pending requests
   */
  getStats(): {
    pendingCount: number;
    enabled: boolean;
    oldestRequestAge: number | null;
    totalRequests: number;
    deduplicatedRequests: number;
    savedRequests: number;
    deduplicationRate: number;
  } {
    let oldestAge: number | null = null;

    if (this.pendingRequests.size > 0) {
      const now = Date.now();
      const timestamps = Array.from(this.pendingRequests.values()).map(
        (r) => r.timestamp
      );
      const oldestTimestamp = Math.min(...timestamps);
      oldestAge = now - oldestTimestamp;
    }

    return {
      pendingCount: this.pendingRequests.size,
      enabled: this.options.enabled,
      oldestRequestAge: oldestAge,
      totalRequests: this.totalRequests,
      deduplicatedRequests: this.deduplicatedRequests,
      savedRequests: this.deduplicatedRequests,
      deduplicationRate: this.getDeduplicationRate(),
    };
  }

  /**
   * Get the percentage of requests that were deduplicated (0-100)
   */
  getDeduplicationRate(): number {
    if (this.totalRequests === 0) {
      return 0;
    }
    return (this.deduplicatedRequests / this.totalRequests) * 100;
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.deduplicatedRequests = 0;
  }

  /**
   * Stop the cleanup timer and clear all requests
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}

/**
 * Parse environment variable as integer with validation
 */
function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}

/**
 * Global deduplicator instance
 */
export const requestDeduplicator = new RequestDeduplicator({
  enabled: process.env['DEDUPLICATION_ENABLED'] !== 'false',
  timeout: parseEnvInt(process.env['DEDUPLICATION_TIMEOUT'], 30000),
  maxPendingRequests: parseEnvInt(
    process.env['DEDUPLICATION_MAX_PENDING'],
    1000
  ),
});

/**
 * Helper: Create a request key from parameters
 * Sorts keys for consistent hashing
 */
export function createRequestKey(
  operation: string,
  params: Record<string, unknown>
): string {
  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${operation}:${serialized}`;
}
