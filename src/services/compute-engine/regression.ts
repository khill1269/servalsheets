/**
 * Regression analysis: linear, polynomial, exponential, logarithmic, power.
 */

import type { RegressionOptions, RegressionResult, CellValue } from './types.js';
import { resolveColumnIndex, extractNumericColumn } from './helpers.js';
import {
  linearRegression,
  polynomialRegression,
  predictValue,
} from '../compute-engine-math.js';
import { ValidationError } from '../../core/errors.js';

/**
 * Compute regression model and optionally make predictions.
 */
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
  if (n < 2)
    throw new ValidationError(
      'Regression requires at least 2 data points',
      'data',
      'at least 2 numeric rows'
    );

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
      throw new ValidationError(
        `Unsupported regression type: ${options.type}`,
        'type',
        'linear | polynomial | exponential | logarithmic | power'
      );
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
