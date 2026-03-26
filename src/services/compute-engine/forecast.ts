/**
 * Forecasting: time series prediction and trend analysis.
 */

import type { ForecastOptions, ForecastResult, CellValue } from './types.js';
import { resolveColumnIndex, extractNumericColumn } from './helpers.js';
import { linearRegression, computeStddev } from '../compute-engine-math.js';
import { ValidationError } from '../../core/errors.js';

/**
 * Compute time series forecast with trend analysis.
 */
export function computeForecast(data: CellValue[][], options: ForecastOptions): ForecastResult {
  const headers = (data[0] || []).map(String);
  const valueIdx = resolveColumnIndex(headers, options.valueColumn);
  const values = extractNumericColumn(data, valueIdx);

  if (values.length < 3)
    throw new ValidationError(
      'Forecasting requires at least 3 data points',
      'data',
      'at least 3 numeric rows'
    );

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
      throw new ValidationError(
        `Unsupported forecast method: ${method}`,
        'method',
        'linear_trend | exponential_smoothing | moving_average | seasonal'
      );
  }

  // Detect seasonality via autocorrelation if not user-specified
  if (!options.seasonality && values.length >= 6) {
    const detectedPeriod = detectSeasonalPeriod(values);
    if (detectedPeriod) {
      trend!.seasonalityDetected = true;
      trend!.seasonalPeriod = detectedPeriod.period;
    }
  } else if (options.seasonality) {
    trend!.seasonalityDetected = true;
    trend!.seasonalPeriod = options.seasonality;
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

/**
 * Detect seasonal period via autocorrelation scan.
 * Returns the lag with the strongest positive autocorrelation (above threshold).
 */
export function detectSeasonalPeriod(values: number[]): { period: number; strength: number } | null {
  if (values.length < 6) return null;

  const maxLag = Math.min(Math.floor(values.length / 2), 365);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Compute variance for denominator
  let variance = 0;
  for (const v of values) {
    variance += (v - mean) ** 2;
  }
  if (variance === 0) return null;

  let bestLag = 0;
  let bestAcf = 0;

  for (let lag = 2; lag <= maxLag; lag++) {
    let numerator = 0;
    for (let i = 0; i < values.length - lag; i++) {
      numerator += (values[i]! - mean) * (values[i + lag]! - mean);
    }
    const acf = numerator / variance;
    if (acf > bestAcf) {
      bestAcf = acf;
      bestLag = lag;
    }
  }

  return bestAcf >= 0.3 ? { period: bestLag, strength: bestAcf } : null;
}

/**
 * Select the best forecasting method based on data characteristics.
 */
export function selectBestMethod(
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
  // Auto-detect seasonality via autocorrelation
  if (!seasonality && values.length >= 6) {
    const detected = detectSeasonalPeriod(values);
    if (detected && values.length >= detected.period * 2) return 'moving_average';
  }
  return 'exponential_smoothing';
}
