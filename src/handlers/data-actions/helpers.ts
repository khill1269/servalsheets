/**
 * ServalSheets - Data Actions Helpers
 *
 * Shared utilities for all data-actions submodules.
 */

import type { sheets_v4 } from 'googleapis';
import type { DataHandlerAccess } from './internal.js';

/**
 * Resolve A1 range notation to absolute row/column bounds.
 * Handles: A1, A1:Z10, Sheet1!A1:Z10, etc.
 */
export function resolveRangeToA1(
  range: string | { sheet?: string; startRow?: number; startCol?: number; endRow?: number; endCol?: number }
): string {
  if (typeof range === 'string') {
    return range; // Already A1 notation
  }
  const { sheet = 'Sheet1', startRow = 1, startCol = 1, endRow = 100, endCol = 26 } = range;
  const startCell = `${columnToLetter(startCol)}${startRow}`;
  const endCell = `${columnToLetter(endCol)}${endRow}`;
  return `${sheet}!${startCell}:${endCell}`;
}

/**
 * Convert 0-based column index to letter (0 → A, 25 → Z, 26 → AA).
 */
export function columnToLetter(col: number): string {
  let letter = '';
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
}

/**
 * Convert column letter to 0-based index (A → 0, Z → 25, AA → 26).
 */
export function letterToColumn(letter: string): number {
  let col = 0;
  for (const char of letter.toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  return col - 1;
}

/**
 * Shape response values based on verbosity/format preference.
 */
export function shapeValuesByResponseFormat(
  values: unknown[][],
  format: 'full' | 'compact' | 'preview' = 'full'
): unknown[][] {
  if (format === 'full') return values;
  if (format === 'compact') return values.slice(0, 10); // First 10 rows
  if (format === 'preview') return values.slice(0, 5); // First 5 rows
  return values;
}

/**
 * Encode pagination cursor for resumable queries.
 */
export function encodeCursor(state: { row: number; col: number; revision?: string }): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

/**
 * Decode pagination cursor.
 */
export function decodeCursor(cursor: string): { row: number; col: number; revision?: string } {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
}

/**
 * Build pagination plan for large datasets.
 */
export function buildPaginationPlan(totalRows: number, pageSize: number = 1000) {
  const totalPages = Math.ceil(totalRows / pageSize);
  return {
    totalPages,
    pageSize,
    estimatedCalls: totalPages,
  };
}

/**
 * Detect formula injection patterns in cell values.
 */
export function hasFormulaInjection(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^[=+@-]/.test(value.trim());
}

/**
 * Build Google API row data from 2D array.
 */
export function buildRowDataFromValues(values: unknown[][]): sheets_v4.Schema$RowData[] {
  return values.map((row) => ({
    values: row.map((val) => ({
      userEnteredValue: formatCellValue(val),
    })),
  }));
}

/**
 * Format cell value for Google Sheets API.
 */
function formatCellValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) {
    return {};
  }
  if (typeof val === 'string' && val.startsWith('=')) {
    return { formulaValue: val };
  }
  if (typeof val === 'boolean') {
    return { boolValue: val };
  }
  if (typeof val === 'number') {
    return { numberValue: val };
  }
  return { stringValue: String(val) };
}
