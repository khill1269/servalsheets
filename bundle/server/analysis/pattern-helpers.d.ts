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
export interface DistributionAnalysis {
    type: 'normal' | 'uniform' | 'exponential' | 'bimodal' | 'skewed' | 'unknown';
    confidence: number;
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
    significance: number;
    changeType: 'level_shift' | 'trend_change' | 'volatility_change';
}
export interface Cluster {
    id: number;
    center: number[];
    members: number[];
    size: number;
}
export interface TrendlineResult {
    type: 'linear' | 'polynomial' | 'exponential' | 'logarithmic';
    equation: string;
    r_squared: number;
    coefficients: number[];
    predicted: number[];
}
/**
 * Detect the type of distribution in data
 */
export declare function detectDistribution(values: number[]): DistributionAnalysis;
/**
 * Detect significant change points in time series
 *
 * Uses CUSUM (cumulative sum) method to detect level shifts
 */
export declare function detectChangePoints(values: number[], threshold?: number): ChangePoint[];
/**
 * Calculate Spearman's rank correlation coefficient
 *
 * Non-parametric measure of rank correlation (monotonic relationship)
 */
export declare function spearman(x: number[], y: number[]): number;
/**
 * Calculate modified Z-score using Median Absolute Deviation (MAD)
 *
 * More robust to outliers than standard Z-score
 */
export declare function modifiedZScore(values: number[]): number[];
/**
 * K-means clustering for 1D data
 */
export declare function detectClusters(values: number[], k?: number): Cluster[];
/**
 * Fit various trendline types to data
 */
export declare function fitTrendline(x: number[], y: number[], type?: 'linear' | 'polynomial' | 'exponential' | 'logarithmic', degree?: number): TrendlineResult;
//# sourceMappingURL=pattern-helpers.d.ts.map