/**
 * ServalSheets - Google API Utilities
 *
 * Clean helpers for common operations.
 */

import type { sheets_v4 } from 'googleapis';

// ============================================================================
// COLOR CONVERSION
// ============================================================================

/**
 * Convert hex color to Google Sheets RGB (0-1 scale)
 */
export function hexToRgb(hex: string): {
  red: number;
  green: number;
  blue: number;
} {
  const clean = hex.replace('#', '');
  return {
    red: parseInt(clean.substring(0, 2), 16) / 255,
    green: parseInt(clean.substring(2, 4), 16) / 255,
    blue: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

/**
 * Convert Google Sheets RGB to hex
 */
export function rgbToHex(color: { red?: number; green?: number; blue?: number }): string {
  const r = Math.round((color.red ?? 0) * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round((color.green ?? 0) * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round((color.blue ?? 0) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}

// ============================================================================
// A1 NOTATION PARSING
// ============================================================================

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
 * Supports emoji sheet names and special characters when properly quoted.
 */
export function parseA1Notation(a1: string): ParsedA1 {
  // Defensive: ensure input is a string
  if (typeof a1 !== 'string' || !a1.trim()) {
    throw new Error(`Invalid A1 notation: expected non-empty string, got ${typeof a1}`);
  }

  // Handle full column notation (A:A, A:C)
  const fullColMatch = a1.match(/^(?:'([^']+)'!|([^!]+)!)?([A-Z]+):([A-Z]+)$/i);
  if (fullColMatch) {
    const sheetName = fullColMatch[1] ?? fullColMatch[2];
    const startColLetter = fullColMatch[3];
    const endColLetter = fullColMatch[4];
    if (!startColLetter || !endColLetter) {
      throw new Error(`Invalid A1 notation (full column): ${a1}`);
    }
    return {
      sheetName,
      startCol: columnLetterToIndex(startColLetter),
      startRow: 0,
      endCol: columnLetterToIndex(endColLetter) + 1,
      endRow: 1000000, // Full column
    };
  }

  // Standard range notation - supports emoji sheet names in quotes
  const match = a1.match(/^(?:'([^']+)'!|([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!match) {
    throw new Error(
      `Invalid A1 notation: ${a1}. Expected format: "A1", "A1:B10", "Sheet1!A1:B10", or "'Sheet Name'!A1:B10"`
    );
  }

  const sheetName = match[1] ?? match[2];
  const startColLetter = match[3];
  const startRowStr = match[4];
  const endColLetter = match[5];
  const endRowStr = match[6];

  // Defensive: ensure required capture groups are present
  if (!startColLetter || !startRowStr) {
    throw new Error(`Invalid A1 notation (missing cell reference): ${a1}`);
  }

  const startCol = columnLetterToIndex(startColLetter);
  const startRow = parseInt(startRowStr, 10) - 1;
  const endCol = endColLetter ? columnLetterToIndex(endColLetter) + 1 : startCol + 1;
  const endRow = endRowStr ? parseInt(endRowStr, 10) : startRow + 1;

  // Defensive: check for NaN (shouldn't happen with valid regex match, but be safe)
  if (
    Number.isNaN(startRow) ||
    Number.isNaN(endRow) ||
    Number.isNaN(startCol) ||
    Number.isNaN(endCol)
  ) {
    throw new Error(`Invalid A1 notation (parse error): ${a1}`);
  }

  return { sheetName, startCol, startRow, endCol, endRow };
}

/**
 * Parse single cell reference (e.g., "Sheet1!A1" or "B5")
 */
export function parseCellReference(cell: string): ParsedCell {
  const match = cell.match(/^(?:'([^']+)'!|([^!]+)!)?([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid cell reference: ${cell}`);
  }

  const sheetName = match[1] ?? match[2];
  const colLetter = match[3]!;
  const rowStr = match[4]!;

  return {
    sheetName,
    col: columnLetterToIndex(colLetter),
    row: parseInt(rowStr, 10) - 1,
  };
}

/**
 * Convert column letter to 0-based index (A=0, B=1, Z=25, AA=26)
 */
export function columnLetterToIndex(letter: string): number {
  let index = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert 0-based index to column letter
 */
export function indexToColumnLetter(index: number): string {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * Build A1 notation from components
 */
export function buildA1Notation(
  sheetName: string | undefined,
  startCol: number,
  startRow: number,
  endCol?: number,
  endRow?: number
): string {
  const startCell = `${indexToColumnLetter(startCol)}${startRow + 1}`;
  const endCell =
    endCol !== undefined && endRow !== undefined
      ? `:${indexToColumnLetter(endCol - 1)}${endRow}`
      : '';

  const range = `${startCell}${endCell}`;

  if (sheetName) {
    const quotedName = /[^a-zA-Z0-9_]/.test(sheetName) ? `'${sheetName}'` : sheetName;
    return `${quotedName}!${range}`;
  }

  return range;
}

// ============================================================================
// GRID RANGE HELPERS
// ============================================================================

export interface GridRangeInput {
  sheetId: number;
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

/**
 * Build internal GridRangeInput
 */
export function buildGridRangeInput(
  sheetId: number,
  startRowIndex?: number,
  endRowIndex?: number,
  startColumnIndex?: number,
  endColumnIndex?: number
): GridRangeInput {
  // Defensive: convert NaN to undefined to prevent validation errors
  // NaN can occur if A1 notation parsing fails or receives unexpected input
  const sanitize = (val?: number): number | undefined =>
    val !== undefined && !Number.isNaN(val) ? val : undefined;

  return {
    sheetId: Number.isNaN(sheetId) ? 0 : sheetId,
    startRowIndex: sanitize(startRowIndex),
    endRowIndex: sanitize(endRowIndex),
    startColumnIndex: sanitize(startColumnIndex),
    endColumnIndex: sanitize(endColumnIndex),
  };
}

/**
 * Build Google Sheets GridRange
 */
export function toGridRange(input: GridRangeInput): sheets_v4.Schema$GridRange {
  return {
    sheetId: input.sheetId,
    startRowIndex: input.startRowIndex,
    endRowIndex: input.endRowIndex,
    startColumnIndex: input.startColumnIndex,
    endColumnIndex: input.endColumnIndex,
  };
}

/**
 * Estimate cell count from a GridRange
 */
export function estimateCellCount(range: sheets_v4.Schema$GridRange): number {
  const rows = (range.endRowIndex ?? 0) - (range.startRowIndex ?? 0);
  const cols = (range.endColumnIndex ?? 0) - (range.startColumnIndex ?? 0);
  return Math.max(0, rows * cols);
}

// ============================================================================
// SPREADSHEET ID EXTRACTION
// ============================================================================

/**
 * Extract spreadsheet ID from URL or return as-is if already an ID
 */
export function extractSpreadsheetId(urlOrId: string): string {
  // Already an ID (no slashes)
  if (!urlOrId.includes('/')) {
    return urlOrId;
  }

  // Extract from URL: https://docs.google.com/spreadsheets/d/{ID}/edit
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1]!;
  }

  throw new Error(`Cannot extract spreadsheet ID from: ${urlOrId}`);
}
