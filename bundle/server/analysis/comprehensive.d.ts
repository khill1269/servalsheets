/**
 * ServalSheets - Comprehensive Analysis Engine
 *
 * ONE TOOL TO RULE THEM ALL
 *
 * This replaces the need to call:
 * - sheets_core (metadata)
 * - sheets_data (data reading)
 * - multiple sheets_analyze actions (quality, patterns, formulas, performance)
 *
 * Single call provides:
 * - Spreadsheet metadata & structure
 * - All sheet data (sampled or full based on size)
 * - Data quality analysis
 * - Statistical analysis
 * - Pattern detection (trends, anomalies, correlations)
 * - Formula analysis & optimization
 * - Performance recommendations
 * - Visualization suggestions
 * - Natural language summary
 *
 * @see MCP Protocol 2025-11-25
 * @see Google Sheets API v4
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Comprehensive analysis configuration
 */
export interface ComprehensiveConfig {
    /** Include formula analysis */
    includeFormulas?: boolean;
    /** Include visualization recommendations */
    includeVisualizations?: boolean;
    /** Include performance analysis */
    includePerformance?: boolean;
    /** Force full data retrieval (vs sampling) */
    forceFullData?: boolean;
    /** Maximum rows before sampling kicks in */
    samplingThreshold?: number;
    /** Sample size when sampling */
    sampleSize?: number;
    /** Specific sheet to analyze (undefined = all sheets) */
    sheetId?: number;
    /** Additional context for AI analysis */
    context?: string;
    /** Pagination cursor (format: "sheet:N") */
    cursor?: string;
    /** Page size for pagination (default: 5 sheets) */
    pageSize?: number;
}
/**
 * Column statistics
 */
export interface ColumnStats {
    name: string;
    index: number;
    dataType: 'number' | 'text' | 'date' | 'boolean' | 'mixed' | 'empty';
    count: number;
    nullCount: number;
    uniqueCount: number;
    completeness: number;
    sum?: number;
    mean?: number;
    median?: number;
    stdDev?: number;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    avgLength?: number;
}
/**
 * Data quality issue
 */
export interface QualityIssue {
    type: string;
    severity: 'low' | 'medium' | 'high';
    location: string;
    description: string;
    autoFixable: boolean;
    fixSuggestion?: string;
}
/**
 * Trend detection result
 */
export interface TrendResult {
    column: string;
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile' | 'seasonal';
    confidence: number;
    changeRate: string;
    description: string;
}
/**
 * Anomaly detection result
 */
export interface AnomalyResult {
    location: string;
    value: unknown;
    expectedRange: string;
    severity: 'low' | 'medium' | 'high';
    zScore: number;
}
/**
 * Correlation result
 */
export interface CorrelationResult {
    columns: [string, string];
    coefficient: number;
    strength: 'none' | 'weak' | 'moderate' | 'strong' | 'very_strong';
    direction: 'positive' | 'negative';
}
/**
 * Formula analysis result
 */
export interface FormulaInfo {
    cell: string;
    formula: string;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    volatileFunctions: string[];
    dependencies: string[];
    issues: string[];
    optimization?: string;
}
/**
 * Visualization recommendation
 */
export interface VisualizationRecommendation {
    chartType: string;
    suitabilityScore: number;
    reasoning: string;
    suggestedConfig: {
        title: string;
        xAxis?: string;
        yAxis?: string;
        series?: string[];
    };
    executionParams: {
        tool: 'sheets_visualize';
        action: 'create';
        params: Record<string, unknown>;
    };
}
/**
 * Performance recommendation
 */
export interface PerformanceRecommendation {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
    recommendation: string;
}
/**
 * Sheet analysis result (per sheet)
 */
export interface SheetAnalysis {
    sheetId: number;
    sheetName: string;
    rowCount: number;
    columnCount: number;
    dataRowCount: number;
    columns: ColumnStats[];
    qualityScore: number;
    completeness: number;
    consistency: number;
    issues: QualityIssue[];
    trends: TrendResult[];
    anomalies: AnomalyResult[];
    correlations: CorrelationResult[];
    formulas?: {
        total: number;
        unique: number;
        volatile: number;
        complex: number;
        issues: FormulaInfo[];
    };
}
/**
 * Complete comprehensive analysis result
 */
export interface ComprehensiveResult {
    success: true;
    action: 'comprehensive';
    spreadsheet: {
        id: string;
        title: string;
        locale: string;
        timeZone: string;
        lastModified?: string;
        owner?: string;
        sheetCount: number;
        totalRows: number;
        totalColumns: number;
        totalCells: number;
        namedRanges: Array<{
            name: string;
            range: string;
        }>;
    };
    sheets: SheetAnalysis[];
    aggregate: {
        totalDataRows: number;
        totalFormulas: number;
        overallQualityScore: number;
        overallCompleteness: number;
        totalIssues: number;
        totalAnomalies: number;
        totalTrends: number;
        totalCorrelations: number;
    };
    visualizations?: VisualizationRecommendation[];
    performance?: {
        score: number;
        recommendations: PerformanceRecommendation[];
    };
    summary: string;
    topInsights: string[];
    executionPath: 'sample' | 'full' | 'streaming';
    duration: number;
    apiCalls: number;
    dataRetrieved: {
        tier: 1 | 2 | 3 | 4;
        rowsAnalyzed: number;
        samplingUsed: boolean;
    };
    nextCursor?: string;
    hasMore?: boolean;
    resourceUri?: string;
}
/**
 * Comprehensive Analysis Engine
 *
 * Performs complete spreadsheet analysis in a single operation
 */
export declare class ComprehensiveAnalyzer {
    private sheetsApi;
    private tieredRetrieval;
    private config;
    private apiCallCount;
    constructor(sheetsApi: sheets_v4.Sheets, config?: ComprehensiveConfig);
    /**
     * Execute comprehensive analysis
     */
    analyze(spreadsheetId: string): Promise<ComprehensiveResult>;
    /**
     * Get spreadsheet info
     */
    private getSpreadsheetInfo;
    /**
     * Format GridRange to A1 notation
     */
    private formatRange;
    /**
     * Convert column index to letter
     */
    private columnToLetter;
    /**
     * Analyze a single sheet
     */
    private analyzeSheet;
    /**
     * Analyze columns for statistics
     */
    private analyzeColumns;
    /**
     * Analyze data quality
     */
    private analyzeQuality;
    /**
     * Detect trends in data
     */
    private detectTrends;
    /**
     * Detect anomalies in data
     */
    private detectAnomaliesEnhanced;
    /**
     * Detect correlations between columns
     */
    private detectCorrelations;
    /**
     * Enrich analysis with formula information
     */
    private enrichWithFormulas;
    /**
     * Detect volatile functions in formula
     */
    private detectVolatileFunctions;
    /**
     * Calculate formula complexity
     */
    private calculateFormulaComplexity;
    /**
     * Calculate nesting level of formula
     */
    private calculateNestingLevel;
    /**
     * Analyze formula for issues
     */
    private analyzeFormulaIssues;
    /**
     * Suggest formula optimization
     */
    private suggestOptimization;
    /**
     * Extract cell dependencies from formula
     */
    private extractDependencies;
    /**
     * Generate visualization recommendations
     */
    private generateVisualizationRecommendations;
    /**
     * Analyze performance
     */
    private analyzePerformance;
    /**
     * Calculate aggregate statistics
     */
    private calculateAggregates;
    /**
     * Generate summary and insights
     */
    private generateSummary;
}
//# sourceMappingURL=comprehensive.d.ts.map