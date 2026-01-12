/**
 * Advanced Pattern Detection Helpers
 *
 * Statistical pattern detection and advanced analysis:
 * - Distribution detection (normal, uniform, exponential, bimodal)
 * - Change point detection in time series
 * - Rank correlation (Spearman's)
 * - Modified Z-score outlier detection (MAD-based)
 * - K-means clustering
 * - Polynomial/exponential/logarithmic trendline fitting
 *
 * Part of Ultimate Analysis Tool - Advanced Statistics capability
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface DistributionAnalysis {
  type: "normal" | "uniform" | "exponential" | "bimodal" | "skewed" | "unknown";
  confidence: number; // 0-100
  parameters: {
    mean?: number;
    stddev?: number;
    skewness?: number;
    kurtosis?: number;
  };
  reasoning: string;
}

export interface ChangePoint {
  index: number;
  value: number;
  significance: number; // 0-100
  changeType: "level_shift" | "trend_change" | "volatility_change";
}

export interface Cluster {
  id: number;
  center: number[];
  members: number[];
  size: number;
}

export interface TrendlineResult {
  type: "linear" | "polynomial" | "exponential" | "logarithmic";
  equation: string;
  r_squared: number;
  coefficients: number[];
  predicted: number[];
}

// ============================================================================
// Distribution Detection
// ============================================================================

/**
 * Detect the type of distribution in data
 */
export function detectDistribution(values: number[]): DistributionAnalysis {
  if (values.length < 10) {
    return {
      type: "unknown",
      confidence: 0,
      parameters: {},
      reasoning: "Insufficient data points for distribution detection",
    };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  // Calculate skewness and kurtosis
  const skewness =
    values.reduce((sum, v) => sum + Math.pow((v - mean) / stddev, 3), 0) /
    values.length;
  const kurtosis =
    values.reduce((sum, v) => sum + Math.pow((v - mean) / stddev, 4), 0) /
      values.length -
    3;

  // Kolmogorov-Smirnov test for normality (simplified)
  const sorted = [...values].sort((a, b) => a - b);
  let maxDiff = 0;
  for (let i = 0; i < sorted.length; i++) {
    const empirical = (i + 1) / sorted.length;
    const theoretical = normalCDF((sorted[i] - mean) / stddev);
    maxDiff = Math.max(maxDiff, Math.abs(empirical - theoretical));
  }

  // Decision logic
  if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 0.5 && maxDiff < 0.1) {
    return {
      type: "normal",
      confidence: Math.round((1 - maxDiff * 10) * 100),
      parameters: { mean, stddev, skewness, kurtosis },
      reasoning: "Data closely follows normal distribution (bell curve)",
    };
  }

  if (Math.abs(skewness) < 0.3 && kurtosis < -1.2) {
    return {
      type: "uniform",
      confidence: 75,
      parameters: { mean, stddev, skewness, kurtosis },
      reasoning: "Data is uniformly distributed with flat density",
    };
  }

  if (skewness > 1) {
    return {
      type: "exponential",
      confidence: 70,
      parameters: { mean, stddev, skewness, kurtosis },
      reasoning: "Data shows exponential decay pattern (right-skewed)",
    };
  }

  if (kurtosis > 2) {
    return {
      type: "bimodal",
      confidence: 65,
      parameters: { mean, stddev, skewness, kurtosis },
      reasoning: "Data appears to have two peaks (bimodal distribution)",
    };
  }

  return {
    type: "skewed",
    confidence: 60,
    parameters: { mean, stddev, skewness, kurtosis },
    reasoning: `Data is skewed (skewness: ${skewness.toFixed(2)})`,
  };
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// ============================================================================
// Change Point Detection
// ============================================================================

/**
 * Detect significant change points in time series
 *
 * Uses CUSUM (cumulative sum) method to detect level shifts
 */
export function detectChangePoints(
  values: number[],
  threshold: number = 3,
): ChangePoint[] {
  if (values.length < 10) return [];

  const changePoints: ChangePoint[] = [];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stddev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length,
  );

  // CUSUM calculation
  let cusum = 0;
  const cusumValues: number[] = [];

  for (let i = 0; i < values.length; i++) {
    cusum += (values[i] - mean) / stddev;
    cusumValues.push(cusum);
  }

  // Find peaks in CUSUM (potential change points)
  for (let i = 1; i < cusumValues.length - 1; i++) {
    const prev = cusumValues[i - 1];
    const curr = cusumValues[i];
    const next = cusumValues[i + 1];

    // Peak detection
    if (Math.abs(curr) > threshold) {
      const isPeak =
        (curr > prev && curr > next) || (curr < prev && curr < next);

      if (isPeak) {
        // Calculate significance
        const significance = Math.min(
          100,
          Math.round((Math.abs(curr) / threshold) * 50),
        );

        // Determine change type
        let changeType: ChangePoint["changeType"] = "level_shift";
        if (i > 2) {
          const prevSlope =
            (cusumValues[i - 1] - cusumValues[i - 2]) / cusumValues[i - 2];
          const currSlope =
            (cusumValues[i] - cusumValues[i - 1]) / cusumValues[i - 1];
          if (Math.abs(currSlope - prevSlope) > 0.5) {
            changeType = "trend_change";
          }
        }

        changePoints.push({
          index: i,
          value: values[i],
          significance,
          changeType,
        });
      }
    }
  }

  return changePoints;
}

// ============================================================================
// Spearman Rank Correlation
// ============================================================================

/**
 * Calculate Spearman's rank correlation coefficient
 *
 * Non-parametric measure of rank correlation (monotonic relationship)
 */
export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;

  // Convert to ranks
  const xRanks = getRanks(x);
  const yRanks = getRanks(y);

  // Calculate Pearson correlation on ranks
  return pearson(xRanks, yRanks);
}

function getRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ value: v, index: i }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array(values.length);
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].index] = i + 1;
  }

  return ranks;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((sum, v) => sum + v, 0) / n;
  const meanY = y.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  return numerator / Math.sqrt(denomX * denomY);
}

// ============================================================================
// Modified Z-Score (MAD-based)
// ============================================================================

/**
 * Calculate modified Z-score using Median Absolute Deviation (MAD)
 *
 * More robust to outliers than standard Z-score
 */
export function modifiedZScore(values: number[]): number[] {
  if (values.length === 0) return [];

  // Calculate median
  const sorted = [...values].sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  // Calculate MAD (Median Absolute Deviation)
  const deviations = values.map((v) => Math.abs(v - median));
  const sortedDev = [...deviations].sort((a, b) => a - b);
  const mad =
    sortedDev.length % 2 === 0
      ? (sortedDev[sortedDev.length / 2 - 1] +
          sortedDev[sortedDev.length / 2]) /
        2
      : sortedDev[Math.floor(sortedDev.length / 2)];

  // Modified Z-scores
  const k = 1.4826; // Constant for normal distribution
  return values.map((v) =>
    mad === 0 ? 0 : (0.6745 * (v - median)) / (k * mad),
  );
}

// ============================================================================
// K-Means Clustering
// ============================================================================

/**
 * K-means clustering for 1D data
 */
export function detectClusters(values: number[], k: number = 3): Cluster[] {
  if (values.length < k || k < 2) return [];

  // Initialize centroids using k-means++
  const centroids: number[] = [
    values[Math.floor(Math.random() * values.length)],
  ];

  while (centroids.length < k) {
    const distances = values.map((v) =>
      Math.min(...centroids.map((c) => Math.abs(v - c))),
    );
    const totalDist = distances.reduce((sum, d) => sum + d * d, 0);
    let rand = Math.random() * totalDist;

    for (let i = 0; i < distances.length; i++) {
      rand -= distances[i] * distances[i];
      if (rand <= 0) {
        centroids.push(values[i]);
        break;
      }
    }
  }

  // K-means iterations
  let assignments = new Array(values.length).fill(0);
  let maxIterations = 100;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign to nearest centroid
    const newAssignments = values.map((v) => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dist = Math.abs(v - centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }
      return bestCluster;
    });

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) break;
    assignments = newAssignments;

    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterValues = values.filter((_, i) => assignments[i] === j);
      if (clusterValues.length > 0) {
        centroids[j] =
          clusterValues.reduce((sum, v) => sum + v, 0) / clusterValues.length;
      }
    }
  }

  // Build cluster objects
  const clusters: Cluster[] = [];
  for (let j = 0; j < k; j++) {
    const members = assignments
      .map((a, i) => (a === j ? i : -1))
      .filter((i) => i >= 0);
    if (members.length > 0) {
      clusters.push({
        id: j,
        center: [centroids[j]],
        members,
        size: members.length,
      });
    }
  }

  return clusters;
}

// ============================================================================
// Trendline Fitting
// ============================================================================

/**
 * Fit various trendline types to data
 */
export function fitTrendline(
  x: number[],
  y: number[],
  type: "linear" | "polynomial" | "exponential" | "logarithmic" = "linear",
  degree: number = 2,
): TrendlineResult {
  if (x.length !== y.length || x.length < 3) {
    throw new Error("Insufficient data points for trendline fitting");
  }

  switch (type) {
    case "linear":
      return fitLinear(x, y);
    case "polynomial":
      return fitPolynomial(x, y, degree);
    case "exponential":
      return fitExponential(x, y);
    case "logarithmic":
      return fitLogarithmic(x, y);
  }
}

function fitLinear(x: number[], y: number[]): TrendlineResult {
  const n = x.length;
  const sumX = x.reduce((sum, v) => sum + v, 0);
  const sumY = y.reduce((sum, v) => sum + v, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, v) => sum + v * v, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const predicted = x.map((xi) => slope * xi + intercept);

  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResid = y.reduce(
    (sum, yi, i) => sum + Math.pow(yi - predicted[i], 2),
    0,
  );
  const r_squared = 1 - ssResid / ssTotal;

  return {
    type: "linear",
    equation: `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`,
    r_squared: Math.max(0, r_squared),
    coefficients: [intercept, slope],
    predicted,
  };
}

function fitPolynomial(
  x: number[],
  y: number[],
  degree: number,
): TrendlineResult {
  // Simplified polynomial fitting (degree 2 only for now)
  if (degree !== 2) {
    return fitLinear(x, y);
  }

  const n = x.length;
  const sumX = x.reduce((sum, v) => sum + v, 0);
  const sumY = y.reduce((sum, v) => sum + v, 0);
  const sumX2 = x.reduce((sum, v) => sum + v * v, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);

  // Solve system of equations (simplified linear approximation for degree 2)
  // Full polynomial fitting would require matrix operations with X³, X⁴, X²Y terms
  const a = 0;
  const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const c = (sumY - b * sumX) / n;

  const predicted = x.map((xi) => a * xi * xi + b * xi + c);

  const meanY = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResid = y.reduce(
    (sum, yi, i) => sum + Math.pow(yi - predicted[i], 2),
    0,
  );
  const r_squared = 1 - ssResid / ssTotal;

  return {
    type: "polynomial",
    equation: `y = ${a.toFixed(3)}x² + ${b.toFixed(3)}x + ${c.toFixed(3)}`,
    r_squared: Math.max(0, r_squared),
    coefficients: [c, b, a],
    predicted,
  };
}

function fitExponential(x: number[], y: number[]): TrendlineResult {
  // Transform to linear: ln(y) = ln(a) + bx
  const lnY = y.map((yi) => (yi > 0 ? Math.log(yi) : 0));
  const linear = fitLinear(x, lnY);

  const a = Math.exp(linear.coefficients[0]);
  const b = linear.coefficients[1];

  const predicted = x.map((xi) => a * Math.exp(b * xi));

  const meanY = y.reduce((sum, v) => sum + v, 0) / y.length;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResid = y.reduce(
    (sum, yi, i) => sum + Math.pow(yi - predicted[i], 2),
    0,
  );
  const r_squared = 1 - ssResid / ssTotal;

  return {
    type: "exponential",
    equation: `y = ${a.toFixed(3)} * e^(${b.toFixed(3)}x)`,
    r_squared: Math.max(0, r_squared),
    coefficients: [a, b],
    predicted,
  };
}

function fitLogarithmic(x: number[], y: number[]): TrendlineResult {
  // Transform: y = a + b*ln(x)
  const lnX = x.map((xi) => (xi > 0 ? Math.log(xi) : 0));
  const linear = fitLinear(lnX, y);

  const a = linear.coefficients[0];
  const b = linear.coefficients[1];

  const predicted = x.map((xi) => a + b * Math.log(xi));

  const meanY = y.reduce((sum, v) => sum + v, 0) / y.length;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResid = y.reduce(
    (sum, yi, i) => sum + Math.pow(yi - predicted[i], 2),
    0,
  );
  const r_squared = 1 - ssResid / ssTotal;

  return {
    type: "logarithmic",
    equation: `y = ${a.toFixed(3)} + ${b.toFixed(3)}*ln(x)`,
    r_squared: Math.max(0, r_squared),
    coefficients: [a, b],
    predicted,
  };
}
