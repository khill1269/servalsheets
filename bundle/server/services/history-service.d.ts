/**
 * HistoryService
 *
 * @purpose Tracks last 100 operations in circular buffer for debugging, undo support, and audit trail
 * @category Infrastructure
 * @usage Use to record all operations with timestamps; supports filtering by tool/action/spreadsheet, fast O(1) lookups by ID
 * @dependencies logger, history types
 * @stateful Yes - maintains circular buffer (max 100), operation ID index, statistics (total count, tool breakdown)
 * @singleton Yes - one instance per process to maintain global operation history
 *
 * @example
 * const history = new HistoryService({ maxSize: 100 });
 * history.record({ id: 'op123', tool: 'sheets_data', action: 'write', spreadsheetId: '1ABC', status: 'success' });
 * const ops = history.list({ tool: 'sheets_data', limit: 10 }); // Last 10 data operations
 * const stats = history.getStats(); // { totalOperations: 500, byTool: {...} }
 */
import type { OperationHistory, OperationHistoryStats, OperationHistoryFilter } from '../types/history.js';
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
export declare class HistoryService {
    private operations;
    private operationsMap;
    private maxSize;
    private verboseLogging;
    private undoStacks;
    private redoStacks;
    constructor(options?: HistoryServiceOptions);
    /**
     * Record an operation
     */
    record(operation: OperationHistory): void;
    /**
     * Get operation by ID
     */
    getById(id: string): OperationHistory | undefined;
    /**
     * Get all operations (optionally filtered)
     */
    getAll(filter?: OperationHistoryFilter): OperationHistory[];
    /**
     * Get recent operations (last N)
     */
    getRecent(count?: number): OperationHistory[];
    /**
     * Get failed operations
     */
    getFailures(count?: number): OperationHistory[];
    /**
     * Get operations for a specific spreadsheet
     */
    getBySpreadsheet(spreadsheetId: string, count?: number): OperationHistory[];
    /**
     * Get statistics for all operations or a specific spreadsheet
     * @param spreadsheetId Optional spreadsheet ID to filter by
     */
    getStats(spreadsheetId?: string): OperationHistoryStats;
    /**
     * Helper to find most common value in a map
     */
    private getMostCommon;
    /**
     * Clear all history
     */
    clear(): void;
    /**
     * Get current size
     */
    size(): number;
    /**
     * Check if history is full
     */
    isFull(): boolean;
    /**
     * Get the last undoable operation for a spreadsheet
     */
    getLastUndoable(spreadsheetId: string): OperationHistory | undefined;
    /**
     * Get the last redoable operation for a spreadsheet
     */
    getLastRedoable(spreadsheetId: string): OperationHistory | undefined;
    /**
     * Mark operation as undone (moves from undo stack to redo stack)
     */
    markAsUndone(operationId: string, spreadsheetId: string): void;
    /**
     * Mark operation as redone (moves from redo stack to undo stack)
     */
    markAsRedone(operationId: string, spreadsheetId: string): void;
    /**
     * Clear operations for a specific spreadsheet
     */
    clearForSpreadsheet(spreadsheetId: string): number;
    /**
     * Get undo stack size for a spreadsheet
     */
    getUndoStackSize(spreadsheetId: string): number;
    /**
     * Get redo stack size for a spreadsheet
     */
    getRedoStackSize(spreadsheetId: string): number;
    /**
     * Get undo stack for a spreadsheet
     * Returns array of operation IDs that can be undone
     */
    getUndoStack(spreadsheetId: string): string[];
    /**
     * Get redo stack for a spreadsheet
     * Returns array of operation IDs that can be redone
     */
    getRedoStack(spreadsheetId: string): string[];
    /**
     * Record an operation with extended tracking
     * Returns the operation ID for referencing
     */
    recordOperation(params: {
        spreadsheetId: string;
        tool: string;
        action: string;
        params: Record<string, unknown>;
        result?: {
            success: boolean;
            [key: string]: unknown;
        };
        error?: Error;
        snapshotId?: string;
        timestamp: Date;
        cellsAffected?: number;
        rowsAffected?: number;
    }): string;
    /**
     * Get operation history for a specific spreadsheet
     * @param spreadsheetId The spreadsheet ID
     * @param options Optional parameters (limit, etc.)
     * @returns Array of operations in reverse chronological order
     */
    getHistory(spreadsheetId: string, options?: {
        limit?: number;
    }): OperationHistory[];
    /**
     * Get a specific operation by ID for a spreadsheet
     * @param spreadsheetId The spreadsheet ID
     * @param operationId The operation ID
     * @returns The operation or undefined if not found
     */
    getOperation(spreadsheetId: string, operationId: string): OperationHistory | undefined;
    /**
     * Search operation history with filters
     * @param spreadsheetId The spreadsheet ID
     * @param filters Search criteria
     * @returns Filtered operations
     */
    searchHistory(spreadsheetId: string, filters: {
        tool?: string;
        action?: string;
        startTime?: Date;
        endTime?: Date;
        result?: 'success' | 'error';
    }): OperationHistory[];
    /**
     * Clear operation history for a specific spreadsheet
     * @param spreadsheetId The spreadsheet ID
     */
    clearHistory(spreadsheetId: string): void;
}
/**
 * Get or create the history service singleton
 */
export declare function getHistoryService(): HistoryService;
/**
 * Set the history service (for testing or custom configuration)
 */
export declare function setHistoryService(service: HistoryService): void;
/**
 * Reset the history service (for testing only)
 * @internal
 */
export declare function resetHistoryService(): void;
//# sourceMappingURL=history-service.d.ts.map