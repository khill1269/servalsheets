/**
 * ServalSheets - Diff Engine
 *
 * Tiered diffing for mutation summaries
 * Tighten-up #3: Don't try to diff everything
 */
import type { sheets_v4 } from 'googleapis';
import type { DiffResult, DiffOptions, CellValue } from '../schemas/shared.js';
type SheetSamples = {
    firstRows: CellValue[][];
    lastRows: CellValue[][];
};
export interface SpreadsheetState {
    timestamp: string;
    spreadsheetId: string;
    sheets: SheetState[];
    checksum: string;
}
export interface SheetState {
    sheetId: number;
    title: string;
    rowCount: number;
    columnCount: number;
    checksum: string;
    blockChecksums?: string[];
    sampleData?: SheetSamples;
    values?: CellValue[][];
}
export interface DiffEngineOptions {
    sheetsApi: sheets_v4.Sheets;
    defaultTier?: 'METADATA' | 'SAMPLE' | 'FULL';
    sampleSize?: number;
    maxFullDiffCells?: number;
    blockSize?: number;
}
export interface CaptureStateOptions {
    tier?: 'METADATA' | 'SAMPLE' | 'FULL';
    sampleSize?: number;
    maxFullDiffCells?: number;
}
/**
 * Diff engine with tiered comparison
 */
export declare class DiffEngine {
    private sheetsApi;
    private defaultTier;
    private sampleSize;
    private maxFullDiffCells;
    private blockSize;
    constructor(options: DiffEngineOptions);
    getDefaultTier(): 'METADATA' | 'SAMPLE' | 'FULL';
    /**
     * Capture current spreadsheet state by fetching from API
     *
     * NOTE: For update operations, prefer `captureStateFromResponse()` to avoid redundant API calls
     */
    captureState(spreadsheetId: string, options?: CaptureStateOptions): Promise<SpreadsheetState>;
    /**
     * Capture detailed state for a specific range by fetching from API
     *
     * NOTE: For update operations, prefer `captureRangeStateFromResponse()` to avoid redundant API calls
     */
    captureRangeState(spreadsheetId: string, range: string): Promise<{
        checksum: string;
        rowCount: number;
        values?: CellValue[][];
    }>;
    /**
     * OPTIMIZATION: Capture state from API response without additional fetches
     *
     * Use this after update operations to avoid redundant API calls.
     * The Google Sheets API returns updated data in responses, eliminating the need
     * to fetch the "after" state separately.
     *
     * @param spreadsheetId - The spreadsheet ID
     * @param sheetsResponse - The response from spreadsheets.get() or spreadsheets.batchUpdate()
     * @param options - Capture options (tier, sample size, etc.)
     * @returns SpreadsheetState constructed from response data
     *
     * @example
     * ```typescript
     * // Before (2 API calls):
     * const before = await diffEngine.captureState(id);
     * const response = await sheetsApi.spreadsheets.batchUpdate(...);
     * const after = await diffEngine.captureState(id);  // ❌ Redundant fetch!
     *
     * // After (1 API call):
     * const before = await diffEngine.captureState(id);
     * const response = await sheetsApi.spreadsheets.batchUpdate(...);
     * const after = diffEngine.captureStateFromResponse(id, response.data);  // ✅ No fetch!
     * ```
     */
    captureStateFromResponse(spreadsheetId: string, sheetsResponse: sheets_v4.Schema$Spreadsheet, options?: CaptureStateOptions): SpreadsheetState;
    /**
     * OPTIMIZATION: Capture range state from update response without additional fetches
     *
     * Use this after values.update() or values.batchUpdate() operations.
     *
     * @param range - The range that was updated
     * @param updateResponse - The UpdateValuesResponse or updatedData from the API
     * @returns Range state constructed from response data
     *
     * @example
     * ```typescript
     * // Before (2 API calls):
     * const before = await diffEngine.captureRangeState(id, range);
     * const response = await sheetsApi.spreadsheets.values.update(...);
     * const after = await diffEngine.captureRangeState(id, range);  // ❌ Redundant fetch!
     *
     * // After (1 API call):
     * const before = await diffEngine.captureRangeState(id, range);
     * const response = await sheetsApi.spreadsheets.values.update(...);
     * const after = diffEngine.captureRangeStateFromResponse(
     *   range,
     *   response.data.updatedData
     * );  // ✅ No fetch!
     * ```
     */
    captureRangeStateFromResponse(range: string, updatedData?: sheets_v4.Schema$ValueRange): {
        checksum: string;
        rowCount: number;
        values?: CellValue[][];
    };
    /**
     * Generate diff between two states
     */
    diff(before: SpreadsheetState, after: SpreadsheetState, options?: DiffOptions): Promise<DiffResult>;
    /**
     * Metadata-only diff (Tier 1)
     */
    private metadataDiff;
    /**
     * Sample diff (Tier 2) - Returns summary with sample statistics
     * OPTIMIZED: Uses Map-based lookup for O(1) before sheet access instead of O(n) find()
     */
    private sampleDiff;
    /**
     * Full cell-by-cell diff (Tier 3) - Compares cells up to limit
     * OPTIMIZED: Uses block checksums for early termination, parallel processing, and Map-based lookups
     */
    private fullDiff;
    /**
     * Convert column index to letter (0 = A, 25 = Z, 26 = AA)
     */
    private columnIndexToLetter;
    private formatCell;
    /**
     * Select appropriate diff tier based on data size
     */
    private selectTier;
    /**
     * Estimate number of changed cells
     */
    private estimateChangedCells;
    private getRangeValues;
    private collectSampleChanges;
    private countCells;
    private ensureValues;
    /**
     * OPTIMIZATION: Compute block checksums for faster diff
     * Divides data into blocks and computes checksum for each
     */
    private computeBlockChecksums;
    /**
     * OPTIMIZATION: Identify which blocks have changed
     * Returns set of block indices that differ between before/after
     */
    private identifyChangedBlocks;
    /**
     * OPTIMIZATION: Diff sheet values with focus on changed blocks
     * Only processes blocks that have actually changed
     */
    private diffSheetValues;
}
export {};
//# sourceMappingURL=diff-engine.d.ts.map