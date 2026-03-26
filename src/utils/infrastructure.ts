/**
 * Infrastructure optimization utilities for request management
 * Includes request coalescing, prefetch prediction, batch scheduling, and connection pooling
 */

import PQueue from 'p-queue';
import { logger } from './logger.js';

/**
 * Request coalescer: combines multiple identical requests into one
 * Reduces redundant API calls within a time window
 */
export class RequestCoalescer<T, R> {
  private pending: Map<string, Promise<R>> = new Map();
  private windowMs: number;

  constructor(windowMs: number = 50) {
    this.windowMs = windowMs;
  }

  async execute(key: string, operation: () => Promise<R>): Promise<R> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    const promise = operation();
    this.pending.set(key, promise);

    promise.finally(() => {
      setTimeout(() => {
        this.pending.delete(key);
      }, this.windowMs);
    });

    return promise;
  }
}

/**
 * Prefetch predictor: predicts likely next requests and prefetches proactively
 */
export class PrefetchPredictor<T> {
  private history: T[] = [];
  private maxHistory: number;
  private predictions: Map<string, T> = new Map();

  constructor(maxHistory: number = 10) {
    this.maxHistory = maxHistory;
  }

  record(item: T): void {
    this.history.push(item);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  predictNext(): T | undefined {
    // Simple heuristic: return most recent item
    // In production: use ML models or pattern matching
    return this.history.length > 0 ? this.history[this.history.length - 1] : undefined;
  }

  clear(): void {
    this.history = [];
    this.predictions.clear();
  }
}

/**
 * Batch request scheduler: groups requests for batch processing
 */
export class BatchRequestScheduler<T, R> {
  private queue: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private windowMs: number;
  private maxBatchSize: number;
  private processor: (batch: T[]) => Promise<R[]>;
  private callbacks: Array<(result: R) => void> = [];

  constructor(
    windowMs: number = 50,
    maxBatchSize: number = 100,
    processor: (batch: T[]) => Promise<R[]> = async (batch) => batch as unknown as R[]
  ) {
    this.windowMs = windowMs;
    this.maxBatchSize = maxBatchSize;
    this.processor = processor;
  }

  add(item: T): Promise<R> {
    return new Promise((resolve) => {
      this.queue.push(item);
      this.callbacks.push(resolve);

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.windowMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);
    const callbacks = this.callbacks.splice(0, batch.length);

    try {
      const results = await this.processor(batch);
      callbacks.forEach((cb, i) => cb(results[i]));
    } catch (error) {
      logger.error('Batch processing failed', { error });
      callbacks.forEach((cb) => cb(undefined as unknown as R));
    }
  }
}

/**
 * Connection pool: manages reusable connections
 */
export class ConnectionPool<T> {
  private pool: T[] = [];
  private activeConnections: Set<T> = new Set();
  private maxSize: number;
  private factory: () => Promise<T>;
  private destroyer?: (conn: T) => Promise<void>;
  private pQueue: PQueue;

  constructor(
    maxSize: number,
    factory: () => Promise<T>,
    destroyer?: (conn: T) => Promise<void>
  ) {
    this.maxSize = maxSize;
    this.factory = factory;
    this.destroyer = destroyer;
    this.pQueue = new PQueue({ concurrency: maxSize });
  }

  async acquire(): Promise<T> {
    if (this.pool.length > 0) {
      const conn = this.pool.pop()!;
      this.activeConnections.add(conn);
      return conn;
    }

    if (this.activeConnections.size < this.maxSize) {
      const conn = await this.factory();
      this.activeConnections.add(conn);
      return conn;
    }

    // Wait for a connection to be released
    return new Promise((resolve) => {
      const checkAvailable = setInterval(() => {
        if (this.pool.length > 0) {
          clearInterval(checkAvailable);
          this.acquire().then(resolve);
        }
      }, 10);
    });
  }

  release(conn: T): void {
    this.activeConnections.delete(conn);
    this.pool.push(conn);
  }

  async drain(): Promise<void> {
    for (const conn of this.activeConnections) {
      if (this.destroyer) {
        await this.destroyer(conn);
      }
    }
    this.activeConnections.clear();
    this.pool = [];
  }
}
