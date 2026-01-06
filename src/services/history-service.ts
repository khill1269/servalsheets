/**
 * ServalSheets - Operation History Service
 *
 * Tracks operation history for debugging, undo, and audit purposes.
 *
 * Features:
 * - Circular buffer (last N operations)
 * - Fast lookups by ID
 * - Filtering and statistics
 * - Exposed via MCP resource
 */

import type {
  OperationHistory,
  OperationHistoryStats,
  OperationHistoryFilter,
} from '../types/history.js';
import { logger } from '../utils/logger.js';

export interface HistoryServiceOptions {
  /** Maximum number of operations to keep (default: 100) */
  maxSize?: number;
  /** Enable detailed logging (default: false) */
  verboseLogging?: boolean;
}

/**
 * Operation History Service
 *
 * Maintains a circular buffer of recent operations for:
 * - Debugging (view recent operations and errors)
 * - Undo/Redo (operations include snapshot IDs)
 * - Audit trail (compliance and security)
 * - Performance analysis (operation durations)
 */
export class HistoryService {
  private operations: OperationHistory[] = [];
  private operationsMap: Map<string, OperationHistory> = new Map();
  private maxSize: number;
  private verboseLogging: boolean;

  // Undo/Redo stacks per spreadsheet
  private undoStacks: Map<string, string[]> = new Map(); // spreadsheetId -> [operationIds]
  private redoStacks: Map<string, string[]> = new Map(); // spreadsheetId -> [operationIds]

  constructor(options: HistoryServiceOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.verboseLogging = options.verboseLogging ?? false;

    logger.info('History service initialized', {
      maxSize: this.maxSize,
      verboseLogging: this.verboseLogging,
    });
  }

  /**
   * Record an operation
   */
  record(operation: OperationHistory): void {
    // Add to array
    this.operations.push(operation);

    // Add to map for fast lookup
    this.operationsMap.set(operation.id, operation);

    // Add to undo stack if it has a snapshot (only successful write operations)
    if (operation.result === 'success' && operation.snapshotId && operation.spreadsheetId) {
      const stack = this.undoStacks.get(operation.spreadsheetId) || [];
      stack.push(operation.id);
      this.undoStacks.set(operation.spreadsheetId, stack);

      // Clear redo stack when new operation is performed
      this.redoStacks.set(operation.spreadsheetId, []);
    }

    // Maintain circular buffer
    if (this.operations.length > this.maxSize) {
      const removed = this.operations.shift();
      if (removed) {
        this.operationsMap.delete(removed.id);
      }
    }

    if (this.verboseLogging) {
      logger.debug('Operation recorded in history', {
        id: operation.id,
        tool: operation.tool,
        action: operation.action,
        result: operation.result,
        duration: operation.duration,
        hasSnapshot: !!operation.snapshotId,
      });
    }
  }

  /**
   * Get operation by ID
   */
  getById(id: string): OperationHistory | undefined {
    return this.operationsMap.get(id);
  }

  /**
   * Get all operations (optionally filtered)
   */
  getAll(filter?: OperationHistoryFilter): OperationHistory[] {
    let filtered = [...this.operations];

    if (filter) {
      if (filter.tool) {
        filtered = filtered.filter((op) => op.tool === filter.tool);
      }

      if (filter.action) {
        filtered = filtered.filter((op) => op.action === filter.action);
      }

      if (filter.result) {
        filtered = filtered.filter((op) => op.result === filter.result);
      }

      if (filter.spreadsheetId) {
        filtered = filtered.filter((op) => op.spreadsheetId === filter.spreadsheetId);
      }

      if (filter.startTime) {
        const startTime = new Date(filter.startTime).getTime();
        filtered = filtered.filter((op) => new Date(op.timestamp).getTime() >= startTime);
      }

      if (filter.endTime) {
        const endTime = new Date(filter.endTime).getTime();
        filtered = filtered.filter((op) => new Date(op.timestamp).getTime() <= endTime);
      }

      if (filter.limit && filter.limit > 0) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Get recent operations (last N)
   */
  getRecent(count: number = 10): OperationHistory[] {
    return this.operations.slice(-count);
  }

  /**
   * Get failed operations
   */
  getFailures(count?: number): OperationHistory[] {
    const failures = this.operations.filter((op) => op.result === 'error');
    return count ? failures.slice(-count) : failures;
  }

  /**
   * Get operations for a specific spreadsheet
   */
  getBySpreadsheet(spreadsheetId: string, count?: number): OperationHistory[] {
    const ops = this.operations.filter((op) => op.spreadsheetId === spreadsheetId);
    return count ? ops.slice(-count) : ops;
  }

  /**
   * Get statistics
   */
  getStats(): OperationHistoryStats {
    const total = this.operations.length;
    const successful = this.operations.filter((op) => op.result === 'success').length;
    const failed = total - successful;

    const totalDuration = this.operations.reduce((sum, op) => sum + op.duration, 0);
    const averageDuration = total > 0 ? totalDuration / total : 0;

    const totalCells = this.operations.reduce(
      (sum, op) => sum + (op.cellsAffected || 0),
      0
    );

    // Find most common tool
    const toolCounts = new Map<string, number>();
    this.operations.forEach((op) => {
      toolCounts.set(op.tool, (toolCounts.get(op.tool) || 0) + 1);
    });
    const mostCommonTool = this.getMostCommon(toolCounts);

    // Find most common action
    const actionCounts = new Map<string, number>();
    this.operations.forEach((op) => {
      actionCounts.set(op.action, (actionCounts.get(op.action) || 0) + 1);
    });
    const mostCommonAction = this.getMostCommon(actionCounts);

    return {
      totalOperations: total,
      successfulOperations: successful,
      failedOperations: failed,
      successRate: total > 0 ? successful / total : 0,
      averageDuration,
      totalCellsAffected: totalCells,
      mostCommonTool,
      mostCommonAction,
      oldestOperation: this.operations[0]?.timestamp,
      newestOperation: this.operations[this.operations.length - 1]?.timestamp,
    };
  }

  /**
   * Helper to find most common value in a map
   */
  private getMostCommon(counts: Map<string, number>): string | undefined {
    let maxCount = 0;
    let maxKey: string | undefined;

    counts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        maxKey = key;
      }
    });

    return maxKey;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.operations = [];
    this.operationsMap.clear();

    logger.info('Operation history cleared');
  }

  /**
   * Get current size
   */
  size(): number {
    return this.operations.length;
  }

  /**
   * Check if history is full
   */
  isFull(): boolean {
    return this.operations.length >= this.maxSize;
  }

  /**
   * Get the last undoable operation for a spreadsheet
   */
  getLastUndoable(spreadsheetId: string): OperationHistory | undefined {
    const stack = this.undoStacks.get(spreadsheetId);
    if (!stack || stack.length === 0) {
      return undefined;
    }

    const operationId = stack[stack.length - 1];
    return this.operationsMap.get(operationId!);
  }

  /**
   * Get the last redoable operation for a spreadsheet
   */
  getLastRedoable(spreadsheetId: string): OperationHistory | undefined {
    const stack = this.redoStacks.get(spreadsheetId);
    if (!stack || stack.length === 0) {
      return undefined;
    }

    const operationId = stack[stack.length - 1];
    return this.operationsMap.get(operationId!);
  }

  /**
   * Mark operation as undone (moves from undo stack to redo stack)
   */
  markAsUndone(operationId: string, spreadsheetId: string): void {
    const undoStack = this.undoStacks.get(spreadsheetId) || [];
    const redoStack = this.redoStacks.get(spreadsheetId) || [];

    // Remove from undo stack
    const index = undoStack.indexOf(operationId);
    if (index !== -1) {
      undoStack.splice(index, 1);
      this.undoStacks.set(spreadsheetId, undoStack);

      // Add to redo stack
      redoStack.push(operationId);
      this.redoStacks.set(spreadsheetId, redoStack);
    }
  }

  /**
   * Mark operation as redone (moves from redo stack to undo stack)
   */
  markAsRedone(operationId: string, spreadsheetId: string): void {
    const undoStack = this.undoStacks.get(spreadsheetId) || [];
    const redoStack = this.redoStacks.get(spreadsheetId) || [];

    // Remove from redo stack
    const index = redoStack.indexOf(operationId);
    if (index !== -1) {
      redoStack.splice(index, 1);
      this.redoStacks.set(spreadsheetId, redoStack);

      // Add to undo stack
      undoStack.push(operationId);
      this.undoStacks.set(spreadsheetId, undoStack);
    }
  }

  /**
   * Clear operations for a specific spreadsheet
   */
  clearForSpreadsheet(spreadsheetId: string): number {
    // Remove operations
    const before = this.operations.length;
    this.operations = this.operations.filter((op) => op.spreadsheetId !== spreadsheetId);
    const removed = before - this.operations.length;

    // Rebuild map
    this.operationsMap.clear();
    this.operations.forEach((op) => {
      this.operationsMap.set(op.id, op);
    });

    // Clear undo/redo stacks
    this.undoStacks.delete(spreadsheetId);
    this.redoStacks.delete(spreadsheetId);

    logger.info(`Cleared ${removed} operations for spreadsheet ${spreadsheetId}`);
    return removed;
  }

  /**
   * Get undo stack size for a spreadsheet
   */
  getUndoStackSize(spreadsheetId: string): number {
    return this.undoStacks.get(spreadsheetId)?.length || 0;
  }

  /**
   * Get redo stack size for a spreadsheet
   */
  getRedoStackSize(spreadsheetId: string): number {
    return this.redoStacks.get(spreadsheetId)?.length || 0;
  }
}

// Singleton instance
let historyService: HistoryService | null = null;

/**
 * Get or create the history service singleton
 */
export function getHistoryService(): HistoryService {
  if (!historyService) {
    historyService = new HistoryService();
  }
  return historyService;
}

/**
 * Set the history service (for testing or custom configuration)
 */
export function setHistoryService(service: HistoryService): void {
  historyService = service;
}
