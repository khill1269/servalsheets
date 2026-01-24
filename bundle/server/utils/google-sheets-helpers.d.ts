/**
 * ServalSheets - Google API Utilities
 *
 * Clean helpers for common operations.
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Convert hex color to Google Sheets RGB (0-1 scale)
 */
export declare function hexToRgb(hex: string): {
    red: number;
    green: number;
    blue: number;
};
/**
 * Convert Google Sheets RGB to hex
 */
export declare function rgbToHex(color: {
    red?: number;
    green?: number;
    blue?: number;
}): string;
export interface ParsedA1 {
    sheetName?: string;
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
}
export interface ParsedCell {
    sheetName?: string;
    col: number;
    row: number;
}
/**
 * Parse A1 notation range (e.g., "Sheet1!A1:C10" or "A1:B5")
 */
export declare function parseA1Notation(a1: string): ParsedA1;
/**
 * Parse single cell reference (e.g., "Sheet1!A1" or "B5")
 */
export declare function parseCellReference(cell: string): ParsedCell;
/**
 * Convert column letter to 0-based index (A=0, B=1, Z=25, AA=26)
 */
export declare function columnLetterToIndex(letter: string): number;
/**
 * Convert 0-based index to column letter
 */
export declare function indexToColumnLetter(index: number): string;
/**
 * Build A1 notation from components
 */
export declare function buildA1Notation(sheetName: string | undefined, startCol: number, startRow: number, endCol?: number, endRow?: number): string;
export interface GridRangeInput {
    sheetId: number;
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
}
/**
 * Build Google Sheets GridRange
 */
export declare function toGridRange(input: GridRangeInput): sheets_v4.Schema$GridRange;
/**
 * Estimate cell count from a GridRange
 */
export declare function estimateCellCount(range: sheets_v4.Schema$GridRange): number;
/**
 * Extract spreadsheet ID from URL or return as-is if already an ID
 */
export declare function extractSpreadsheetId(urlOrId: string): string;
//# sourceMappingURL=google-sheets-helpers.d.ts.map