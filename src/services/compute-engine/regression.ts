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
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }
}
