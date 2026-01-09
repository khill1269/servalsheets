/**
 * ServalSheets - Batch Request Aggregator
 *
 * Aggregates similar requests within a time window and executes them as batch operations.
 * Reduces API call count and improves overall throughput.
 * Phase 2, Task 2.3
 *
 * Features:
 * - Time-window based aggregation
 * - Automatic batch API call generation
 * - Promise resolution for individual requests
 * - Configurable window size and max batch size
 * - Per-spreadsheet batching
 */

import { logger } from "../utils/logger.js";

export interface BatchRequest<T = unknown> {
  /** Unique identifier for tracking */
  id: string;
  /** Spreadsheet ID (for grouping) */
  spreadsheetId: string;
  /** Request parameters */
  params: T;
  /** Promise resolve function */
  resolve: (result: unknown) => void;
  /** Promise reject function */
  reject: (error: Error) => void;
  /** Timestamp when request was added */
  timestamp: number;
}

export interface BatchWindow<T = unknown> {
  /** Requests in this window */
  requests: BatchRequest<T>[];
  /** Timer for window expiration */
  timer: NodeJS.Timeout;
  /** Window start time */
  startTime: number;
}

export interface BatchAggregatorOptions {
  /** Time window in ms (default: 50ms) */
  windowMs?: number;
  /** Max requests per batch (default: 100) */
  maxBatchSize?: number;
  /** Enable verbose logging (default: false) */
  verboseLogging?: boolean;
}

export interface BatchAggregatorStats {
  totalRequests: number;
  batchedRequests: number;
  batchesSent: number;
  averageBatchSize: number;
  apiCallReduction: number;
}

/**
 * Batch Request Aggregator
 *
 * Collects requests within a time window and executes them as batches
 */
export class BatchAggregator<T = unknown> {
  private windows: Map<string, BatchWindow<T>> = new Map();
  private windowMs: number;
  private maxBatchSize: number;
  private verboseLogging: boolean;

  // Statistics
  private stats = {
    totalRequests: 0,
    batchedRequests: 0,
    batchesSent: 0,
  };

  constructor(
    private batchExecutor: (requests: BatchRequest<T>[]) => Promise<unknown[]>,
    options: BatchAggregatorOptions = {},
  ) {
    this.windowMs = options.windowMs ?? 50;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.verboseLogging = options.verboseLogging ?? false;

    if (this.verboseLogging) {
      logger.info("Batch aggregator initialized", {
        windowMs: this.windowMs,
        maxBatchSize: this.maxBatchSize,
      });
    }
  }

  /**
   * Add a request to the aggregation window
   * Returns a promise that resolves when the batch executes
   */
  add(id: string, spreadsheetId: string, params: T): Promise<unknown> {
    this.stats.totalRequests++;

    return new Promise((resolve, reject) => {
      const request: BatchRequest<T> = {
        id,
        spreadsheetId,
        params,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Get or create window for this spreadsheet
      const windowKey = this.getWindowKey(spreadsheetId);
      let window = this.windows.get(windowKey);

      if (!window) {
        // Create new window
        window = {
          requests: [],
          timer: setTimeout(() => this.executeWindow(windowKey), this.windowMs),
          startTime: Date.now(),
        };
        this.windows.set(windowKey, window);

        if (this.verboseLogging) {
          logger.debug("Created new batch window", {
            windowKey,
            windowMs: this.windowMs,
          });
        }
      }

      // Add request to window
      window.requests.push(request);

      // Execute immediately if window is full
      if (window.requests.length >= this.maxBatchSize) {
        clearTimeout(window.timer);
        this.executeWindow(windowKey);
      }
    });
  }

  /**
   * Execute all requests in a window as a batch
   */
  private async executeWindow(windowKey: string): Promise<void> {
    const window = this.windows.get(windowKey);
    if (!window || window.requests.length === 0) {
      this.windows.delete(windowKey);
      return;
    }

    const requests = window.requests;
    this.windows.delete(windowKey);

    const batchSize = requests.length;
    this.stats.batchedRequests += batchSize;
    this.stats.batchesSent++;

    if (this.verboseLogging) {
      logger.debug("Executing batch window", {
        windowKey,
        batchSize,
        windowDuration: Date.now() - window.startTime,
      });
    }

    try {
      // Execute batch
      const results = await this.batchExecutor(requests);

      // Resolve individual promises
      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        const result = results[i];

        if (request && result !== undefined) {
          request.resolve(result);
        } else if (request) {
          request.reject(new Error("No result returned for request"));
        }
      }

      logger.info("Batch executed successfully", {
        windowKey,
        batchSize,
        apiCallsSaved: batchSize - 1,
      });
    } catch (error) {
      // Reject all promises in batch
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Batch execution failed", {
        windowKey,
        batchSize,
        error: errorMessage,
      });

      for (const request of requests) {
        request.reject(
          error instanceof Error ? error : new Error(errorMessage),
        );
      }
    }
  }

  /**
   * Get window key for grouping
   */
  private getWindowKey(spreadsheetId: string): string {
    return `${spreadsheetId}`;
  }

  /**
   * Flush all pending windows immediately
   */
  async flush(): Promise<void> {
    const windowKeys = Array.from(this.windows.keys());

    for (const key of windowKeys) {
      const window = this.windows.get(key);
      if (window) {
        clearTimeout(window.timer);
        await this.executeWindow(key);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): BatchAggregatorStats {
    const averageBatchSize =
      this.stats.batchesSent > 0
        ? this.stats.batchedRequests / this.stats.batchesSent
        : 0;

    const apiCallReduction =
      this.stats.totalRequests > 0
        ? ((this.stats.totalRequests - this.stats.batchesSent) /
            this.stats.totalRequests) *
          100
        : 0;

    return {
      totalRequests: this.stats.totalRequests,
      batchedRequests: this.stats.batchedRequests,
      batchesSent: this.stats.batchesSent,
      averageBatchSize,
      apiCallReduction,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      batchesSent: 0,
    };
  }

  /**
   * Get pending window count
   */
  getPendingCount(): number {
    return this.windows.size;
  }

  /**
   * Clear all windows (for cleanup)
   */
  clear(): void {
    for (const window of this.windows.values()) {
      clearTimeout(window.timer);
    }
    this.windows.clear();
  }
}

/**
 * Create a batch aggregator for a specific operation type
 */
export function createBatchAggregator<T>(
  batchExecutor: (requests: BatchRequest<T>[]) => Promise<unknown[]>,
  options?: BatchAggregatorOptions,
): BatchAggregator<T> {
  return new BatchAggregator<T>(batchExecutor, options);
}
