/**
 * Compute Engine — re-export facade for submodules.
 * All implementation is split into focused modules under this directory.
 */

// ============================================================================
// Types
// ============================================================================

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
} from './types.js';

// ============================================================================
// Data Fetching (keep in index.ts since it's a thin API wrapper)
// ============================================================================

import type { sheets_v4 } from 'googleapis';
import { executeWithRetry } from '../../utils/retry.js';
import type { CellValue } from './types.js';

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

// ============================================================================
// Module Exports
// ============================================================================

export { aggregate } from './aggregation.js';
export { computeStatistics } from './statistics.js';
export { computeRegression } from './regression.js';
export { computeForecast, detectSeasonalPeriod, selectBestMethod } from './forecast.js';
export { matrixOp } from './matrix.js';
export { computePivot } from './pivot.js';

// ============================================================================
// Math Engine Exports (re-export for convenience)
// ============================================================================

export { kMeansClustering, findOptimalK, explainFormula } from '../compute-engine-math.js';
