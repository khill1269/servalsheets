/**
 * ServalSheets - Analysis Helper Functions
 *
 * Reusable statistical and data analysis functions extracted from
 * the original analysis handler. These pure functions are shared
 * between fast path (traditional stats) and AI path (enhanced analysis).
 *
 * All functions are optimized for performance with O(n) single-pass algorithms.
 */
/**
 * Calculate Pearson correlation coefficient between two numeric arrays
 * Returns value between -1 (perfect negative correlation) and 1 (perfect positive correlation)
 * Returns 0 if arrays are incompatible or have insufficient variance
 */
export declare function pearson(x: number[], y: number[]): number;
/**
 * Determine the type of a single value
 * Returns: 'empty' | 'number' | 'boolean' | 'string' | 'other'
 */
export declare function valueType(value: unknown): string;
/**
 * Analyze trends in numeric columns using linear regression
 * Returns trend direction and change rate for each column with sufficient data
 * O(n*m) complexity - single pass through data
 */
export declare function analyzeTrends(values: unknown[][]): Array<{
    column: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: string;
    confidence: number;
}>;
/**
 * Detect statistical anomalies using z-score method
 * Returns outliers that are >3 standard deviations from mean
 * O(n*m) complexity - single pass through data
 */
export declare function detectAnomalies(values: unknown[][]): Array<{
    cell: string;
    value: number;
    expected: string;
    deviation: string;
    zScore: string;
}>;
/**
 * Analyze seasonality patterns in time series data
 * Simplified detection - looks for repeating patterns
 * Note: Production implementation should use FFT or autocorrelation
 */
export declare function analyzeSeasonality(values: unknown[][]): {
    detected: boolean;
    period?: string;
    pattern?: string;
    strength?: number;
    message?: string;
    note?: string;
};
/**
 * Auto-detect data type of a column based on its values
 * Returns: 'empty' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'text' | 'mixed' | 'unknown'
 */
export declare function detectDataType(columnData: unknown[]): string;
/**
 * Analyze distribution of values in a column
 * Returns statistics for numeric data or value counts for categorical data
 */
export declare function analyzeDistribution(columnData: unknown[]): {
    type: 'categorical';
    uniqueCount: number;
    totalCount: number;
} | {
    type: 'numeric';
    mean: string;
    median: string;
    stdDev: string;
    min: string;
    max: string;
    quartiles: {
        q1: string;
        q2: string;
        q3: string;
        iqr: string;
    };
};
/**
 * Check quality metrics for a column
 * Returns completeness, consistency scores and list of quality issues
 */
export declare function checkColumnQuality(columnData: unknown[], dataType: string): {
    completeness: number;
    consistency: number;
    issues: string[];
    uniqueRatio?: number;
};
/**
 * Analyze correlations between numeric columns
 * Returns pairwise correlations with strength classification
 * O(n*m + m^2) complexity - single pass + pairwise comparison
 */
export declare function analyzeCorrelationsData(values: unknown[][]): Array<{
    columns: number[];
    correlation: string;
    strength: string;
}>;
/**
 * Type definitions for complex return types
 */
export interface TrendAnalysis {
    column: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: string;
    confidence: number;
}
export interface Anomaly {
    cell: string;
    value: number;
    expected: string;
    deviation: string;
    zScore: string;
}
export interface SeasonalityResult {
    detected: boolean;
    period?: string;
    pattern?: string;
    strength?: number;
    message?: string;
    note?: string;
}
export interface DistributionStats {
    type: 'numeric' | 'categorical';
    mean?: string;
    median?: string;
    stdDev?: string;
    min?: string;
    max?: string;
    quartiles?: {
        q1: string;
        q2: string;
        q3: string;
        iqr: string;
    };
    uniqueCount?: number;
    totalCount?: number;
}
export interface QualityScore {
    completeness: number;
    consistency: number;
    issues: string[];
    uniqueRatio?: number;
}
export interface CorrelationResult {
    columns: number[];
    correlation: string;
    strength: string;
}
//# sourceMappingURL=helpers.d.ts.map