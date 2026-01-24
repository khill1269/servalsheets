/**
 * ServalSheets - Range Resolver
 *
 * Resolves semantic range queries to A1 notation
 * MCP Protocol: 2025-11-25
 *
 * Tighten-up #6: Strict resolution with confidence
 */
import type { sheets_v4 } from 'googleapis';
import type { RangeInput, ResolvedRange, ErrorDetail } from '../schemas/shared.js';
export declare class RangeResolutionError extends Error {
    readonly code: string;
    readonly details: Record<string, unknown>;
    readonly retryable: boolean;
    constructor(message: string, code: string, details?: Record<string, unknown>, retryable?: boolean);
    toErrorDetail(): ErrorDetail;
}
export interface RangeResolverOptions {
    sheetsApi: sheets_v4.Sheets;
    cacheTtlMs?: number;
    fuzzyMatchThreshold?: number;
}
/**
 * Resolves various range formats to A1 notation
 */
export declare class RangeResolver {
    private sheetsApi;
    private headerCache;
    private cacheTtlMs;
    private fuzzyMatchThreshold;
    constructor(options: RangeResolverOptions);
    /**
     * Escape sheet name for A1 notation
     * Single quotes within sheet names must be doubled
     */
    private escapeSheetName;
    /**
     * Resolve a range input to A1 notation
     */
    resolve(spreadsheetId: string, input: RangeInput): Promise<ResolvedRange>;
    /**
     * Resolve A1 notation directly
     */
    private resolveA1;
    /**
     * Resolve named range
     */
    private resolveNamedRange;
    /**
     * Resolve grid coordinates
     */
    private resolveGrid;
    /**
     * Resolve semantic query (column header match)
     */
    private resolveSemantic;
    /**
     * Get headers for a sheet (cached)
     */
    private getHeaders;
    /**
     * Get sheet info by name
     */
    private getSheetInfo;
    /**
     * Convert A1 reference to grid range
     */
    private a1ToGridRange;
    /**
     * Convert grid range to A1 notation with escaped sheet name
     */
    private gridRangeToA1;
    /**
     * Convert column letter to 0-based index
     */
    private letterToColumnIndex;
    /**
     * Convert 0-based index to column letter
     */
    private columnIndexToLetter;
    /**
     * Clear header cache
     */
    clearCache(): void;
    /**
     * Invalidate cache for a specific spreadsheet
     */
    invalidateSpreadsheet(spreadsheetId: string): void;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): {
        size: number;
        max: number;
        hitRate: number;
    };
}
//# sourceMappingURL=range-resolver.d.ts.map