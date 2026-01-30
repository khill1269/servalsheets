/**
 * SheetResolver
 *
 * @purpose Resolves sheet references (name or numeric ID) to sheet metadata; enables natural sheet referencing ("Sheet1" vs sheetId: 0)
 * @category Core
 * @usage Use whenever accepting sheet name/ID input; resolves to { sheetId, title, index, gridProperties }, LRU cache (100 entries)
 * @dependencies sheets_v4, LRUCache, logger
 * @stateful Yes - maintains LRU cache of resolved sheets (max 100 per spreadsheet), cache TTL 5min
 * @singleton No - instantiate per handler context to maintain isolated caches
 *
 * @example
 * const resolver = new SheetResolver(sheetsClient);
 * const sheet = await resolver.resolve(spreadsheetId, 'Sheet1'); // Resolves by name
 * const sheet2 = await resolver.resolve(spreadsheetId, 0); // Resolves by ID
 * // { sheetId: 0, title: 'Sheet1', index: 0, gridProperties: {...} }
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Sheet reference - can be either name or ID
 */
export interface SheetReference {
    /** Sheet name (preferred for UX) */
    sheetName?: string;
    /** Sheet ID (numeric, for API) */
    sheetId?: number;
}
/**
 * Resolved sheet information
 */
export interface ResolvedSheet {
    /** Numeric sheet ID */
    sheetId: number;
    /** Sheet title/name */
    title: string;
    /** Sheet index (0-based position) */
    index: number;
    /** Whether the sheet is hidden */
    hidden: boolean;
    /** Grid properties */
    gridProperties?: {
        rowCount: number;
        columnCount: number;
        frozenRowCount?: number;
        frozenColumnCount?: number;
    };
}
/**
 * Sheet resolution result with confidence
 */
export interface SheetResolutionResult {
    /** Resolved sheet info */
    sheet: ResolvedSheet;
    /** Resolution method used */
    method: 'exact_name' | 'exact_id' | 'fuzzy_name' | 'index';
    /** Confidence score (0-1) */
    confidence: number;
    /** Alternative matches (for fuzzy resolution) */
    alternatives?: Array<{
        sheet: ResolvedSheet;
        similarity: number;
    }>;
}
/**
 * Sheet resolver options
 */
export interface SheetResolverOptions {
    /** Sheets API instance */
    sheetsApi: sheets_v4.Sheets;
    /** Cache TTL in milliseconds (default: 5 minutes) */
    cacheTtlMs?: number;
    /** Enable fuzzy matching (default: true) */
    enableFuzzyMatch?: boolean;
    /** Fuzzy match threshold (0-1, default: 0.7) */
    fuzzyThreshold?: number;
}
export declare class SheetResolutionError extends Error {
    readonly code: string;
    readonly details: Record<string, unknown>;
    readonly retryable: boolean;
    readonly availableSheets?: string[];
    constructor(message: string, code: string, details?: Record<string, unknown>, availableSheets?: string[]);
}
/**
 * Sheet Resolver Service
 *
 * Provides intelligent sheet resolution with caching and fuzzy matching.
 * Allows users to reference sheets by name, reducing friction.
 */
export declare class SheetResolver {
    private sheetsApi;
    private cache;
    private cacheTtlMs;
    private enableFuzzyMatch;
    private fuzzyThreshold;
    constructor(options?: SheetResolverOptions);
    /**
     * Get the Sheets API instance
     * @private
     */
    private getSheetsApi;
    /**
     * Resolve a sheet reference to sheet metadata
     *
     * @param spreadsheetId - Spreadsheet ID
     * @param reference - Sheet reference (name or ID)
     * @returns Resolved sheet information
     */
    resolve(spreadsheetId: string, reference: SheetReference): Promise<SheetResolutionResult>;
    /**
     * Resolve sheet by name with fuzzy matching support
     */
    private resolveByName;
    /**
     * Calculate string similarity using Levenshtein-based metric
     */
    private calculateSimilarity;
    /**
     * Get all sheets in a spreadsheet (cached)
     */
    getSheets(spreadsheetId: string): Promise<ResolvedSheet[]>;
    /**
     * Resolve multiple sheet references
     */
    resolveMultiple(spreadsheetId: string, references: SheetReference[]): Promise<SheetResolutionResult[]>;
    /**
     * Get sheet by index (0-based)
     */
    getSheetByIndex(spreadsheetId: string, index: number): Promise<ResolvedSheet | null>;
    /**
     * List all sheet names in a spreadsheet
     */
    listSheetNames(spreadsheetId: string): Promise<string[]>;
    /**
     * Invalidate cache for a spreadsheet
     */
    invalidate(spreadsheetId: string): void;
    /**
     * Invalidate cache for a spreadsheet (alias for invalidate)
     */
    invalidateCache(spreadsheetId: string): void;
    /**
     * Clear entire cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        max: number;
    };
    /**
     * Get all sheets for a spreadsheet (alias for getSheets)
     */
    getAllSheets(spreadsheetId: string): Promise<ResolvedSheet[]>;
    /**
     * Get a sheet by name
     */
    getSheetByName(spreadsheetId: string, sheetName: string, _auth?: unknown): Promise<{
        properties?: {
            sheetId: number;
            title: string;
        };
    } | undefined>;
    /**
     * Get a sheet by ID
     */
    getSheetById(spreadsheetId: string, sheetId: number, _auth?: unknown): Promise<{
        properties?: {
            sheetId: number;
            title: string;
        };
    } | undefined>;
    /**
     * Resolve a range reference to A1 notation
     * Handles A1 notation, named ranges, and semantic queries
     */
    resolveRange(spreadsheetId: string, range: string | {
        semantic: {
            column: string;
            sheet: string;
        };
    }, _auth: unknown): Promise<{
        resolvedRange: string;
        wasResolved: boolean;
        originalInput: string | object;
    }>;
    /**
     * Get all named ranges in a spreadsheet
     */
    getNamedRanges(spreadsheetId: string, _auth: unknown): Promise<Array<sheets_v4.Schema$NamedRange>>;
    /**
     * Find column index by header name
     * Returns 0-based column index, or -1 if not found
     */
    findColumnByHeader(spreadsheetId: string, sheetName: string, headerName: string, _auth: unknown): Promise<number>;
    /**
     * Get headers (first row) from a sheet
     */
    getHeaders(spreadsheetId: string, sheetName: string, _auth: unknown): Promise<string[]>;
    /**
     * Convert 0-based column index to letter (A, B, ..., Z, AA, AB, ...)
     */
    columnIndexToLetter(index: number): string;
    /**
     * Convert column letter to 0-based index (A->0, B->1, ..., AA->26)
     */
    letterToColumnIndex(letter: string): number;
    /**
     * Parse A1 notation into components
     */
    parseA1Notation(notation: string): {
        sheetName?: string;
        startColumn?: string;
        startRow?: number;
        endColumn?: string;
        endRow?: number;
    };
    /**
     * Build A1 notation from components
     */
    buildA1Notation(components: {
        sheetName?: string;
        startColumn: string;
        startRow?: number;
        endColumn?: string;
        endRow?: number;
    }): string;
}
/**
 * Get or create the sheet resolver singleton
 */
export declare function getSheetResolver(options?: SheetResolverOptions): SheetResolver | null;
/**
 * Set the sheet resolver (for testing or custom configuration)
 */
export declare function setSheetResolver(resolver: SheetResolver | null): void;
/**
 * Initialize sheet resolver with Sheets API
 */
export declare function initializeSheetResolver(sheetsApi: sheets_v4.Sheets, options?: Omit<SheetResolverOptions, 'sheetsApi'>): SheetResolver;
/**
 * Reset the sheet resolver (for testing only)
 * @internal
 */
export declare function resetSheetResolver(): void;
//# sourceMappingURL=sheet-resolver.d.ts.map