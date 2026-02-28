/**
 * ServalSheets - Computation Engine
 *
 * Server-side computation for spreadsheet data.
 * Provides deterministic math, statistics, forecasting, and matrix operations
 * without requiring AI/Sampling round-trips.
 *
 * Design: Stateless module-level functions, dynamically imported by handler.
 */

import type { sheets_v4 } from 'googleapis';
import { executeWithRetry } from '../utils/retry.js';
// logger imported for future use in compute engine

// ============================================================================
// Types
// ============================================================================

export interface AggregateOptions {
  functions: string[];
  groupBy?: string;
}

export interface AggregateResult {
  aggregations: Record<string, number | null>;
  groups?: Array<{
    key: string | number | boolean | null;
    aggregations: Record<string, number | null>;
    rowCount: number;
  }>;
  rowCount: number;
}

export interface StatisticalOptions {
  columns?: string[];
  percentiles: number[];
  includeCorrelations: boolean;
}

export interface ColumnStats {
  count: number;
  mean: number | null;
  median: number | null;
  mode?: number | null;
  stddev: number | null;
  variance: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  skewness?: number | null;
  kurtosis?: number | null;
  percentiles?: Record<string, number>;
  nullCount?: number;
}

export interface RegressionOptions {
  xColumn: string;
  yColumn: string;
  type: 'linear' | 'polynomial' | 'exponential' | 'logarithmic' | 'power';
  degree: number;
  predict?: number[];
}

export interface RegressionResult {
  coefficients: number[];
  rSquared: number;
  equation: string;
  predictions?: Array<{ x: number; y: number }>;
  residuals: { mean: number; stddev: number; max: number };
}

export interface ForecastOptions {
  dateColumn: string;
  valueColumn: string;
  periods: number;
  method: 'linear_trend' | 'moving_average' | 'exponential_smoothing' | 'auto';
  seasonality?: number;
}

export interface ForecastResult {
  forecast: Array<{
    period: string | number;
    value: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    seasonalityDetected: boolean;
    seasonalPeriod?: number;
  };
  methodUsed: string;
}

export interface PivotOptions {
  rows: string[];
  columns?: string[];
  values: Array<{ column: string; function: string }>;
  filters?: Array<{ column: string; values: Array<string | number | boolean> }>;
}

export interface PivotResult {
  headers: string[];
  rows: Array<Array<string | number | null>>;
  totals?: Record<string, number>;
}

type CellValue = string | number | boolean | null;

// ============================================================================
// Data Fetching
// ============================================================================

export async function fetchRangeData(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string
): Promise<CellValue[][]> {
  const response = await executeWithRetry(async () =>
    sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    })
  );
  return (response.data.values as CellValue[][]) || [];
}

function resolveColumnIndex(headers: string[], col: string): number {
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
  throw new Error(`Column "${col}" not found. Available headers: ${headers.join(', ')}`);
}

function extractNumericColumn(data: CellValue[][], colIdx: number): number[] {
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

// ============================================================================
// Aggregation
// ============================================================================

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

function computeAggFn(values: number[], fn: string, rows: CellValue[][]): number | null {
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

// ============================================================================
// Statistics
// ============================================================================

export function computeStatistics(
  data: CellValue[][],
  options: StatisticalOptions
): {
  statistics: Record<string, ColumnStats>;
  correlations?: Record<string, Record<string, number>>;
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
    };
  }

  let correlations: Record<string, Record<string, number>> | undefined;
  if (options.includeCorrelations && Object.keys(columnData).length > 1) {
    correlations = {};
    const colNames = Object.keys(columnData);
    for (const a of colNames) {
      correlations[a] = {};
      for (const b of colNames) {
        correlations[a]![b] = computeCorrelation(columnData[a]!, columnData[b]!);
      }
    }
  }

  return { statistics, correlations };
}

// ============================================================================
// Regression
// ============================================================================

export function computeRegression(
  data: CellValue[][],
  options: RegressionOptions
): RegressionResult {
  const headers = (data[0] || []).map(String);
  const xIdx = resolveColumnIndex(headers, options.xColumn);
  const yIdx = resolveColumnIndex(headers, options.yColumn);

  const xValues = extractNumericColumn(data, xIdx);
  const yValues = extractNumericColumn(data, yIdx);
  const n = Math.min(xValues.length, yValues.length);
  if (n < 2) throw new Error('Regression requires at least 2 data points');

  const x = xValues.slice(0, n);
  const y = yValues.slice(0, n);

  let coefficients: number[];
  let equation: string;

  switch (options.type) {
    case 'linear': {
      const [slope, intercept] = linearRegression(x, y);
      coefficients = [slope, intercept];
      equation = `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`;
      break;
    }
    case 'polynomial': {
      coefficients = polynomialRegression(x, y, options.degree);
      equation = coefficients.map((c, i) => `${c.toFixed(4)}x^${i}`).join(' + ');
      break;
    }
    case 'exponential': {
      const logY = y.map((v) => (v > 0 ? Math.log(v) : 0));
      const [slope, intercept] = linearRegression(x, logY);
      coefficients = [Math.exp(intercept), slope];
      equation = `y = ${coefficients[0]!.toFixed(4)} * e^(${coefficients[1]!.toFixed(4)}x)`;
      break;
    }
    case 'logarithmic': {
      const logX = x.map((v) => (v > 0 ? Math.log(v) : 0));
      const [slope, intercept] = linearRegression(logX, y);
      coefficients = [slope, intercept];
      equation = `y = ${slope.toFixed(4)} * ln(x) + ${intercept.toFixed(4)}`;
      break;
    }
    case 'power': {
      const logX = x.map((v) => (v > 0 ? Math.log(v) : 0));
      const logY = y.map((v) => (v > 0 ? Math.log(v) : 0));
      const [slope, intercept] = linearRegression(logX, logY);
      coefficients = [Math.exp(intercept), slope];
      equation = `y = ${coefficients[0]!.toFixed(4)} * x^${coefficients[1]!.toFixed(4)}`;
      break;
    }
    default:
      throw new Error(`Unsupported regression type: ${options.type}`);
  }

  // R-squared
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const predicted = x.map((xi) => predictValue(xi, coefficients, options.type, options.degree));
  const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - predicted[i]!, 2), 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  // Residuals
  const residualValues = y.map((yi, i) => yi - predicted[i]!);
  const residualMean = residualValues.reduce((a, b) => a + b, 0) / n;
  const residualStddev = Math.sqrt(
    residualValues.reduce((sum, r) => sum + Math.pow(r - residualMean, 2), 0) / (n - 1)
  );

  const result: RegressionResult = {
    coefficients,
    rSquared,
    equation,
    residuals: {
      mean: residualMean,
      stddev: residualStddev,
      max: Math.max(...residualValues.map(Math.abs)),
    },
  };

  if (options.predict) {
    result.predictions = options.predict.map((xi) => ({
      x: xi,
      y: predictValue(xi, coefficients, options.type, options.degree),
    }));
  }

  return result;
}

// ============================================================================
// Forecasting
// ============================================================================

export function computeForecast(data: CellValue[][], options: ForecastOptions): ForecastResult {
  const headers = (data[0] || []).map(String);
  const valueIdx = resolveColumnIndex(headers, options.valueColumn);
  const values = extractNumericColumn(data, valueIdx);

  if (values.length < 3) throw new Error('Forecasting requires at least 3 data points');

  const method =
    options.method === 'auto' ? selectBestMethod(values, options.seasonality) : options.method;
  let forecastValues: number[];
  let trend: ForecastResult['trend'];

  switch (method) {
    case 'linear_trend': {
      const xArr = values.map((_, i) => i);
      const [slope, intercept] = linearRegression(xArr, values);
      forecastValues = Array.from(
        { length: options.periods },
        (_, i) => slope * (values.length + i) + intercept
      );
      trend = {
        direction: slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable',
        strength: Math.abs(slope) / (Math.max(...values) - Math.min(...values) || 1),
        seasonalityDetected: false,
      };
      break;
    }
    case 'moving_average': {
      const window = Math.min(Math.floor(values.length / 3), 12);
      const lastWindow = values.slice(-window);
      const avg = lastWindow.reduce((a, b) => a + b, 0) / window;
      forecastValues = Array(options.periods).fill(avg) as number[];
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      trend = {
        direction:
          diff > 0.01 * firstAvg ? 'increasing' : diff < -0.01 * firstAvg ? 'decreasing' : 'stable',
        strength: Math.abs(diff) / (firstAvg || 1),
        seasonalityDetected: false,
      };
      break;
    }
    case 'exponential_smoothing': {
      const alpha = 0.3;
      let smoothed = values[0]!;
      for (let i = 1; i < values.length; i++) {
        smoothed = alpha * values[i]! + (1 - alpha) * smoothed;
      }
      forecastValues = Array(options.periods).fill(smoothed) as number[];
      const trendSlope = (smoothed - values[0]!) / values.length;
      trend = {
        direction: trendSlope > 0.01 ? 'increasing' : trendSlope < -0.01 ? 'decreasing' : 'stable',
        strength: Math.abs(trendSlope) / (Math.max(...values) - Math.min(...values) || 1),
        seasonalityDetected: false,
      };
      break;
    }
    default:
      throw new Error(`Unsupported forecast method: ${method}`);
  }

  // Add confidence bounds (simple ±2 stddev)
  const stddev = computeStddev(values, true) || 0;
  const forecast = forecastValues.map((value, i) => ({
    period: values.length + i + 1,
    value: Math.round(value * 100) / 100,
    lowerBound: Math.round((value - 2 * stddev) * 100) / 100,
    upperBound: Math.round((value + 2 * stddev) * 100) / 100,
  }));

  return { forecast, trend: trend!, methodUsed: method };
}

function selectBestMethod(
  values: number[],
  seasonality?: number
): 'linear_trend' | 'moving_average' | 'exponential_smoothing' {
  // Simple heuristic: use linear trend if data shows clear trend, otherwise exponential smoothing
  const xArr = values.map((_, i) => i);
  const [slope] = linearRegression(xArr, values);
  const yMean = values.reduce((a, b) => a + b, 0) / values.length;
  const trendStrength = Math.abs(slope * values.length) / (yMean || 1);
  if (trendStrength > 0.3) return 'linear_trend';
  if (seasonality && values.length >= seasonality * 2) return 'moving_average';
  return 'exponential_smoothing';
}

// ============================================================================
// Matrix Operations
// ============================================================================

export function matrixOp(
  matrix: number[][],
  operation: string,
  secondMatrix?: number[][]
): { matrix?: number[][]; scalar?: number; eigenvalues?: number[] } {
  switch (operation) {
    case 'transpose':
      return { matrix: transpose(matrix) };
    case 'multiply': {
      if (!secondMatrix) throw new Error('multiply requires secondRange');
      return { matrix: matrixMultiply(matrix, secondMatrix) };
    }
    case 'determinant': {
      if (matrix.length !== matrix[0]?.length)
        throw new Error('Determinant requires a square matrix');
      return { scalar: determinant(matrix) };
    }
    case 'inverse': {
      if (matrix.length !== matrix[0]?.length) throw new Error('Inverse requires a square matrix');
      return { matrix: invertMatrix(matrix) };
    }
    case 'trace': {
      if (matrix.length !== matrix[0]?.length) throw new Error('Trace requires a square matrix');
      let sum = 0;
      for (let i = 0; i < matrix.length; i++) sum += matrix[i]![i]!;
      return { scalar: sum };
    }
    case 'rank':
      return { scalar: computeRank(matrix) };
    case 'eigenvalues': {
      if (matrix.length !== matrix[0]?.length)
        throw new Error('Eigenvalues requires a square matrix');
      // Simple power iteration for 2x2 or return diagonal for diagonal matrices
      if (matrix.length === 2) {
        const a = matrix[0]![0]!,
          b = matrix[0]![1]!,
          c = matrix[1]![0]!,
          d = matrix[1]![1]!;
        const trace = a + d;
        const det = a * d - b * c;
        const disc = Math.sqrt(Math.max(trace * trace - 4 * det, 0));
        return { eigenvalues: [(trace + disc) / 2, (trace - disc) / 2] };
      }
      // For larger matrices, return diagonal elements as approximation
      return { eigenvalues: matrix.map((row, i) => row[i]!) };
    }
    default:
      throw new Error(`Unsupported matrix operation: ${operation}`);
  }
}

// ============================================================================
// Pivot Computation
// ============================================================================

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

  // Group rows
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

// ============================================================================
// Formula Explanation
// ============================================================================

export function explainFormula(formula: string): {
  summary: string;
  functions: Array<{ name: string; description: string; arguments: string[] }>;
  references: Array<{ ref: string }>;
  complexity: 'simple' | 'moderate' | 'complex';
} {
  const cleaned = formula.startsWith('=') ? formula.slice(1) : formula;

  // Extract function calls
  const fnRegex = /([A-Z_]+)\s*\(/g;
  const functions: Array<{ name: string; description: string; arguments: string[] }> = [];
  const seenFns = new Set<string>();
  let match;
  while ((match = fnRegex.exec(cleaned)) !== null) {
    const fnName = match[1]!;
    if (!seenFns.has(fnName)) {
      seenFns.add(fnName);
      functions.push({
        name: fnName,
        description: FUNCTION_DESCRIPTIONS[fnName] || `Google Sheets function: ${fnName}`,
        arguments: extractFunctionArgs(cleaned, match.index! + fnName.length),
      });
    }
  }

  // Extract cell references
  const refRegex = /(?:(?:[A-Za-z_]\w*!)?\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)/g;
  const references: Array<{ ref: string }> = [];
  const seenRefs = new Set<string>();
  while ((match = refRegex.exec(cleaned)) !== null) {
    if (!seenRefs.has(match[0])) {
      seenRefs.add(match[0]);
      references.push({ ref: match[0] });
    }
  }

  const nestLevel = (cleaned.match(/\(/g) || []).length;
  const complexity = nestLevel <= 1 ? 'simple' : nestLevel <= 3 ? 'moderate' : 'complex';

  const summary =
    functions.length === 0
      ? `Simple expression: ${cleaned}`
      : `Uses ${functions.map((f) => f.name).join(', ')} with ${references.length} cell reference(s)`;

  return { summary, functions, references, complexity };
}

function extractFunctionArgs(formula: string, startIdx: number): string[] {
  let depth = 0;
  let current = '';
  const args: string[] = [];
  for (let i = startIdx; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === '(') {
      depth++;
      if (depth === 1) continue;
    }
    if (ch === ')') {
      depth--;
      if (depth === 0) {
        if (current.trim()) args.push(current.trim());
        break;
      }
    }
    if (ch === ',' && depth === 1) {
      args.push(current.trim());
      current = '';
      continue;
    }
    if (depth >= 1) current += ch;
  }
  return args;
}

// ============================================================================
// Helper Math Functions
// ============================================================================

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function computeMode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let maxCount = 0;
  let mode: number | null = null;
  for (const [val, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = val;
    }
  }
  return maxCount > 1 ? mode : null;
}

function computeStddev(values: number[], population: boolean): number | null {
  const v = computeVariance(values, population);
  return v !== null ? Math.sqrt(v) : null;
}

function computeVariance(values: number[], population: boolean): number | null {
  if (values.length < (population ? 1 : 2)) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sumSq = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  return sumSq / (population ? values.length : values.length - 1);
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
}

function computeCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const xMean = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const yMean = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0,
    denX = 0,
    denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - xMean;
    const dy = y[i]! - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

function linearRegression(x: number[], y: number[]): [number, number] {
  const n = Math.min(x.length, y.length);
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]!;
    sumY += y[i]!;
    sumXY += x[i]! * y[i]!;
    sumX2 += x[i]! * x[i]!;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return [slope, intercept];
}

function polynomialRegression(x: number[], y: number[], degree: number): number[] {
  // Solve using normal equations (X^T * X) * coeffs = X^T * y
  const n = x.length;
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) row.push(Math.pow(x[i]!, j));
    X.push(row);
  }
  const XT = transpose(X);
  const XTX = matrixMultiply(XT, X);
  const XTy = matrixMultiply(
    XT,
    y.map((v) => [v])
  );
  try {
    const inv = invertMatrix(XTX);
    const coeffs = matrixMultiply(inv, XTy);
    return coeffs.map((row) => row[0]!);
  } catch {
    // Fallback to linear if matrix is singular
    const [slope, intercept] = linearRegression(x, y);
    return [intercept, slope];
  }
}

function predictValue(x: number, coefficients: number[], type: string, _degree: number): number {
  switch (type) {
    case 'linear':
      return coefficients[0]! * x + coefficients[1]!;
    case 'polynomial':
      return coefficients.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0);
    case 'exponential':
      return coefficients[0]! * Math.exp(coefficients[1]! * x);
    case 'logarithmic':
      return coefficients[0]! * Math.log(Math.max(x, 0.001)) + coefficients[1]!;
    case 'power':
      return coefficients[0]! * Math.pow(Math.max(x, 0.001), coefficients[1]!);
    default:
      return 0;
  }
}

function transpose(m: number[][]): number[][] {
  if (m.length === 0) return [];
  const rows = m.length;
  const cols = m[0]!.length;
  const result: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0) as number[]);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) result[j]![i] = m[i]![j]!;
  return result;
}

function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length,
    colsA = a[0]?.length || 0,
    colsB = b[0]?.length || 0;
  if (colsA !== b.length)
    throw new Error(`Matrix dimensions incompatible: ${rowsA}x${colsA} * ${b.length}x${colsB}`);
  const result: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0) as number[]);
  for (let i = 0; i < rowsA; i++)
    for (let j = 0; j < colsB; j++)
      for (let k = 0; k < colsA; k++) result[i]![j]! += a[i]![k]! * b[k]![j]!;
  return result;
}

function determinant(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0]![0]!;
  if (n === 2) return m[0]![0]! * m[1]![1]! - m[0]![1]! * m[1]![0]!;
  let det = 0;
  for (let j = 0; j < n; j++) {
    const sub: number[][] = [];
    for (let i = 1; i < n; i++) {
      sub.push([...m[i]!.slice(0, j), ...m[i]!.slice(j + 1)]);
    }
    det += Math.pow(-1, j) * m[0]![j]! * determinant(sub);
  }
  return det;
}

function invertMatrix(m: number[][]): number[][] {
  const n = m.length;
  // Augmented matrix [M | I]
  const aug: number[][] = m.map((row, i) => {
    const identity = Array(n).fill(0) as number[];
    identity[i] = 1;
    return [...row, ...identity];
  });
  // Gauss-Jordan elimination
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k]![i]!) > Math.abs(aug[maxRow]![i]!)) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow]!, aug[i]!];
    const pivot = aug[i]![i]!;
    if (Math.abs(pivot) < 1e-10) throw new Error('Matrix is singular (not invertible)');
    for (let j = 0; j < 2 * n; j++) aug[i]![j]! /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k]![i]!;
      for (let j = 0; j < 2 * n; j++) aug[k]![j]! -= factor * aug[i]![j]!;
    }
  }
  return aug.map((row) => row.slice(n));
}

function computeRank(m: number[][]): number {
  // Row echelon form
  const rows = m.length;
  const cols = m[0]?.length || 0;
  const aug = m.map((row) => [...row]);
  let rank = 0;
  for (let col = 0; col < cols && rank < rows; col++) {
    let maxRow = rank;
    for (let row = rank + 1; row < rows; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[maxRow]![col]!)) maxRow = row;
    }
    if (Math.abs(aug[maxRow]![col]!) < 1e-10) continue;
    [aug[rank], aug[maxRow]] = [aug[maxRow]!, aug[rank]!];
    for (let row = rank + 1; row < rows; row++) {
      const factor = aug[row]![col]! / aug[rank]![col]!;
      for (let j = col; j < cols; j++) aug[row]![j]! -= factor * aug[rank]![j]!;
    }
    rank++;
  }
  return rank;
}

// ============================================================================
// Function Descriptions (for explain_formula)
// ============================================================================

const FUNCTION_DESCRIPTIONS: Record<string, string> = {
  SUM: 'Adds all numbers in a range',
  AVERAGE: 'Returns the arithmetic mean of values',
  COUNT: 'Counts cells containing numbers',
  COUNTA: 'Counts non-empty cells',
  IF: 'Returns one value if true, another if false',
  VLOOKUP:
    'Looks up a value in the first column and returns a value in the same row from a specified column',
  HLOOKUP: 'Horizontal lookup across the first row of a range',
  INDEX: 'Returns the value at a given position in a range',
  MATCH: 'Returns the relative position of an item in a range',
  SUMIF: 'Sums values that meet a condition',
  SUMIFS: 'Sums values that meet multiple conditions',
  COUNTIF: 'Counts cells that meet a condition',
  COUNTIFS: 'Counts cells that meet multiple conditions',
  AVERAGEIF: 'Averages values that meet a condition',
  MIN: 'Returns the smallest value',
  MAX: 'Returns the largest value',
  ROUND: 'Rounds a number to a specified number of digits',
  CONCATENATE: 'Joins text strings together',
  LEFT: 'Returns characters from the start of a string',
  RIGHT: 'Returns characters from the end of a string',
  MID: 'Returns characters from the middle of a string',
  LEN: 'Returns the length of a string',
  TRIM: 'Removes leading and trailing whitespace',
  IFERROR: 'Returns a specified value if an expression results in an error',
  ARRAYFORMULA: 'Enables a formula to work on arrays of values',
  UNIQUE: 'Returns unique values from a range',
  FILTER: 'Filters a range based on conditions',
  SORT: 'Sorts a range by specified columns',
  QUERY: 'Runs a Google Visualization API Query Language query',
  IMPORTRANGE: 'Imports data from another spreadsheet',
  SPARKLINE: 'Creates a miniature chart within a cell',
  ABS: 'Returns the absolute value',
  SQRT: 'Returns the square root',
  POWER: 'Returns a number raised to a power',
  LOG: 'Returns the logarithm of a number',
  LN: 'Returns the natural logarithm',
  EXP: 'Returns e raised to a power',
  MOD: 'Returns the remainder of division',
  CEILING: 'Rounds up to nearest multiple',
  FLOOR: 'Rounds down to nearest multiple',
  MEDIAN: 'Returns the median value',
  MODE: 'Returns the most frequent value',
  STDEV: 'Returns the sample standard deviation',
  VAR: 'Returns the sample variance',
  CORREL: 'Returns the correlation coefficient between two datasets',
  FORECAST: 'Predicts a future value using linear regression',
  TREND: 'Returns values along a linear trend',
  GROWTH: 'Returns values along an exponential growth trend',
  TRANSPOSE: 'Transposes rows and columns',
  MMULT: 'Multiplies two matrices',
  MINVERSE: 'Returns the inverse of a matrix',
  MDETERM: 'Returns the determinant of a matrix',
};
