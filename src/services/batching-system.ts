import PQueue from 'p-queue';
import { ConcurrencyCoordinator } from './concurrency-coordinator.js';

export interface BatchOperation {
  id: string;
  type: 'write' | 'format' | 'dimension' | 'clear';
  payload: Record<string, unknown>;
  createdAt: number;
  timeout?: number;
}

export interface AdaptiveBatchWindow {
  minMs: number;
  maxMs: number;
  currentMs: number;
  adjust(): void;
}

export class BatchCompiler {
  private queue = new PQueue({ concurrency: 1 });
  private operations: BatchOperation[] = [];
  private window: AdaptiveBatchWindow;
  private coordinator: ConcurrencyCoordinator;

  constructor(coordinator: ConcurrencyCoordinator) {
    this.coordinator = coordinator;
    this.window = {
      minMs: 20,
      maxMs: 200,
      currentMs: 50,
      adjust: () => {
        // Adaptive window sizing based on queue depth
        if (this.operations.length > 10) this.window.currentMs = Math.min(this.window.maxMs, this.window.currentMs + 10);
        else if (this.operations.length < 3) this.window.currentMs = Math.max(this.window.minMs, this.window.currentMs - 10);
      },
    };
  }

  async queueOperation(operation: BatchOperation): Promise<void> {
    this.operations.push(operation);
    await this.queue.add(() => this.processBatch());
  }

  private async processBatch(): Promise<void> {
    if (this.operations.length === 0) return;

    // Wait for adaptive window
    await new Promise((resolve) => setTimeout(resolve, this.window.currentMs));

    // Check if more operations arrived during window
    if (this.operations.length > 0) {
      const batch = this.operations.splice(0, Math.min(100, this.operations.length));
      const permit = await this.coordinator.acquirePermit(batch.length);

      try {
        // Compile operations into batchUpdate
        const compiled = this.compileBatch(batch);
        this.window.adjust();
        // Execute compiled operations
      } finally {
        this.coordinator.releasePermit(permit);
      }
    }
  }

  private compileBatch(operations: BatchOperation[]): Record<string, unknown> {
    const requests: Record<string, unknown>[] = [];
    const writeOps = operations.filter((o) => o.type === 'write');
    const formatOps = operations.filter((o) => o.type === 'format');
    const clearOps = operations.filter((o) => o.type === 'clear');

    // Merge write operations
    if (writeOps.length > 0) {
      requests.push({
        updateValues: {
          data: writeOps.map((o) => o.payload),
          fields: 'userEnteredValue',
        },
      });
    }

    // Merge format operations
    if (formatOps.length > 0) {
      requests.push({
        updateCells: {
          data: formatOps.map((o) => o.payload),
          fields: 'userEnteredFormat',
        },
      });
    }

    // Merge clear operations
    if (clearOps.length > 0) {
      requests.push({
        deleteRange: {
          range: clearOps.map((o) => o.payload.range),
        },
      });
    }

    return { requests };
  }
}

export class ConcurrencyCoordinator {
  private permits = 100; // 85% of quota limit
  private reserved = 0;
  private queue = new Map<string, number>();

  async acquirePermit(operationCount: number): Promise<string> {
    const needed = Math.ceil(operationCount / 10); // Estimate: 10 ops per permit
    while (this.available() < needed) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.reserved += needed;
    return `permit-${Date.now()}`;
  }

  releasePermit(permitId: string): void {
    const used = this.queue.get(permitId) || 0;
    this.reserved -= used;
  }

  private available(): number {
    return this.permits - this.reserved;
  }
}
