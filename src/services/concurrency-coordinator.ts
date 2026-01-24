/**
 * Unified Concurrency Coordinator - Phase 1: Critical Stability
 *
 * Purpose: Centralized management of all concurrent Google API operations
 * to prevent quota exhaustion and 429 errors.
 *
 * Problem Solved:
 * - ParallelExecutor: 20 concurrent
 * - PrefetchingSystem: 2 concurrent
 * - BatchingSystem: adaptive
 * - Total: 22+ concurrent connections → quota exceeded!
 *
 * Solution: Shared semaphore with global limit of 15 concurrent operations
 * (safely below Google's per-user quota limits while maintaining performance)
 */

import { logger } from '../utils/logger.js';

/**
 * Configuration for concurrency coordinator
 */
export interface ConcurrencyConfig {
  /** Maximum concurrent Google API operations across ALL systems */
  maxConcurrent: number;
  /** Enable metrics tracking */
  enableMetrics?: boolean;
  /** Enable verbose logging for debugging */
  verboseLogging?: boolean;
}

/**
 * Metrics for monitoring concurrency usage
 */
export interface ConcurrencyMetrics {
  /** Current number of active operations */
  activeOperations: number;
  /** Peak concurrent operations observed */
  peakConcurrent: number;
  /** Total operations executed */
  totalOperations: number;
  /** Total time spent waiting for permits (ms) */
  totalWaitTimeMs: number;
  /** Number of times limit was reached */
  limitReachedCount: number;
  /** Average wait time per operation (ms) */
  averageWaitTimeMs: number;
}

/**
 * Operation metadata for tracking
 */
interface Operation {
  id: string;
  source: string; // Which system requested this (ParallelExecutor, Prefetching, etc.)
  startTime: number;
  acquireTime: number;
}

/**
 * Unified Concurrency Coordinator
 *
 * Implements a semaphore pattern to limit total concurrent Google API operations.
 * All systems (ParallelExecutor, PrefetchingSystem, BatchingSystem) must
 * acquire a permit before making API calls.
 *
 * Thread-safe: Uses async queue with FIFO ordering
 */
export class ConcurrencyCoordinator {
  private readonly config: Required<ConcurrencyConfig>;
  private activeOperations: Map<string, Operation> = new Map();
  private waitQueue: Array<{
    resolve: () => void;
    source: string;
    queuedAt: number;
  }> = [];

  // Metrics
  private metrics: ConcurrencyMetrics = {
    activeOperations: 0,
    peakConcurrent: 0,
    totalOperations: 0,
    totalWaitTimeMs: 0,
    limitReachedCount: 0,
    averageWaitTimeMs: 0,
  };

  constructor(config?: Partial<ConcurrencyConfig>) {
    this.config = {
      maxConcurrent: config?.maxConcurrent ?? 15, // Safe default (below Google's limits)
      enableMetrics: config?.enableMetrics ?? true,
      verboseLogging: config?.verboseLogging ?? false,
    };

    if (this.config.verboseLogging) {
      logger.info('ConcurrencyCoordinator initialized', {
        maxConcurrent: this.config.maxConcurrent,
      });
    }

    // Support environment variable override
    const envLimit = process.env['GOOGLE_API_MAX_CONCURRENT'];
    if (envLimit) {
      const parsed = parseInt(envLimit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
        this.config.maxConcurrent = parsed;
        logger.info(`Concurrency limit overridden by env: ${parsed}`);
      }
    }
  }

  /**
   * Acquire a permit to execute a Google API operation
   *
   * Blocks until a permit is available if the limit is reached.
   * Must be followed by release() when operation completes.
   *
   * @param source - Identifier for the system requesting permit (e.g., "ParallelExecutor")
   * @returns Operation ID to pass to release()
   */
  async acquire(source: string): Promise<string> {
    const operationId = `${source}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();

    // Check if we can proceed immediately
    if (this.activeOperations.size < this.config.maxConcurrent) {
      return this.grantPermit(operationId, source, startTime);
    }

    // Queue and wait for permit
    if (this.config.verboseLogging) {
      logger.debug('Concurrency limit reached, queuing operation', {
        source,
        active: this.activeOperations.size,
        limit: this.config.maxConcurrent,
        queueSize: this.waitQueue.length,
      });
    }

    this.metrics.limitReachedCount++;

    return new Promise<string>((resolve) => {
      this.waitQueue.push({
        resolve: () => resolve(this.grantPermit(operationId, source, startTime)),
        source,
        queuedAt: Date.now(),
      });
    });
  }

  /**
   * Release a permit after operation completes
   *
   * @param operationId - ID returned from acquire()
   */
  release(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      logger.warn('Attempted to release unknown operation', { operationId });
      return;
    }

    this.activeOperations.delete(operationId);
    this.metrics.activeOperations = this.activeOperations.size;

    if (this.config.verboseLogging) {
      const duration = Date.now() - operation.startTime;
      logger.debug('Released concurrency permit', {
        source: operation.source,
        duration,
        active: this.activeOperations.size,
        queued: this.waitQueue.length,
      });
    }

    // Grant permit to next waiting operation
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next.resolve();
    }
  }

  /**
   * Execute an async operation with automatic permit management
   *
   * Acquires permit, executes operation, releases permit on completion or error.
   *
   * @param source - Identifier for the system (e.g., "ParallelExecutor")
   * @param fn - Async function to execute
   * @returns Result of the operation
   */
  async execute<T>(source: string, fn: () => Promise<T>): Promise<T> {
    const operationId = await this.acquire(source);
    try {
      return await fn();
    } finally {
      this.release(operationId);
    }
  }

  /**
   * Get current concurrency metrics
   */
  getMetrics(): ConcurrencyMetrics {
    return {
      ...this.metrics,
      averageWaitTimeMs:
        this.metrics.totalOperations > 0
          ? this.metrics.totalWaitTimeMs / this.metrics.totalOperations
          : 0,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      activeOperations: this.activeOperations.size,
      peakConcurrent: 0,
      totalOperations: 0,
      totalWaitTimeMs: 0,
      limitReachedCount: 0,
      averageWaitTimeMs: 0,
    };
  }

  /**
   * Get current status for monitoring
   */
  getStatus(): {
    active: number;
    queued: number;
    limit: number;
    utilization: number;
  } {
    return {
      active: this.activeOperations.size,
      queued: this.waitQueue.length,
      limit: this.config.maxConcurrent,
      utilization: (this.activeOperations.size / this.config.maxConcurrent) * 100,
    };
  }

  /**
   * Internal: Grant a permit and start tracking operation
   */
  private grantPermit(operationId: string, source: string, startTime: number): string {
    const acquireTime = Date.now();
    const waitTime = acquireTime - startTime;

    this.activeOperations.set(operationId, {
      id: operationId,
      source,
      startTime,
      acquireTime,
    });

    // Update metrics
    this.metrics.activeOperations = this.activeOperations.size;
    this.metrics.totalOperations++;
    this.metrics.totalWaitTimeMs += waitTime;
    this.metrics.peakConcurrent = Math.max(this.metrics.peakConcurrent, this.activeOperations.size);

    if (this.config.verboseLogging && waitTime > 100) {
      logger.debug('Operation waited for permit', {
        source,
        waitTime,
        active: this.activeOperations.size,
      });
    }

    return operationId;
  }
}

/**
 * Global singleton instance
 *
 * Shared across all systems to enforce unified concurrency limit.
 * Initialize once at application startup.
 */
let globalCoordinator: ConcurrencyCoordinator | null = null;

/**
 * Get or create the global concurrency coordinator
 *
 * @param config - Configuration (only used on first call)
 * @returns Global coordinator instance
 */
export function getConcurrencyCoordinator(
  config?: Partial<ConcurrencyConfig>
): ConcurrencyCoordinator {
  if (!globalCoordinator) {
    globalCoordinator = new ConcurrencyCoordinator(config);
  }
  return globalCoordinator;
}

/**
 * Reset the global coordinator (for testing only)
 */
export function resetConcurrencyCoordinator(): void {
  globalCoordinator = null;
}
