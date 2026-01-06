/**
 * ServalSheets - Batch Request Time Windows System
 *
 * Collects operations within a time window and batches them into single API calls.
 * Phase 2, Task 2.3
 *
 * Features:
 * - 50-100ms collection windows
 * - Automatic operation merging
 * - Promise resolution for individual operations
 * - Cross-tool batching support
 * - Comprehensive metrics
 *
 * Expected Impact:
 * - 20-40% reduction in API calls
 * - 30% reduction in quota usage
 * - Same or better latency
 */

import type { sheets_v4 } from 'googleapis';
import { logger } from '../utils/logger.js';

/**
 * Supported operation types that can be batched
 */
export type BatchableOperationType =
  | 'values:update'
  | 'values:append'
  | 'values:clear'
  | 'format:update'
  | 'cells:update'
  | 'sheet:update';

/**
 * Operation to be batched
 */
export interface BatchableOperation<T = unknown> {
  /** Unique operation ID */
  id: string;
  /** Operation type */
  type: BatchableOperationType;
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Operation-specific parameters (varies by operation type) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
  /** Promise resolver */
  resolve: (result: T) => void;
  /** Promise rejecter */
  reject: (error: Error) => void;
  /** Timestamp when queued */
  queuedAt: number;
}

/**
 * Batch execution result
 */
export interface BatchResult {
  /** Number of operations in batch */
  operationCount: number;
  /** API calls made (should be 1) */
  apiCalls: number;
  /** Execution duration in ms */
  duration: number;
  /** Success status */
  success: boolean;
}

/**
 * Batching system configuration
 */
export interface BatchingSystemOptions {
  /** Collection window in ms (default: 50) */
  windowMs?: number;
  /** Maximum operations per batch (default: 100) */
  maxBatchSize?: number;
  /** Enable batching (default: true) */
  enabled?: boolean;
  /** Verbose logging (default: false) */
  verboseLogging?: boolean;
}

/**
 * Batching system statistics
 */
export interface BatchingStats {
  /** Total operations received */
  totalOperations: number;
  /** Total batches executed */
  totalBatches: number;
  /** Total API calls made */
  totalApiCalls: number;
  /** API calls saved by batching */
  apiCallsSaved: number;
  /** API call reduction percentage */
  reductionPercentage: number;
  /** Average batch size */
  avgBatchSize: number;
  /** Average batch duration */
  avgBatchDuration: number;
  /** Max batch size */
  maxBatchSize: number;
  /** Min batch size */
  minBatchSize: number;
}

/**
 * Batch Request Time Windows System
 *
 * Collects operations within a time window and executes them as batched API calls
 */
export class BatchingSystem {
  private sheetsApi: sheets_v4.Sheets;
  private enabled: boolean;
  private windowMs: number;
  private maxBatchSize: number;
  private verboseLogging: boolean;

  // Operation queues by batch key
  private pendingBatches = new Map<string, BatchableOperation[]>();

  // Timer references for each batch key
  private batchTimers = new Map<string, NodeJS.Timeout>();

  // Statistics
  private stats = {
    totalOperations: 0,
    totalBatches: 0,
    totalApiCalls: 0,
    batchSizes: [] as number[],
    batchDurations: [] as number[],
  };

  constructor(sheetsApi: sheets_v4.Sheets, options: BatchingSystemOptions = {}) {
    this.sheetsApi = sheetsApi;
    this.enabled = options.enabled ?? true;
    this.windowMs = options.windowMs ?? 50;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.verboseLogging = options.verboseLogging ?? false;

    if (this.verboseLogging) {
      logger.info('Batching system initialized', {
        enabled: this.enabled,
        windowMs: this.windowMs,
        maxBatchSize: this.maxBatchSize,
      });
    }
  }

  /**
   * Execute an operation (with batching if enabled)
   */
  async execute<T>(operation: Omit<BatchableOperation<T>, 'resolve' | 'reject' | 'queuedAt'>): Promise<T> {
    if (!this.enabled) {
      // Batching disabled, execute immediately
      return this.executeImmediate<T>(operation);
    }

    this.stats.totalOperations++;

    return new Promise<T>((resolve, reject) => {
      const batchKey = this.getBatchKey(operation);
      const queuedOp: BatchableOperation<T> = {
        ...operation,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      // Add to pending batch
      if (!this.pendingBatches.has(batchKey)) {
        this.pendingBatches.set(batchKey, []);
      }

      const batch = this.pendingBatches.get(batchKey)!;
      batch.push(queuedOp as BatchableOperation);

      // Start timer if this is the first operation in the batch
      if (batch.length === 1) {
        this.startBatchTimer(batchKey);
      }

      // Execute immediately if batch size limit reached
      if (batch.length >= this.maxBatchSize) {
        this.cancelBatchTimer(batchKey);
        void this.executeBatch(batchKey);
      }

      if (this.verboseLogging) {
        logger.debug('Operation queued for batching', {
          batchKey,
          operationId: operation.id,
          batchSize: batch.length,
        });
      }
    });
  }

  /**
   * Generate batch key for grouping operations
   */
  private getBatchKey(operation: Omit<BatchableOperation, 'resolve' | 'reject' | 'queuedAt'>): string {
    // Group by spreadsheet + operation type
    return `${operation.spreadsheetId}:${operation.type}`;
  }

  /**
   * Start timer for batch execution
   */
  private startBatchTimer(batchKey: string): void {
    const timer = setTimeout(() => {
      void this.executeBatch(batchKey);
    }, this.windowMs);

    this.batchTimers.set(batchKey, timer);
  }

  /**
   * Cancel batch timer
   */
  private cancelBatchTimer(batchKey: string): void {
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }
  }

  /**
   * Execute a batch of operations
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const operations = this.pendingBatches.get(batchKey);
    if (!operations || operations.length === 0) {
      return;
    }

    // Remove from pending
    this.pendingBatches.delete(batchKey);
    this.cancelBatchTimer(batchKey);

    this.stats.totalBatches++;
    this.stats.batchSizes.push(operations.length);

    const startTime = Date.now();

    try {
      // Merge operations based on type
      const firstOp = operations[0];
      if (!firstOp) {
        throw new Error('Empty batch');
      }

      switch (firstOp.type) {
        case 'values:update':
          await this.executeBatchValuesUpdate(operations);
          break;

        case 'values:append':
          await this.executeBatchValuesAppend(operations);
          break;

        case 'values:clear':
          await this.executeBatchValuesClear(operations);
          break;

        case 'format:update':
        case 'cells:update':
        case 'sheet:update':
          await this.executeBatchBatchUpdate(operations);
          break;

        default:
          throw new Error(`Unsupported batch type: ${firstOp.type}`);
      }

      this.stats.totalApiCalls++; // Single API call for the batch

      const duration = Date.now() - startTime;
      this.stats.batchDurations.push(duration);

      if (this.verboseLogging) {
        logger.info('Batch executed successfully', {
          batchKey,
          operationCount: operations.length,
          duration,
        });
      }
    } catch (error) {
      logger.error('Batch execution failed', {
        batchKey,
        operationCount: operations.length,
        error: error instanceof Error ? error.message : String(error),
      });

      // Reject all operations in the batch
      const err = error instanceof Error ? error : new Error(String(error));
      operations.forEach((op) => op.reject(err));
    }
  }

  /**
   * Execute batch of values.update operations
   */
  private async executeBatchValuesUpdate(operations: BatchableOperation[]): Promise<void> {
    const spreadsheetId = operations[0]!.spreadsheetId;

    // Use values.batchUpdate
    const data = operations.map((op) => ({
      range: op.params.range,
      values: op.params.values,
    }));

    const response = await this.sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        data,
        valueInputOption: operations[0]!.params.valueInputOption || 'USER_ENTERED',
      },
    });

    // Resolve individual promises
    operations.forEach((op, index) => {
      const updateResult = response.data.responses?.[index];
      op.resolve(updateResult);
    });
  }

  /**
   * Execute batch of values.append operations
   */
  private async executeBatchValuesAppend(operations: BatchableOperation[]): Promise<void> {
    // Append operations can't be truly batched, but we can execute them in parallel
    const results = await Promise.all(
      operations.map((op) =>
        this.sheetsApi.spreadsheets.values.append({
          spreadsheetId: op.spreadsheetId,
          range: op.params.range,
          valueInputOption: op.params.valueInputOption || 'USER_ENTERED',
          requestBody: {
            values: op.params.values,
          },
        })
      )
    );

    operations.forEach((op, index) => {
      op.resolve(results[index]!.data);
    });
  }

  /**
   * Execute batch of values.clear operations
   */
  private async executeBatchValuesClear(operations: BatchableOperation[]): Promise<void> {
    const spreadsheetId = operations[0]!.spreadsheetId;

    // Use values.batchClear
    const ranges = operations.map((op) => op.params.range);

    const response = await this.sheetsApi.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges,
      },
    });

    // Resolve all with the same response
    operations.forEach((op) => {
      op.resolve(response.data);
    });
  }

  /**
   * Execute batch using batchUpdate (for format/cell/sheet operations)
   */
  private async executeBatchBatchUpdate(operations: BatchableOperation[]): Promise<void> {
    const spreadsheetId = operations[0]!.spreadsheetId;

    // Merge all requests
    const requests = operations.flatMap((op) => op.params.requests || [op.params.request]);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests,
      },
    });

    // Resolve all operations with the full response
    // Note: Individual operation results are in responses array
    operations.forEach((op, index) => {
      const opResponse = response.data.replies?.[index];
      op.resolve(opResponse);
    });
  }

  /**
   * Execute operation immediately (without batching)
   */
  private async executeImmediate<T>(
    operation: Omit<BatchableOperation<T>, 'resolve' | 'reject' | 'queuedAt'>
  ): Promise<T> {
    switch (operation.type) {
      case 'values:update':
        return (await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: operation.spreadsheetId,
          range: operation.params.range,
          valueInputOption: operation.params.valueInputOption || 'USER_ENTERED',
          requestBody: {
            values: operation.params.values,
          },
        })) as T;

      case 'values:append':
        return (await this.sheetsApi.spreadsheets.values.append({
          spreadsheetId: operation.spreadsheetId,
          range: operation.params.range,
          valueInputOption: operation.params.valueInputOption || 'USER_ENTERED',
          requestBody: {
            values: operation.params.values,
          },
        })) as T;

      case 'values:clear':
        return (await this.sheetsApi.spreadsheets.values.clear({
          spreadsheetId: operation.spreadsheetId,
          range: operation.params.range,
        })) as T;

      case 'format:update':
      case 'cells:update':
      case 'sheet:update':
        return (await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: operation.spreadsheetId,
          requestBody: {
            requests: operation.params.requests || [operation.params.request],
          },
        })) as T;

      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  /**
   * Get batching statistics
   */
  getStats(): BatchingStats {
    const avgBatchSize =
      this.stats.batchSizes.length > 0
        ? this.stats.batchSizes.reduce((a, b) => a + b, 0) / this.stats.batchSizes.length
        : 0;

    const avgBatchDuration =
      this.stats.batchDurations.length > 0
        ? this.stats.batchDurations.reduce((a, b) => a + b, 0) / this.stats.batchDurations.length
        : 0;

    const apiCallsSaved = this.stats.totalOperations - this.stats.totalApiCalls;
    const reductionPercentage =
      this.stats.totalOperations > 0 ? (apiCallsSaved / this.stats.totalOperations) * 100 : 0;

    return {
      totalOperations: this.stats.totalOperations,
      totalBatches: this.stats.totalBatches,
      totalApiCalls: this.stats.totalApiCalls,
      apiCallsSaved,
      reductionPercentage,
      avgBatchSize,
      avgBatchDuration,
      maxBatchSize: this.stats.batchSizes.length > 0 ? Math.max(...this.stats.batchSizes) : 0,
      minBatchSize: this.stats.batchSizes.length > 0 ? Math.min(...this.stats.batchSizes) : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalOperations: 0,
      totalBatches: 0,
      totalApiCalls: 0,
      batchSizes: [],
      batchDurations: [],
    };
  }

  /**
   * Flush all pending batches immediately
   */
  async flush(): Promise<void> {
    const batchKeys = Array.from(this.pendingBatches.keys());

    await Promise.all(batchKeys.map((key) => this.executeBatch(key)));
  }

  /**
   * Destroy the batching system
   */
  destroy(): void {
    // Cancel all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    // Clear pending batches
    this.pendingBatches.clear();
  }
}

// Singleton instance
let batchingSystem: BatchingSystem | null = null;

/**
 * Initialize the batching system
 */
export function initBatchingSystem(sheetsApi: sheets_v4.Sheets): BatchingSystem {
  if (!batchingSystem) {
    batchingSystem = new BatchingSystem(sheetsApi, {
      enabled: process.env['BATCHING_ENABLED'] !== 'false',
      windowMs: parseInt(process.env['BATCHING_WINDOW_MS'] || '50', 10),
      maxBatchSize: parseInt(process.env['BATCHING_MAX_SIZE'] || '100', 10),
      verboseLogging: process.env['BATCHING_VERBOSE'] === 'true',
    });
  }
  return batchingSystem;
}

/**
 * Get the batching system singleton
 */
export function getBatchingSystem(): BatchingSystem | null {
  return batchingSystem;
}
