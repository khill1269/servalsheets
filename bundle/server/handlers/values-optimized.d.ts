/**
 * ServalSheets - Optimized Values Handler Mixin
 *
 * Performance optimizations for the values handler hot path.
 *
 * Usage:
 * 1. Import this mixin in values.ts
 * 2. Use optimized methods in hot paths
 *
 * Optimizations:
 * - Pre-built action dispatch map (O(1) vs switch statement)
 * - Inline cache key generation
 * - Fast cell counting
 * - Lazy context tracking
 * - Optimized response building
 *
 * @module handlers/values-optimized
 */
import type { sheets_v4 } from 'googleapis';
import { LazyContextTracker } from './optimization.js';
/**
 * Fast cache get with hot tier priority
 */
export declare function fastCacheGet<T>(operation: string, spreadsheetId: string, range: string): T | undefined;
/**
 * Fast cache set with hot tier
 */
export declare function fastCacheSet<T>(operation: string, spreadsheetId: string, range: string, value: T, ttl?: number): void;
/**
 * Fast cache invalidation for range
 */
export declare function fastCacheInvalidate(spreadsheetId: string, range?: string): number;
/**
 * Optimized values read path
 *
 * Optimizations:
 * - Hot cache lookup first (50ns vs 5ms)
 * - Inline cache key generation
 * - Fast cell counting
 * - Minimal object allocation
 */
export declare function optimizedValuesRead(sheetsApi: sheets_v4.Sheets, spreadsheetId: string, range: string, options?: {
    valueRenderOption?: string;
    majorDimension?: string;
}): Promise<{
    values: unknown[][];
    range: string;
    majorDimension?: string;
    fromCache: boolean;
    cellCount: number;
}>;
/**
 * Optimized values write path
 *
 * Optimizations:
 * - Fast cell counting
 * - Minimal object allocation for response
 * - Cache invalidation
 */
export declare function optimizedValuesWrite(sheetsApi: sheets_v4.Sheets, spreadsheetId: string, range: string, values: unknown[][], options?: {
    valueInputOption?: string;
    includeValuesInResponse?: boolean;
}): Promise<{
    updatedCells: number;
    updatedRows: number;
    updatedColumns: number;
    updatedRange: string;
}>;
/**
 * Optimized batch values read
 *
 * Optimizations:
 * - Parallel cache lookups
 * - Single API call for cache misses
 * - Fast result aggregation
 */
export declare function optimizedBatchRead(sheetsApi: sheets_v4.Sheets, spreadsheetId: string, ranges: string[], options?: {
    valueRenderOption?: string;
    majorDimension?: string;
}): Promise<{
    valueRanges: Array<{
        range: string;
        values: unknown[][];
    }>;
    fromCache: number;
    fromApi: number;
}>;
/**
 * Create lazy context tracker for values handler
 */
export declare function createValuesContextTracker(updateFn: (params: {
    spreadsheetId?: string;
    sheetId?: number;
    range?: string;
}) => void): LazyContextTracker;
/**
 * Build optimized read response
 */
export declare function buildReadResponse(values: unknown[][], range: string, options?: {
    majorDimension?: string;
    maxCells?: number;
    maxRows?: number;
    spreadsheetId?: string;
}): {
    success: true;
    action: 'read';
    values: unknown[][];
    range: string;
    majorDimension?: string;
    truncated?: boolean;
    resourceUri?: string;
    originalRows?: number;
    originalCells?: number;
};
/**
 * Build optimized write response
 */
export declare function buildWriteResponse(updatedCells: number, updatedRows: number, updatedColumns: number, updatedRange: string, mutation?: {
    cellsAffected?: number;
    diff?: unknown;
    reversible?: boolean;
    revertSnapshotId?: string;
}, dryRun?: boolean): {
    success: true;
    action: 'write';
    updatedCells: number;
    updatedRows: number;
    updatedColumns: number;
    updatedRange: string;
    mutation?: typeof mutation;
    dryRun?: boolean;
};
export declare const ValuesOptimization: {
    fastCacheGet: typeof fastCacheGet;
    fastCacheSet: typeof fastCacheSet;
    fastCacheInvalidate: typeof fastCacheInvalidate;
    optimizedValuesRead: typeof optimizedValuesRead;
    optimizedValuesWrite: typeof optimizedValuesWrite;
    optimizedBatchRead: typeof optimizedBatchRead;
    createValuesContextTracker: typeof createValuesContextTracker;
    buildReadResponse: typeof buildReadResponse;
    buildWriteResponse: typeof buildWriteResponse;
};
//# sourceMappingURL=values-optimized.d.ts.map