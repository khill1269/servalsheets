/**
 * Batching System
 *
 * Coordinates batch compilation of operations into batchUpdate calls.
 * Respects 100-operation limit per API call. Supports adaptive window sizing.
 */

import type { sheets_v4 } from 'googleapis';

// ============================================================================
// AdaptiveBatchWindow
// ============================================================================

export interface AdaptiveBatchWindowConfig {
  minWindowMs?: number;
  maxWindowMs?: number;
  initialWindowMs?: number;
  lowThreshold?: number;
  highThreshold?: number;
  increaseRate?: number;
  decreaseRate?: number;
}

const ADAPTIVE_DEFAULTS: Required<AdaptiveBatchWindowConfig> = {
  minWindowMs: 20,
  maxWindowMs: 100,
  initialWindowMs: 50,
  lowThreshold: 3,
  highThreshold: 50,
  increaseRate: 1.2,
  decreaseRate: 0.8,
};

const MAX_HISTORY_SIZE = 1000;

export class AdaptiveBatchWindow {
  private cfg: Required<AdaptiveBatchWindowConfig>;
  private current: number;
  private history: number[] = [];

  constructor(config: AdaptiveBatchWindowConfig = {}) {
    this.cfg = { ...ADAPTIVE_DEFAULTS, ...config };
    this.current = this.cfg.initialWindowMs;
  }

  getConfig(): Required<AdaptiveBatchWindowConfig> {
    return { ...this.cfg };
  }

  getCurrentWindow(): number {
    return this.current;
  }

  /**
   * Adjust window size based on number of operations in the last batch.
   * - ops < lowThreshold: increase window (low traffic)
   * - ops > highThreshold: decrease window (high traffic)
   * - otherwise: maintain window
   */
  adjust(operationCount: number): void {
    let next: number;
    if (operationCount < this.cfg.lowThreshold) {
      next = Math.min(this.cfg.maxWindowMs, this.current * this.cfg.increaseRate);
    } else if (operationCount > this.cfg.highThreshold) {
      next = Math.max(this.cfg.minWindowMs, this.current * this.cfg.decreaseRate);
    } else {
      next = this.current;
    }
    this.current = next;
    this.history.push(next);
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift();
    }
  }

  getAverageWindow(): number {
    if (this.history.length === 0) return this.current;
    return this.history.reduce((a, b) => a + b, 0) / this.history.length;
  }

  reset(): void {
    this.current = this.cfg.minWindowMs;
    this.history = [];
  }
}

// ============================================================================
// BatchOperation
// ============================================================================

export interface BatchOperation {
  id: string;
  type: 'values:update' | 'values:clear' | 'format' | string;
  spreadsheetId: string;
  params: Record<string, unknown>;
}

export interface AdaptiveWindowConfig {
  minWindowMs?: number;
  maxWindowMs?: number;
  initialWindowMs?: number;
  lowThreshold?: number;
  highThreshold?: number;
}

export interface BatchingSystemOptions {
  /** Enable adaptive window sizing (default: true) */
  adaptiveWindow?: boolean;
  /** Adaptive window configuration */
  adaptiveConfig?: AdaptiveWindowConfig;
  /** Fixed window in ms when adaptiveWindow=false */
  windowMs?: number;
  /** Max operations per batch (default: 100) */
  maxBatchSize?: number;
  /** Enable verbose logging */
  verboseLogging?: boolean;
}

export interface BatchingStats {
  totalOperations: number;
  totalBatches: number;
  /** Defined only when adaptiveWindow=true */
  currentWindowMs?: number;
  /** Defined only when adaptiveWindow=true */
  avgWindowMs?: number;
}

interface PendingOp {
  op: BatchOperation;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class BatchingSystem {
  private sheetsApi: sheets_v4.Sheets | null;
  private maxBatchSize: number;
  private fixedWindowMs: number;
  private useAdaptive: boolean;
  private verboseLogging: boolean;

  // Adaptive window state
  private minWindowMs: number;
  private maxWindowMs: number;
  private currentWindowMs: number;
  private lowThreshold: number;
  private highThreshold: number;
  private windowHistory: number[] = [];

  // Stats
  private totalOperations = 0;
  private totalBatches = 0;

  // Queue
  private pending: PendingOp[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(sheetsApi?: sheets_v4.Sheets | null, options: BatchingSystemOptions = {}) {
    this.sheetsApi = sheetsApi ?? null;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.verboseLogging = options.verboseLogging ?? false;

    const adaptive = options.adaptiveConfig ?? {};
    this.minWindowMs = adaptive.minWindowMs ?? 20;
    this.maxWindowMs = adaptive.maxWindowMs ?? 200;
    this.currentWindowMs = adaptive.initialWindowMs ?? this.minWindowMs;
    this.lowThreshold = adaptive.lowThreshold ?? 3;
    this.highThreshold = adaptive.highThreshold ?? 10;
    this.fixedWindowMs = options.windowMs ?? 50;
    this.useAdaptive = options.adaptiveWindow !== false;

    // Initialize window history with the initial value
    this.windowHistory = [this.currentWindowMs];
  }

  /**
   * Queue a single operation and return a promise that resolves when it is executed.
   */
  execute(op: BatchOperation): Promise<unknown> {
    if (this.destroyed) {
      return Promise.reject(new Error('BatchingSystem has been destroyed'));
    }

    return new Promise((resolve, reject) => {
      this.pending.push({ op, resolve, reject });

      if (!this.timer) {
        const delay = this.useAdaptive ? this.currentWindowMs : this.fixedWindowMs;
        this.timer = setTimeout(() => {
          this.timer = null;
          void this.flushNow();
        }, delay);
      }
    });
  }

  /**
   * Flush all pending operations immediately.
   */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flushNow();
  }

  private async flushNow(): Promise<void> {
    if (this.pending.length === 0) return;

    const batch = this.pending.splice(0, this.maxBatchSize);
    const batchSize = batch.length;

    this.totalOperations += batchSize;
    this.totalBatches += 1;

    // Adapt window based on batch size
    if (this.useAdaptive) {
      if (batchSize < this.lowThreshold) {
        // Low traffic: increase window
        this.currentWindowMs = Math.min(
          this.maxWindowMs,
          Math.round(this.currentWindowMs * 1.1 + 2)
        );
      } else if (batchSize > this.highThreshold) {
        // High traffic: decrease window
        this.currentWindowMs = Math.max(
          this.minWindowMs,
          Math.round(this.currentWindowMs * 0.9 - 2)
        );
      }
      // else: optimal range, keep window stable

      this.windowHistory.push(this.currentWindowMs);
    }

    if (this.verboseLogging) {
      console.debug(`[BatchingSystem] Flushing ${batchSize} operations`);
    }

    // Execute the batch against the Sheets API
    try {
      await this.executeBatchOps(batch);
      for (const item of batch) {
        item.resolve(undefined);
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error);
      }
    }

    // If more items arrived during execution, schedule another flush
    if (this.pending.length > 0 && !this.timer) {
      const delay = this.useAdaptive ? this.currentWindowMs : this.fixedWindowMs;
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flushNow();
      }, delay);
    }
  }

  private async executeBatchOps(batch: PendingOp[]): Promise<void> {
    if (!this.sheetsApi) return;

    // Group by spreadsheetId and type
    const valueUpdates = batch.filter((b) => b.op.type === 'values:update');
    const valueClears = batch.filter((b) => b.op.type === 'values:clear');
    const formatOps = batch.filter(
      (b) => b.op.type !== 'values:update' && b.op.type !== 'values:clear'
    );

    const bySpreadsheet = new Map<string, typeof batch>();
    for (const item of [...valueUpdates, ...valueClears, ...formatOps]) {
      const list = bySpreadsheet.get(item.op.spreadsheetId) ?? [];
      list.push(item);
      bySpreadsheet.set(item.op.spreadsheetId, list);
    }

    for (const [spreadsheetId, ops] of bySpreadsheet) {
      const updates = ops.filter((o) => o.op.type === 'values:update');
      const clears = ops.filter((o) => o.op.type === 'values:clear');
      const formats = ops.filter(
        (o) => o.op.type !== 'values:update' && o.op.type !== 'values:clear'
      );

      // Chunk at maxBatchSize
      for (let i = 0; i < updates.length; i += this.maxBatchSize) {
        const chunk = updates.slice(i, i + this.maxBatchSize);
        await this.sheetsApi.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: chunk.map((item) => ({
              range: (item.op.params as Record<string, unknown>).range as string,
              values: (item.op.params as Record<string, unknown>).values as unknown[][],
            })),
          },
        });
      }

      if (clears.length > 0) {
        await this.sheetsApi.spreadsheets.values.batchClear({
          spreadsheetId,
          requestBody: {
            ranges: clears.map(
              (item) => (item.op.params as Record<string, unknown>).range as string
            ),
          },
        });
      }

      if (formats.length > 0) {
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: formats.map((item) => item.op.params as sheets_v4.Schema$Request),
          },
        });
      }
    }
  }

  /**
   * Get current statistics.
   */
  getStats(): BatchingStats {
    const stats: BatchingStats = {
      totalOperations: this.totalOperations,
      totalBatches: this.totalBatches,
    };

    if (this.useAdaptive) {
      stats.currentWindowMs = this.currentWindowMs;
      const avg =
        this.windowHistory.length > 0
          ? Math.round(
              this.windowHistory.reduce((a, b) => a + b, 0) / this.windowHistory.length
            )
          : this.currentWindowMs;
      stats.avgWindowMs = avg;
    }

    return stats;
  }

  /**
   * Reset statistics and adaptive window back to minimum.
   */
  resetStats(): void {
    this.totalOperations = 0;
    this.totalBatches = 0;
    if (this.useAdaptive) {
      this.currentWindowMs = this.minWindowMs;
      this.windowHistory = [this.currentWindowMs];
    }
  }

  /**
   * Clean up timers and reject any pending operations.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const item of this.pending) {
      item.reject(new Error('BatchingSystem destroyed'));
    }
    this.pending = [];
  }

  // Legacy API used by some handlers
  chunkOperations(operations: unknown[]): unknown[][] {
    const chunks: unknown[][] = [];
    for (let i = 0; i < operations.length; i += this.maxBatchSize) {
      chunks.push(operations.slice(i, i + this.maxBatchSize));
    }
    return chunks;
  }

  async executeBatch(spreadsheetId: string, operations: unknown[]): Promise<unknown> {
    const chunks = this.chunkOperations(operations);
    const results = [];
    for (const chunk of chunks) {
      const result = await this.executeBatchChunk(spreadsheetId, chunk);
      results.push(result);
    }
    return { totalOperations: operations.length, chunks: results.length };
  }

  private async executeBatchChunk(
    _spreadsheetId: string,
    operations: unknown[]
  ): Promise<unknown> {
    return { operationCount: operations.length };
  }
}

// ============================================================================
// Singleton management
// ============================================================================

let instance: BatchingSystem | null = null;

/**
 * Initialize the batching system singleton with a Sheets API client.
 */
export function initBatchingSystem(sheetsApi: sheets_v4.Sheets): BatchingSystem {
  if (instance) {
    instance.destroy();
  }
  instance = new BatchingSystem(sheetsApi, { adaptiveWindow: true });
  return instance;
}

/**
 * Get the current batching system singleton (may be null if not initialized).
 */
export function getBatchingSystem(): BatchingSystem | null {
  return instance;
}

/**
 * Reset the batching system singleton (for testing).
 */
export function resetBatchingSystem(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
