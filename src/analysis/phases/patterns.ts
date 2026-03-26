/**
 * Phase 5-7: Trend detection, anomaly detection, and correlation analysis
 */

import { spearman } from '../helpers.js';
import type { ColumnStats, TrendResult, AnomalyResult, CorrelationResult } from '../comprehensive.js';

/**
 * Detect linear trends in numeric columns using linear regression + R²
 */
export function detectTrends(
  _headers: string[],
  dataRows: unknown[][],
  columns: ColumnStats[]
): TrendResult[] {
  const trends: TrendResult[] = [];

  columns.forEach((col, index) => {
    if (col.dataType !== 'number' || col.count < 5) return;

    const values = dataRows.reduce<number[]>((acc, row) => {
      const n = Number(row[index]);
      if (!Number.isNaN(n)) {
        acc.push(n);
      }
      return acc;
    }, []);

    if (values.length < 5) return;

    // Simple linear regression for trend
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, y, x) => sum + x * y, 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;

    // Calculate R-squared
    const yMean = ySum / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, x) => {
      const predicted = intercept + slope * x;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = 1 - ssResidual / ssTotal;

    if (rSquared > 0.3) {
      const direction = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable';

      trends.push({
        column: col.name,
        direction,
        confidence: Math.round(rSquared * 100),
        changeRate: `${(slope * 100).toFixed(2)}% per row`,
        description: `${col.name} shows ${direction} trend with ${Math.round(rSquared * 100)}% confidence`,
      });
    }
  });

  return trends;
}

/**
 * Detect statistical anomalies (z-score > 2) in numeric columns
 */
export function detectAnomaliesEnhanced(
  _headers: string[],
  dataRows: unknown[][],
  columns: ColumnStats[]
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];

  columns.forEach((col, colIndex) => {
    if (col.dataType !== 'number' || !col.mean || !col.stdDev) return;

    dataRows.forEach((row, rowIndex) => {
      const value = Number(row[colIndex]);
      if (isNaN(value)) return;

      const zScore = (value - col.mean!) / col.stdDev!;

      if (Math.abs(zScore) > 2) {
        const lowerBound = col.mean! - 2 * col.stdDev!;
        const upperBound = col.mean! + 2 * col.stdDev!;

        anomalies.push({
          location: `${col.name}:Row ${rowIndex + 2}`,
          value,
          expectedRange: `${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}`,
          severity: Math.abs(zScore) > 3 ? 'high' : Math.abs(zScore) > 2.5 ? 'medium' : 'low',
          zScore: Math.round(zScore * 100) / 100,
        });
      }
    });
  });

  // Limit to top 20 anomalies by severity
  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 20);
}

/**
 * Detect Pearson (and Spearman fallback) correlations between numeric column pairs
 */
export function detectCorrelations(
  _headers: string[],
  dataRows: unknown[][],
  columns: ColumnStats[]
): CorrelationResult[] {
  const correlations: CorrelationResult[] = [];
  const numericColumns = columns.filter((c) => c.dataType === 'number' && c.mean !== undefined);

  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i]!;
      const col2 = numericColumns[j]!;

      const values1 = dataRows.reduce<number[]>((acc, row) => {
        const n = Number(row[col1.index]);
        if (!Number.isNaN(n)) {
          acc.push(n);
        }
        return acc;
      }, []);
      const values2 = dataRows.reduce<number[]>((acc, row) => {
        const n = Number(row[col2.index]);
        if (!Number.isNaN(n)) {
          acc.push(n);
        }
        return acc;
      }, []);

      if (values1.length < 5 || values2.length < 5) continue;

      // Pearson correlation
      const n = Math.min(values1.length, values2.length);
      const mean1 = values1.reduce((a, b) => a + b, 0) / n;
      const mean2 = values2.reduce((a, b) => a + b, 0) / n;

      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;

      for (let k = 0; k < n; k++) {
        const diff1 = values1[k]! - mean1;
        const diff2 = values2[k]! - mean2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }

      const coefficient = numerator / (Math.sqrt(denom1) * Math.sqrt(denom2));
      const absCoef = Math.abs(coefficient);

      // Use Pearson if strong enough; otherwise try Spearman for non-linear monotonic relationships
      let bestCoef = coefficient;
      let bestMethod: 'pearson' | 'spearman' = 'pearson';

      if (absCoef <= 0.4 && values1.length >= 5 && values2.length >= 5) {
        // Pearson is weak — check if Spearman (rank-based) finds a stronger monotonic relationship
        const spearmanCoef = spearman(values1.slice(0, n), values2.slice(0, n));
        if (Math.abs(spearmanCoef) > absCoef + 0.1) {
          bestCoef = spearmanCoef;
          bestMethod = 'spearman';
        }
      }

      const bestAbs = Math.abs(bestCoef);
      if (bestAbs > 0.3) {
        correlations.push({
          columns: [col1.name, col2.name],
          coefficient: Math.round(bestCoef * 100) / 100,
          strength:
            bestAbs > 0.8
              ? 'very_strong'
              : bestAbs > 0.6
                ? 'strong'
                : bestAbs > 0.4
                  ? 'moderate'
                  : 'weak',
          direction: bestCoef > 0 ? 'positive' : 'negative',
          method: bestMethod,
        });
      }
    }
  }

  return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
}
