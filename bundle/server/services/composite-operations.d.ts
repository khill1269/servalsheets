/**
 * CompositeOperationsService
 *
 * @purpose Provides high-level operations combining multiple API calls: import_csv, smart_append, bulk_update, deduplicate
 * @category Core
 * @usage Use for complex multi-step operations that need CSV parsing, intelligent column matching, or data deduplication
 * @dependencies sheets_v4, SheetResolver, logger
 * @stateful No - stateless service processing operations on-demand
 * @singleton No - can be instantiated per request
 *
 * @example
 * const service = new CompositeOperationsService(sheetsClient, sheetResolver);
 * await service.importCsv({ spreadsheetId, csvData, sheet: 'Data', skipHeader: true });
 * await service.smartAppend({ spreadsheetId, range: 'A1:Z100', values: [[...]], matchHeaders: true });
 */
import type { sheets_v4 } from 'googleapis';
import type { SheetResolver } from './sheet-resolver.js';
/**
 * CSV import options
 */
export interface CsvImportOptions {
    /** Target spreadsheet ID */
    spreadsheetId: string;
    /** Target sheet (name or ID) - creates if doesn't exist */
    sheet?: string | number;
    /** CSV data as string */
    csvData: string;
    /** Field delimiter (default: comma) */
    delimiter?: string;
    /** Whether first row is header (default: true) */
    hasHeader?: boolean;
    /** How to handle existing data */
    mode?: 'replace' | 'append' | 'new_sheet';
    /** New sheet name if mode is 'new_sheet' */
    newSheetName?: string;
    /** Skip empty rows (default: true) */
    skipEmptyRows?: boolean;
    /** Trim whitespace from values (default: true) */
    trimValues?: boolean;
}
/**
 * CSV import result
 */
export interface CsvImportResult {
    /** Number of rows imported */
    rowsImported: number;
    /** Number of columns */
    columnsImported: number;
    /** Target range */
    range: string;
    /** Sheet ID */
    sheetId: number;
    /** Sheet name */
    sheetName: string;
    /** Rows skipped (empty) */
    rowsSkipped: number;
    /** Whether a new sheet was created */
    newSheetCreated: boolean;
}
/**
 * Smart append options
 */
export interface SmartAppendOptions {
    /** Target spreadsheet ID */
    spreadsheetId: string;
    /** Target sheet (name or ID) */
    sheet: string | number;
    /** Data to append - object array with column headers as keys */
    data: Array<Record<string, unknown>>;
    /** Match columns by header (default: true) */
    matchHeaders?: boolean;
    /** Create missing columns (default: false) */
    createMissingColumns?: boolean;
    /** Skip rows with all empty values (default: true) */
    skipEmptyRows?: boolean;
}
/**
 * Smart append result
 */
export interface SmartAppendResult {
    /** Number of rows appended */
    rowsAppended: number;
    /** Columns matched */
    columnsMatched: string[];
    /** Columns created (if createMissingColumns was true) */
    columnsCreated: string[];
    /** Columns in data that weren't in sheet */
    columnsSkipped: string[];
    /** Target range */
    range: string;
    /** Sheet ID */
    sheetId: number;
}
/**
 * Bulk update options
 */
export interface BulkUpdateOptions {
    /** Target spreadsheet ID */
    spreadsheetId: string;
    /** Target sheet (name or ID) */
    sheet: string | number;
    /** Key column header for matching rows */
    keyColumn: string;
    /** Data to update - objects with key column and update values */
    updates: Array<Record<string, unknown>>;
    /** Create rows for unmatched keys (default: false) */
    createUnmatched?: boolean;
}
/**
 * Bulk update result
 */
export interface BulkUpdateResult {
    /** Rows updated */
    rowsUpdated: number;
    /** Rows created (if createUnmatched was true) */
    rowsCreated: number;
    /** Keys not found */
    keysNotFound: string[];
    /** Total cells modified */
    cellsModified: number;
}
/**
 * Data deduplication options
 */
export interface DeduplicateOptions {
    /** Target spreadsheet ID */
    spreadsheetId: string;
    /** Target sheet (name or ID) */
    sheet: string | number;
    /** Column(s) to check for duplicates */
    keyColumns: string[];
    /** Keep first or last duplicate (default: 'first') */
    keep?: 'first' | 'last';
    /** Preview only, don't delete (default: false) */
    preview?: boolean;
}
/**
 * Deduplication result
 */
export interface DeduplicateResult {
    /** Total rows analyzed */
    totalRows: number;
    /** Unique rows */
    uniqueRows: number;
    /** Duplicate rows found */
    duplicatesFound: number;
    /** Rows deleted (0 if preview) */
    rowsDeleted: number;
    /** Preview of duplicates (if preview mode) */
    duplicatePreview?: Array<{
        rowNumber: number;
        keyValues: Record<string, unknown>;
        keepStatus: 'keep' | 'delete';
    }>;
}
/**
 * Composite Operations Service
 *
 * Provides high-level operations that abstract away API complexity.
 */
export declare class CompositeOperationsService {
    private sheetsApi;
    private sheetResolver;
    constructor(sheetsApi: sheets_v4.Sheets, sheetResolver: SheetResolver);
    /**
     * Import CSV data into a sheet
     */
    importCsv(options: CsvImportOptions): Promise<CsvImportResult>;
    /**
     * Smart append - matches columns by header
     */
    smartAppend(options: SmartAppendOptions): Promise<SmartAppendResult>;
    /**
     * Bulk update rows by key column
     */
    bulkUpdate(options: BulkUpdateOptions): Promise<BulkUpdateResult>;
    /**
     * Deduplicate rows in a sheet
     */
    deduplicate(options: DeduplicateOptions): Promise<DeduplicateResult>;
    /**
     * Parse CSV string to 2D array
     */
    private parseCsv;
    /**
     * Parse a single CSV line handling quoted values
     */
    private parseCsvLine;
    /**
     * Parse a string value to appropriate type
     */
    private parseValue;
    /**
     * Create a new sheet
     */
    private createSheet;
    /**
     * Convert column index to letter
     */
    private columnIndexToLetter;
}
/**
 * Get the composite operations service instance
 */
export declare function getCompositeOperations(): CompositeOperationsService | null;
/**
 * Initialize composite operations service
 */
export declare function initializeCompositeOperations(sheetsApi: sheets_v4.Sheets, sheetResolver: SheetResolver): CompositeOperationsService;
/**
 * Reset composite operations service (for testing only)
 * @internal
 */
export declare function resetCompositeOperations(): void;
//# sourceMappingURL=composite-operations.d.ts.map