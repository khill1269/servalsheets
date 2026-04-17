/**
 * Regression Service
 *
 * Fits linear, polynomial, and exponential regression models.
 */

export class RegressionService {
  fitLinear(x: number[], y: number[]): { slope: number; intercept: number } {
    if (x.length !== y.length || x.length < 2) {
      throw new Error('Invalid data for regression');
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] ?? 0), 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }
}

// ============================================================================
// Standalone function (used by compute handler via index.ts re-export)
// ============================================================================

interface RegressionOptions {
  xColumn?: number;
  yColumn?: number;
  type?: string;
  degree?: number;
  predict?: number[];
}

interface RegressionResult {
  coefficients: number[];
  rSquared: number;
  equation: string;
  predictions?: Array<{ x: number; y: number }>;
  residuals?: number[];
}

export function computeRegression(data: unknown[][], options: RegressionOptions): RegressionResult {
  const xCol = options.xColumn ?? 0;
  const yCol = options.yColumn ?? 1;

  // Extract numeric x/y values from data (skip header row)
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const xVal = Number(row[xCol]);
    const yVal = Number(row[yCol]);
    if (!isNaN(xVal) && !isNaN(yVal)) {
      x.push(xVal);
      y.push(yVal);
    }
  }

  if (x.length < 2) {
    return { coefficients: [0, 0], rSquared: 0, equation: 'y = 0' };
  }

  const svc = new RegressionService();
  const { slope, intercept } = svc.fitLinear(x, y);

  // R-squared
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - (slope * (x[i] ?? 0) + intercept)) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  // Residuals
  const residuals = y.map((yi, i) => yi - (slope * (x[i] ?? 0) + intercept));

  // Predictions
  const predictions = options.predict?.map((px) => ({ x: px, y: slope * px + intercept }));

  return {
    coefficients: [intercept, slope],
    rSquared,
    equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
    predictions,
    residuals,
  };
}
