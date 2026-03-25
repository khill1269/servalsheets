/**
 * Shared internal helpers for compute-engine modules.
 * Used by aggregation, statistics, regression, forecast, and pivot modules.
 */

import type { CellValue } from './types.js';
import { NotFoundError } from '../../core/errors.js';
import {
  computeMedian,
  computeMode,
  computeStddev,
  computeVariance,
} from '../compute-engine-math.js';

/**
 * Resolve a column reference to its 0-based index.
 * Supports both column letters (A, B, C) and header names.
 */
export function resolveColumnIndex(headers: string[], col: string): number {
  // Try as column letter first (A, B, C, ...)
  if (/^[A-Z]{1,3}$/i.test(col)) {
    let idx = 0;
    for (let i = 0; i < col.length; i++) {
      idx = idx * 26 + (col.toUpperCase().charCodeAt(i) - 64);
    }
    return idx - 1; // 0-based
  }
  // Try as header name
  const headerIdx = headers.findIndex((h) => h?.toString().toLowerCase() === col.toLowerCase());
  if (headerIdx >= 0) return headerIdx;
  throw new NotFoundError('column', col, { availableHeaders: headers.join(', ') });
}

/**
 * Extract numeric values from a column, skipping non-numeric rows.
 */
export function extractNumericColumn(data: CellValue[][], colIdx: number): number[] {
  const values: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const val = data[i]?.[colIdx];
    if (val !== null && val !== undefined && val !== '' && typeof val === 'number') {
      values.push(val);
    } else if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) values.push(parsed);
    }
  }
  return values;
}

/**
 * Compute an aggregation function result.
 * Supports: sum, average, count, counta, countblank, min, max, median, mode, product, stdev, stdevp, var, varp
 */
export function computeAggFn(values: number[], fn: string, rows: CellValue[][]): number | null {
  if (values.length === 0 && !['count', 'counta', 'countblank'].includes(fn)) return null;
  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'average':
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    case 'count':
      return values.length;
    case 'counta': {
      let count = 0;
      for (const row of rows)
        for (const cell of row) if (cell !== null && cell !== undefined && cell !== '') count++;
      return count;
    }
    case 'countblank': {
      let count = 0;
      for (const row of rows)
        for (const cell of row) if (cell === null || cell === undefined || cell === '') count++;
      return count;
    }
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'median':
      return computeMedian(values);
    case 'mode':
      return computeMode(values);
    case 'product':
      return values.reduce((a, b) => a * b, 1);
    case 'stdev':
      return computeStddev(values, false);
    case 'stdevp':
      return computeStddev(values, true);
    case 'var':
      return computeVariance(values, false);
    case 'varp':
      return computeVariance(values, true);
    default:
      return null;
  }
}
