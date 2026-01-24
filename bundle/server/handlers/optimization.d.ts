/**
 * ServalSheets - Handler Optimization Utilities
 *
 * Performance utilities for handler hot paths.
 *
 * Optimizations:
 * 1. Pre-computed action dispatch tables (O(1) lookup vs switch)
 * 2. Inline cache key generation (no object allocation)
 * 3. Lazy context tracking (only when needed)
 * 4. Fast parameter presence checks
 * 5. Optimized response building
 *
 * @module handlers/optimization
 */
/**
 * Create a fast action dispatcher using a Map
 * Avoids switch statement overhead for frequent actions
 */
export declare function createActionDispatcher<TInput extends {
    action: string;
}, TOutput>(handlers: Record<string, (input: TInput) => Promise<TOutput>>): (input: TInput) => Promise<TOutput>;
/**
 * Fast cache key generation without object allocation
 * Uses a simple string join instead of JSON.stringify
 */
export declare function fastCacheKey(prefix: string, ...parts: (string | number | undefined)[]): string;
/**
 * Fast cache key for spreadsheet operations
 */
export declare function spreadsheetCacheKey(operation: string, spreadsheetId: string, range?: string, extra?: string): string;
/**
 * Check if all required parameters are present (avoid inference overhead)
 */
export declare function hasRequiredParams(input: Record<string, unknown>, ...required: string[]): boolean;
/**
 * Fast spreadsheet ID extraction (avoids type narrowing overhead)
 */
export declare function getSpreadsheetId(input: Record<string, unknown>): string | undefined;
/**
 * Fast action extraction
 */
export declare function getAction(input: Record<string, unknown>): string | undefined;
/**
 * Fast success response builder
 * Minimizes object allocation by reusing base and only adding needed fields
 */
export declare function fastSuccess<T extends Record<string, unknown>>(action: string, data: T): T & {
    success: true;
    action: string;
};
/**
 * Fast error response builder
 */
export declare function fastError(code: string, message: string, retryable?: boolean): {
    success: false;
    error: {
        code: string;
        message: string;
        retryable: boolean;
    };
};
/**
 * Execute multiple async operations in parallel with early bailout
 * Returns as soon as first operation fails
 */
export declare function parallelWithBailout<T>(operations: (() => Promise<T>)[]): Promise<T[]>;
/**
 * Batch async operations with concurrency limit
 */
export declare function batchAsync<T, R>(items: T[], operation: (item: T) => Promise<R>, concurrency?: number): Promise<R[]>;
/**
 * Lazy context tracker - only updates context when values change
 */
export declare class LazyContextTracker {
    private updateFn;
    private lastSpreadsheetId?;
    private lastSheetId?;
    private lastRange?;
    constructor(updateFn: (params: {
        spreadsheetId?: string;
        sheetId?: number;
        range?: string;
    }) => void);
    /**
     * Track context only if values have changed
     */
    track(params: {
        spreadsheetId?: string;
        sheetId?: number;
        range?: string;
    }): void;
    /**
     * Reset tracking state
     */
    reset(): void;
}
/**
 * Fast cell count for values array (avoids reduce overhead)
 */
export declare function countCells(values: unknown[][]): number;
/**
 * Fast row count
 */
export declare function countRows(values: unknown[][]): number;
/**
 * Fast column count (from first row)
 */
export declare function countColumns(values: unknown[][]): number;
/**
 * Truncate values array efficiently
 */
export declare function truncateValues(values: unknown[][], maxRows: number, maxCells: number): {
    values: unknown[][];
    truncated: boolean;
    originalRows: number;
    originalCells: number;
};
/**
 * Fast A1 range parsing (avoids regex when possible)
 * Named fastParseA1Range to avoid conflict with services/parseA1Range
 */
export declare function fastParseA1Range(range: string): {
    sheet?: string;
    startCol: string;
    startRow: number;
    endCol?: string;
    endRow?: number;
} | null;
/**
 * Fast range cell count estimation
 */
export declare function estimateRangeCells(range: string): number;
/**
 * Fast column letter to index conversion with caching
 */
export declare function columnLetterToIndex(letter: string): number;
export declare const HandlerOptimization: {
    createActionDispatcher: typeof createActionDispatcher;
    fastCacheKey: typeof fastCacheKey;
    spreadsheetCacheKey: typeof spreadsheetCacheKey;
    hasRequiredParams: typeof hasRequiredParams;
    getSpreadsheetId: typeof getSpreadsheetId;
    getAction: typeof getAction;
    fastSuccess: typeof fastSuccess;
    fastError: typeof fastError;
    parallelWithBailout: typeof parallelWithBailout;
    batchAsync: typeof batchAsync;
    LazyContextTracker: typeof LazyContextTracker;
    countCells: typeof countCells;
    countRows: typeof countRows;
    countColumns: typeof countColumns;
    truncateValues: typeof truncateValues;
    fastParseA1Range: typeof fastParseA1Range;
    estimateRangeCells: typeof estimateRangeCells;
    columnLetterToIndex: typeof columnLetterToIndex;
};
//# sourceMappingURL=optimization.d.ts.map