/**
 * Statistical analysis: distributions, correlations, percentiles, etc.
 */

import type { StatisticalOptions, ColumnStats, CorrelationMatrix, CellValue } from './types.js';
import { resolveColumnIndex, extractNumericColumn } from './helpers.js';
import {
  computeCorrelation,
  computeSpearmanCorrelation,
  computeMedian,
  computeMode,
  computePercentile,
  computeVariance,
  computeMovingWindow,
} from '../compute-engine-math.js';

/**
 * Compute comprehensive statistics for data columns.
 */
export function computeStatistics(
  data: CellValue[][],
  options: StatisticalOptions
): {
  statistics: Record<string, ColumnStats>;
  correlations?: Record<string, Record<string, number>>;
  correlationMatrix?: CorrelationMatrix;
} {
  const headers = (data[0] || []).map(String);
  const targetCols = options.columns
    ? options.columns.map((c) => resolveColumnIndex(headers, c))
    : headers.map((_, i) => i).filter((i) => extractNumericColumn(data, i).length > 0);

  const statistics: Record<string, ColumnStats> = {};
  const columnData: Record<string, number[]> = {};

  for (const colIdx of targetCols) {
    const colName = headers[colIdx] || `Col${colIdx}`;
    const values = extractNumericColumn(data, colIdx);
    columnData[colName] = values;

    const nullCount = data.slice(1).filter((row) => {
      const v = row[colIdx];
      return v === null || v === undefined || v === '';
    }).length;

    if (values.length === 0) {
      statistics[colName] = {
        count: 0,
        mean: null,
        median: null,
        stddev: null,
        variance: null,
        min: null,
        max: null,
        range: null,
        nullCount,
      };
      continue;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = computeVariance(values, false);
    const stddev = variance !== null ? Math.sqrt(variance) : null;

    const percentiles: Record<string, number> = {};
    for (const p of options.percentiles) {
      percentiles[String(p)] = computePercentile(sorted, p);
    }

    // Skewness and kurtosis
    let skewness: number | null = null;
    let kurtosis: number | null = null;
    if (values.length >= 3 && stddev !== null && stddev > 0) {
      const n = values.length;
      const m3 = values.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0) / n;
      skewness = m3 / Math.pow(stddev, 3);
      const m4 = values.reduce((sum, v) => sum + Math.pow(v - mean, 4), 0) / n;
      kurtosis = m4 / Math.pow(stddev, 4) - 3; // excess kurtosis
    }

    // Moving window statistics if configured
    let movingWindow: number[] | undefined;
    if (options.movingWindowConfig && options.movingWindowConfig.column === colName) {
      movingWindow = computeMovingWindow(
        values,
        options.movingWindowConfig.windowSize,
        options.movingWindowConfig.operation
      );
    }

    statistics[colName] = {
      count: values.length,
      mean,
      median: computeMedian(values),
      mode: computeMode(values),
      stddev,
      variance,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      range: sorted[sorted.length - 1]! - sorted[0]!,
      skewness,
      kurtosis,
      percentiles,
      nullCount,
      ...(movingWindow !== undefined ? { movingWindow } : {}),
    };
  }

  let correlations: Record<string, Record<string, number>> | undefined;
  let correlationMatrix: CorrelationMatrix | undefined;
  if (options.includeCorrelations && Object.keys(columnData).length > 1) {
    const correlationMap: Record<string, Record<string, number>> = {};
    const colNames = Object.keys(columnData);
    for (const a of colNames) {
      correlationMap[a] = {};
      for (const b of colNames) {
        correlationMap[a][b] = computeCorrelation(columnData[a]!, columnData[b]!);
      }
    }
    correlations = correlationMap;
    // Also provide structured matrix format
    const matrix = colNames.map((a) => {
      const row = correlationMap[a];
      return colNames.map((b) => row?.[b] ?? 0);
    });
    correlationMatrix = { columns: colNames, matrix };

    // Compute Spearman (rank) correlations for non-linear monotonic relationships
    const spearmanMap: Record<string, Record<string, number>> = {};
    for (const a of colNames) {
      spearmanMap[a] = {};
      for (const b of colNames) {
        spearmanMap[a][b] = computeSpearmanCorrelation(columnData[a]!, columnData[b]!);
      }
    }
    // Attach as additional field (backwards-compatible)
    correlationMatrix.spearmanMatrix = colNames.map((a) => {
      const row = spearmanMap[a];
      return colNames.map((b) => row?.[b] ?? 0);
    });
  }

  return { statistics, correlations, correlationMatrix };
}
