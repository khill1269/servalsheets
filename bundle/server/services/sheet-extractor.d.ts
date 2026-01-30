/**
 * SheetExtractor
 *
 * @purpose Unified data extraction pipeline with cache-first strategy, pagination, and tiered retrieval (quick/medium/comprehensive)
 * @category Core
 * @usage Use for test framework and data operations; implements 3 tiers (quick: metadata, medium: +data, comprehensive: +analysis)
 * @dependencies sheets_v4, drive_v3, logger, cache-manager
 * @stateful No - stateless extraction service using cache manager
 * @singleton No - can be instantiated per extraction request
 *
 * @example
 * const extractor = new SheetExtractor(sheetsClient, driveClient);
 * const data = await extractor.extract(spreadsheetId, { tier: 'medium', range: 'A1:Z100', useCache: true });
 * // { metadata: {...}, values: [[...]], cached: true }
 */
import type { sheets_v4, drive_v3 } from 'googleapis';
import { type ExtractionTier, type TestCategory, type TestDomain } from '../constants/extraction-fields.js';
/**
 * Progress callback for long-running extractions
 */
export type ExtractProgressCallback = (progress: ExtractProgress) => void;
/**
 * Progress information during extraction
 */
export interface ExtractProgress {
    phase: 'initializing' | 'fetching' | 'processing' | 'complete';
    tier?: ExtractionTier;
    tiersCompleted: number;
    tiersTotal: number;
    message: string;
    percentComplete: number;
}
/**
 * Options for extraction
 */
export interface ExtractOptions {
    /** Specific tiers to extract (defaults to all needed for categories) */
    tiers?: ExtractionTier[];
    /** Specific categories to test (determines tiers if not specified) */
    categories?: TestCategory[];
    /** Specific domains to test */
    domains?: TestDomain[];
    /** Maximum rows to extract per sheet (for pagination) */
    maxRowsPerSheet?: number;
    /** Maximum columns to extract per sheet */
    maxColumnsPerSheet?: number;
    /** Skip cache and fetch fresh data */
    skipCache?: boolean;
    /** Progress callback */
    onProgress?: ExtractProgressCallback;
    /** Abort signal for cancellation */
    abortSignal?: AbortSignal;
    /** Include raw API responses */
    includeRaw?: boolean;
}
/**
 * Sheet metadata from extraction
 */
export interface ExtractedSheetMeta {
    sheetId: number;
    title: string;
    index: number;
    hidden: boolean;
    gridProperties: {
        rowCount: number;
        columnCount: number;
        frozenRowCount: number;
        frozenColumnCount: number;
    };
    tabColor?: {
        red: number;
        green: number;
        blue: number;
        alpha?: number;
    };
}
/**
 * Cell value with metadata
 */
export interface ExtractedCellValue {
    row: number;
    col: number;
    value: unknown;
    formattedValue?: string;
    formula?: string;
    hyperlink?: string;
    note?: string;
    dataValidation?: sheets_v4.Schema$DataValidationRule;
}
/**
 * Merged cell region
 */
export interface ExtractedMerge {
    sheetId: number;
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
}
/**
 * Named range
 */
export interface ExtractedNamedRange {
    namedRangeId: string;
    name: string;
    range: {
        sheetId: number;
        startRowIndex: number;
        endRowIndex: number;
        startColumnIndex: number;
        endColumnIndex: number;
    };
}
/**
 * Conditional format rule
 */
export interface ExtractedConditionalFormat {
    sheetId: number;
    ranges: Array<{
        startRowIndex: number;
        endRowIndex: number;
        startColumnIndex: number;
        endColumnIndex: number;
    }>;
    booleanRule?: sheets_v4.Schema$BooleanRule;
    gradientRule?: sheets_v4.Schema$GradientRule;
}
/**
 * Protected range
 */
export interface ExtractedProtectedRange {
    protectedRangeId: number;
    sheetId?: number;
    range?: {
        startRowIndex: number;
        endRowIndex: number;
        startColumnIndex: number;
        endColumnIndex: number;
    };
    description?: string;
    warningOnly: boolean;
    editors?: {
        users?: string[];
        groups?: string[];
        domainUsersCanEdit?: boolean;
    };
}
/**
 * Filter view
 */
export interface ExtractedFilterView {
    filterViewId: number;
    title: string;
    range: {
        sheetId: number;
        startRowIndex: number;
        endRowIndex: number;
        startColumnIndex: number;
        endColumnIndex: number;
    };
    criteria?: Record<string, sheets_v4.Schema$FilterCriteria>;
}
/**
 * Chart
 */
export interface ExtractedChart {
    chartId: number;
    sheetId: number;
    position: {
        anchorCell?: {
            sheetId: number;
            rowIndex: number;
            columnIndex: number;
        };
        offsetX?: number;
        offsetY?: number;
        width?: number;
        height?: number;
    };
    chartType?: string;
    title?: string;
}
/**
 * Pivot table
 */
export interface ExtractedPivotTable {
    sheetId: number;
    sourceRange?: {
        sheetId: number;
        startRowIndex: number;
        endRowIndex: number;
        startColumnIndex: number;
        endColumnIndex: number;
    };
    rows?: sheets_v4.Schema$PivotGroup[];
    columns?: sheets_v4.Schema$PivotGroup[];
    values?: sheets_v4.Schema$PivotValue[];
}
/**
 * Sharing permission (from Drive API)
 */
export interface ExtractedPermission {
    id: string;
    type: 'user' | 'group' | 'domain' | 'anyone';
    role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
    emailAddress?: string;
    domain?: string;
    displayName?: string;
}
/**
 * Comment (from Drive API)
 */
export interface ExtractedComment {
    id: string;
    author: {
        displayName: string;
        emailAddress?: string;
    };
    content: string;
    createdTime: string;
    modifiedTime?: string;
    resolved: boolean;
    anchor?: string;
    replies?: Array<{
        id: string;
        author: {
            displayName: string;
            emailAddress?: string;
        };
        content: string;
        createdTime: string;
    }>;
}
/**
 * Complete extraction result
 */
export interface ExtractionResult {
    /** Spreadsheet ID */
    spreadsheetId: string;
    /** Spreadsheet metadata */
    metadata: {
        title: string;
        locale: string;
        timeZone: string;
        url: string;
        createdTime?: string;
        modifiedTime?: string;
        ownerEmail?: string;
    };
    /** Tiers that were extracted */
    tiersExtracted: ExtractionTier[];
    /** Extraction timestamp */
    extractedAt: string;
    /** Time taken in milliseconds */
    extractionTimeMs: number;
    /** Whether data came from cache */
    fromCache: boolean;
    /** Sheet metadata */
    sheets: ExtractedSheetMeta[];
    /** Cell data by sheet (sheetId -> row -> col -> cell) */
    cellData: Map<number, Map<number, Map<number, ExtractedCellValue>>>;
    /** Merged cells */
    merges: ExtractedMerge[];
    /** Named ranges */
    namedRanges: ExtractedNamedRange[];
    /** Conditional formats by sheet */
    conditionalFormats: Map<number, ExtractedConditionalFormat[]>;
    /** Protected ranges */
    protectedRanges: ExtractedProtectedRange[];
    /** Filter views by sheet */
    filterViews: Map<number, ExtractedFilterView[]>;
    /** Charts by sheet */
    charts: Map<number, ExtractedChart[]>;
    /** Pivot tables by sheet */
    pivotTables: Map<number, ExtractedPivotTable[]>;
    /** Data validation rules by sheet (sheetId -> row -> col -> rule) */
    dataValidation: Map<number, Map<number, Map<number, sheets_v4.Schema$DataValidationRule>>>;
    /** Sharing permissions (requires Drive API) */
    permissions?: ExtractedPermission[];
    /** Comments (requires Drive API) */
    comments?: ExtractedComment[];
    /** Raw API responses (if requested) */
    raw?: {
        spreadsheet?: sheets_v4.Schema$Spreadsheet;
        permissions?: drive_v3.Schema$PermissionList;
        comments?: drive_v3.Schema$CommentList;
    };
    /** Errors encountered during extraction */
    errors: Array<{
        tier: ExtractionTier;
        message: string;
        recoverable: boolean;
    }>;
}
/**
 * Sheet Extractor Service
 *
 * Provides unified data extraction from Google Sheets with:
 * - Tiered extraction based on test categories
 * - Cache-first retrieval strategy
 * - Pagination for large sheets
 * - Drive API integration for collaboration data
 * - Progress tracking
 */
export declare class SheetExtractor {
    private sheetsApi;
    private driveApi?;
    constructor(sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive);
    /**
     * Extract data from a spreadsheet based on specified options
     *
     * @param spreadsheetId - The spreadsheet ID to extract from
     * @param options - Extraction options
     * @returns Complete extraction result
     */
    extract(spreadsheetId: string, options?: ExtractOptions): Promise<ExtractionResult>;
    /**
     * Extract only specific categories
     */
    extractCategories(spreadsheetId: string, categories: TestCategory[], options?: Omit<ExtractOptions, 'categories'>): Promise<ExtractionResult>;
    /**
     * Extract only specific domains
     */
    extractDomains(spreadsheetId: string, domains: TestDomain[], options?: Omit<ExtractOptions, 'domains'>): Promise<ExtractionResult>;
    /**
     * Quick extraction - minimal tier only
     */
    extractMinimal(spreadsheetId: string, options?: Omit<ExtractOptions, 'tiers'>): Promise<ExtractionResult>;
    /**
     * Full extraction - all tiers
     */
    extractComprehensive(spreadsheetId: string, options?: Omit<ExtractOptions, 'tiers'>): Promise<ExtractionResult>;
    /**
     * Determine which tiers to extract based on options
     */
    private determineTiers;
    /**
     * Extract a single tier's data
     */
    private extractTier;
    /**
     * Process spreadsheet API response and populate result
     */
    private processSpreadsheetResponse;
    /**
     * Process a single sheet
     */
    private processSheet;
    /**
     * Process grid data (cells, values, formatting)
     */
    private processGridData;
    /**
     * Extract the actual value from a cell
     */
    private extractCellValue;
    /**
     * Process merged cell regions
     */
    private processMerges;
    /**
     * Process named ranges
     */
    private processNamedRanges;
    /**
     * Process conditional formats
     */
    private processConditionalFormats;
    /**
     * Process filter views
     */
    private processFilterViews;
    /**
     * Process protected ranges
     */
    private processProtectedRanges;
    /**
     * Process charts
     */
    private processCharts;
    /**
     * Extract data from Drive API (permissions, comments)
     */
    private extractDriveData;
    /**
     * Get cached extraction result
     */
    private getFromCache;
    /**
     * Save extraction result to cache
     */
    private saveToCache;
    /**
     * Convert Maps to plain objects for serialization
     */
    private serializeMaps;
    /**
     * Convert serialized objects back to Maps
     */
    private reconstructMaps;
    /**
     * Convert a Map to a plain object
     */
    private mapToObject;
    /**
     * Convert a plain object to a Map
     */
    private objectToMap;
    /**
     * Report progress to callback
     */
    private reportProgress;
    /**
     * Check if an error is recoverable (can continue extraction)
     */
    private isRecoverableError;
    /**
     * Invalidate cache for a spreadsheet
     */
    invalidateCache(spreadsheetId: string): void;
    /**
     * Get extraction statistics
     */
    getStats(): {
        cacheHits: number;
        cacheMisses: number;
        averageExtractionTime: number;
    };
}
/**
 * Create a new SheetExtractor instance
 */
export declare function createSheetExtractor(sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive): SheetExtractor;
/**
 * Get cell value from extraction result
 */
export declare function getCellValue(result: ExtractionResult, sheetId: number, row: number, col: number): ExtractedCellValue | undefined;
/**
 * Get all cell values for a sheet
 */
export declare function getSheetCells(result: ExtractionResult, sheetId: number): ExtractedCellValue[];
/**
 * Get sheet by ID from extraction result
 */
export declare function getSheetById(result: ExtractionResult, sheetId: number): ExtractedSheetMeta | undefined;
/**
 * Get sheet by name from extraction result
 */
export declare function getSheetByName(result: ExtractionResult, name: string): ExtractedSheetMeta | undefined;
/**
 * Count total cells with data
 */
export declare function countCellsWithData(result: ExtractionResult): number;
/**
 * Check if extraction has errors
 */
export declare function hasExtractionErrors(result: ExtractionResult): boolean;
/**
 * Get non-recoverable errors
 */
export declare function getCriticalErrors(result: ExtractionResult): ExtractionResult['errors'];
//# sourceMappingURL=sheet-extractor.d.ts.map