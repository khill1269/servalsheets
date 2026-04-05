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
    let smoothed = values[0];
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
