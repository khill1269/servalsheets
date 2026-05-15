import { logger } from '../../utils/logger.js';

/**
 * Forecast Service
 *
 * Predicts future values using simple exponential smoothing or linear regression.
 */

export class ForecastService {
  forecast(values: number[], periods: number): number[] {
    if (values.length < 2) {
      logger.warn('Not enough data for forecasting', { count: values.length });
      return [];
    }

    // Simple exponential smoothing
    const alpha = 0.3;
    let smoothed = values[0] ?? 0;
    const forecasts: number[] = [];

    for (const value of values.slice(1)) {
      smoothed = alpha * value + (1 - alpha) * smoothed;
    }

    for (let i = 0; i < periods; i++) {
      forecasts.push(smoothed);
    }

    return forecasts;
  }
}

// ============================================================================
// Standalone functions (used by compute handler via index.ts re-export)
// ============================================================================

export interface ForecastOptions {
  dateColumn?: number | string;
  valueColumn?: number | string;
  periods: number;
  method?: string;
  seasonality?: number;
}

interface ForecastResult {
  forecast: number[];
  methodUsed: string;
  trend: { direction: string; strength: number };
  seasonalityDetected: boolean;
  seasonalPeriod?: number;
  confidence: number;
}

function resolveColumnIndex(
  col: number | string | undefined,
  header: unknown[] | undefined,
  fallback: number
): number {
  if (typeof col === 'number' && Number.isInteger(col) && col >= 0) return col;
  if (typeof col === 'string' && col.length > 0) {
    if (/^\d+$/.test(col)) return Number(col);
    if (/^[A-Za-z]+$/.test(col)) {
      let idx = 0;
      const upper = col.toUpperCase();
      for (let i = 0; i < upper.length; i++) {
        idx = idx * 26 + (upper.charCodeAt(i) - 64);
      }
      return idx - 1;
    }
    if (header) {
      const found = header.findIndex(
        (h) => typeof h === 'string' && h.toLowerCase() === col.toLowerCase()
      );
      if (found >= 0) return found;
    }
  }
  return fallback;
}

export function computeForecast(data: unknown[][], options: ForecastOptions): ForecastResult {
  const valCol = resolveColumnIndex(options.valueColumn, data[0], 1);

  // Extract numeric values (skip header)
  const values: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const v = Number(row[valCol]);
    if (!isNaN(v)) values.push(v);
  }

  const svc = new ForecastService();
  const forecast = svc.forecast(values, options.periods);

  // Simple trend detection
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const avgFirst =
    firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
  const avgSecond =
    secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
  const trendDirection =
    avgSecond > avgFirst * 1.02
      ? 'increasing'
      : avgSecond < avgFirst * 0.98
        ? 'decreasing'
        : 'stable';

  const seasonalPeriod = options.seasonality ?? detectSeasonalPeriod(values);

  return {
    forecast,
    methodUsed: options.method ?? 'exponential_smoothing',
    trend: {
      direction: trendDirection,
      strength: values.length > 0 ? Math.abs(avgSecond - avgFirst) / (Math.abs(avgFirst) || 1) : 0,
    },
    seasonalityDetected: seasonalPeriod > 0,
    seasonalPeriod: seasonalPeriod > 0 ? seasonalPeriod : undefined,
    confidence: Math.min(0.95, 0.5 + values.length * 0.01),
  };
}

/**
 * Detect seasonal period via simple autocorrelation peak detection.
 */
export function detectSeasonalPeriod(values: number[]): number {
  if (values.length < 6) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const demeaned = values.map((v) => v - mean);
  const variance = demeaned.reduce((a, b) => a + b * b, 0);
  if (variance === 0) return 0;

  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = 2; lag <= Math.min(Math.floor(values.length / 2), 52); lag++) {
    let corr = 0;
    for (let i = 0; i < values.length - lag; i++) {
      corr += (demeaned[i] ?? 0) * (demeaned[i + lag] ?? 0);
    }
    corr /= variance;
    if (corr > bestCorr && corr > 0.3) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  return bestLag;
}

/**
 * Select best forecasting method based on data characteristics.
 */
export function selectBestMethod(values: number[]): string {
  if (values.length < 6) return 'naive';
  const period = detectSeasonalPeriod(values);
  if (period > 0) return 'seasonal_decomposition';
  return 'exponential_smoothing';
}
