/**
 * Pivot table generation with aggregation.
 */

import type { PivotOptions, PivotResult, CellValue } from './types.js';
import { resolveColumnIndex, computeAggFn } from './helpers.js';

/**
 * Compute pivot table with row/column grouping and value aggregation.
 */
export function computePivot(data: CellValue[][], options: PivotOptions): PivotResult {
  const headers = (data[0] || []).map(String);
  let rows = data.slice(1);

  // Apply filters
  if (options.filters) {
    for (const filter of options.filters) {
      const colIdx = resolveColumnIndex(headers, filter.column);
      rows = rows.filter((row) => {
        const val = row[colIdx];
        return filter.values.some((fv) => String(fv) === String(val));
      });
    }
  }

  const rowIndices = options.rows.map((r) => resolveColumnIndex(headers, r));
  const valueSpecs = options.values.map((v) => ({
    colIdx: resolveColumnIndex(headers, v.column),
    fn: v.function,
  }));

  // Multi-value pivot: if column indices specified, group by row + column key
  if (options.columns && options.columns.length > 0) {
    const colIndices = options.columns.map((c) => resolveColumnIndex(headers, c));
    const groups = new Map<string, Map<string, CellValue[][]>>();

    // Group by (rowKey, colKey)
    for (const row of rows) {
      const rowKey = rowIndices.map((i) => String(row[i] ?? '')).join('|');
      const colKey = colIndices.map((i) => String(row[i] ?? '')).join('|');

      if (!groups.has(rowKey)) groups.set(rowKey, new Map());
      const colMap = groups.get(rowKey)!;
      if (!colMap.has(colKey)) colMap.set(colKey, []);
      colMap.get(colKey)!.push(row);
    }

    // Get unique column keys (sorted)
    const uniqueColKeys = Array.from(
      new Set(Array.from(groups.values()).flatMap((m) => Array.from(m.keys())))
    ).sort();

    // Build headers: row keys + (colKey | valueFunc) for each column
    const pivotHeaders = [...options.rows];
    for (const colKey of uniqueColKeys) {
      for (const spec of valueSpecs) {
        const colName = colKey === '' ? '(empty)' : colKey;
        pivotHeaders.push(`${colName} | ${spec.fn}(${headers[spec.colIdx]})`);
      }
    }

    // Build pivot rows
    const pivotRows: Array<Array<string | number | null>> = [];
    const totals: Record<string, number> = {};

    const uniqueRowKeys = Array.from(new Set(Array.from(groups.keys()).map((k) => k))).sort();

    for (const rowKey of uniqueRowKeys) {
      const keyParts = rowKey.split('|');
      const row: Array<string | number | null> = [...keyParts];
      const colMap: Map<string, CellValue[][]> =
        groups.get(rowKey) ?? new Map<string, CellValue[][]>();

      for (const colKey of uniqueColKeys) {
        const groupRows = colMap.get(colKey) || [];
        for (const spec of valueSpecs) {
          const values = groupRows
            .map((r) => r[spec.colIdx])
            .filter((v): v is number => typeof v === 'number');
          const aggResult = computeAggFn(values, spec.fn, groupRows);
          row.push(aggResult);

          const colName = colKey === '' ? '(empty)' : colKey;
          const totalKey = `${colName} | ${spec.fn}(${headers[spec.colIdx]})`;
          totals[totalKey] = (totals[totalKey] || 0) + (aggResult || 0);
        }
      }

      pivotRows.push(row);
    }

    return { headers: pivotHeaders, rows: pivotRows, totals };
  }

  // Standard pivot: single-value group by row key only
  const groups = new Map<string, CellValue[][]>();
  for (const row of rows) {
    const key = rowIndices.map((i) => String(row[i] ?? '')).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Build pivot headers
  const pivotHeaders = [
    ...options.rows,
    ...options.values.map((v) => `${v.function}(${v.column})`),
  ];

  // Build pivot rows
  const pivotRows: Array<Array<string | number | null>> = [];
  const totals: Record<string, number> = {};

  for (const [key, groupRows] of groups) {
    const keyParts = key.split('|');
    const row: Array<string | number | null> = [...keyParts];

    for (const spec of valueSpecs) {
      const values = groupRows
        .map((r) => r[spec.colIdx])
        .filter((v): v is number => typeof v === 'number');
      const aggResult = computeAggFn(values, spec.fn, groupRows);
      row.push(aggResult);

      const totalKey = `${spec.fn}(${headers[spec.colIdx]})`;
      totals[totalKey] = (totals[totalKey] || 0) + (aggResult || 0);
    }

    pivotRows.push(row);
  }

  return { headers: pivotHeaders, rows: pivotRows, totals };
}
