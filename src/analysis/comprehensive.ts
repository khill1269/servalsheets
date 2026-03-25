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
import { TieredRetrieval } from './tiered-retrieval.js';
import { getCacheAdapter } from '../utils/cache-adapter.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../core/errors.js';
import {
  MAX_RESPONSE_SIZE_BYTES,
  // MAX_SHEETS_INLINE, // Reserved for future pagination use
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../config/constants.js';
import { storeAnalysisResult } from '../resources/analyze.js';
import type { AnalyzeResponse } from '../schemas/analyze.js';
import { sendProgress } from '../utils/request-context.js';

// Phase helpers (extracted pure functions)
import { columnToLetter, formatRange } from './phases/helpers.js';
import { analyzeColumns, analyzeQuality } from './phases/structure.js';
import { detectTrends, detectAnomaliesEnhanced, detectCorrelations } from './phases/patterns.js';
import {
  detectVolatileFunctions,
  calculateFormulaComplexity,
  analyzeFormulaIssues,
  suggestOptimization,
  extractDependencies,
} from './phases/formulas.js';
import {
  calculateAggregates,
  generateVisualizationRecommendations,
  analyzePerformance,
  generateSummary,
} from './phases/insights.js';

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
  /** Which method produced this correlation (Pearson=linear, Spearman=monotonic/non-linear) */
  method?: 'pearson' | 'spearman';
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
    action: 'chart_create';
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
    formulaDensity: number;
    chartCount: number;
    errorCellCount: number;
    pivotTableCount: number;
    dataValidationCount: number;
    conditionalFormatCount: number;
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

  // Data truncation notice (if rows or columns were limited)
  truncation?: {
    truncated: boolean;
    message: string;
    originalRows?: number;
    originalColumns?: number;
    analyzedRows: number;
    analyzedColumns: number;
  };
}

/**
 * Comprehensive Analysis Engine
 *
 * Performs complete spreadsheet analysis in a single operation.
 * Pure analysis logic lives in ./phases/ — this class owns only
 * instance state (API client, cache, config) and async I/O flows.
 */
export class ComprehensiveAnalyzer {
  private sheetsApi: sheets_v4.Sheets;
  private tieredRetrieval: TieredRetrieval;
  private config: Required<ComprehensiveConfig>;
  private apiCallCount: number = 0;
  private readonly metadataCache: ReturnType<typeof getCacheAdapter>;

  constructor(sheetsApi: sheets_v4.Sheets, config: ComprehensiveConfig = {}) {
    this.sheetsApi = sheetsApi;
    this.metadataCache = getCacheAdapter('analysis-metadata');
    this.tieredRetrieval = new TieredRetrieval({
      cache: getCacheAdapter('analysis'),
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
    await sendProgress(10, 100, 'Metadata loaded');

    // Determine which sheets to analyze
    let sheetsToAnalyze =
      this.config.sheetId !== undefined
        ? metadata.sheets.filter((s) => s.sheetId === this.config.sheetId)
        : metadata.sheets;

    if (sheetsToAnalyze.length === 0) {
      throw new NotFoundError(
        'sheet',
        this.config.sheetId !== undefined ? String(this.config.sheetId) : 'any'
      );
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
    await sendProgress(20, 100, 'Spreadsheet info loaded');

    // Step 3: Analyze each sheet (use paginated sheets)
    const sheetAnalyses: SheetAnalysis[] = [];
    let _totalDataRows = 0; // Accumulated but aggregate recalculates
    let executionPath: 'sample' | 'full' | 'streaming' = 'sample';
    let rowsAnalyzed = 0;
    let samplingUsed = false;

    // Track truncation for user notification
    let dataTruncated = false;
    let truncationOriginalRows = 0;
    let truncationOriginalCols = 0;
    let truncationAnalyzedRows = 0;
    let truncationAnalyzedCols = 0;
    const truncationReasons: string[] = [];

    // CRITICAL: Limit data to prevent 536MB string error
    const MAX_ROWS_PER_SHEET = 5000; // Hard limit to prevent massive results
    const MAX_COLS_PER_SHEET = 100; // Hard limit

    for (const sheet of paginatedSheets) {
      truncationOriginalRows += sheet.rowCount;
      truncationOriginalCols = Math.max(truncationOriginalCols, sheet.columnCount);

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
        dataTruncated = true;
        truncationReasons.push(
          `Sheet "${sheet.title}": sampled ${sampleSize} of ${sheet.rowCount} rows`
        );

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
        dataTruncated = true;
        truncationReasons.push(
          `Sheet "${sheet.title}": columns truncated from ${data[0].length} to ${MAX_COLS_PER_SHEET}`
        );
        data = data.map((row) => row.slice(0, MAX_COLS_PER_SHEET));
        logger.warn('Truncated columns to prevent oversized response', {
          sheetTitle: sheet.title,
          originalCols: data[0]!.length,
          truncatedTo: MAX_COLS_PER_SHEET,
        });
      }

      // CRITICAL: Truncate rows if too many (backup safety)
      if (data.length > MAX_ROWS_PER_SHEET) {
        dataTruncated = true;
        truncationReasons.push(
          `Sheet "${sheet.title}": rows truncated from ${data.length} to ${MAX_ROWS_PER_SHEET}`
        );
        data = data.slice(0, MAX_ROWS_PER_SHEET);
        logger.warn('Truncated rows to prevent oversized response', {
          sheetTitle: sheet.title,
          originalRows: data.length,
          truncatedTo: MAX_ROWS_PER_SHEET,
        });
      }

      rowsAnalyzed += data.length;
      truncationAnalyzedRows += data.length;
      truncationAnalyzedCols = Math.max(truncationAnalyzedCols, data[0]?.length ?? 0);

      // Analyze the sheet
      const analysis = await this.analyzeSheet(
        spreadsheetId,
        sheet,
        data,
        needsSampling ? sheet.rowCount : data.length
      );
      sheetAnalyses.push(analysis);
      _totalDataRows += analysis.dataRowCount;

      // Progress: 20–70% spread across paginated sheets (GC yield point between sheets)
      const sheetIdx = sheetAnalyses.length;
      const sheetProgress = Math.round(20 + (sheetIdx / paginatedSheets.length) * 50);
      await sendProgress(
        sheetProgress,
        100,
        `Analyzed sheet ${sheetIdx}/${paginatedSheets.length}: ${sheet.title}`
      );
    }

    // Step 4: Get formulas if requested
    if (this.config.includeFormulas) {
      await sendProgress(72, 100, 'Extracting formula analysis');
      await this.enrichWithFormulas(spreadsheetId, sheetAnalyses);
    }
    await sendProgress(75, 100, 'Calculating aggregates');

    // Step 5: Calculate aggregates
    const aggregate = calculateAggregates(sheetAnalyses);

    // Step 6: Generate visualization recommendations if requested
    let visualizations: VisualizationRecommendation[] | undefined;
    if (this.config.includeVisualizations && sheetAnalyses.length > 0) {
      await sendProgress(80, 100, 'Generating visualization recommendations');
      visualizations = generateVisualizationRecommendations(spreadsheetId, sheetAnalyses[0]!);
    }

    // Step 7: Generate performance recommendations if requested
    let performance: { score: number; recommendations: PerformanceRecommendation[] } | undefined;
    if (this.config.includePerformance) {
      await sendProgress(85, 100, 'Analyzing performance');
      performance = analyzePerformance(metadata, sheetAnalyses, aggregate);
    }

    await sendProgress(90, 100, 'Generating summary and insights');
    // Step 8: Generate summary and insights
    const { summary, topInsights } = generateSummary(
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
      // Include truncation notice so the user knows what they're looking at
      truncation: dataTruncated
        ? {
            truncated: true,
            message: `Data was limited for analysis. ${truncationReasons.join('. ')}. Use forceFullData=true or drill_down for complete data.`,
            originalRows: truncationOriginalRows,
            originalColumns: truncationOriginalCols,
            analyzedRows: truncationAnalyzedRows,
            analyzedColumns: truncationAnalyzedCols,
          }
        : undefined,
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
      const analysisId = storeAnalysisResult(spreadsheetId, result as unknown as AnalyzeResponse);
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
        const analysisId = storeAnalysisResult(spreadsheetId, result as unknown as AnalyzeResponse);
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
        const analysisId = storeAnalysisResult(spreadsheetId, result as unknown as AnalyzeResponse);
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
   * Get spreadsheet info with caching
   *
   * Cache TTL: 5 minutes (metadata rarely changes)
   */
  private async getSpreadsheetInfo(spreadsheetId: string): Promise<{
    locale?: string;
    timeZone?: string;
    lastModified?: string;
    owner?: string;
    namedRanges: Array<{ name: string; range: string }>;
  }> {
    const cacheKey = `spreadsheet-info:${spreadsheetId}`;

    // Check cache first
    const cached = this.metadataCache.get(cacheKey);
    if (cached) {
      logger.debug('Spreadsheet info cache hit', { spreadsheetId });
      return cached as {
        locale?: string;
        timeZone?: string;
        lastModified?: string;
        owner?: string;
        namedRanges: Array<{ name: string; range: string }>;
      };
    }

    logger.debug('Spreadsheet info cache miss - fetching', { spreadsheetId });

    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'properties,namedRanges',
      });

      const namedRanges = (response.data.namedRanges ?? []).map((nr) => ({
        name: nr.name ?? 'Unnamed',
        range: formatRange(nr.range),
      }));

      const result = {
        locale: response.data.properties?.locale ?? undefined,
        timeZone: response.data.properties?.timeZone ?? undefined,
        namedRanges,
      };

      // Cache for 5 minutes
      this.metadataCache.set(cacheKey, result, 5 * 60 * 1000);
      logger.debug('Cached spreadsheet info', { spreadsheetId });

      return result;
    } catch (error) {
      logger.warn('Failed to fetch spreadsheet metadata, returning empty named ranges', {
        error,
        spreadsheetId,
      });
      return { namedRanges: [] };
    }
  }

  /**
   * Analyze a single sheet
   */
  private async analyzeSheet(
    _spreadsheetId: string,
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
    const columns = analyzeColumns(headers, dataRows);

    // Check data quality
    const { qualityScore, completeness, consistency, issues } = analyzeQuality(
      headers,
      dataRows,
      columns
    );

    // Detect patterns
    const trends = detectTrends(headers, dataRows, columns);
    const anomalies = detectAnomaliesEnhanced(headers, dataRows, columns);
    const correlations = detectCorrelations(headers, dataRows, columns);

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
   * Enrich analysis with formula information
   *
   * Uses optimized field mask to fetch only formulas (not effectiveValue)
   * Caches formula data for 2 minutes
   */
  private async enrichWithFormulas(
    spreadsheetId: string,
    sheetAnalyses: SheetAnalysis[]
  ): Promise<void> {
    const cacheKey = `formulas:${spreadsheetId}`;

    // Check cache first
    let response = this.metadataCache.get(cacheKey) as sheets_v4.Schema$Spreadsheet | undefined;

    if (!response) {
      logger.debug('Formula data cache miss - fetching', { spreadsheetId });

      try {
        // Scope includeGridData to only the sheets being analyzed to avoid fetching the
        // entire workbook. Using sheet names as ranges (e.g. "'Sheet1'") tells the API to
        // include grid data only for those sheets; the field mask further limits to formulas.
        const sheetRanges = sheetAnalyses.map((a) => `'${a.sheetName.replace(/'/g, "''")}'`);
        const apiResponse = await this.sheetsApi.spreadsheets.get({
          spreadsheetId,
          ranges: sheetRanges.length > 0 ? sheetRanges : undefined,
          includeGridData: true,
          // Optimized field mask: fetch only formulas, not effectiveValue
          fields: 'sheets(properties.sheetId,data.rowData.values.userEnteredValue.formulaValue)',
        });
        this.apiCallCount++;

        response = apiResponse.data;

        // Cache formula data for 2 minutes
        this.metadataCache.set(cacheKey, response, 2 * 60 * 1000);
        logger.debug('Cached formula data', { spreadsheetId });
      } catch (error) {
        logger.warn('Failed to fetch formulas', { spreadsheetId, error });
        return;
      }
    } else {
      logger.debug('Formula data cache hit', { spreadsheetId });
    }

    try {
      for (const analysis of sheetAnalyses) {
        const sheetData = response.sheets?.find((s) => s.properties?.sheetId === analysis.sheetId);

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
              const volatileFunctions = detectVolatileFunctions(formula);
              if (volatileFunctions.length > 0) volatileCount++;

              // Calculate complexity
              const complexity = calculateFormulaComplexity(formula);
              if (complexity === 'complex' || complexity === 'very_complex') {
                complexCount++;

                const issues = analyzeFormulaIssues(formula);
                if (issues.length > 0 || volatileFunctions.length > 0) {
                  formulas.push({
                    cell: `${columnToLetter(colIndex)}${rowIndex + 1}`,
                    formula,
                    complexity,
                    volatileFunctions,
                    dependencies: extractDependencies(formula),
                    issues,
                    optimization: suggestOptimization(formula),
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
}
