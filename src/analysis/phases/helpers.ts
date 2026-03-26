/**
 * Shared helper utilities for ComprehensiveAnalyzer phases
 */

import type { sheets_v4 } from 'googleapis';

/**
 * Convert column index (0-based) to spreadsheet letter notation (A, B, ... Z, AA, AB, ...)
 */
export function columnToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Format a GridRange object to A1 notation string
 */
export function formatRange(range?: sheets_v4.Schema$GridRange): string {
  if (!range) return 'Unknown';
  const startCol = columnToLetter(range.startColumnIndex ?? 0);
  const endCol = columnToLetter((range.endColumnIndex ?? 1) - 1);
  const startRow = (range.startRowIndex ?? 0) + 1;
  const endRow = range.endRowIndex ?? startRow;
  return `${startCol}${startRow}:${endCol}${endRow}`;
}
