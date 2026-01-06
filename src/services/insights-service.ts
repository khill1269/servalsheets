/**
 * ServalSheets - AI Insights Service
 *
 * Advanced AI-powered insights for spreadsheet data:
 * - Anomaly detection (outliers, missing data, quality issues)
 * - Relationship discovery (correlations, dependencies, patterns)
 * - Predictive insights (trends, forecasts, recommendations)
 *
 * Phase 3, Task 3.3
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Insight,
  InsightType,
  InsightSeverity,
  AnomalyInsight,
  RelationshipInsight,
  PredictionInsight,
  PatternInsight,
  QualityInsight,
  InsightRequest,
  InsightResult,
  InsightsServiceConfig,
  InsightsServiceStats,
  AnomalyDetectionConfig as _AnomalyDetectionConfig,
  RelationshipDiscoveryConfig as _RelationshipDiscoveryConfig,
  PredictionConfig as _PredictionConfig,
  PredictionValue,
  InsightRecommendation as _InsightRecommendation,
  InsightEvidence as _InsightEvidence,
} from '../types/insights.js';

/**
 * Cell value type
 */
type CellValue = string | number | boolean | null | undefined;

/**
 * Data column for analysis
 */
interface DataColumn {
  name: string;
  values: CellValue[];
  range: string;
}

/**
 * Statistical metrics for a data column
 */
interface ColumnStats {
  count: number;
  nullCount: number;
  uniqueCount: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  dataType: 'number' | 'string' | 'boolean' | 'date' | 'mixed';
}

/**
 * Insights Service - AI-powered data analysis and insights generation
 */
export class InsightsService {
  private config: Required<InsightsServiceConfig>;
  private stats: InsightsServiceStats;
  private insightCache: Map<string, { insights: Insight[]; timestamp: number }>;

  constructor(config: InsightsServiceConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      anomalyDetection: {
        detectOutliers: config.anomalyDetection?.detectOutliers ?? true,
        outlierThreshold: config.anomalyDetection?.outlierThreshold ?? 3.0,
        detectMissing: config.anomalyDetection?.detectMissing ?? true,
        detectDuplicates: config.anomalyDetection?.detectDuplicates ?? true,
        detectFormatInconsistencies:
          config.anomalyDetection?.detectFormatInconsistencies ?? true,
        detectInvalidValues: config.anomalyDetection?.detectInvalidValues ?? true,
        minSampleSize: config.anomalyDetection?.minSampleSize ?? 10,
      },
      relationshipDiscovery: {
        detectCorrelations: config.relationshipDiscovery?.detectCorrelations ?? true,
        minCorrelation: config.relationshipDiscovery?.minCorrelation ?? 0.5,
        detectDependencies: config.relationshipDiscovery?.detectDependencies ?? true,
        detectPatterns: config.relationshipDiscovery?.detectPatterns ?? true,
        maxColumnsToCompare: config.relationshipDiscovery?.maxColumnsToCompare ?? 10,
      },
      prediction: {
        detectTrends: config.prediction?.detectTrends ?? true,
        enableForecasting: config.prediction?.enableForecasting ?? true,
        forecastPeriods: config.prediction?.forecastPeriods ?? 5,
        minHistoricalPoints: config.prediction?.minHistoricalPoints ?? 10,
        confidenceLevel: config.prediction?.confidenceLevel ?? 0.95,
      },
      minConfidence: config.minConfidence ?? 0.6,
      maxInsightsPerRequest: config.maxInsightsPerRequest ?? 50,
      enableCaching: config.enableCaching ?? true,
      cacheTtl: config.cacheTtl ?? 300000, // 5 minutes
      verboseLogging: config.verboseLogging ?? false,
    };

    this.stats = {
      totalInsights: 0,
      insightsByType: {
        anomaly: 0,
        relationship: 0,
        prediction: 0,
        pattern: 0,
        quality: 0,
        optimization: 0,
      },
      insightsBySeverity: {
        info: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      avgConfidence: 0,
      totalRequests: 0,
      avgGenerationTime: 0,
      cacheHitRate: 0,
      spreadsheetsAnalyzed: 0,
      rowsAnalyzed: 0,
    };

    this.insightCache = new Map();
  }

  /**
   * Generate insights for spreadsheet data
   */
  async generateInsights(request: InsightRequest): Promise<InsightResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    if (!this.config.enabled) {
      return this.emptyResult(request, startTime);
    }

    // Check cache
    const cacheKey = this.getCacheKey(request);
    if (this.config.enableCaching) {
      const cached = this.insightCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
        this.log('Cache hit for insights request');
        return this.buildResult(cached.insights, request, startTime);
      }
    }

    // Fetch data (simulated for now - in production would use GoogleAPIService)
    const data = await this.fetchData(request);
    if (!data || data.length === 0) {
      return this.emptyResult(request, startTime);
    }

    // Generate insights
    const insights: Insight[] = [];
    const insightTypes = request.insightTypes || [
      'anomaly',
      'relationship',
      'prediction',
      'pattern',
      'quality',
    ];

    if (insightTypes.includes('anomaly')) {
      insights.push(...(await this.detectAnomalies(data, request)));
    }

    if (insightTypes.includes('relationship')) {
      insights.push(...(await this.discoverRelationships(data, request)));
    }

    if (insightTypes.includes('prediction')) {
      insights.push(...(await this.generatePredictions(data, request)));
    }

    if (insightTypes.includes('pattern')) {
      insights.push(...(await this.detectPatterns(data, request)));
    }

    if (insightTypes.includes('quality')) {
      insights.push(...(await this.assessDataQuality(data, request)));
    }

    // Filter by confidence and limit
    const filteredInsights = insights
      .filter((i) => i.confidence >= (request.minConfidence ?? this.config.minConfidence))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, request.maxInsights ?? this.config.maxInsightsPerRequest);

    // Cache results
    if (this.config.enableCaching) {
      this.insightCache.set(cacheKey, {
        insights: filteredInsights,
        timestamp: Date.now(),
      });
    }

    // Update stats
    this.updateStats(filteredInsights, data);

    return this.buildResult(filteredInsights, request, startTime);
  }

  /**
   * Detect anomalies in data
   */
  private async detectAnomalies(
    data: DataColumn[],
    request: InsightRequest
  ): Promise<AnomalyInsight[]> {
    const insights: AnomalyInsight[] = [];
    const config = this.config.anomalyDetection;

    for (const column of data) {
      const stats = this.calculateColumnStats(column);

      // Skip if insufficient data
      if (stats.count < (config.minSampleSize ?? 10)) {
        continue;
      }

      // Detect outliers (numeric data only)
      if (config.detectOutliers && stats.dataType === 'number' && stats.stdDev) {
        const outliers = this.detectOutliers(column, stats, config.outlierThreshold ?? 3.0);
        if (outliers.length > 0) {
          insights.push(this.createOutlierInsight(column, outliers, stats, request));
        }
      }

      // Detect missing data
      if (config.detectMissing && stats.nullCount > 0) {
        const missingPercentage = (stats.nullCount / stats.count) * 100;
        if (missingPercentage > 5) {
          // >5% missing
          insights.push(this.createMissingDataInsight(column, stats, request));
        }
      }

      // Detect duplicates
      if (config.detectDuplicates) {
        const duplicatePercentage =
          ((stats.count - stats.uniqueCount) / stats.count) * 100;
        if (duplicatePercentage > 10 && stats.uniqueCount < stats.count) {
          // >10% duplicates
          insights.push(this.createDuplicateInsight(column, stats, request));
        }
      }

      // Detect format inconsistencies
      if (config.detectFormatInconsistencies && stats.dataType === 'mixed') {
        insights.push(this.createFormatInconsistencyInsight(column, stats, request));
      }

      // Detect invalid values
      if (config.detectInvalidValues) {
        const invalidValues = this.detectInvalidValues(column, stats);
        if (invalidValues.length > 0) {
          insights.push(
            this.createInvalidValueInsight(column, invalidValues, stats, request)
          );
        }
      }
    }

    return insights;
  }

  /**
   * Discover relationships between columns
   */
  private async discoverRelationships(
    data: DataColumn[],
    request: InsightRequest
  ): Promise<RelationshipInsight[]> {
    const insights: RelationshipInsight[] = [];
    const config = this.config.relationshipDiscovery;

    if (!config.detectCorrelations || data.length < 2) {
      return insights;
    }

    // Limit columns to compare
    const columnsToCompare = data.slice(0, config.maxColumnsToCompare);

    // Compare each pair of numeric columns
    for (let i = 0; i < columnsToCompare.length; i++) {
      for (let j = i + 1; j < columnsToCompare.length; j++) {
        const col1 = columnsToCompare[i]!;
        const col2 = columnsToCompare[j]!;

        const stats1 = this.calculateColumnStats(col1);
        const stats2 = this.calculateColumnStats(col2);

        // Only analyze numeric columns
        if (stats1.dataType === 'number' && stats2.dataType === 'number') {
          const correlation = this.calculateCorrelation(col1, col2);

          if (Math.abs(correlation) >= (config.minCorrelation ?? 0.5)) {
            insights.push(
              this.createCorrelationInsight(col1, col2, correlation, request)
            );
          }
        }
      }
    }

    return insights;
  }

  /**
   * Generate predictive insights
   */
  private async generatePredictions(
    data: DataColumn[],
    request: InsightRequest
  ): Promise<PredictionInsight[]> {
    const insights: PredictionInsight[] = [];
    const config = this.config.prediction;

    for (const column of data) {
      const stats = this.calculateColumnStats(column);

      // Only predict on numeric data with sufficient history
      if (
        stats.dataType !== 'number' ||
        stats.count < (config.minHistoricalPoints ?? 10)
      ) {
        continue;
      }

      // Detect trends
      if (config.detectTrends) {
        const trend = this.detectTrend(column);
        if (trend.confidence > this.config.minConfidence) {
          insights.push(this.createTrendInsight(column, trend, request));
        }
      }

      // Generate forecasts
      if (config.enableForecasting) {
        const forecast = this.generateForecast(column, config.forecastPeriods ?? 5);
        if (forecast.confidence > this.config.minConfidence) {
          insights.push(this.createForecastInsight(column, forecast, request));
        }
      }
    }

    return insights;
  }

  /**
   * Detect patterns in data
   */
  private async detectPatterns(
    data: DataColumn[],
    request: InsightRequest
  ): Promise<PatternInsight[]> {
    const insights: PatternInsight[] = [];

    for (const column of data) {
      const stats = this.calculateColumnStats(column);

      if (stats.dataType === 'number' && stats.count >= 20) {
        // Detect seasonal patterns
        const seasonalPattern = this.detectSeasonalPattern(column);
        if (seasonalPattern && seasonalPattern.strength > 0.6) {
          insights.push(this.createSeasonalPatternInsight(column, seasonalPattern, request));
        }
      }
    }

    return insights;
  }

  /**
   * Assess data quality
   */
  private async assessDataQuality(
    data: DataColumn[],
    request: InsightRequest
  ): Promise<QualityInsight[]> {
    const insights: QualityInsight[] = [];

    for (const column of data) {
      const stats = this.calculateColumnStats(column);
      const qualityScore = this.calculateQualityScore(stats);

      if (qualityScore < 0.8) {
        // Quality below 80%
        insights.push(this.createQualityInsight(column, stats, qualityScore, request));
      }
    }

    return insights;
  }

  /**
   * Calculate statistical metrics for a column
   */
  private calculateColumnStats(column: DataColumn): ColumnStats {
    const values = column.values.filter((v) => v !== null && v !== undefined);
    const nullCount = column.values.length - values.length;

    // Determine data type
    const types = new Set(values.map((v) => typeof v));
    let dataType: ColumnStats['dataType'] = 'mixed';
    if (types.size === 1) {
      const type = types.values().next().value;
      dataType = type === 'number' ? 'number' : type === 'string' ? 'string' : type === 'boolean' ? 'boolean' : 'mixed';
    }

    const stats: ColumnStats = {
      count: column.values.length,
      nullCount,
      uniqueCount: new Set(values).size,
      dataType,
    };

    // Calculate numeric statistics
    if (dataType === 'number') {
      const numValues = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);

      if (numValues.length > 0) {
        stats.mean = numValues.reduce((sum, v) => sum + v, 0) / numValues.length;
        stats.median = this.calculateMedian(numValues);
        stats.min = numValues[0];
        stats.max = numValues[numValues.length - 1];

        // Calculate standard deviation
        const variance =
          numValues.reduce((sum, v) => sum + Math.pow(v - stats.mean!, 2), 0) /
          numValues.length;
        stats.stdDev = Math.sqrt(variance);

        // Calculate quartiles
        stats.q1 = this.calculatePercentile(numValues, 25);
        stats.q3 = this.calculatePercentile(numValues, 75);
        stats.iqr = stats.q3 - stats.q1;
      }
    }

    return stats;
  }

  /**
   * Detect outliers using z-score method
   */
  private detectOutliers(
    column: DataColumn,
    stats: ColumnStats,
    threshold: number
  ): number[] {
    if (!stats.mean || !stats.stdDev) return [];

    const outliers: number[] = [];
    const numValues = column.values.filter((v): v is number => typeof v === 'number');

    for (let i = 0; i < numValues.length; i++) {
      const value = numValues[i]!;
      const zScore = Math.abs((value - stats.mean) / stats.stdDev);
      if (zScore > threshold) {
        outliers.push(i);
      }
    }

    return outliers;
  }

  /**
   * Detect invalid values based on data type
   */
  private detectInvalidValues(column: DataColumn, _stats: ColumnStats): number[] {
    const invalid: number[] = [];

    for (let i = 0; i < column.values.length; i++) {
      const value = column.values[i];

      // Check for common invalid patterns
      if (typeof value === 'string') {
        const str = value.toLowerCase();
        if (
          str === 'n/a' ||
          str === 'error' ||
          str === '#error' ||
          str === '#ref!' ||
          str === '#div/0!' ||
          str === '#value!'
        ) {
          invalid.push(i);
        }
      }
    }

    return invalid;
  }

  /**
   * Calculate correlation coefficient between two columns
   */
  private calculateCorrelation(col1: DataColumn, col2: DataColumn): number {
    const values1 = col1.values.filter((v): v is number => typeof v === 'number');
    const values2 = col2.values.filter((v): v is number => typeof v === 'number');

    const n = Math.min(values1.length, values2.length);
    if (n < 2) return 0;

    const mean1 = values1.reduce((sum, v) => sum + v, 0) / n;
    const mean2 = values2.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = values1[i]! - mean1;
      const diff2 = values2[i]! - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Detect trend in time series data
   */
  private detectTrend(column: DataColumn): {
    direction: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    confidence: number;
  } {
    const values = column.values.filter((v): v is number => typeof v === 'number');
    if (values.length < 3) {
      return { direction: 'stable', slope: 0, confidence: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const meanX = x.reduce((sum, v) => sum + v, 0) / n;
    const meanY = y.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i]! - meanX) * (y[i]! - meanY);
      denominator += Math.pow(x[i]! - meanX, 2);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    // Calculate R-squared for confidence
    const predictions = x.map((xi) => meanY + slope * (xi - meanX));
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i]!, 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return {
      direction: slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable',
      slope,
      confidence: Math.max(0, Math.min(1, rSquared)),
    };
  }

  /**
   * Generate forecast for time series data
   */
  private generateForecast(
    column: DataColumn,
    periods: number
  ): {
    predictions: PredictionValue[];
    confidence: number;
  } {
    const values = column.values.filter((v): v is number => typeof v === 'number');
    if (values.length < 3) {
      return { predictions: [], confidence: 0 };
    }

    const trend = this.detectTrend(column);
    const lastValue = values[values.length - 1]!;
    const predictions: PredictionValue[] = [];

    for (let i = 1; i <= periods; i++) {
      const predictedValue = lastValue + trend.slope * i;
      predictions.push({
        value: predictedValue,
        confidence: trend.confidence * (1 - i * 0.1), // Confidence decreases over time
        timestamp: `Period ${i}`,
      });
    }

    return { predictions, confidence: trend.confidence };
  }

  /**
   * Detect seasonal patterns
   */
  private detectSeasonalPattern(column: DataColumn): {
    frequency: number;
    strength: number;
  } | null {
    const values = column.values.filter((v): v is number => typeof v === 'number');
    if (values.length < 20) return null;

    // Simple autocorrelation-based seasonality detection
    const maxLag = Math.floor(values.length / 3);
    let bestLag = 0;
    let maxCorr = 0;

    for (let lag = 2; lag <= maxLag; lag++) {
      const corr = this.calculateAutocorrelation(values, lag);
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    return maxCorr > 0.5 ? { frequency: bestLag, strength: maxCorr } : null;
  }

  /**
   * Calculate autocorrelation at given lag
   */
  private calculateAutocorrelation(values: number[], lag: number): number {
    const n = values.length - lag;
    if (n < 1) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i]! - mean) * (values[i + lag]! - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i]! - mean, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate data quality score
   */
  private calculateQualityScore(stats: ColumnStats): number {
    let score = 1.0;

    // Penalize missing data
    const missingPercentage = stats.nullCount / stats.count;
    score -= missingPercentage * 0.5;

    // Penalize low uniqueness (except for categorical data)
    const uniquenessRatio = stats.uniqueCount / (stats.count - stats.nullCount);
    if (uniquenessRatio < 0.5 && stats.count > 20) {
      score -= (0.5 - uniquenessRatio) * 0.3;
    }

    // Penalize mixed data types
    if (stats.dataType === 'mixed') {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Helper: Calculate median
   */
  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1]! + sortedValues[mid]!) / 2
      : sortedValues[mid]!;
  }

  /**
   * Helper: Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
  }

  /**
   * Create outlier insight
   */
  private createOutlierInsight(
    column: DataColumn,
    outlierIndices: number[],
    stats: ColumnStats,
    request: InsightRequest
  ): AnomalyInsight {
    const affectedPercentage = (outlierIndices.length / stats.count) * 100;
    const severity: InsightSeverity =
      affectedPercentage > 10
        ? 'high'
        : affectedPercentage > 5
          ? 'medium'
          : 'low';

    return {
      id: uuidv4(),
      type: 'anomaly',
      anomalyType: 'outlier',
      severity,
      confidence: 0.85,
      title: `Outliers detected in ${column.name}`,
      description: `Found ${outlierIndices.length} outliers (${affectedPercentage.toFixed(1)}%) in column ${column.name}`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      affectedPercentage,
      deviation: stats.stdDev ? stats.stdDev * (this.config.anomalyDetection.outlierThreshold ?? 3.0) : undefined,
      recommendations: [
        {
          action: 'Review and validate outlier values',
          impact: 'Improved data quality and analysis accuracy',
          effort: 'low',
          priority: 'medium',
        },
      ],
      evidence: [
        {
          type: 'statistical',
          description: `Values exceed ${this.config.anomalyDetection.outlierThreshold ?? 3.0} standard deviations`,
          metrics: {
            mean: stats.mean ?? 0,
            stdDev: stats.stdDev ?? 0,
            outlierCount: outlierIndices.length,
          },
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Create missing data insight
   */
  private createMissingDataInsight(
    column: DataColumn,
    stats: ColumnStats,
    request: InsightRequest
  ): AnomalyInsight {
    const missingPercentage = (stats.nullCount / stats.count) * 100;
    const severity: InsightSeverity =
      missingPercentage > 30
        ? 'high'
        : missingPercentage > 15
          ? 'medium'
          : 'low';

    return {
      id: uuidv4(),
      type: 'anomaly',
      anomalyType: 'missing_data',
      severity,
      confidence: 0.95,
      title: `Missing data in ${column.name}`,
      description: `${stats.nullCount} missing values (${missingPercentage.toFixed(1)}%) in column ${column.name}`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      affectedPercentage: missingPercentage,
      recommendations: [
        {
          action: 'Fill missing values or remove incomplete rows',
          impact: 'Complete dataset for accurate analysis',
          effort: 'medium',
          priority: 'high',
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Create duplicate insight
   */
  private createDuplicateInsight(
    column: DataColumn,
    stats: ColumnStats,
    request: InsightRequest
  ): AnomalyInsight {
    const duplicateCount = stats.count - stats.uniqueCount;
    const duplicatePercentage = (duplicateCount / stats.count) * 100;

    return {
      id: uuidv4(),
      type: 'anomaly',
      anomalyType: 'duplicate',
      severity: 'medium',
      confidence: 0.9,
      title: `Duplicate values in ${column.name}`,
      description: `${duplicateCount} duplicate values (${duplicatePercentage.toFixed(1)}%) in column ${column.name}`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      affectedPercentage: duplicatePercentage,
      recommendations: [
        {
          action: 'Remove duplicates or verify intentional duplicates',
          impact: 'Cleaner dataset, accurate counts',
          effort: 'low',
          priority: 'medium',
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Create format inconsistency insight
   */
  private createFormatInconsistencyInsight(
    column: DataColumn,
    stats: ColumnStats,
    request: InsightRequest
  ): AnomalyInsight {
    return {
      id: uuidv4(),
      type: 'anomaly',
      anomalyType: 'inconsistent_format',
      severity: 'medium',
      confidence: 0.8,
      title: `Mixed data types in ${column.name}`,
      description: `Column ${column.name} contains mixed data types (numbers, text, etc.)`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      recommendations: [
        {
          action: 'Standardize data types in column',
          impact: 'Consistent data format for reliable calculations',
          effort: 'medium',
          priority: 'high',
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Create invalid value insight
   */
  private createInvalidValueInsight(
    column: DataColumn,
    invalidIndices: number[],
    stats: ColumnStats,
    request: InsightRequest
  ): AnomalyInsight {
    const affectedPercentage = (invalidIndices.length / stats.count) * 100;

    return {
      id: uuidv4(),
      type: 'anomaly',
      anomalyType: 'invalid_value',
      severity: 'high',
      confidence: 0.95,
      title: `Invalid values in ${column.name}`,
      description: `${invalidIndices.length} invalid values (errors, N/A) in column ${column.name}`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      affectedPercentage,
      recommendations: [
        {
          action: 'Fix errors or replace with valid values',
          impact: 'Valid data for calculations',
          effort: 'medium',
          priority: 'high',
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Create correlation insight
   */
  private createCorrelationInsight(
    col1: DataColumn,
    col2: DataColumn,
    correlation: number,
    request: InsightRequest
  ): RelationshipInsight {
    const strength: 'weak' | 'moderate' | 'strong' =
      Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.5 ? 'moderate' : 'weak';

    return {
      id: uuidv4(),
      type: 'relationship',
      relationshipType: 'correlation',
      severity: 'info',
      confidence: Math.abs(correlation),
      title: `Correlation between ${col1.name} and ${col2.name}`,
      description: `${strength.charAt(0).toUpperCase() + strength.slice(1)} ${correlation > 0 ? 'positive' : 'negative'} correlation (r=${correlation.toFixed(2)})`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      primaryRange: col1.range,
      relatedRange: col2.range,
      correlation,
      strength,
      direction: correlation > 0 ? 'positive' : 'negative',
      evidence: [
        {
          type: 'statistical',
          description: `Pearson correlation coefficient`,
          metrics: { correlation },
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Create trend insight
   */
  private createTrendInsight(
    column: DataColumn,
    trend: { direction: string; slope: number; confidence: number },
    request: InsightRequest
  ): PredictionInsight {
    return {
      id: uuidv4(),
      type: 'prediction',
      predictionType: 'trend',
      severity: 'info',
      confidence: trend.confidence,
      title: `${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)} trend in ${column.name}`,
      description: `Data shows ${trend.direction} trend (slope=${trend.slope.toFixed(2)})`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      model: 'Linear Regression',
      modelMetrics: {
        r2: trend.confidence,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Create forecast insight
   */
  private createForecastInsight(
    column: DataColumn,
    forecast: { predictions: PredictionValue[]; confidence: number },
    request: InsightRequest
  ): PredictionInsight {
    return {
      id: uuidv4(),
      type: 'prediction',
      predictionType: 'forecast',
      severity: 'info',
      confidence: forecast.confidence,
      title: `Forecast for ${column.name}`,
      description: `Predicted ${forecast.predictions.length} future values`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      predictions: forecast.predictions,
      model: 'Linear Extrapolation',
      timeHorizon: `${forecast.predictions.length} periods`,
      historicalRange: column.range,
      timestamp: Date.now(),
    };
  }

  /**
   * Create seasonal pattern insight
   */
  private createSeasonalPatternInsight(
    column: DataColumn,
    pattern: { frequency: number; strength: number },
    request: InsightRequest
  ): PatternInsight {
    return {
      id: uuidv4(),
      type: 'pattern',
      patternType: 'seasonal',
      severity: 'info',
      confidence: pattern.strength,
      title: `Seasonal pattern in ${column.name}`,
      description: `Detected repeating pattern with frequency ${pattern.frequency}`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      frequency: `Every ${pattern.frequency} periods`,
      strength: pattern.strength,
      timestamp: Date.now(),
    };
  }

  /**
   * Create quality insight
   */
  private createQualityInsight(
    column: DataColumn,
    stats: ColumnStats,
    qualityScore: number,
    request: InsightRequest
  ): QualityInsight {
    const severity: InsightSeverity =
      qualityScore < 0.5 ? 'high' : qualityScore < 0.7 ? 'medium' : 'low';

    const issues: string[] = [];
    if (stats.nullCount > 0) issues.push(`${stats.nullCount} missing values`);
    if (stats.dataType === 'mixed') issues.push('mixed data types');
    if (stats.uniqueCount < stats.count * 0.5) issues.push('low uniqueness');

    return {
      id: uuidv4(),
      type: 'quality',
      issueType: 'completeness',
      severity,
      confidence: 0.9,
      title: `Data quality issues in ${column.name}`,
      description: `Quality score ${(qualityScore * 100).toFixed(0)}%. Issues: ${issues.join(', ')}`,
      spreadsheetId: request.spreadsheetId,
      sheetName: request.sheetName,
      range: column.range,
      qualityScore,
      issueCount: issues.length,
      totalDataPoints: stats.count,
      recommendations: [
        {
          action: 'Address data quality issues',
          impact: 'Improved data reliability',
          effort: 'medium',
          priority: 'high',
        },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch data from spreadsheet (simulated)
   */
  private async fetchData(_request: InsightRequest): Promise<DataColumn[]> {
    // TODO: Integrate with GoogleAPIService to fetch real data
    // For now, return simulated data for testing

    return [
      {
        name: 'Column A',
        values: [10, 20, 30, 40, 200, 60, 70, 80, 90, 100], // Contains outlier
        range: 'A1:A10',
      },
      {
        name: 'Column B',
        values: [15, 25, 35, 45, null, 65, 75, 85, 95, 105], // Contains missing value
        range: 'B1:B10',
      },
    ];
  }

  /**
   * Build result object
   */
  private buildResult(
    insights: Insight[],
    request: InsightRequest,
    startTime: number
  ): InsightResult {
    const insightsByType: Record<InsightType, number> = {
      anomaly: 0,
      relationship: 0,
      prediction: 0,
      pattern: 0,
      quality: 0,
      optimization: 0,
    };

    const insightsBySeverity: Record<InsightSeverity, number> = {
      info: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    insights.forEach((insight) => {
      insightsByType[insight.type]++;
      insightsBySeverity[insight.severity]++;
    });

    return {
      insights,
      totalInsights: insights.length,
      insightsByType,
      insightsBySeverity,
      duration: Date.now() - startTime,
      spreadsheetId: request.spreadsheetId,
      sheetsAnalyzed: request.sheetName ? [request.sheetName] : [],
      rowsAnalyzed: 0, // TODO: Track actual rows
      columnsAnalyzed: 0, // TODO: Track actual columns
    };
  }

  /**
   * Empty result
   */
  private emptyResult(request: InsightRequest, startTime: number): InsightResult {
    return {
      insights: [],
      totalInsights: 0,
      insightsByType: {
        anomaly: 0,
        relationship: 0,
        prediction: 0,
        pattern: 0,
        quality: 0,
        optimization: 0,
      },
      insightsBySeverity: {
        info: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      duration: Date.now() - startTime,
      spreadsheetId: request.spreadsheetId,
      sheetsAnalyzed: [],
      rowsAnalyzed: 0,
      columnsAnalyzed: 0,
    };
  }

  /**
   * Update statistics
   */
  private updateStats(insights: Insight[], data: DataColumn[]): void {
    this.stats.totalInsights += insights.length;

    insights.forEach((insight) => {
      this.stats.insightsByType[insight.type]++;
      this.stats.insightsBySeverity[insight.severity]++;
    });

    // Update average confidence
    const totalConfidence = insights.reduce((sum, i) => sum + i.confidence, 0);
    this.stats.avgConfidence =
      (this.stats.avgConfidence * (this.stats.totalInsights - insights.length) +
        totalConfidence) /
      this.stats.totalInsights;

    this.stats.rowsAnalyzed += data[0]?.values.length || 0;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(request: InsightRequest): string {
    return `${request.spreadsheetId}-${request.sheetName || 'all'}-${request.range || 'all'}-${(request.insightTypes || []).join(',')}`;
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(`[InsightsService] ${message}`); // Debugging output when verboseLogging enabled
    }
  }

  /**
   * Get service statistics
   */
  getStats(): InsightsServiceStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalInsights: 0,
      insightsByType: {
        anomaly: 0,
        relationship: 0,
        prediction: 0,
        pattern: 0,
        quality: 0,
        optimization: 0,
      },
      insightsBySeverity: {
        info: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      avgConfidence: 0,
      totalRequests: 0,
      avgGenerationTime: 0,
      cacheHitRate: 0,
      spreadsheetsAnalyzed: 0,
      rowsAnalyzed: 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.insightCache.clear();
  }
}

// Singleton instance
let insightsServiceInstance: InsightsService | null = null;

/**
 * Get insights service instance
 */
export function getInsightsService(config?: InsightsServiceConfig): InsightsService {
  if (!insightsServiceInstance) {
    insightsServiceInstance = new InsightsService(config);
  }
  return insightsServiceInstance;
}
