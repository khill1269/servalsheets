/**
 * ServalSheets - Computation Engine (thin re-export facade)
 *
 * Server-side computation for spreadsheet data.
 * Implementation split into focused modules under src/services/compute-engine/
 * Provides deterministic math, statistics, forecasting, and matrix operations
 * without requiring AI/Sampling round-trips.
 */

export type {
  AggregateOptions,
  AggregateResult,
  StatisticalOptions,
  ColumnStats,
  CorrelationMatrix,
  RegressionOptions,
  RegressionResult,
  ForecastOptions,
  ForecastResult,
  PivotOptions,
  PivotResult,
  CellValue,
} from './compute-engine/index.js';

export {
  fetchRangeData,
  aggregate,
  computeStatistics,
  computeRegression,
  computeForecast,
  detectSeasonalPeriod,
  selectBestMethod,
  matrixOp,
  computePivot,
  kMeansClustering,
  findOptimalK,
  explainFormula,
} from './compute-engine/index.js';
