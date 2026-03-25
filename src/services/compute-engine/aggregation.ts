/**
 * Aggregation operations: sum, average, grouping, etc.
 */

import type { AggregateOptions, AggregateResult, CellValue } from './types.js';
import { resolveColumnIndex, computeAggFn } from './helpers.js';

/**
 * Aggregate data with optional grouping.
 */
export function aggregate(data: CellValue[][], options: AggregateOptions): AggregateResult {
  const headers = (data[0] || []).map(String);
  const rows = data.slice(1);

  if (options.groupBy) {
    const groupIdx = resolveColumnIndex(headers, options.groupBy);
    const groups = new Map<string, CellValue[][]>();
    for (const row of rows) {
      const key = String(row[groupIdx] ?? 'null');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const groupResults = Array.from(groups.entries()).map(([key, groupRows]) => ({
      key: key === 'null' ? null : key,
      aggregations: computeAggregations(groupRows, options.functions),
      rowCount: groupRows.length,
    }));
    return {
      aggregations: computeAggregations(rows, options.functions),
      groups: groupResults,
      rowCount: rows.length,
    };
  }

  return { aggregations: computeAggregations(rows, options.functions), rowCount: rows.length };
}

/**
 * Compute all requested aggregation functions over a set of rows.
 */
function computeAggregations(
  rows: CellValue[][],
  functions: string[]
): Record<string, number | null> {
  const numericValues: number[] = [];
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === 'number') numericValues.push(cell);
      else if (typeof cell === 'string') {
        const parsed = parseFloat(cell);
        if (!isNaN(parsed)) numericValues.push(parsed);
      }
    }
  }

  const result: Record<string, number | null> = {};
  for (const fn of functions) {
    result[fn] = computeAggFn(numericValues, fn, rows);
  }
  return result;
}
