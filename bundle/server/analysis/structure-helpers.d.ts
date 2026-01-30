/**
 * Structure Analysis Helpers - Cross-Sheet Intelligence
 *
 * Provides advanced structural analysis capabilities:
 * - Header detection with multiple heuristics
 * - Data region boundary detection
 * - Schema inference (types, cardinality, uniqueness)
 * - Cross-sheet reference detection (foreign keys)
 * - Merged cell analysis
 * - Protected range detection
 *
 * Part of Ultimate Analysis Tool - Cross-Sheet Intelligence capability
 */
import type { sheets_v4 } from 'googleapis';
export interface HeaderDetectionResult {
    hasHeaders: boolean;
    headerRow: number;
    confidence: number;
    reasoning: string;
    headers: string[];
}
export interface DataRegion {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    rowCount: number;
    colCount: number;
    cellCount: number;
}
export interface ColumnSchema {
    columnIndex: number;
    columnName: string;
    inferredType: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
    typeConfidence: number;
    cardinality: number;
    uniqueRatio: number;
    nullCount: number;
    nullRatio: number;
    sampleValues: unknown[];
}
export interface ForeignKeyCandidate {
    sourceSheet: string;
    sourceColumn: string;
    targetSheet: string;
    targetColumn: string;
    matchRatio: number;
    confidence: number;
    reasoning: string;
}
export interface MergedCellInfo {
    range: string;
    rowSpan: number;
    colSpan: number;
    value: unknown;
}
export interface ProtectedRangeInfo {
    range: string;
    description: string;
    warningOnly: boolean;
    editors: string[];
}
/**
 * Detect header row using multiple heuristics
 *
 * Heuristics:
 * 1. Type consistency: Headers are typically all strings
 * 2. Uniqueness: Headers should have unique values
 * 3. Non-numeric: Headers are rarely all numbers
 * 4. Data pattern change: Row after headers has different type distribution
 * 5. Common header patterns: "Name", "ID", "Date", etc.
 */
export declare function detectHeaderRow(data: unknown[][]): HeaderDetectionResult;
/**
 * Detect the boundary of the data region
 *
 * Identifies the rectangular region containing actual data,
 * excluding empty rows/columns at edges.
 */
export declare function detectDataRegion(data: unknown[][]): DataRegion;
/**
 * Infer schema for each column
 *
 * Analyzes column types, cardinality, uniqueness, and provides sample values.
 */
export declare function inferSchema(data: unknown[][], headerRow?: number): ColumnSchema[];
/**
 * Detect potential foreign key relationships between sheets
 *
 * Looks for columns in different sheets where values overlap significantly,
 * suggesting a relationship.
 */
export declare function detectForeignKeys(sheets: Array<{
    name: string;
    data: unknown[][];
    schema: ColumnSchema[];
}>): ForeignKeyCandidate[];
/**
 * Analyze merged cells in a sheet
 */
export declare function findMergedCells(sheetData: sheets_v4.Schema$Sheet): MergedCellInfo[];
/**
 * Detect protected ranges in a sheet
 */
export declare function findProtectedRanges(sheetData: sheets_v4.Schema$Sheet): ProtectedRangeInfo[];
//# sourceMappingURL=structure-helpers.d.ts.map