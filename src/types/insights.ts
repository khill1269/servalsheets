/**
 * ServalSheets - AI Insights Types
 *
 * Type definitions for advanced AI-powered insights:
 * - Anomaly detection
 * - Relationship discovery
 * - Predictive insights
 *
 * Phase 3, Task 3.3
 */

/**
 * Insight type categories
 */
export type InsightType =
  | 'anomaly'
  | 'relationship'
  | 'prediction'
  | 'pattern'
  | 'quality'
  | 'optimization';

/**
 * Severity level for insights
 */
export type InsightSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Confidence level for insights (0.0 - 1.0)
 */
export type ConfidenceLevel = number;

/**
 * Base insight interface
 */
export interface Insight {
  /** Unique insight ID */
  id: string;

  /** Insight type */
  type: InsightType;

  /** Severity level */
  severity: InsightSeverity;

  /** Confidence score (0.0 - 1.0) */
  confidence: ConfidenceLevel;

  /** Human-readable title */
  title: string;

  /** Detailed description */
  description: string;

  /** Affected spreadsheet ID */
  spreadsheetId?: string;

  /** Affected sheet name */
  sheetName?: string;

  /** Affected range (A1 notation) */
  range?: string;

  /** Affected cells or data points */
  affectedCells?: string[];

  /** Recommended actions */
  recommendations?: InsightRecommendation[];

  /** Supporting evidence/data */
  evidence?: InsightEvidence[];

  /** Related insights */
  relatedInsights?: string[];

  /** Timestamp when insight was generated */
  timestamp: number;

  /** Tags for categorization */
  tags?: string[];
}

/**
 * Recommended action for an insight
 */
export interface InsightRecommendation {
  /** Action description */
  action: string;

  /** Expected impact */
  impact: string;

  /** Effort level (low/medium/high) */
  effort: 'low' | 'medium' | 'high';

  /** Action priority */
  priority: 'low' | 'medium' | 'high';

  /** Tool/operation to execute */
  operation?: string;

  /** Parameters for the operation */
  params?: Record<string, unknown>;
}

/**
 * Evidence supporting an insight
 */
export interface InsightEvidence {
  /** Evidence type */
  type: 'statistical' | 'visual' | 'pattern' | 'comparison' | 'historical';

  /** Evidence description */
  description: string;

  /** Supporting data */
  data?: unknown;

  /** Statistical metrics */
  metrics?: Record<string, number>;
}

/**
 * Anomaly insight - detects outliers and unusual patterns
 */
export interface AnomalyInsight extends Insight {
  type: 'anomaly';

  /** Anomaly subtype */
  anomalyType:
    | 'outlier'
    | 'missing_data'
    | 'duplicate'
    | 'inconsistent_format'
    | 'invalid_value'
    | 'unexpected_pattern'
    | 'data_quality';

  /** Anomalous values */
  anomalousValues?: unknown[];

  /** Expected value or range */
  expectedValue?: unknown;

  /** Statistical deviation (e.g., z-score) */
  deviation?: number;

  /** Percentage of data affected */
  affectedPercentage?: number;
}

/**
 * Relationship insight - discovers correlations and dependencies
 */
export interface RelationshipInsight extends Insight {
  type: 'relationship';

  /** Relationship subtype */
  relationshipType:
    | 'correlation'
    | 'causation'
    | 'dependency'
    | 'pattern'
    | 'trend'
    | 'association';

  /** Primary column/range */
  primaryRange: string;

  /** Related column/range */
  relatedRange: string;

  /** Correlation coefficient (-1.0 to 1.0) */
  correlation?: number;

  /** Relationship strength (weak/moderate/strong) */
  strength: 'weak' | 'moderate' | 'strong';

  /** Relationship direction (positive/negative/none) */
  direction?: 'positive' | 'negative' | 'none';

  /** Statistical significance (p-value) */
  pValue?: number;
}

/**
 * Prediction insight - forecasts and trend analysis
 */
export interface PredictionInsight extends Insight {
  type: 'prediction';

  /** Prediction subtype */
  predictionType:
    | 'trend'
    | 'forecast'
    | 'classification'
    | 'recommendation'
    | 'risk';

  /** Predicted values */
  predictions?: PredictionValue[];

  /** Model used for prediction */
  model?: string;

  /** Model accuracy/confidence metrics */
  modelMetrics?: {
    accuracy?: number;
    rmse?: number;
    mae?: number;
    r2?: number;
  };

  /** Time horizon (for forecasts) */
  timeHorizon?: string;

  /** Historical data used */
  historicalRange?: string;
}

/**
 * Predicted value with confidence interval
 */
export interface PredictionValue {
  /** Predicted value */
  value: unknown;

  /** Lower confidence bound */
  lowerBound?: unknown;

  /** Upper confidence bound */
  upperBound?: unknown;

  /** Confidence level */
  confidence: number;

  /** Timestamp or period */
  timestamp?: string;
}

/**
 * Pattern insight - identifies recurring patterns
 */
export interface PatternInsight extends Insight {
  type: 'pattern';

  /** Pattern subtype */
  patternType:
    | 'seasonal'
    | 'cyclical'
    | 'recurring'
    | 'sequential'
    | 'structural';

  /** Pattern frequency */
  frequency?: string;

  /** Pattern strength (0.0 - 1.0) */
  strength: number;

  /** Pattern instances */
  instances?: PatternInstance[];
}

/**
 * Instance of a detected pattern
 */
export interface PatternInstance {
  /** Location of pattern */
  range: string;

  /** Pattern start */
  start: number | string;

  /** Pattern end */
  end: number | string;

  /** Pattern values */
  values?: unknown[];
}

/**
 * Data quality insight
 */
export interface QualityInsight extends Insight {
  type: 'quality';

  /** Quality issue type */
  issueType:
    | 'completeness'
    | 'accuracy'
    | 'consistency'
    | 'validity'
    | 'timeliness'
    | 'uniqueness';

  /** Quality score (0.0 - 1.0) */
  qualityScore: number;

  /** Number of issues found */
  issueCount: number;

  /** Total data points examined */
  totalDataPoints: number;
}

/**
 * Optimization insight
 */
export interface OptimizationInsight extends Insight {
  type: 'optimization';

  /** Optimization opportunity type */
  opportunityType:
    | 'performance'
    | 'cost'
    | 'structure'
    | 'formula'
    | 'storage'
    | 'workflow';

  /** Current state metrics */
  currentState?: Record<string, number>;

  /** Potential improvement */
  potentialImprovement?: Record<string, number>;

  /** Estimated benefit */
  estimatedBenefit?: string;
}

/**
 * Insight generation request
 */
export interface InsightRequest {
  /** Target spreadsheet ID */
  spreadsheetId: string;

  /** Target sheet name (optional) */
  sheetName?: string;

  /** Target range (optional) */
  range?: string;

  /** Types of insights to generate */
  insightTypes?: InsightType[];

  /** Minimum confidence threshold */
  minConfidence?: number;

  /** Maximum insights to return */
  maxInsights?: number;

  /** Include recommendations */
  includeRecommendations?: boolean;

  /** Context for insight generation */
  context?: Record<string, unknown>;
}

/**
 * Insight generation result
 */
export interface InsightResult {
  /** Generated insights */
  insights: Insight[];

  /** Total insights found */
  totalInsights: number;

  /** Insights by type */
  insightsByType: Record<InsightType, number>;

  /** Insights by severity */
  insightsBySeverity: Record<InsightSeverity, number>;

  /** Generation duration in ms */
  duration: number;

  /** Spreadsheet analyzed */
  spreadsheetId: string;

  /** Sheets analyzed */
  sheetsAnalyzed: string[];

  /** Rows analyzed */
  rowsAnalyzed: number;

  /** Columns analyzed */
  columnsAnalyzed: number;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  /** Enable outlier detection */
  detectOutliers?: boolean;

  /** Outlier threshold (z-score) */
  outlierThreshold?: number;

  /** Enable missing data detection */
  detectMissing?: boolean;

  /** Enable duplicate detection */
  detectDuplicates?: boolean;

  /** Enable format inconsistency detection */
  detectFormatInconsistencies?: boolean;

  /** Enable invalid value detection */
  detectInvalidValues?: boolean;

  /** Minimum sample size for analysis */
  minSampleSize?: number;
}

/**
 * Relationship discovery configuration
 */
export interface RelationshipDiscoveryConfig {
  /** Enable correlation analysis */
  detectCorrelations?: boolean;

  /** Minimum correlation threshold */
  minCorrelation?: number;

  /** Enable dependency detection */
  detectDependencies?: boolean;

  /** Enable pattern detection */
  detectPatterns?: boolean;

  /** Maximum columns to compare */
  maxColumnsToCompare?: number;
}

/**
 * Prediction configuration
 */
export interface PredictionConfig {
  /** Enable trend analysis */
  detectTrends?: boolean;

  /** Enable forecasting */
  enableForecasting?: boolean;

  /** Forecast periods */
  forecastPeriods?: number;

  /** Minimum historical data points */
  minHistoricalPoints?: number;

  /** Confidence level for predictions */
  confidenceLevel?: number;
}

/**
 * Insights service configuration
 */
export interface InsightsServiceConfig {
  /** Enable insights generation */
  enabled?: boolean;

  /** Anomaly detection config */
  anomalyDetection?: AnomalyDetectionConfig;

  /** Relationship discovery config */
  relationshipDiscovery?: RelationshipDiscoveryConfig;

  /** Prediction config */
  prediction?: PredictionConfig;

  /** Minimum confidence for insights */
  minConfidence?: number;

  /** Maximum insights per request */
  maxInsightsPerRequest?: number;

  /** Enable caching */
  enableCaching?: boolean;

  /** Cache TTL in milliseconds */
  cacheTtl?: number;

  /** Verbose logging */
  verboseLogging?: boolean;
}

/**
 * Insights service statistics
 */
export interface InsightsServiceStats {
  /** Total insights generated */
  totalInsights: number;

  /** Insights by type */
  insightsByType: Record<InsightType, number>;

  /** Insights by severity */
  insightsBySeverity: Record<InsightSeverity, number>;

  /** Average confidence score */
  avgConfidence: number;

  /** Total requests processed */
  totalRequests: number;

  /** Average generation time (ms) */
  avgGenerationTime: number;

  /** Cache hit rate */
  cacheHitRate?: number;

  /** Total spreadsheets analyzed */
  spreadsheetsAnalyzed: number;

  /** Total rows analyzed */
  rowsAnalyzed: number;
}
