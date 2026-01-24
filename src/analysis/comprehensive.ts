/**
 * ServalSheets - Comprehensive Analysis Engine
 *
 * ONE TOOL TO RULE THEM ALL
 *
 * This replaces the need to call:
 * - sheets_core (metadata)
 * - sheets_data (data reading)
 * - sheets_analysis (all 13 actions)
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
import { TieredRetrieval, type SheetMetadata } from './tiered-retrieval.js';
import { getHotCache } from '../utils/hot-cache.js';
import { logger } from '../utils/logger.js';
import {
  MAX_RESPONSE_SIZE_BYTES,
  // MAX_SHEETS_INLINE, // Reserved for future pagination use
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../config/constants.js';
import { storeAnalysisResult } from '../resources/analyze.js';

// Import analysis helpers
import { detectDataType } from './helpers.js';

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
  /** Timeout in milliseconds */
  timeoutMs?: number;
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
  // Numeric stats (if applicable)
  sum?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  // Text stats (if applicable)
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

  // Column-level analysis
  columns: ColumnStats[];

  // Data quality
  qualityScore: number;
  completeness: number;
  consistency: number;
  issues: QualityIssue[];

  // Patterns
  trends: TrendResult[];
  anomalies: AnomalyResult[];
  correlations: CorrelationResult[];

  // Formulas (if applicable)
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

  // Metadata (from sheets_core)
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
    namedRanges: Array<{ name: string; range: string }>;
  };

  // Per-sheet analysis
  sheets: SheetAnalysis[];

  // Aggregate statistics
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

  // Visualizations (if requested)
  visualizations?: VisualizationRecommendation[];

  // Performance (if requested)
  performance?: {
    score: number;
    recommendations: PerformanceRecommendation[];
  };

  // AI-generated summary
  summary: string;
  topInsights: string[];

  // Execution metadata
  executionPath: 'sample' | 'full' | 'streaming';
  duration: number;
  apiCalls: number;
  dataRetrieved: {
    tier: 1 | 2 | 3 | 4;
    rowsAnalyzed: number;
    samplingUsed: boolean;
  };

  // Pagination (MCP 2025-11-25)
  nextCursor?: string;
  hasMore?: boolean;

  // Resource URI (when response too large)
  resourceUri?: string;
}

/**
 * Comprehensive Analysis Engine
 *
 * Performs complete spreadsheet analysis in a single operation
 */
export class ComprehensiveAnalyzer {
  private sheetsApi: sheets_v4.Sheets;
  private tieredRetrieval: TieredRetrieval;
  private config: Required<ComprehensiveConfig>;
  private apiCallCount: number = 0;

  constructor(sheetsApi: sheets_v4.Sheets, config: ComprehensiveConfig = {}) {
    this.sheetsApi = sheetsApi;
    this.tieredRetrieval = new TieredRetrieval({
      cache: getHotCache(),
      sheetsApi,
      defaultSampleSize: config.sampleSize ?? 500,
      maxSampleSize: 1000,
    });

    this.config = {
      includeFormulas: config.includeFormulas ?? true,
      includeVisualizations: config.includeVisualizations ?? true,
      includePerformance: config.includePerformance ?? true,
      forceFullData: config.forceFullData ?? false,
      samplingThreshold: config.samplingThreshold ?? 10000,
      sampleSize: config.sampleSize ?? 500,
      sheetId: config.sheetId as number,
      context: config.context ?? '',
      cursor: config.cursor ?? '',
      pageSize: Math.min(config.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      timeoutMs: config.timeoutMs ?? 30000,
    };
  }

  /**
   * Execute comprehensive analysis
   */
  async analyze(spreadsheetId: string): Promise<ComprehensiveResult> {
    const startTime = Date.now();
    this.apiCallCount = 0;

    logger.info('Starting comprehensive analysis', {
      spreadsheetId,
      config: this.config,
    });

    // Step 1: Get metadata (Tier 1) - from sheets_core
    const metadata = await this.tieredRetrieval.getMetadata(spreadsheetId);
    this.apiCallCount++;

    // Determine which sheets to analyze
    let sheetsToAnalyze =
      this.config.sheetId !== undefined
        ? metadata.sheets.filter((s) => s.sheetId === this.config.sheetId)
        : metadata.sheets;

    if (sheetsToAnalyze.length === 0) {
      throw new Error(`No sheets found to analyze`);
    }

    // Parse cursor for pagination (format: "sheet:N")
    let startSheetIndex = 0;
    if (this.config.cursor) {
      const match = this.config.cursor.match(/^sheet:(\d+)$/);
      if (match) {
        startSheetIndex = parseInt(match[1]!, 10);
      }
    }

    // Apply pagination
    const pageSize = this.config.pageSize;
    const endSheetIndex = Math.min(startSheetIndex + pageSize, sheetsToAnalyze.length);
    const paginatedSheets = sheetsToAnalyze.slice(startSheetIndex, endSheetIndex);
    const hasMore = endSheetIndex < sheetsToAnalyze.length;
    const nextCursor = hasMore ? `sheet:${endSheetIndex}` : undefined;

    logger.info('Pagination applied', {
      totalSheets: sheetsToAnalyze.length,
      startIndex: startSheetIndex,
      endIndex: endSheetIndex,
      pageSize,
      hasMore,
    });

    // Step 2: Get full spreadsheet info for additional metadata
    const spreadsheetInfo = await this.getSpreadsheetInfo(spreadsheetId);
    this.apiCallCount++;

    // Step 3: Analyze each sheet (use paginated sheets)
    const sheetAnalyses: SheetAnalysis[] = [];
    let _totalDataRows = 0; // Accumulated but aggregate recalculates
    let executionPath: 'sample' | 'full' | 'streaming' = 'sample';
    let rowsAnalyzed = 0;
    let samplingUsed = false;

    // CRITICAL: Limit data to prevent 536MB string error
    const MAX_ROWS_PER_SHEET = 5000; // Hard limit to prevent massive results
    const MAX_COLS_PER_SHEET = 100; // Hard limit

    for (const sheet of paginatedSheets) {
      // Determine if we need sampling based on row count
      const needsSampling =
        sheet.rowCount > this.config.samplingThreshold && !this.config.forceFullData;

      // Get data (Tier 3 or 4) with hard limits
      let data: unknown[][];
      if (needsSampling || sheet.rowCount > MAX_ROWS_PER_SHEET) {
        // Force sampling for sheets > MAX_ROWS_PER_SHEET
        const sampleSize = Math.min(this.config.sampleSize, MAX_ROWS_PER_SHEET);
        const sampleResult = await this.tieredRetrieval.getSample(
          spreadsheetId,
          sheet.sheetId,
          sampleSize
        );
        data = sampleResult.sampleData.rows;
        samplingUsed = true;
        executionPath = 'sample';

        logger.info('Using sampling for large sheet', {
          sheetTitle: sheet.title,
          rowCount: sheet.rowCount,
          sampleSize,
        });
      } else {
        const fullResult = await this.tieredRetrieval.getFull(spreadsheetId, sheet.sheetId);
        data = fullResult.fullData.values;
        executionPath = sheet.rowCount > 50000 ? 'streaming' : 'full';
      }
      this.apiCallCount++;

      // CRITICAL: Truncate columns if too many
      if (data.length > 0 && data[0] && data[0].length > MAX_COLS_PER_SHEET) {
        data = data.map((row) => row.slice(0, MAX_COLS_PER_SHEET));
        logger.warn('Truncated columns to prevent oversized response', {
          sheetTitle: sheet.title,
          originalCols: data[0]!.length,
          truncatedTo: MAX_COLS_PER_SHEET,
        });
      }

      // CRITICAL: Truncate rows if too many (backup safety)
      if (data.length > MAX_ROWS_PER_SHEET) {
        data = data.slice(0, MAX_ROWS_PER_SHEET);
        logger.warn('Truncated rows to prevent oversized response', {
          sheetTitle: sheet.title,
          originalRows: data.length,
          truncatedTo: MAX_ROWS_PER_SHEET,
        });
      }

      rowsAnalyzed += data.length;

      // Analyze the sheet
      const analysis = await this.analyzeSheet(
        spreadsheetId,
        sheet,
        data,
        needsSampling ? sheet.rowCount : data.length
      );
      sheetAnalyses.push(analysis);
      _totalDataRows += analysis.dataRowCount;
    }

    // Step 4: Get formulas if requested
    if (this.config.includeFormulas) {
      await this.enrichWithFormulas(spreadsheetId, sheetAnalyses);
    }

    // Step 5: Calculate aggregates
    const aggregate = this.calculateAggregates(sheetAnalyses);

    // Step 6: Generate visualization recommendations if requested
    let visualizations: VisualizationRecommendation[] | undefined;
    if (this.config.includeVisualizations && sheetAnalyses.length > 0) {
      visualizations = this.generateVisualizationRecommendations(spreadsheetId, sheetAnalyses[0]!);
    }

    // Step 7: Generate performance recommendations if requested
    let performance: { score: number; recommendations: PerformanceRecommendation[] } | undefined;
    if (this.config.includePerformance) {
      performance = this.analyzePerformance(metadata, sheetAnalyses, aggregate);
    }

    // Step 8: Generate summary and insights
    const { summary, topInsights } = this.generateSummary(
      metadata,
      sheetAnalyses,
      aggregate,
      performance
    );

    const duration = Date.now() - startTime;

    logger.info('Comprehensive analysis complete', {
      spreadsheetId,
      duration,
      sheetsAnalyzed: sheetAnalyses.length,
      rowsAnalyzed,
      apiCalls: this.apiCallCount,
      paginated: hasMore,
    });

    const result: ComprehensiveResult = {
      success: true,
      action: 'comprehensive',
      spreadsheet: {
        id: spreadsheetId,
        title: metadata.title,
        locale: spreadsheetInfo.locale ?? 'en_US',
        timeZone: spreadsheetInfo.timeZone ?? 'America/New_York',
        lastModified: spreadsheetInfo.lastModified,
        owner: spreadsheetInfo.owner,
        sheetCount: metadata.sheets.length,
        totalRows: metadata.sheets.reduce((sum, s) => sum + s.rowCount, 0),
        totalColumns: metadata.sheets.reduce((sum, s) => sum + s.columnCount, 0),
        totalCells: metadata.sheets.reduce((sum, s) => sum + s.rowCount * s.columnCount, 0),
        namedRanges: spreadsheetInfo.namedRanges,
      },
      sheets: sheetAnalyses,
      aggregate,
      visualizations,
      performance,
      summary,
      topInsights,
      executionPath,
      duration,
      apiCalls: this.apiCallCount,
      dataRetrieved: {
        tier: samplingUsed ? 3 : 4,
        rowsAnalyzed,
        samplingUsed,
      },
      nextCursor,
      hasMore,
    };

    // Check response size and use resource URI if too large (MCP 2025-11-25)
    // IMPORTANT: Estimate size BEFORE stringifying to avoid V8 string length limit (536MB)

    // Estimate response size based on data structure
    const totalDataRows = result.sheets.reduce((sum, sheet) => sum + sheet.dataRowCount, 0);
    const totalColumns = result.sheets.reduce((sum, sheet) => sum + sheet.columns.length, 0);
    const totalIssues = result.sheets.reduce((sum, sheet) => sum + sheet.issues.length, 0);
    const totalTrends = result.sheets.reduce((sum, sheet) => sum + sheet.trends.length, 0);
    const totalAnomalies = result.sheets.reduce((sum, sheet) => sum + sheet.anomalies.length, 0);

    // Conservative estimate: each analysis object ~500 bytes, plus overhead
    const estimatedSizeBytes =
      totalDataRows * 50 + // Row count metadata
      totalColumns * 300 + // Column stats
      totalIssues * 200 + // Issues
      totalTrends * 150 + // Trends
      totalAnomalies * 150 + // Anomalies
      result.sheets.length * 2000 + // Per-sheet overhead
      100000; // Base overhead for spreadsheet metadata

    // If estimate exceeds 100MB (way below 536MB limit), store as resource immediately
    const SIZE_LIMIT_FOR_ESTIMATE = 100 * 1024 * 1024; // 100MB

    if (estimatedSizeBytes > SIZE_LIMIT_FOR_ESTIMATE) {
      logger.info('Response estimated too large, storing as resource without stringify check', {
        estimatedSizeBytes,
        estimatedSizeMB: (estimatedSizeBytes / 1024 / 1024).toFixed(2),
        totalDataRows,
        sheetsCount: result.sheets.length,
      });

      // Store full result as resource
      const analysisId = storeAnalysisResult(spreadsheetId, result);
      const resourceUri = `analyze://results/${analysisId}`;

      // Return minimal response with resource URI
      return {
        success: true,
        action: 'comprehensive',
        spreadsheet: result.spreadsheet,
        sheets: [], // Empty - available via resource
        aggregate: result.aggregate,
        summary: `${result.summary} - Full results (estimated ${(estimatedSizeBytes / 1024 / 1024).toFixed(1)}MB) stored at ${resourceUri}`,
        topInsights: result.topInsights,
        executionPath: result.executionPath,
        duration: result.duration,
        apiCalls: result.apiCalls,
        dataRetrieved: result.dataRetrieved,
        nextCursor,
        hasMore,
        resourceUri,
      };
    }

    // For smaller responses, measure actual size
    try {
      const responseJson = JSON.stringify(result);
      const responseSizeBytes = responseJson.length;

      if (responseSizeBytes > MAX_RESPONSE_SIZE_BYTES) {
        logger.info('Response too large, storing as resource', {
          sizeBytes: responseSizeBytes,
          sizeMB: (responseSizeBytes / 1024 / 1024).toFixed(2),
          maxBytes: MAX_RESPONSE_SIZE_BYTES,
        });

        // Store full result as resource
        const analysisId = storeAnalysisResult(spreadsheetId, result);
        const resourceUri = `analyze://results/${analysisId}`;

        // Return minimal response with resource URI
        return {
          success: true,
          action: 'comprehensive',
          spreadsheet: result.spreadsheet,
          sheets: [], // Empty - available via resource
          aggregate: result.aggregate,
          summary: `${result.summary} - Full results (${(responseSizeBytes / 1024 / 1024).toFixed(1)}MB) stored at ${resourceUri}`,
          topInsights: result.topInsights,
          executionPath: result.executionPath,
          duration: result.duration,
          apiCalls: result.apiCalls,
          dataRetrieved: result.dataRetrieved,
          nextCursor,
          hasMore,
          resourceUri,
        };
      }
    } catch (error) {
      // Catch V8 string length limit errors (Cannot create a string longer than 0x1fffffe8 characters)
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('string longer than') || errorMessage.includes('0x1fffffe8')) {
        logger.error('Response exceeded V8 string length limit, storing as resource', {
          error: errorMessage,
          totalDataRows,
          sheetsCount: result.sheets.length,
        });

        // Store full result as resource
        const analysisId = storeAnalysisResult(spreadsheetId, result);
        const resourceUri = `analyze://results/${analysisId}`;

        // Return minimal response with resource URI
        return {
          success: true,
          action: 'comprehensive',
          spreadsheet: result.spreadsheet,
          sheets: [], // Empty - available via resource
          aggregate: result.aggregate,
          summary: `${result.summary} - Full results (very large) stored at ${resourceUri}`,
          topInsights: result.topInsights,
          executionPath: result.executionPath,
          duration: result.duration,
          apiCalls: result.apiCalls,
          dataRetrieved: result.dataRetrieved,
          nextCursor,
          hasMore,
          resourceUri,
        };
      }

      logger.warn('Failed to check response size', {
        error: errorMessage,
      });
    }

    return result;
  }

  /**
   * Get spreadsheet info
   */
  private async getSpreadsheetInfo(spreadsheetId: string): Promise<{
    locale?: string;
    timeZone?: string;
    lastModified?: string;
    owner?: string;
    namedRanges: Array<{ name: string; range: string }>;
  }> {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'properties,namedRanges',
      });

      const namedRanges = (response.data.namedRanges ?? []).map((nr) => ({
        name: nr.name ?? 'Unnamed',
        range: this.formatRange(nr.range),
      }));

      return {
        locale: response.data.properties?.locale ?? undefined,
        timeZone: response.data.properties?.timeZone ?? undefined,
        namedRanges,
      };
    } catch {
      return { namedRanges: [] };
    }
  }

  /**
   * Format GridRange to A1 notation
   */
  private formatRange(range?: sheets_v4.Schema$GridRange): string {
    if (!range) return 'Unknown';
    const startCol = this.columnToLetter(range.startColumnIndex ?? 0);
    const endCol = this.columnToLetter((range.endColumnIndex ?? 1) - 1);
    const startRow = (range.startRowIndex ?? 0) + 1;
    const endRow = range.endRowIndex ?? startRow;
    return `${startCol}${startRow}:${endCol}${endRow}`;
  }

  /**
   * Convert column index to letter
   */
  private columnToLetter(index: number): string {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  /**
   * Analyze a single sheet
   */
  private async analyzeSheet(
    spreadsheetId: string,
    sheet: {
      sheetId: number;
      title: string;
      rowCount: number;
      columnCount: number;
    },
    data: unknown[][],
    actualRowCount: number
  ): Promise<SheetAnalysis> {
    if (data.length === 0) {
      return {
        sheetId: sheet.sheetId,
        sheetName: sheet.title,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        dataRowCount: 0,
        columns: [],
        qualityScore: 0,
        completeness: 0,
        consistency: 0,
        issues: [],
        trends: [],
        anomalies: [],
        correlations: [],
      };
    }

    // Extract headers and data
    const headers = data[0]?.map(String) ?? [];
    const dataRows = data.slice(1);
    const dataRowCount = actualRowCount - 1; // Exclude header

    // Analyze columns
    const columns = this.analyzeColumns(headers, dataRows);

    // Check data quality
    const { qualityScore, completeness, consistency, issues } = this.analyzeQuality(
      headers,
      dataRows,
      columns
    );

    // Detect patterns
    const trends = this.detectTrends(headers, dataRows, columns);
    const anomalies = this.detectAnomaliesEnhanced(headers, dataRows, columns);
    const correlations = this.detectCorrelations(headers, dataRows, columns);

    return {
      sheetId: sheet.sheetId,
      sheetName: sheet.title,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      dataRowCount,
      columns,
      qualityScore,
      completeness,
      consistency,
      issues,
      trends,
      anomalies,
      correlations,
    };
  }

  /**
   * Analyze columns for statistics
   */
  private analyzeColumns(headers: string[], dataRows: unknown[][]): ColumnStats[] {
    return headers.map((header, index) => {
      const values = dataRows.map((row) => row[index]);
      const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
      const detectedType = detectDataType(values);

      // Map detectDataType results to ColumnStats enum
      const dataType: ColumnStats['dataType'] =
        detectedType === 'email' || detectedType === 'url' || detectedType === 'unknown'
          ? 'text'
          : (detectedType as ColumnStats['dataType']);

      const stats: ColumnStats = {
        name: header || `Column ${index + 1}`,
        index,
        dataType,
        count: values.length,
        nullCount: values.length - nonNullValues.length,
        uniqueCount: new Set(nonNullValues.map(String)).size,
        completeness: (nonNullValues.length / values.length) * 100,
      };

      // Add numeric stats if applicable
      if (dataType === 'number') {
        const numericValues = nonNullValues.map(Number).filter((n) => !isNaN(n));
        if (numericValues.length > 0) {
          const sorted = [...numericValues].sort((a, b) => a - b);
          stats.sum = numericValues.reduce((a, b) => a + b, 0);
          stats.mean = stats.sum / numericValues.length;
          stats.median = sorted[Math.floor(sorted.length / 2)] ?? 0;
          stats.min = sorted[0];
          stats.max = sorted[sorted.length - 1];

          // Standard deviation
          const variance =
            numericValues.reduce((sum, val) => sum + Math.pow(val - stats.mean!, 2), 0) /
            numericValues.length;
          stats.stdDev = Math.sqrt(variance);
        }
      }

      // Add text stats if applicable
      if (dataType === 'text') {
        const lengths = nonNullValues.map((v) => String(v).length);
        if (lengths.length > 0) {
          stats.minLength = Math.min(...lengths);
          stats.maxLength = Math.max(...lengths);
          stats.avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        }
      }

      return stats;
    });
  }

  /**
   * Analyze data quality
   */
  private analyzeQuality(
    headers: string[],
    dataRows: unknown[][],
    columns: ColumnStats[]
  ): {
    qualityScore: number;
    completeness: number;
    consistency: number;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    // Check for empty/duplicate headers
    headers.forEach((header, index) => {
      if (!header || header.trim() === '') {
        issues.push({
          type: 'EMPTY_HEADER',
          severity: 'high',
          location: `Column ${index + 1}`,
          description: `Column ${index + 1} has no header`,
          autoFixable: true,
          fixSuggestion: `Add header "Column${index + 1}"`,
        });
      }
    });

    const headerCounts = headers.reduce(
      (acc, h) => {
        acc[h] = (acc[h] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(headerCounts).forEach(([header, count]) => {
      if (count > 1 && header) {
        issues.push({
          type: 'DUPLICATE_HEADER',
          severity: 'medium',
          location: `Header: ${header}`,
          description: `Header "${header}" appears ${count} times`,
          autoFixable: true,
          fixSuggestion: `Rename duplicate headers to unique names`,
        });
      }
    });

    // Check columns for issues
    columns.forEach((col) => {
      // High null rate
      const nullRate = col.nullCount / col.count;
      if (nullRate > 0.5) {
        issues.push({
          type: 'HIGH_NULL_RATE',
          severity: nullRate > 0.8 ? 'high' : 'medium',
          location: col.name,
          description: `${(nullRate * 100).toFixed(1)}% of values are empty`,
          autoFixable: false,
          fixSuggestion: 'Consider removing column or filling missing values',
        });
      }

      // Mixed data types
      if (col.dataType === 'mixed') {
        issues.push({
          type: 'MIXED_DATA_TYPES',
          severity: 'medium',
          location: col.name,
          description: `Column contains mixed data types`,
          autoFixable: false,
          fixSuggestion: 'Standardize column to single data type',
        });
      }

      // Low uniqueness in text columns (potential categorical)
      if (col.dataType === 'text' && col.uniqueCount < 20 && col.count > 100) {
        issues.push({
          type: 'POTENTIAL_CATEGORICAL',
          severity: 'low',
          location: col.name,
          description: `Only ${col.uniqueCount} unique values - consider using data validation`,
          autoFixable: true,
          fixSuggestion: 'Add dropdown data validation for consistency',
        });
      }
    });

    // Check for duplicate rows
    const rowStrings = dataRows.map((row) => JSON.stringify(row));
    const uniqueRows = new Set(rowStrings);
    const duplicateCount = rowStrings.length - uniqueRows.size;
    if (duplicateCount > 0) {
      issues.push({
        type: 'DUPLICATE_ROWS',
        severity: duplicateCount > 10 ? 'high' : 'medium',
        location: 'Multiple rows',
        description: `${duplicateCount} duplicate rows found`,
        autoFixable: true,
        fixSuggestion: 'Remove duplicate rows',
      });
    }

    // Calculate scores
    const completeness =
      columns.length > 0
        ? columns.reduce((sum, col) => sum + col.completeness, 0) / columns.length
        : 0;

    const consistency =
      100 -
      (issues.filter((i) => i.severity === 'high').length * 15 +
        issues.filter((i) => i.severity === 'medium').length * 5);

    const qualityScore = Math.max(
      0,
      Math.min(100, completeness * 0.5 + Math.max(0, consistency) * 0.5)
    );

    return {
      qualityScore,
      completeness,
      consistency: Math.max(0, consistency),
      issues,
    };
  }

  /**
   * Detect trends in data
   */
  private detectTrends(
    headers: string[],
    dataRows: unknown[][],
    columns: ColumnStats[]
  ): TrendResult[] {
    const trends: TrendResult[] = [];

    columns.forEach((col, index) => {
      if (col.dataType !== 'number' || col.count < 5) return;

      const values = dataRows.map((row) => Number(row[index])).filter((n) => !isNaN(n));

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
   * Detect anomalies in data
   */
  private detectAnomaliesEnhanced(
    headers: string[],
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
   * Detect correlations between columns
   */
  private detectCorrelations(
    headers: string[],
    dataRows: unknown[][],
    columns: ColumnStats[]
  ): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];
    const numericColumns = columns.filter((c) => c.dataType === 'number' && c.mean !== undefined);

    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i]!;
        const col2 = numericColumns[j]!;

        const values1 = dataRows.map((row) => Number(row[col1.index])).filter((n) => !isNaN(n));
        const values2 = dataRows.map((row) => Number(row[col2.index])).filter((n) => !isNaN(n));

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

        if (absCoef > 0.3) {
          correlations.push({
            columns: [col1.name, col2.name],
            coefficient: Math.round(coefficient * 100) / 100,
            strength:
              absCoef > 0.8
                ? 'very_strong'
                : absCoef > 0.6
                  ? 'strong'
                  : absCoef > 0.4
                    ? 'moderate'
                    : 'weak',
            direction: coefficient > 0 ? 'positive' : 'negative',
          });
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  }

  /**
   * Enrich analysis with formula information
   */
  private async enrichWithFormulas(
    spreadsheetId: string,
    sheetAnalyses: SheetAnalysis[]
  ): Promise<void> {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        includeGridData: true,
        fields: 'sheets(properties,data(rowData(values(userEnteredValue,effectiveValue))))',
      });
      this.apiCallCount++;

      for (const analysis of sheetAnalyses) {
        const sheetData = response.data.sheets?.find(
          (s) => s.properties?.sheetId === analysis.sheetId
        );

        if (!sheetData?.data?.[0]?.rowData) continue;

        const formulas: FormulaInfo[] = [];
        let volatileCount = 0;
        let complexCount = 0;
        const uniqueFormulas = new Set<string>();

        sheetData.data[0].rowData.forEach((row, rowIndex) => {
          row.values?.forEach((cell, colIndex) => {
            const formula = cell.userEnteredValue?.formulaValue;
            if (formula) {
              uniqueFormulas.add(formula);

              // Detect volatile functions
              const volatileFunctions = this.detectVolatileFunctions(formula);
              if (volatileFunctions.length > 0) volatileCount++;

              // Calculate complexity
              const complexity = this.calculateFormulaComplexity(formula);
              if (complexity === 'complex' || complexity === 'very_complex') {
                complexCount++;

                const issues = this.analyzeFormulaIssues(formula);
                if (issues.length > 0 || volatileFunctions.length > 0) {
                  formulas.push({
                    cell: `${this.columnToLetter(colIndex)}${rowIndex + 1}`,
                    formula,
                    complexity,
                    volatileFunctions,
                    dependencies: this.extractDependencies(formula),
                    issues,
                    optimization: this.suggestOptimization(formula),
                  });
                }
              }
            }
          });
        });

        if (uniqueFormulas.size > 0) {
          analysis.formulas = {
            total: uniqueFormulas.size,
            unique: uniqueFormulas.size,
            volatile: volatileCount,
            complex: complexCount,
            issues: formulas.slice(0, 20), // Top 20 issues
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to analyze formulas', { error });
    }
  }

  /**
   * Detect volatile functions in formula
   */
  private detectVolatileFunctions(formula: string): string[] {
    const volatile = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'INDIRECT', 'OFFSET', 'INFO'];
    return volatile.filter((fn) => formula.toUpperCase().includes(fn + '('));
  }

  /**
   * Calculate formula complexity
   */
  private calculateFormulaComplexity(
    formula: string
  ): 'simple' | 'moderate' | 'complex' | 'very_complex' {
    const functionCount = (formula.match(/[A-Z]+\(/gi) || []).length;
    const nestedLevel = this.calculateNestingLevel(formula);
    const length = formula.length;

    if (functionCount > 10 || nestedLevel > 4 || length > 200) return 'very_complex';
    if (functionCount > 5 || nestedLevel > 2 || length > 100) return 'complex';
    if (functionCount > 2 || nestedLevel > 1 || length > 50) return 'moderate';
    return 'simple';
  }

  /**
   * Calculate nesting level of formula
   */
  private calculateNestingLevel(formula: string): number {
    let maxLevel = 0;
    let currentLevel = 0;
    for (const char of formula) {
      if (char === '(') {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
      } else if (char === ')') {
        currentLevel--;
      }
    }
    return maxLevel;
  }

  /**
   * Analyze formula for issues
   */
  private analyzeFormulaIssues(formula: string): string[] {
    const issues: string[] = [];

    // Check for full column references
    if (/[A-Z]:[A-Z]/i.test(formula)) {
      issues.push('Uses full column reference - may slow calculation');
    }

    // Check for VLOOKUP (suggest INDEX/MATCH)
    if (/VLOOKUP/i.test(formula)) {
      issues.push('VLOOKUP is slower than INDEX/MATCH');
    }

    // Check for hardcoded values
    if (/\d{4,}/.test(formula)) {
      issues.push('Contains hardcoded numbers - consider using named ranges');
    }

    return issues;
  }

  /**
   * Suggest formula optimization
   */
  private suggestOptimization(formula: string): string | undefined {
    if (/VLOOKUP/i.test(formula)) {
      return 'Consider using INDEX/MATCH for better performance';
    }
    if (/[A-Z]:[A-Z]/i.test(formula)) {
      return 'Use specific range instead of full column reference';
    }
    // OK: Explicit empty - no optimization suggestion for this formula
    return undefined;
  }

  /**
   * Extract cell dependencies from formula
   */
  private extractDependencies(formula: string): string[] {
    const cellRefs = formula.match(/\$?[A-Z]+\$?\d+/gi) || [];
    const rangeRefs = formula.match(/\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/gi) || [];
    return [...new Set([...cellRefs, ...rangeRefs])];
  }

  /**
   * Generate visualization recommendations
   */
  private generateVisualizationRecommendations(
    spreadsheetId: string,
    analysis: SheetAnalysis
  ): VisualizationRecommendation[] {
    const recommendations: VisualizationRecommendation[] = [];
    const numericCols = analysis.columns.filter((c) => c.dataType === 'number');
    const textCols = analysis.columns.filter((c) => c.dataType === 'text');

    // Time series / trend chart
    if (analysis.trends.length > 0 && numericCols.length > 0) {
      const trendCol = numericCols[0]!;
      recommendations.push({
        chartType: 'LINE',
        suitabilityScore: 90,
        reasoning: `Trends detected in ${analysis.trends.length} columns - line chart shows progression`,
        suggestedConfig: {
          title: `${trendCol.name} Trend`,
          xAxis: 'Row Index',
          yAxis: trendCol.name,
        },
        executionParams: {
          tool: 'sheets_visualize',
          action: 'create',
          params: {
            spreadsheetId,
            sheetId: analysis.sheetId,
            chartType: 'LINE',
            dataRange: `${analysis.sheetName}!A1:${this.columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
            title: `${trendCol.name} Trend Analysis`,
          },
        },
      });
    }

    // Category comparison (bar chart)
    if (textCols.length > 0 && numericCols.length > 0) {
      const catCol = textCols.find((c) => c.uniqueCount < 20) || textCols[0]!;
      const valCol = numericCols[0]!;
      recommendations.push({
        chartType: 'COLUMN',
        suitabilityScore: 85,
        reasoning: `Categorical data (${catCol.name}) with numeric values (${valCol.name}) - column chart compares categories`,
        suggestedConfig: {
          title: `${valCol.name} by ${catCol.name}`,
          xAxis: catCol.name,
          yAxis: valCol.name,
        },
        executionParams: {
          tool: 'sheets_visualize',
          action: 'create',
          params: {
            spreadsheetId,
            sheetId: analysis.sheetId,
            chartType: 'COLUMN',
            dataRange: `${analysis.sheetName}!A1:${this.columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
            title: `${valCol.name} by ${catCol.name}`,
          },
        },
      });
    }

    // Correlation scatter plot
    if (analysis.correlations.length > 0) {
      const topCorr = analysis.correlations[0]!;
      recommendations.push({
        chartType: 'SCATTER',
        suitabilityScore: 80,
        reasoning: `Strong correlation (${topCorr.coefficient}) between ${topCorr.columns[0]} and ${topCorr.columns[1]}`,
        suggestedConfig: {
          title: `${topCorr.columns[0]} vs ${topCorr.columns[1]}`,
          xAxis: topCorr.columns[0],
          yAxis: topCorr.columns[1],
        },
        executionParams: {
          tool: 'sheets_visualize',
          action: 'create',
          params: {
            spreadsheetId,
            sheetId: analysis.sheetId,
            chartType: 'SCATTER',
            dataRange: `${analysis.sheetName}!A1:${this.columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
            title: `Correlation: ${topCorr.columns[0]} vs ${topCorr.columns[1]}`,
          },
        },
      });
    }

    // Distribution (pie chart for categorical with few values)
    if (textCols.some((c) => c.uniqueCount <= 10 && c.uniqueCount > 1)) {
      const pieCol = textCols.find((c) => c.uniqueCount <= 10 && c.uniqueCount > 1)!;
      recommendations.push({
        chartType: 'PIE',
        suitabilityScore: 75,
        reasoning: `${pieCol.name} has ${pieCol.uniqueCount} categories - pie chart shows distribution`,
        suggestedConfig: {
          title: `${pieCol.name} Distribution`,
        },
        executionParams: {
          tool: 'sheets_visualize',
          action: 'create',
          params: {
            spreadsheetId,
            sheetId: analysis.sheetId,
            chartType: 'PIE',
            dataRange: `${analysis.sheetName}!A1:${this.columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
            title: `${pieCol.name} Distribution`,
          },
        },
      });
    }

    return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  /**
   * Analyze performance
   */
  private analyzePerformance(
    metadata: SheetMetadata,
    sheetAnalyses: SheetAnalysis[],
    _aggregate: { totalFormulas: number }
  ): { score: number; recommendations: PerformanceRecommendation[] } {
    const recommendations: PerformanceRecommendation[] = [];
    let penalties = 0;

    // Check total size
    const totalCells = metadata.sheets.reduce((sum, s) => sum + s.rowCount * s.columnCount, 0);
    if (totalCells > 5000000) {
      recommendations.push({
        type: 'LARGE_SPREADSHEET',
        severity: 'high',
        description: `Spreadsheet has ${(totalCells / 1000000).toFixed(1)}M cells`,
        impact: 'Slow load times and calculation',
        recommendation: 'Consider splitting into multiple spreadsheets',
      });
      penalties += 20;
    }

    // Check sheet count
    if (metadata.sheets.length > 20) {
      recommendations.push({
        type: 'TOO_MANY_SHEETS',
        severity: 'medium',
        description: `${metadata.sheets.length} sheets in spreadsheet`,
        impact: 'Navigation and loading complexity',
        recommendation: 'Consider consolidating or archiving unused sheets',
      });
      penalties += 10;
    }

    // Check volatile formulas
    const volatileCount = sheetAnalyses.reduce((sum, s) => sum + (s.formulas?.volatile ?? 0), 0);
    if (volatileCount > 10) {
      recommendations.push({
        type: 'VOLATILE_FORMULAS',
        severity: 'high',
        description: `${volatileCount} volatile formulas (NOW, TODAY, RAND, etc.)`,
        impact: 'Recalculates on every change',
        recommendation: 'Replace with static values or trigger-based updates',
      });
      penalties += 15;
    }

    // Check complex formulas
    const complexCount = sheetAnalyses.reduce((sum, s) => sum + (s.formulas?.complex ?? 0), 0);
    if (complexCount > 50) {
      recommendations.push({
        type: 'COMPLEX_FORMULAS',
        severity: 'medium',
        description: `${complexCount} complex/very complex formulas`,
        impact: 'Slow calculation times',
        recommendation: 'Simplify formulas or use helper columns',
      });
      penalties += 10;
    }

    const score = Math.max(0, 100 - penalties);

    return { score, recommendations };
  }

  /**
   * Calculate aggregate statistics
   */
  private calculateAggregates(sheetAnalyses: SheetAnalysis[]): {
    totalDataRows: number;
    totalFormulas: number;
    overallQualityScore: number;
    overallCompleteness: number;
    totalIssues: number;
    totalAnomalies: number;
    totalTrends: number;
    totalCorrelations: number;
  } {
    return {
      totalDataRows: sheetAnalyses.reduce((sum, s) => sum + s.dataRowCount, 0),
      totalFormulas: sheetAnalyses.reduce((sum, s) => sum + (s.formulas?.total ?? 0), 0),
      overallQualityScore:
        sheetAnalyses.length > 0
          ? sheetAnalyses.reduce((sum, s) => sum + s.qualityScore, 0) / sheetAnalyses.length
          : 0,
      overallCompleteness:
        sheetAnalyses.length > 0
          ? sheetAnalyses.reduce((sum, s) => sum + s.completeness, 0) / sheetAnalyses.length
          : 0,
      totalIssues: sheetAnalyses.reduce((sum, s) => sum + s.issues.length, 0),
      totalAnomalies: sheetAnalyses.reduce((sum, s) => sum + s.anomalies.length, 0),
      totalTrends: sheetAnalyses.reduce((sum, s) => sum + s.trends.length, 0),
      totalCorrelations: sheetAnalyses.reduce((sum, s) => sum + s.correlations.length, 0),
    };
  }

  /**
   * Generate summary and insights
   */
  private generateSummary(
    metadata: SheetMetadata,
    sheetAnalyses: SheetAnalysis[],
    aggregate: ReturnType<typeof this.calculateAggregates>,
    performance?: {
      score: number;
      recommendations: PerformanceRecommendation[];
    }
  ): { summary: string; topInsights: string[] } {
    const insights: string[] = [];

    // Quality insight
    if (aggregate.overallQualityScore >= 80) {
      insights.push(
        `✅ High data quality (${aggregate.overallQualityScore.toFixed(0)}%) - data is clean and consistent`
      );
    } else if (aggregate.overallQualityScore >= 60) {
      insights.push(
        `⚠️ Moderate data quality (${aggregate.overallQualityScore.toFixed(0)}%) - ${aggregate.totalIssues} issues found`
      );
    } else {
      insights.push(
        `❌ Low data quality (${aggregate.overallQualityScore.toFixed(0)}%) - ${aggregate.totalIssues} issues need attention`
      );
    }

    // Trends insight
    if (aggregate.totalTrends > 0) {
      const trendingCols = sheetAnalyses.flatMap((s) => s.trends.map((t) => t.column)).slice(0, 3);
      insights.push(`📈 ${aggregate.totalTrends} trend(s) detected in: ${trendingCols.join(', ')}`);
    }

    // Anomalies insight
    if (aggregate.totalAnomalies > 0) {
      insights.push(
        `🔍 ${aggregate.totalAnomalies} anomalies detected - review for data entry errors`
      );
    }

    // Correlations insight
    if (aggregate.totalCorrelations > 0) {
      const strongCorr = sheetAnalyses.flatMap((s) =>
        s.correlations.filter((c) => c.strength === 'strong' || c.strength === 'very_strong')
      );
      if (strongCorr.length > 0) {
        insights.push(
          `🔗 ${strongCorr.length} strong correlation(s) found - ${strongCorr[0]?.columns.join(' ↔ ')}`
        );
      }
    }

    // Performance insight
    if (performance && performance.score < 70) {
      insights.push(
        `⚡ Performance score: ${performance.score}% - ${performance.recommendations.length} optimization(s) recommended`
      );
    }

    // Formula insight
    if (aggregate.totalFormulas > 0) {
      const issueFormulas = sheetAnalyses.reduce(
        (sum, s) => sum + (s.formulas?.issues.length ?? 0),
        0
      );
      if (issueFormulas > 0) {
        insights.push(`📊 ${aggregate.totalFormulas} formulas, ${issueFormulas} need optimization`);
      }
    }

    const summary =
      `Analyzed "${metadata.title}" with ${metadata.sheets.length} sheet(s), ` +
      `${aggregate.totalDataRows.toLocaleString()} data rows. ` +
      `Quality score: ${aggregate.overallQualityScore.toFixed(0)}%. ` +
      `Found ${aggregate.totalTrends} trends, ${aggregate.totalAnomalies} anomalies, ` +
      `${aggregate.totalCorrelations} correlations, and ${aggregate.totalIssues} issues.`;

    return { summary, topInsights: insights.slice(0, 6) };
  }
}
