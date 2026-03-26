/**
 * Infrastructure Utilities
 *
 * High-level infrastructure services:
 * - RequestCoalescer: Batch multiple requests to same spreadsheet
 * - PrefetchPredictor: Predict and prefetch data based on patterns
 * - BatchRequestScheduler: Schedule and batch Google Sheets API requests
 * - ConnectionPool: Manage concurrent request limiting
 */

import { getRequestLogger } from './request-context.js';

interface CoalescedRequest<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  addedAt: number;
}

export class RequestCoalescer {
  private pending: Map<string, CoalescedRequest<unknown>> = new Map();
  private logger = getRequestLogger();
  private coalesceWindowMs: number = 50; // Batch window: 50ms

  /**
   * Coalesce multiple requests to the same key
   * If a request for this key is in-flight, return the same promise
   */
  async coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      this.logger.debug('Request coalesced', { key });
      return existing.promise as Promise<T>;
    }

    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.pending.set(key, { promise, resolve: resolve as (v: unknown) => void, reject, addedAt: Date.now() });

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.pending.delete(key);
    }

    return promise;
  }

  getPendingCount(): number {
    return this.pending.size;
  }
}

interface PrefetchCandidate {
  range: string;
  likelihood: number; // 0-1
  lastAccessed: number;
}

export class PrefetchPredictor {
  private accessPatterns: Map<string, number[]> = new Map(); // range -> timestamps
  private predictions: Map<string, PrefetchCandidate> = new Map();
  private logger = getRequestLogger();
  private maxPatterns = 1000;

  /**
   * Record an access pattern
   */
  recordAccess(range: string): void {
    const timestamps = this.accessPatterns.get(range) ?? [];
    timestamps.push(Date.now());
    // Keep only last 20 accesses per range
    if (timestamps.length > 20) timestamps.shift();
    this.accessPatterns.set(range, timestamps);
  }

  /**
   * Predict next likely accesses based on patterns
   * Returns ranges that should be prefetched
   */
  predictNext(recentRange: string, topN: number = 3): string[] {
    const candidates: PrefetchCandidate[] = [];

    for (const [range, timestamps] of this.accessPatterns.entries()) {
      if (range === recentRange) continue;

      // Calculate likelihood based on frequency and recency
      const frequency = timestamps.length;
      const recency = Date.now() - (timestamps[timestamps.length - 1] ?? 0);
      const likelihood = Math.max(0, 1 - recency / (24 * 60 * 60 * 1000)) * (frequency / 20); // 0-1

      if (likelihood > 0.1) {
        candidates.push({ range, likelihood, lastAccessed: recency });
      }
    }

    candidates.sort((a, b) => b.likelihood - a.likelihood);
    return candidates.slice(0, topN).map((c) => c.range);
  }

  clear(): void {
    this.accessPatterns.clear();
    this.predictions.clear();
  }
}

interface BatchedOperation {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  addedAt: number;
}

export class BatchRequestScheduler {
  private queue: BatchedOperation[] = [];
  private batchSize: number = 20;
  private batchWindowMs: number = 100;
  private logger = getRequestLogger();
  private timerId: NodeJS.Timeout | null = null;
  private processing = false;

  /**
   * Schedule an operation for batching
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve: resolve as (v: unknown) => void, reject, addedAt: Date.now() });
      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.timerId || this.processing) return;

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.timerId = setTimeout(() => this.flush(), this.batchWindowMs);
    }
  }

  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;

    const batch = this.queue.splice(0, this.batchSize);
    this.logger.debug('Flushing batch', { size: batch.length });

    const results = await Promise.allSettled(batch.map((op) => op.fn()));

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        batch[index]!.resolve(result.value);
      } else {
        batch[index]!.reject(result.reason);
      }
    });

    this.processing = false;

    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

export class ConnectionPool {
  private activeConnections: number = 0;
  private waitingRequests: Array<() => void> = [];
  private maxConcurrent: number;
  private logger = getRequestLogger();

  constructor(maxConcurrent: number = 20) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Acquire a connection slot
   * Waits if max concurrent connections reached
   */
  async acquire(): Promise<void> {
    if (this.activeConnections < this.maxConcurrent) {
      this.activeConnections++;
      return;
    }

    // Wait for a slot to free up
    await new Promise<void>((resolve) => {
      this.waitingRequests.push(resolve);
    });
  }

  /**
   * Release a connection slot
   */
  release(): void {
    const waiting = this.waitingRequests.shift();
    if (waiting) {
      waiting();
      this.activeConnections++;
    } else {
      this.activeConnections--;
    }
  }

  /**
   * Execute function with connection slot
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      maxConcurrent: this.maxConcurrent,
      waitingRequests: this.waitingRequests.length,
    };
  }
}

// Singleton factories

let globalCoalescer: RequestCoalescer | null = null;
export function getRequestCoalescer(): RequestCoalescer {
  if (!globalCoalescer) {
    globalCoalescer = new RequestCoalescer();
  }
  return globalCoalescer;
}

let globalPredictor: PrefetchPredictor | null = null;
export function getPrefetchPredictor(): PrefetchPredictor {
  if (!globalPredictor) {
    globalPredictor = new PrefetchPredictor();
  }
  return globalPredictor;
}

let globalScheduler: BatchRequestScheduler | null = null;
export function getBatchRequestScheduler(): BatchRequestScheduler {
  if (!globalScheduler) {
    globalScheduler = new BatchRequestScheduler();
  }
  return globalScheduler;
}

let globalPool: ConnectionPool | null = null;
export function getConnectionPool(maxConcurrent?: number): ConnectionPool {
  if (!globalPool) {
    globalPool = new ConnectionPool(maxConcurrent);
  }
  return globalPool;
}
