/**
 * Type definitions for the Compute Engine.
 * Interfaces and type aliases used across compute-engine modules.
 */

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
  movingWindowConfig?: {
    windowSize: number;
    operation: 'average' | 'median' | 'sum';
    column: string;
  };
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
  movingWindow?: number[];
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
  spearmanMatrix?: number[][];
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

export type CellValue = string | number | boolean | null;
