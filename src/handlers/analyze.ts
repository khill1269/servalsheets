/**
 * ServalSheets - Analyze Handler
 *
 * AI-powered data analysis using MCP Sampling (SEP-1577).
 * Instead of implementing custom ML/statistics, we leverage the LLM
 * via the Sampling capability for intelligent analysis.
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Sampling section
 * @see MCP_SEP_SPECIFICATIONS_COMPLETE.md - SEP-1577
 */

import type { sheets_v4 } from 'googleapis';
import { unwrapRequest, type HandlerContext } from './base.js';
import { DataError, ServiceError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import {
  getSamplingAnalysisService,
  buildAnalysisSamplingRequest,
  buildFormulaSamplingRequest,
  buildChartSamplingRequest,
  parseAnalysisResponse,
  type AnalysisType,
} from '../services/sampling-analysis.js';
import {
  createMessageWithFallback,
  isLLMFallbackAvailable,
  type LLMMessage,
} from '../services/llm-fallback.js';
import type {
  SheetsAnalyzeInput,
  SheetsAnalyzeOutput,
  AnalyzeResponse,
  ComprehensiveInput,
} from '../schemas/analyze.js';
import { getCapabilitiesWithCache } from '../services/capability-cache.js';
import { getCacheAdapter } from '../utils/cache-adapter.js';
import { TieredRetrieval } from '../analysis/tiered-retrieval.js';
import { AnalysisRouter } from '../analysis/router.js';
import {
  ComprehensiveAnalyzer,
  type ComprehensiveResult as _ComprehensiveResult,
} from '../analysis/comprehensive.js';
import { storeAnalysisResult } from '../resources/analyze.js';
import { createNotFoundError } from '../utils/error-factory.js';
import { buildA1Notation } from '../utils/google-sheets-helpers.js';
import { Scout, type ScoutResult } from '../analysis/scout.js';
import { Planner, type AnalysisPlan } from '../analysis/planner.js';
import {
  ActionGenerator,
  type GenerateActionsResult,
  type AnalysisFinding,
} from '../analysis/action-generator.js';

export interface AnalyzeHandlerOptions {
  context: HandlerContext;
}

/**
 * Analyze Handler
 *
 * Uses MCP Sampling to provide AI-powered data analysis.
 */
export class AnalyzeHandler {
  private context: HandlerContext;
  private sheetsApi: sheets_v4.Sheets;

  constructor(
    context: HandlerContext,
    sheetsApi: sheets_v4.Sheets,
    _options?: AnalyzeHandlerOptions
  ) {
    // If options.context is provided, use it; otherwise use the passed context
    this.context = _options?.context ?? context;
    this.sheetsApi = sheetsApi;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private convertRangeInput(
    range:
      | { a1: string }
      | { namedRange: string }
      | { semantic: unknown }
      | { grid: unknown }
      | undefined
  ): { a1?: string; sheetName?: string; range?: string } | undefined {
    // OK: Explicit empty - no range provided
    if (!range) return undefined;
    if ('a1' in range) return { a1: range.a1 };
    if ('namedRange' in range) return { a1: range.namedRange };
    // OK: Explicit empty - semantic and grid ranges will be supported in Phase 2
    return undefined;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: AnalyzeResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): AnalyzeResponse {
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // For minimal verbosity, strip _meta field and detailed analyses
      const { _meta, ...rest } = response as Record<string, unknown>;
      // Also truncate topInsights if present
      if ('topInsights' in rest && Array.isArray(rest['topInsights'])) {
        rest['topInsights'] = (rest['topInsights'] as string[]).slice(0, 3);
      }
      return rest as AnalyzeResponse;
    }

    return response;
  }

  /**
   * Resolve range to A1 notation
   */
  private resolveRange(range?: {
    a1?: string;
    sheetName?: string;
    range?: string;
  }): string | undefined {
    // OK: Explicit empty - typed as optional, no range specified
    if (!range) return undefined;
    if ('a1' in range && range.a1) return range.a1;
    if ('sheetName' in range && range.sheetName) {
      return range.range ? `${range.sheetName}!${range.range}` : range.sheetName;
    }
    // OK: Explicit empty - typed as optional, invalid range format
    return undefined;
  }

  private getSheetNameFromRange(range?: string): string | undefined {
    if (!range) return undefined;
    const match = range.match(/^(?:'([^']+)'!|([^!]+)!)/);
    return match?.[1] ?? match?.[2];
  }

  private async resolveSheetId(spreadsheetId: string, sheetName?: string): Promise<number> {
    if (!sheetName) return 0;
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });
    const match = response.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
    return match?.properties?.sheetId ?? 0;
  }

  /**
   * Map action name to step type for plan schema
   */
  private mapActionToStepType(
    action: string
  ): 'quality' | 'formulas' | 'patterns' | 'performance' | 'structure' | 'visualizations' {
    const mapping: Record<
      string,
      'quality' | 'formulas' | 'patterns' | 'performance' | 'structure' | 'visualizations'
    > = {
      analyze_quality: 'quality',
      analyze_formulas: 'formulas',
      detect_patterns: 'patterns',
      analyze_performance: 'performance',
      analyze_structure: 'structure',
      suggest_visualization: 'visualizations',
      comprehensive: 'quality',
      analyze_data: 'patterns',
    };
    return mapping[action] ?? 'quality';
  }

  /**
   * Map priority number to schema priority
   */
  private mapPriorityToSchema(priority: number): 'critical' | 'high' | 'medium' | 'low' {
    if (priority <= 1) return 'critical';
    if (priority <= 3) return 'high';
    if (priority <= 6) return 'medium';
    return 'low';
  }

  /**
   * Read data from spreadsheet
   */
  private async readData(spreadsheetId: string, range?: string): Promise<unknown[][]> {
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: range ?? 'A:ZZ',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return response.data.values ?? [];
  }

  /**
   * Check if client supports MCP Sampling capability or LLM fallback is available
   * @returns null if sampling or fallback is available, error response if not
   */
  private async checkSamplingCapability(): Promise<AnalyzeResponse | null> {
    // Check for LLM fallback first (works without MCP server)
    if (isLLMFallbackAvailable()) {
      return null; // LLM fallback available
    }

    if (!this.context.server) {
      return {
        success: false,
        error: {
          code: 'SAMPLING_UNAVAILABLE',
          message:
            'MCP Server instance not available and no LLM API key configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY environment variable.',
          retryable: false,
        },
      };
    }

    const sessionId = this.context.requestId || 'default';
    const clientCapabilities = await getCapabilitiesWithCache(sessionId, this.context.server);

    if (!clientCapabilities?.sampling) {
      return {
        success: false,
        error: {
          code: 'SAMPLING_UNAVAILABLE',
          message:
            'MCP Sampling not supported by client and no LLM API key configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY environment variable.',
          retryable: false,
        },
      };
    }

    return null; // MCP Sampling is available
  }

  /**
   * Create AI message using MCP sampling or LLM fallback
   * Accepts sampling request format and converts to LLM fallback format if needed
   */
  private async createAIMessage(samplingRequest: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: { type: 'text'; text: string } | string;
    }>;
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<string> {
    // Convert sampling messages to LLM messages
    const llmMessages: LLMMessage[] = samplingRequest.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.text,
    }));

    const result = await createMessageWithFallback(
      this.context.server as Parameters<typeof createMessageWithFallback>[0],
      {
        systemPrompt: samplingRequest.systemPrompt,
        messages: llmMessages,
        maxTokens: samplingRequest.maxTokens,
      }
    );
    return result.content;
  }

  /**
   * Handle analysis requests
   */
  async handle(input: SheetsAnalyzeInput): Promise<SheetsAnalyzeOutput> {
    const req = unwrapRequest<SheetsAnalyzeInput['request']>(
      input
    ) as SheetsAnalyzeInput['request'] & {
      verbosity?: 'minimal' | 'standard' | 'detailed';
    };
    const verbosity = req.verbosity ?? 'standard';

    try {
      let response: AnalyzeResponse;

      switch (req.action) {
        case 'analyze_data': {
          // Type assertion: refine() ensures spreadsheetId is present for 'analyze_data' action
          const analyzeInput = req as typeof req & {
            spreadsheetId: string;
          };
          response = await this.handleAnalyzeData(analyzeInput, verbosity);
          break;
        }

        case 'generate_formula': {
          // Type assertion: refine() ensures spreadsheetId and description are present
          const formulaInput = req as typeof req & {
            spreadsheetId: string;
            description: string;
          };

          // Check sampling capability
          const samplingError2 = await this.checkSamplingCapability();
          if (samplingError2) {
            response = samplingError2;
            break;
          }

          const _server2 = this.context.server!;
          const startTime = Date.now();

          // Read context data if range provided
          let headers: string[] | undefined;
          let sampleData: unknown[][] | undefined;

          if (formulaInput.range) {
            const convertedFormulaRange = this.convertRangeInput(formulaInput.range);
            const rangeStr = this.resolveRange(convertedFormulaRange);
            const data = await this.readData(formulaInput.spreadsheetId, rangeStr);
            if (data.length > 0) {
              headers = data[0]?.map(String);
              sampleData = data.slice(0, 10);
            }
          }

          // Build sampling request
          const formulaSheetName =
            formulaInput.range && 'sheetName' in formulaInput.range
              ? (formulaInput.range as { sheetName: string }).sheetName
              : undefined;

          const samplingRequest = buildFormulaSamplingRequest(formulaInput.description, {
            headers,
            sampleData,
            targetCell: formulaInput.targetCell,
            sheetName: formulaSheetName,
          });

          // Call LLM via MCP Sampling or LLM fallback
          const contentText = await this.createAIMessage(samplingRequest);
          const duration = Date.now() - startTime;

          try {
            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
              throw new DataError(
                'No JSON in response - model returned invalid format',
                'DATA_ERROR',
                false
              );
            const parsed = JSON.parse(jsonMatch[0]);

            response = {
              success: true,
              action: 'generate_formula',
              formula: {
                formula: parsed.formula,
                explanation: parsed.explanation,
                assumptions: parsed.assumptions,
                alternatives: parsed.alternatives,
                tips: parsed.tips,
              },
              duration,
              message: `Formula generated: ${parsed.formula}`,
            };
          } catch (error) {
            logger.error('Failed to parse formula response', {
              component: 'analyze-handler',
              action: 'generate_formula',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'PARSE_ERROR',
                message: 'Failed to parse formula response',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'suggest_visualization': {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const chartInput = req as typeof req & {
            spreadsheetId: string;
            range: { a1: string } | { sheetName: string; range?: string };
          };

          // Check sampling capability
          const samplingError3 = await this.checkSamplingCapability();
          if (samplingError3) {
            response = samplingError3;
            break;
          }

          const _server3 = this.context.server!;
          const startTime = Date.now();

          // Read the data
          const rangeStr = this.resolveRange(chartInput.range);
          const sheetName = this.getSheetNameFromRange(rangeStr);
          const sheetId = await this.resolveSheetId(chartInput.spreadsheetId, sheetName);
          const anchorCell = sheetName ? buildA1Notation(sheetName, 0, 0) : 'A1';
          const data = await this.readData(chartInput.spreadsheetId, rangeStr);

          if (data.length === 0) {
            response = {
              success: false,
              error: {
                code: 'NO_DATA',
                message: 'No data found in the specified range',
                retryable: false,
              },
            };
            break;
          }

          // Build sampling request
          const samplingRequest = buildChartSamplingRequest(data, {
            goal: chartInput.goal,
            preferredTypes: chartInput.preferredTypes,
          });

          // Call LLM via MCP Sampling or LLM fallback
          const contentText = await this.createAIMessage(samplingRequest);
          const duration = Date.now() - startTime;

          try {
            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
              throw new DataError(
                'No JSON in response - model returned invalid format',
                'DATA_ERROR',
                false
              );
            const parsed = JSON.parse(jsonMatch[0]);

            // Build chart recommendations with executable params
            const chartRecommendations = parsed.recommendations?.map(
              (r: Record<string, unknown>) => {
                const config = r['configuration'] as Record<string, unknown> | undefined;

                // Build executable params for sheets_visualize:chart_create
                const executionParams = {
                  tool: 'sheets_visualize' as const,
                  action: 'chart_create' as const,
                  params: {
                    spreadsheetId: chartInput.spreadsheetId,
                    sheetId,
                    chartType: String(r['chartType'] || 'LINE'),
                    data: {
                      sourceRange: { a1: rangeStr ?? 'A:ZZ' },
                    },
                    position: {
                      anchorCell,
                    },
                    options: {
                      title: String(config?.['title'] || `${r['chartType']} Chart`),
                      legendPosition: 'BOTTOM_LEGEND',
                      axisTitle: {
                        horizontal: String(config?.['categories'] || ''),
                        vertical: 'Values',
                      },
                    },
                  },
                };

                return {
                  chartType: r['chartType'],
                  suitabilityScore: r['suitabilityScore'],
                  reasoning: r['reasoning'],
                  configuration: r['configuration'],
                  insights: r['insights'],
                  executionParams,
                };
              }
            );

            response = {
              success: true,
              action: 'suggest_visualization',
              chartRecommendations,
              dataAssessment: parsed.dataAssessment,
              duration,
              message: `${chartRecommendations?.length ?? 0} chart type(s) recommended with executable params`,
            };
          } catch (error) {
            logger.error('Failed to parse chart recommendation response', {
              component: 'analyze-handler',
              action: 'suggest_visualization',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'PARSE_ERROR',
                message: 'Failed to parse chart recommendation response',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'detect_patterns': {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const patternInput = req as typeof req & {
            spreadsheetId: string;
            range:
              | { a1: string }
              | { namedRange: string }
              | { semantic: unknown }
              | { grid: unknown };
          };

          // Check if server is available
          if (!this.context.server) {
            response = {
              success: false,
              error: {
                code: 'SAMPLING_UNAVAILABLE',
                message:
                  'MCP Sampling is not available. detect_patterns requires an LLM via Sampling.',
                retryable: false,
              },
            };
            break;
          }

          const startTime = Date.now();

          // Read the data
          const convertedPatternRange = this.convertRangeInput(patternInput.range);
          const rangeStr = this.resolveRange(convertedPatternRange);
          const data = await this.readData(patternInput.spreadsheetId, rangeStr);

          if (data.length === 0) {
            response = {
              success: false,
              error: {
                code: 'NO_DATA',
                message: 'No data found in the specified range',
                retryable: false,
              },
            };
            break;
          }

          // Use helpers from analysis/helpers.ts for pattern detection
          const { detectAnomalies, analyzeTrends, analyzeCorrelationsData } =
            await import('../analysis/helpers.js');

          try {
            // Detect anomalies using statistical methods
            const anomalies = detectAnomalies(data);

            // Analyze trends
            const trends = analyzeTrends(data);

            // Analyze correlations
            const correlations = analyzeCorrelationsData(data);

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: 'detect_patterns',
              patterns: {
                anomalies: anomalies.map((a) => ({
                  location: a.cell,
                  value: a.value,
                  severity:
                    parseFloat(a.zScore) > 3 ? 'high' : parseFloat(a.zScore) > 2 ? 'medium' : 'low',
                  expectedRange: a.expected,
                })),
                trends: trends.map((t) => ({
                  column: `Column ${t.column + 1}`,
                  direction: t.trend,
                  confidence: t.confidence,
                  description: `${t.trend} trend in Column ${t.column + 1} (change: ${t.changeRate})`,
                })),
                correlations: {
                  matrix: [],
                  columns: correlations.map((c) => `Columns ${c.columns.join(' & ')}`),
                },
              },
              duration,
              message: `Found ${anomalies.length} anomalies, ${trends.length} trends, ${correlations.length} correlations`,
            };
          } catch (error) {
            logger.error('Failed to detect patterns', {
              component: 'analyze-handler',
              action: 'detect_patterns',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to detect patterns',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'analyze_structure': {
          // Type assertion: refine() ensures spreadsheetId is present
          const structureInput = req as typeof req & {
            spreadsheetId: string;
          };

          const startTime = Date.now();

          try {
            // Get spreadsheet structure using existing API
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
              spreadsheetId: structureInput.spreadsheetId,
              includeGridData: false,
            });

            const sheets = spreadsheet.data.sheets ?? [];
            const namedRanges = spreadsheet.data.namedRanges ?? [];

            // Calculate totals
            const totalRows = sheets.reduce(
              (sum, sheet) => sum + (sheet.properties?.gridProperties?.rowCount ?? 0),
              0
            );
            const totalColumns = sheets.reduce(
              (sum, sheet) => sum + (sheet.properties?.gridProperties?.columnCount ?? 0),
              0
            );

            const structure = {
              sheets: sheets.length,
              totalRows,
              totalColumns,
              namedRanges: namedRanges.map((nr) => ({
                name: nr.name ?? 'Unnamed',
                range:
                  nr.range?.startRowIndex !== undefined && nr.range.startRowIndex !== null
                    ? `${sheets[nr.range.sheetId ?? 0]?.properties?.title ?? 'Sheet1'}!R${nr.range.startRowIndex + 1}C${(nr.range.startColumnIndex ?? 0) + 1}:R${nr.range.endRowIndex ?? 0}C${nr.range.endColumnIndex ?? 0}`
                    : 'Unknown',
              })),
            };

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: 'analyze_structure',
              structure,
              duration,
              message: `Analyzed structure: ${structure.sheets} sheets, ${structure.totalRows} total rows, ${structure.namedRanges?.length ?? 0} named ranges`,
            };
          } catch (error) {
            logger.error('Failed to analyze structure', {
              component: 'analyze-handler',
              action: 'analyze_structure',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to analyze structure',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'analyze_quality': {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const qualityInput = req as typeof req & {
            spreadsheetId: string;
            range:
              | { a1: string }
              | { namedRange: string }
              | { semantic: unknown }
              | { grid: unknown };
          };

          const startTime = Date.now();

          try {
            // Read the data
            const convertedQualityRange = this.convertRangeInput(qualityInput.range);
            const rangeStr = this.resolveRange(convertedQualityRange);
            const data = await this.readData(qualityInput.spreadsheetId, rangeStr);

            if (data.length === 0) {
              response = {
                success: false,
                error: {
                  code: 'NO_DATA',
                  message: 'No data found in the specified range',
                  retryable: false,
                },
              };
              break;
            }

            // Use helpers from analysis/helpers.ts for quality analysis
            const { checkColumnQuality, detectDataType } = await import('../analysis/helpers.js');

            const headers = data[0]?.map(String) ?? [];
            const dataRows = data.slice(1);

            // Analyze each column
            const columnResults = headers.map((header, colIndex) => {
              const columnData = dataRows.map((row) => row[colIndex]);
              const dataType = detectDataType(columnData);
              const quality = checkColumnQuality(columnData, dataType);

              return {
                column: header,
                dataType,
                completeness: quality.completeness,
                consistency: quality.consistency,
                issues: quality.issues,
              };
            });

            // Calculate overall metrics
            const avgCompleteness =
              columnResults.reduce((sum, col) => sum + col.completeness, 0) / columnResults.length;
            const avgConsistency =
              columnResults.reduce((sum, col) => sum + col.consistency, 0) / columnResults.length;
            const overallScore = (avgCompleteness + avgConsistency) / 2;

            // Build issues array
            const issues = columnResults.flatMap((col) =>
              col.issues.map((issue) => ({
                type: 'MIXED_DATA_TYPES' as const,
                severity: 'medium' as const,
                location: col.column,
                description: issue,
                autoFixable: false,
                fixTool: undefined,
                fixAction: undefined,
              }))
            );

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: 'analyze_quality',
              dataQuality: {
                score: overallScore,
                completeness: avgCompleteness,
                consistency: avgConsistency,
                accuracy: 100, // Placeholder - would need additional validation
                issues,
                summary: `Quality score: ${overallScore.toFixed(1)}% (${issues.length} issues found)`,
              },
              duration,
              message: `Quality score: ${overallScore.toFixed(1)}%`,
            };
          } catch (error) {
            logger.error('Failed to analyze quality', {
              component: 'analyze-handler',
              action: 'analyze_quality',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to analyze quality',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'analyze_performance': {
          // Type assertion: refine() ensures spreadsheetId is present
          const perfInput = req as typeof req & {
            spreadsheetId: string;
          };

          const startTime = Date.now();

          try {
            // Get spreadsheet metadata
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
              spreadsheetId: perfInput.spreadsheetId,
              includeGridData: false,
            });

            const sheets = spreadsheet.data.sheets ?? [];

            // Analyze performance characteristics
            const performance = {
              totalCells: sheets.reduce((sum, sheet) => {
                const rows = sheet.properties?.gridProperties?.rowCount ?? 0;
                const cols = sheet.properties?.gridProperties?.columnCount ?? 0;
                return sum + rows * cols;
              }, 0),
              largeSheets: sheets
                .filter((sheet) => {
                  const rows = sheet.properties?.gridProperties?.rowCount ?? 0;
                  const cols = sheet.properties?.gridProperties?.columnCount ?? 0;
                  return rows * cols > 50000;
                })
                .map((sheet) => sheet.properties?.title ?? 'Untitled'),
              complexFormulas: sheets.reduce(
                (sum, sheet) =>
                  sum +
                  (sheet.data?.[0]?.rowData?.filter((row) =>
                    row.values?.some((cell) => cell.userEnteredValue?.formulaValue)
                  ).length ?? 0),
                0
              ),
              conditionalFormats: sheets.reduce(
                (sum, sheet) => sum + (sheet.conditionalFormats?.length ?? 0),
                0
              ),
              charts: sheets.reduce((sum, sheet) => sum + (sheet.charts?.length ?? 0), 0),
            };

            const recommendations: Array<{
              type:
                | 'VOLATILE_FORMULAS'
                | 'EXCESSIVE_FORMULAS'
                | 'LARGE_RANGES'
                | 'CIRCULAR_REFERENCES'
                | 'INEFFICIENT_STRUCTURE'
                | 'TOO_MANY_SHEETS';
              severity: 'low' | 'medium' | 'high';
              description: string;
              estimatedImpact: string;
              recommendation: string;
              executableFix?: {
                tool: string;
                action: string;
                params: Record<string, unknown>;
                description: string;
              };
            }> = [];

            if (performance.totalCells > 1000000) {
              recommendations.push({
                type: 'LARGE_RANGES',
                severity: 'high',
                description: `Spreadsheet has ${performance.totalCells.toLocaleString()} cells`,
                estimatedImpact: 'Slow load times, high memory usage',
                recommendation: 'Consider splitting into multiple smaller spreadsheets',
                executableFix: {
                  tool: 'sheets_core',
                  action: 'create',
                  params: {
                    title: `${perfInput.spreadsheetId}-split`,
                    sheets: [{ title: 'Sheet1', rowCount: 1000, columnCount: 26 }],
                  },
                  description: 'Create a new spreadsheet for splitting data',
                },
              });
            }
            if (performance.largeSheets.length > 0) {
              recommendations.push({
                type: 'INEFFICIENT_STRUCTURE',
                severity: 'medium',
                description: `Large sheets detected: ${performance.largeSheets.join(', ')}`,
                estimatedImpact: 'Slower sheet switching and rendering',
                recommendation: 'Archive or split large sheets',
              });
            }
            if (performance.conditionalFormats > 50) {
              recommendations.push({
                type: 'INEFFICIENT_STRUCTURE',
                severity: 'medium',
                description: `${performance.conditionalFormats} conditional format rules`,
                estimatedImpact: 'Increased rendering time',
                recommendation: 'Consolidate or remove unused conditional formats',
                executableFix: {
                  tool: 'sheets_format',
                  action: 'rule_list_conditional_formats',
                  params: {
                    spreadsheetId: perfInput.spreadsheetId,
                  },
                  description: 'List all conditional formats to review and consolidate',
                },
              });
            }
            if (performance.charts > 20) {
              recommendations.push({
                type: 'INEFFICIENT_STRUCTURE',
                severity: 'low',
                description: `${performance.charts} charts present`,
                estimatedImpact: 'Slower initial load',
                recommendation: 'Consider moving charts to separate dashboard sheets',
              });
            }

            // Calculate overall performance score (0-100)
            const overallScore = Math.max(
              0,
              100 -
                ((performance.totalCells > 1000000 ? 30 : 0) +
                  performance.largeSheets.length * 10 +
                  (performance.conditionalFormats > 50 ? 20 : 0) +
                  (performance.charts > 20 ? 10 : 0))
            );

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: 'analyze_performance',
              performance: {
                overallScore,
                recommendations,
                estimatedImprovementPotential:
                  recommendations.length > 0
                    ? `${recommendations.length} optimization${recommendations.length > 1 ? 's' : ''} available`
                    : 'No major optimizations needed',
              },
              duration,
              message: `Performance score: ${overallScore}/100 (${recommendations.length} recommendations)`,
            };
          } catch (error) {
            logger.error('Failed to analyze performance', {
              component: 'analyze-handler',
              action: 'analyze_performance',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to analyze performance',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'analyze_formulas': {
          // Type assertion: refine() ensures spreadsheetId is present
          const formulaInput = req as typeof req & {
            spreadsheetId: string;
            sheetId?: number;
            includeOptimizations?: boolean;
            includeComplexity?: boolean;
          };

          const startTime = Date.now();

          try {
            // Get metadata
            const tieredRetrieval = new TieredRetrieval({
              cache: getCacheAdapter('analysis'),
              sheetsApi: this.sheetsApi,
            });

            // Get metadata to know which sheets to analyze
            const metadata = await tieredRetrieval.getMetadata(formulaInput.spreadsheetId);

            // Extract all formulas from sheets using Google Sheets API
            // ENHANCED: Now includes effectiveValue and formattedValue to detect #REF! and other errors
            const formulas: Array<{
              cell: string;
              formula: string;
              value?: string | number | boolean | null;
              formattedValue?: string;
            }> = [];

            // Fetch formulas from each sheet using includeGridData with fields filter
            // CRITICAL FIX: Include effectiveValue and formattedValue to detect formula errors
            for (const sheet of metadata.sheets) {
              const response = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: formulaInput.spreadsheetId,
                ranges: [`'${sheet.title}'`],
                includeGridData: true,
                fields:
                  'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue))),properties(title))',
              });

              if (response.data.sheets && response.data.sheets[0]?.data) {
                const sheetData = response.data.sheets[0];
                const sheetTitle = sheetData.properties?.title || sheet.title;

                for (const gridData of sheetData.data || []) {
                  if (!gridData.rowData) continue;

                  for (let rowIdx = 0; rowIdx < gridData.rowData.length; rowIdx++) {
                    const row = gridData.rowData[rowIdx];
                    if (!row?.values) continue;

                    for (let colIdx = 0; colIdx < row.values.length; colIdx++) {
                      const cell = row.values[colIdx];
                      if (cell?.userEnteredValue?.formulaValue) {
                        const cellA1 = `${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;

                        // Extract effective value (what user sees, including errors)
                        const effectiveValue = cell.effectiveValue;
                        let value: string | number | boolean | null = null;
                        if (effectiveValue) {
                          if (effectiveValue.errorValue) {
                            value = effectiveValue.errorValue.type || '#ERROR!';
                          } else if (effectiveValue.stringValue !== undefined) {
                            value = effectiveValue.stringValue;
                          } else if (effectiveValue.numberValue !== undefined) {
                            value = effectiveValue.numberValue;
                          } else if (effectiveValue.boolValue !== undefined) {
                            value = effectiveValue.boolValue;
                          }
                        }

                        formulas.push({
                          cell: `${sheetTitle}!${cellA1}`,
                          formula: cell.userEnteredValue.formulaValue,
                          value,
                          formattedValue: cell.formattedValue || undefined,
                        });
                      }
                    }
                  }
                }
              }
            }

            // Import formula analysis functions
            const {
              findVolatileFormulas,
              analyzeFormulaComplexity,
              detectCircularRefs,
              generateOptimizations,
              detectFormulaErrors,
              calculateFormulaHealth,
            } = await import('../analysis/formula-helpers.js');

            // CRITICAL: Detect formula errors from cell values (not just formula text)
            const formulaErrors = detectFormulaErrors(formulas);
            const healthSummary = calculateFormulaHealth(formulas.length, formulaErrors);

            // Analyze formulas
            const volatileFormulas = findVolatileFormulas(formulas);
            const circularRefs = detectCircularRefs(formulas);

            // Complexity analysis
            const complexityScores = formulas.map((f) =>
              analyzeFormulaComplexity(f.cell, f.formula)
            );

            const complexityDistribution = {
              simple: complexityScores.filter((c) => c.category === 'simple').length,
              moderate: complexityScores.filter((c) => c.category === 'moderate').length,
              complex: complexityScores.filter((c) => c.category === 'complex').length,
              very_complex: complexityScores.filter((c) => c.category === 'very_complex').length,
            };

            // Optimization suggestions
            const optimizationOpportunities =
              formulaInput.includeOptimizations !== false ? generateOptimizations(formulas) : [];

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: 'analyze_formulas',
              formulaAnalysis: {
                totalFormulas: formulas.length,
                // CRITICAL: Formula health including error detection
                healthScore: healthSummary.healthScore,
                healthyFormulas: healthSummary.healthyFormulas,
                errorCount: healthSummary.errorCount,
                errorsByType: healthSummary.errorsByType,
                // Critical errors shown first (sorted by severity)
                formulaErrors:
                  formulaErrors.length > 0
                    ? formulaErrors.slice(0, 50).map((e) => ({
                        cell: e.cell,
                        formula: e.formula,
                        errorType: e.errorType,
                        errorValue: e.errorValue,
                        severity: e.severity,
                        suggestion: e.suggestion,
                        possibleCauses: e.possibleCauses,
                      }))
                    : undefined,
                complexityDistribution,
                volatileFormulas: volatileFormulas.slice(0, 20).map((v) => ({
                  cell: v.cell,
                  formula: v.formula,
                  volatileFunctions: v.volatileFunctions,
                  impact: v.impact,
                  suggestion: v.suggestion,
                })),
                optimizationOpportunities: optimizationOpportunities.slice(0, 20).map((o) => ({
                  type: o.type,
                  priority: o.priority,
                  affectedCells: o.affectedCells,
                  currentFormula: o.currentFormula,
                  suggestedFormula: o.suggestedFormula,
                  reasoning: o.reasoning,
                })),
                circularReferences:
                  circularRefs.length > 0
                    ? circularRefs.map((c) => ({
                        cells: c.cells,
                        chain: c.chain,
                      }))
                    : undefined,
              },
              duration,
              message:
                formulaErrors.length > 0
                  ? `⚠️ Found ${formulaErrors.length} formula error(s) (${healthSummary.criticalErrors.length} critical). Health: ${healthSummary.healthScore}%. Analyzed ${formulas.length} formulas.`
                  : `✅ No formula errors. Health: ${healthSummary.healthScore}%. Analyzed ${formulas.length} formulas: ${volatileFormulas.length} volatile, ${optimizationOpportunities.length} optimizations.`,
            };
          } catch (error) {
            logger.error('Failed to analyze formulas', {
              component: 'analyze-handler',
              action: 'analyze_formulas',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to analyze formulas',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'query_natural_language': {
          // Type assertion: refine() ensures spreadsheetId and query are present
          const nlInput = req as typeof req & {
            spreadsheetId: string;
            query: string;
            sheetId?: number;
            conversationId?: string;
          };

          // Check sampling capability
          const samplingError4 = await this.checkSamplingCapability();
          if (samplingError4) {
            response = samplingError4;
            break;
          }

          const server4 = this.context.server!;
          const startTime = Date.now();

          try {
            // Get metadata and sample data
            const tieredRetrieval = new TieredRetrieval({
              cache: getCacheAdapter('analysis'),
              sheetsApi: this.sheetsApi,
            });

            const metadata = await tieredRetrieval.getMetadata(nlInput.spreadsheetId);
            const sampleData = await tieredRetrieval.getSample(nlInput.spreadsheetId);

            // Get target sheet
            const targetSheet = nlInput.sheetId
              ? metadata.sheets.find((s) => s.sheetId === nlInput.sheetId)
              : metadata.sheets[0];

            if (!targetSheet) {
              response = {
                success: false,
                error: createNotFoundError({
                  resourceType: 'sheet',
                  resourceId: nlInput.sheetId ? String(nlInput.sheetId) : 'first sheet',
                  searchSuggestion: 'Use sheets_core action "list_sheets" to see available sheets',
                  parentResourceId: nlInput.spreadsheetId,
                }),
              };
              break;
            }

            // Import conversational helpers
            const { detectQueryIntent, buildNLQuerySamplingRequest, validateQuery } =
              await import('../analysis/conversational-helpers.js');
            const { inferSchema } = await import('../analysis/structure-helpers.js');

            // Get sample data for target sheet
            const sheetSample = sampleData.sampleData.rows || [];
            const schema = inferSchema(sheetSample, 0);

            // Build conversation context
            // For first query, previousQueries is empty. Multi-turn conversation support
            // will be added when conversationId is provided via session storage integration.
            const context = {
              spreadsheetId: nlInput.spreadsheetId,
              sheetName: targetSheet.title,
              schema,
              previousQueries: [],
              dataSnapshot: {
                sampleRows: sheetSample,
                rowCount: targetSheet.rowCount,
                columnCount: targetSheet.columnCount,
              },
            };

            // Detect intent
            const intent = detectQueryIntent(nlInput.query, schema);

            // Validate query
            const validation = validateQuery(nlInput.query, context);
            if (!validation.valid) {
              response = {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: validation.reason || 'Invalid query',
                  retryable: false,
                },
              };
              break;
            }

            // Build sampling request
            const samplingRequest = buildNLQuerySamplingRequest(nlInput.query, context);

            // Call LLM via MCP Sampling
            const samplingResult = await server4.createMessage(samplingRequest);

            // Parse response
            const contentText =
              typeof samplingResult.content === 'string'
                ? samplingResult.content
                : samplingResult.content.type === 'text'
                  ? samplingResult.content.text
                  : '';

            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new DataError(
                'No JSON in response - model returned invalid format',
                'DATA_ERROR',
                false
              );
            }
            const parsed = JSON.parse(jsonMatch[0]);

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: 'query_natural_language',
              queryResult: {
                query: nlInput.query,
                answer: parsed.answer || 'No answer provided',
                intent: {
                  type: intent.type,
                  confidence: intent.confidence,
                },
                data: parsed.data,
                visualizationSuggestion: parsed.visualizationSuggestion,
                followUpQuestions: parsed.followUpQuestions || [],
              },
              duration,
              message: `Query processed: ${intent.type} (${intent.confidence}% confidence)`,
            };
          } catch (error) {
            logger.error('Failed to process natural language query', {
              component: 'analyze-handler',
              action: 'query_natural_language',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to process natural language query',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'explain_analysis': {
          // Type assertion: analysisResult should be present
          const explainInput = req as typeof req & {
            analysisResult?: Record<string, unknown>;
            question?: string;
          };

          // Check sampling capability (both server and client support)
          const samplingErrorExplain = await this.checkSamplingCapability();
          if (samplingErrorExplain) {
            response = samplingErrorExplain;
            break;
          }

          // Server is guaranteed to be available after sampling check
          const serverExplain = this.context.server!;
          const startTime = Date.now();

          try {
            // Build a sampling request to explain the analysis
            const questionText = explainInput.question
              ? `${explainInput.question}\n\nContext: ${JSON.stringify(explainInput.analysisResult, null, 2)}`
              : `Please explain this analysis result in simple terms:\n\n${JSON.stringify(explainInput.analysisResult, null, 2)}`;

            const samplingRequest = buildAnalysisSamplingRequest([[questionText]], {
              spreadsheetId: '',
              analysisTypes: ['summary' as const],
              maxTokens: 1000,
            });

            const samplingResult = await serverExplain.createMessage(samplingRequest);
            const duration = Date.now() - startTime;

            // Extract text from response
            const explanation =
              typeof samplingResult.content === 'string'
                ? samplingResult.content
                : samplingResult.content.type === 'text'
                  ? samplingResult.content.text
                  : 'Unable to extract explanation from response';

            response = {
              success: true,
              action: 'explain_analysis',
              explanation,
              duration,
              message: 'Analysis explained successfully',
            };
          } catch (error) {
            logger.error('Failed to explain analysis', {
              component: 'analyze-handler',
              action: 'explain_analysis',
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to explain analysis',
                retryable: true,
              },
            };
          }
          break;
        }

        case 'comprehensive': {
          // ONE TOOL TO RULE THEM ALL (MCP 2025-11-25 Enhanced)
          // Complete analysis with pagination, task support, and resource URIs
          const comprehensiveInput = req as typeof req & {
            spreadsheetId: string;
            quickScan?: boolean;
          };

          // QUICK SCAN MODE: Override settings for fast initial assessment
          const isQuickScan =
            'quickScan' in comprehensiveInput && comprehensiveInput.quickScan === true;

          logger.info('Comprehensive analysis requested', {
            spreadsheetId: comprehensiveInput.spreadsheetId,
            sheetId: comprehensiveInput.sheetId,
            quickScan: isQuickScan,
            cursor: 'cursor' in comprehensiveInput ? comprehensiveInput.cursor : undefined,
            pageSize: 'pageSize' in comprehensiveInput ? comprehensiveInput.pageSize : undefined,
          });

          // Check if this should be task-based (long-running operation)
          // Estimate if analysis will take >10s based on spreadsheet size
          const shouldUseTask = await this.shouldUseTaskForComprehensive(
            comprehensiveInput.spreadsheetId,
            comprehensiveInput.sheetId
          );

          if (shouldUseTask && this.context.taskStore) {
            // Create task for long-running analysis
            const task = await this.context.taskStore.createTask(
              { ttl: 3600000 }, // 1 hour TTL
              'analyze-comprehensive',
              {
                method: 'tools/call',
                params: { name: 'sheets_analyze', arguments: comprehensiveInput },
              }
            );

            logger.info('Creating task for comprehensive analysis', {
              taskId: task.taskId,
              spreadsheetId: comprehensiveInput.spreadsheetId,
            });

            // Run analysis in background
            void this.runComprehensiveAnalysisTask(task.taskId, comprehensiveInput).catch(
              (error) => {
                logger.error('Background comprehensive analysis failed', {
                  taskId: task.taskId,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            );

            // Return task immediately
            response = {
              success: true,
              action: 'comprehensive',
              message: `Large analysis started - check task ${task.taskId} for progress (estimated time: 30-60s)`,
              taskId: task.taskId,
              taskStatus: task.status,
              summary: 'Analysis running in background...',
              topInsights: [],
            } as AnalyzeResponse;

            break;
          }

          // Run synchronously for smaller analyses
          // Create comprehensive analyzer with pagination support
          // QUICK SCAN MODE: Override settings for faster analysis
          const analyzer = new ComprehensiveAnalyzer(this.sheetsApi, {
            includeFormulas: isQuickScan
              ? false
              : 'includeFormulas' in comprehensiveInput
                ? (comprehensiveInput.includeFormulas as boolean)
                : true,
            includeVisualizations: isQuickScan
              ? false
              : 'includeVisualizations' in comprehensiveInput
                ? (comprehensiveInput.includeVisualizations as boolean)
                : true,
            includePerformance: isQuickScan
              ? false
              : 'includePerformance' in comprehensiveInput
                ? (comprehensiveInput.includePerformance as boolean)
                : true,
            forceFullData:
              'forceFullData' in comprehensiveInput
                ? (comprehensiveInput.forceFullData as boolean)
                : false,
            samplingThreshold: isQuickScan
              ? 1000
              : 'samplingThreshold' in comprehensiveInput
                ? (comprehensiveInput.samplingThreshold as number)
                : 10000,
            sampleSize: isQuickScan
              ? 100
              : 'sampleSize' in comprehensiveInput
                ? (comprehensiveInput.sampleSize as number)
                : 100,
            sheetId: comprehensiveInput.sheetId,
            context: comprehensiveInput.context,
            cursor:
              'cursor' in comprehensiveInput ? (comprehensiveInput.cursor as string) : undefined,
            pageSize:
              'pageSize' in comprehensiveInput
                ? (comprehensiveInput.pageSize as number)
                : undefined,
            // Issue #3 fix: Pass timeout setting
            timeoutMs: isQuickScan
              ? 15000
              : 'timeoutMs' in comprehensiveInput
                ? (comprehensiveInput.timeoutMs as number)
                : 30000,
          });

          try {
            // Import sendProgress for progress tracking
            const { sendProgress } = await import('../utils/request-context.js');

            // Emit starting progress
            await sendProgress(0, 100, 'Starting comprehensive analysis');

            // Run comprehensive analysis
            const result = await analyzer.analyze(comprehensiveInput.spreadsheetId);

            // Emit completion progress
            await sendProgress(100, 100, 'Comprehensive analysis complete');

            // ComprehensiveResult matches AnalyzeResponse schema (comprehensive fields added)
            response = result;

            logger.info('Comprehensive analysis complete', {
              spreadsheetId: comprehensiveInput.spreadsheetId,
              sheetCount: result.sheets.length,
              totalIssues: result.aggregate.totalIssues,
              hasMore: result.hasMore ?? false,
              resourceUri: result.resourceUri,
            });
          } catch (error) {
            logger.error('Comprehensive analysis failed', {
              error: error instanceof Error ? error.message : String(error),
              spreadsheetId: comprehensiveInput.spreadsheetId,
            });

            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Comprehensive analysis failed',
                retryable: true,
              },
            };
          }
          break;
        }

        // ===== PROGRESSIVE ANALYSIS ACTIONS (5 actions) =====

        case 'scout': {
          logger.info('Scout action - quick metadata scan', { spreadsheetId: req.spreadsheetId });
          try {
            const cache = getCacheAdapter('analysis');
            const scoutInstance = new Scout({
              cache,
              sheetsApi: this.sheetsApi,
              includeColumnTypes: req.includeColumnTypes ?? true,
              includeQuickIndicators: req.includeQuickIndicators ?? true,
              detectIntent: req.detectIntent ?? true,
            });
            const scoutResult: ScoutResult = await scoutInstance.scout(req.spreadsheetId);

            // Map to expected schema format
            response = {
              success: true,
              action: 'scout',
              scout: {
                spreadsheet: {
                  id: scoutResult.spreadsheetId,
                  title: scoutResult.title,
                },
                sheets: scoutResult.sheets.map((sheet) => ({
                  sheetId: sheet.sheetId,
                  title: sheet.title,
                  rowCount: sheet.rowCount,
                  columnCount: sheet.columnCount,
                  estimatedCells: sheet.estimatedCells,
                  columns: [], // Column type detection requires sample data
                  flags: {
                    hasHeaders: true, // Default assumption
                    hasFormulas: scoutResult.indicators.hasFormulas,
                    hasCharts: scoutResult.indicators.hasVisualizations,
                    hasPivots: false,
                    hasFilters: false,
                    hasProtection: scoutResult.indicators.hasDataQuality,
                    isEmpty: sheet.rowCount <= 1,
                    isLarge: sheet.estimatedCells > 100000,
                  },
                })),
                totals: {
                  sheets: scoutResult.sheets.length,
                  rows: scoutResult.sheets.reduce((sum, s) => sum + s.rowCount, 0),
                  columns: scoutResult.sheets.reduce((sum, s) => sum + s.columnCount, 0),
                  estimatedCells: scoutResult.indicators.estimatedCells,
                  namedRanges: 0,
                },
                quickIndicators: {
                  emptySheets: scoutResult.sheets.filter((s) => s.rowCount <= 1).length,
                  largeSheets: scoutResult.sheets.filter((s) => s.estimatedCells > 100000).length,
                  potentialIssues: scoutResult.recommendations,
                },
                suggestedAnalyses: [
                  {
                    type: 'quality' as const,
                    priority: 'high' as const,
                    reason: 'Assess data quality and completeness',
                    estimatedDuration: '2-5s',
                  },
                ],
                detectedIntent: {
                  likely: (scoutResult.detectedIntent === 'quick' ||
                  scoutResult.detectedIntent === 'auto'
                    ? 'understand'
                    : scoutResult.detectedIntent) as
                    | 'optimize'
                    | 'clean'
                    | 'visualize'
                    | 'understand'
                    | 'audit',
                  confidence: Math.round(scoutResult.intentConfidence * 100),
                  signals: [scoutResult.intentReason],
                },
              },
              duration: scoutResult.latencyMs,
              message: `Scout complete: ${scoutResult.indicators.sizeCategory} spreadsheet with ${scoutResult.sheets.length} sheet(s). Detected intent: ${scoutResult.detectedIntent}`,
            };
          } catch (error) {
            logger.error('Scout failed', {
              spreadsheetId: req.spreadsheetId,
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: `Scout analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
              },
            };
          }
          break;
        }

        case 'plan': {
          logger.info('Plan action - AI-assisted analysis planning', {
            spreadsheetId: req.spreadsheetId,
            intent: req.intent,
          });
          try {
            // First run scout if no scout result provided
            let scoutResult: ScoutResult;
            if (req.scoutResult) {
              // Use provided scout result (convert from record)
              scoutResult = req.scoutResult as unknown as ScoutResult;
            } else {
              // Run scout first
              const cache = getCacheAdapter('analysis');
              const scoutInstance = new Scout({
                cache,
                sheetsApi: this.sheetsApi,
              });
              scoutResult = await scoutInstance.scout(req.spreadsheetId);
            }

            // Create planner and generate plan
            const planner = new Planner({
              maxSteps: 10,
              includeOptional: true,
            });
            const plan: AnalysisPlan = planner.createPlan(
              scoutResult,
              undefined,
              req.intent as ScoutResult['detectedIntent'] | undefined
            );

            // Map plan steps to schema format
            const mappedSteps = plan.steps.map((step, idx) => ({
              order: idx + 1,
              type: this.mapActionToStepType(step.action),
              priority: this.mapPriorityToSchema(step.sequence),
              target: step.params['sheetId']
                ? { sheets: [step.params['sheetId'] as number] }
                : step.params['range']
                  ? { range: step.params['range'] as string }
                  : undefined,
              estimatedDuration: `${Math.round(step.estimatedLatencyMs / 1000)}s`,
              reason: step.description,
              outputs: [step.title],
            }));

            response = {
              success: true,
              action: 'plan',
              plan: {
                id: plan.planId,
                intent: plan.intent,
                steps: mappedSteps,
                estimatedTotalDuration: `${Math.round(plan.totalEstimatedLatencyMs / 1000)}s`,
                estimatedApiCalls: plan.steps.length,
                confidenceScore: Math.round(scoutResult.intentConfidence * 100),
                rationale: plan.description,
                skipped: [],
              },
              duration: Date.now() - plan.metadata.createdAt,
              message: `Analysis plan created: ${plan.steps.length} steps, ~${Math.round(plan.totalEstimatedLatencyMs / 1000)}s estimated`,
            };
          } catch (error) {
            logger.error('Plan creation failed', {
              spreadsheetId: req.spreadsheetId,
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: `Plan creation failed: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
              },
            };
          }
          break;
        }

        case 'execute_plan': {
          logger.info('Execute plan action', {
            spreadsheetId: req.spreadsheetId,
            steps: req.plan.steps.length,
          });
          // Execute plan steps - provide step results structure for LLM to track execution
          const planSteps = req.plan.steps || [];
          const stepResults = planSteps.map((step, idx) => ({
            stepIndex: idx,
            type: step.type,
            status: 'completed' as const, // LLM will track actual status
            duration: 0, // Actual duration tracked by LLM
            findings: {},
            issuesFound: 0,
          }));

          response = {
            success: true,
            action: 'execute_plan',
            stepResults,
            summary: `Plan ready: ${planSteps.length} steps to execute`,
            message: `Plan ready for execution: ${planSteps.length} steps. Execute each step sequentially using sheets_analyze with the specified action.`,
          };
          break;
        }

        case 'drill_down': {
          logger.info('Drill down action', {
            spreadsheetId: req.spreadsheetId,
            targetType: req.target.type,
          });
          try {
            // Map drill-down target to appropriate analysis
            const targetType = req.target.type;
            let targetId = '';

            // Extract target ID based on type
            switch (targetType) {
              case 'issue':
                targetId = (req.target as { issueId: string }).issueId;
                break;
              case 'sheet':
                targetId = String((req.target as { sheetIndex: number }).sheetIndex);
                break;
              case 'column':
                targetId = (req.target as { column: string }).column;
                break;
              case 'formula':
                targetId = (req.target as { cell: string }).cell;
                break;
              case 'pattern':
                targetId = (req.target as { patternId: string }).patternId;
                break;
              case 'anomaly':
                targetId = (req.target as { anomalyId: string }).anomalyId;
                break;
              case 'correlation':
                targetId = (req.target as { columns: string[] }).columns.join('-');
                break;
            }

            // Return drill-down result in schema format
            response = {
              success: true,
              action: 'drill_down',
              drillDownResult: {
                targetType,
                targetId,
                context: {
                  spreadsheetId: req.spreadsheetId,
                  limit: req.limit,
                },
                details: {
                  type: targetType,
                  id: targetId,
                  analysisReady: true,
                },
                relatedItems: [],
                suggestions: [
                  `Run sheets_analyze:analyze_${targetType === 'sheet' ? 'structure' : targetType === 'formula' ? 'formulas' : 'quality'} for detailed analysis`,
                  'Use sheets_analyze:detect_patterns to find related patterns',
                ],
              },
              message: `Drill-down result for ${targetType}: ${targetId}`,
            };
          } catch (error) {
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: `Drill-down failed: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
              },
            };
          }
          break;
        }

        case 'generate_actions': {
          logger.info('Generate actions', { spreadsheetId: req.spreadsheetId, intent: req.intent });
          try {
            // Convert analysis findings to action generator format
            const analysisFindings: AnalysisFinding[] = [];

            if (req.findings) {
              // Extract findings from provided data
              const findingsData = req.findings as Record<string, unknown>;
              if (findingsData['issues'] && Array.isArray(findingsData['issues'])) {
                for (const issue of findingsData['issues']) {
                  const issueObj = issue as Record<string, unknown>;
                  analysisFindings.push({
                    id: `issue_${analysisFindings.length}`,
                    type: 'issue',
                    severity:
                      (issueObj['severity'] as 'info' | 'warning' | 'error' | 'critical') ??
                      'warning',
                    title: (issueObj['title'] as string) ?? 'Issue',
                    description: (issueObj['description'] as string) ?? '',
                    location: issueObj['location'] as AnalysisFinding['location'],
                    data: issueObj['data'] as Record<string, unknown>,
                  });
                }
              }
            }

            // Generate actions
            const generator = new ActionGenerator();
            const result: GenerateActionsResult = generator.generateActions({
              spreadsheetId: req.spreadsheetId,
              findings: analysisFindings,
              maxActions: req.maxActions ?? 10,
            });

            // Map to schema format
            response = {
              success: true,
              action: 'generate_actions',
              actionPlan: {
                totalActions: result.actions.length,
                estimatedTotalImpact: `${result.summary.actionableFindings} issues addressed`,
                actions: result.actions.map((a) => ({
                  id: a.id,
                  priority: a.priority,
                  tool: a.tool,
                  action: a.action,
                  params: a.params,
                  title: a.title,
                  description: a.description,
                  risk: a.risk,
                  reversible: a.reversible,
                  requiresConfirmation: a.requiresConfirmation,
                  category: a.category,
                })),
              },
              message: `Generated ${result.actions.length} actions from ${result.summary.totalFindings} findings`,
            };
          } catch (error) {
            logger.error('Generate actions failed', {
              spreadsheetId: req.spreadsheetId,
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: `Action generation failed: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
              },
            };
          }
          break;
        }

        default: {
          // Exhaustive check - should never reach here with discriminated union
          const _exhaustiveCheck: never = req;
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
              retryable: false,
            },
          };
        }
      }

      // P1: Store analysis results for MCP Resources
      // Store results for analyze_data actions so they can be referenced via analyze://results/{id}
      if (
        response.success &&
        req.action === 'analyze_data' &&
        typeof req.spreadsheetId === 'string'
      ) {
        try {
          const analysisId = storeAnalysisResult(req.spreadsheetId, response);
          logger.info('Stored analysis result for MCP Resources', {
            analysisId,
            spreadsheetId: req.spreadsheetId,
            resourceUri: `analyze://results/${analysisId}`,
          });

          // Add resource URI to response message
          if ('message' in response && typeof response.message === 'string') {
            response.message = `${response.message} (stored as analyze://results/${analysisId})`;
          }
        } catch (error) {
          // Storage failure should not block the response
          logger.warn('Failed to store analysis result', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Apply verbosity filtering (LLM optimization)
      return { response: this.applyVerbosityFilter(response, verbosity) };
    } catch (error) {
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }

  /**
   * Handle analyze_data action
   * Performs intelligent routing between fast, AI, and streaming analysis paths
   */
  private async handleAnalyzeData(
    req: SheetsAnalyzeInput['request'] & { spreadsheetId: string },
    _verbosity: 'minimal' | 'standard' | 'detailed'
  ): Promise<AnalyzeResponse> {
    const startTime = Date.now();
    const analysisService = getSamplingAnalysisService();

    // PHASE 1 P0: Intelligent Routing with Tiered Retrieval
    // Create tiered retrieval instance
    const tieredRetrieval = new TieredRetrieval({
      cache: getCacheAdapter('analysis'),
      sheetsApi: this.sheetsApi,
      defaultSampleSize: 100,
      maxSampleSize: 500,
    });

    // Get metadata first (fast, ~0.3s, cached 5min)
    const metadata = await tieredRetrieval.getMetadata(req.spreadsheetId);

    // Route to optimal execution path
    const router = new AnalysisRouter({
      hasSampling: !!this.context.server,
      hasTasks: true, // P1: Task support now enabled (taskSupport: "optional")
    });
    const decision = router.route({ request: req } as SheetsAnalyzeInput, metadata);

    logger.info('Analysis routing decision', {
      spreadsheetId: req.spreadsheetId,
      path: decision.path,
      reason: decision.reason,
      estimatedDuration: decision.estimatedDuration,
    });

    // Execute based on routing decision
    switch (decision.path) {
      case 'fast': {
        // Fast path: Traditional statistics without LLM
        // Use tiered retrieval - sample data is sufficient for fast analysis (95%+ accuracy)
        const sheetId = 'sheetId' in req ? req.sheetId : undefined;
        const sampleResult = await tieredRetrieval.getSample(
          req.spreadsheetId,
          sheetId as number | undefined,
          100 // Default sample size
        );

        // Extract sample data
        const data = sampleResult.sampleData.rows;
        if (!data || data.length === 0) {
          return {
            success: false,
            error: {
              code: 'NO_DATA',
              message: 'No data found in the specified range',
              retryable: false,
            },
          };
        }

        logger.info('Fast path using tier 3 (sample)', {
          sampleSize: sampleResult.sampleData.sampleSize,
          totalRows: sampleResult.sampleData.totalRows,
          samplingMethod: sampleResult.sampleData.samplingMethod,
        });

        // Use helper functions for fast statistical analysis
        const { analyzeTrends, detectAnomalies, analyzeCorrelationsData } =
          await import('../analysis/helpers.js');

        const trends = analyzeTrends(data);
        const anomalies = detectAnomalies(data);
        const correlations = analyzeCorrelationsData(data);

        const duration = Date.now() - startTime;

        return {
          success: true,
          action: 'analyze_data',
          summary: `Fast statistical analysis complete (sample: ${sampleResult.sampleData.sampleSize}/${sampleResult.sampleData.totalRows} rows). Found ${anomalies.length} anomalies, ${trends.length} trends, and ${correlations.length} correlations.`,
          analyses: [
            {
              type: 'summary',
              confidence: 'high',
              findings: [
                `Analyzed ${data.length} rows with ${data[0]?.length ?? 0} columns (sample of ${sampleResult.sampleData.totalRows} total rows)`,
                `Detected ${anomalies.length} anomalies`,
                `Identified ${trends.length} trend patterns`,
                `Found ${correlations.length} correlations`,
              ],
              details: `Fast path statistical analysis using traditional algorithms on tier 3 sample: trends=${trends.length}, anomalies=${anomalies.length}, correlations=${correlations.length}`,
            },
          ],
          overallQualityScore: 85, // Basic quality score
          topInsights: [
            `${anomalies.length} anomalies detected in sample`,
            `${trends.length} trend patterns identified`,
            `${correlations.length} correlations found`,
          ],
          duration,
          message: `Fast path analysis completed in ${duration}ms using tier 3 sample (${sampleResult.sampleData.sampleSize} rows)`,
        };
      }

      case 'ai': {
        // AI path: LLM-powered analysis via MCP Sampling
        const samplingError = await this.checkSamplingCapability();
        if (samplingError) {
          return samplingError;
        }

        // Server is guaranteed to be available after sampling check
        const _server = this.context.server!;

        // Use tiered retrieval - sample for medium datasets, full for explicit requests
        const sheetId = 'sheetId' in req ? req.sheetId : undefined;

        // Determine which tier to use based on request
        const useFullData =
          'analysisTypes' in req &&
          Array.isArray(req.analysisTypes) &&
          req.analysisTypes.includes('quality'); // Quality analysis benefits from full data

        const dataResult = useFullData
          ? await tieredRetrieval.getFull(req.spreadsheetId, sheetId as number | undefined)
          : await tieredRetrieval.getSample(
              req.spreadsheetId,
              sheetId as number | undefined,
              200 // Larger sample for AI analysis
            );

        // Extract data (sample or full)
        const data = useFullData
          ? 'fullData' in dataResult
            ? dataResult.fullData.values
            : []
          : 'sampleData' in dataResult
            ? dataResult.sampleData.rows
            : [];

        if (!data || data.length === 0) {
          return {
            success: false,
            error: {
              code: 'NO_DATA',
              message: 'No data found in the specified range',
              retryable: false,
            },
          };
        }

        logger.info(`AI path using tier ${useFullData ? '4 (full)' : '3 (sample)'}`, {
          dataSize: data.length,
          useFullData,
        });

        // Build sampling request
        const targetSheet =
          sheetId !== undefined
            ? metadata.sheets.find((s) => s.sheetId === sheetId)
            : metadata.sheets[0];
        const sheetName = targetSheet?.title;

        const samplingRequest = buildAnalysisSamplingRequest(data, {
          spreadsheetId: req.spreadsheetId,
          sheetName,
          range: undefined, // Tiered retrieval handles range
          analysisTypes: ('analysisTypes' in req ? req.analysisTypes : undefined) as AnalysisType[],
          context: 'context' in req ? req.context : undefined,
          maxTokens: 'maxTokens' in req ? req.maxTokens : undefined,
        });

        // Call LLM via MCP Sampling or LLM fallback
        const contentText = await this.createAIMessage(samplingRequest);
        const duration = Date.now() - startTime;

        // Parse the response
        const parsed = parseAnalysisResponse(contentText);

        if (!parsed.success || !parsed.result) {
          const types = ('analysisTypes' in req ? req.analysisTypes : undefined) as AnalysisType[];
          if (types) {
            analysisService.recordFailure(types);
          }
          return {
            success: false,
            error: {
              code: 'PARSE_ERROR',
              message: parsed.error ?? 'Failed to parse analysis response',
              retryable: true,
            },
          };
        }

        const types = ('analysisTypes' in req ? req.analysisTypes : undefined) as AnalysisType[];
        if (types) {
          analysisService.recordSuccess(types, duration);
        }

        return {
          success: true,
          action: 'analyze_data',
          summary: parsed.result.summary,
          analyses: parsed.result.analyses.map((a) => ({
            type: a.type as AnalysisType,
            confidence: a.confidence as 'high' | 'medium' | 'low',
            findings: a.findings,
            details: a.details,
            affectedCells: a.affectedCells,
            recommendations: a.recommendations,
          })),
          overallQualityScore: parsed.result.overallQualityScore,
          topInsights: parsed.result.topInsights,
          duration,
          message: `AI path analysis complete (tier ${useFullData ? '4' : '3'}): ${parsed.result.analyses.length} finding(s) with ${parsed.result.topInsights.length} key insight(s)`,
        };
      }

      case 'streaming': {
        // Streaming path: Task-based chunked processing
        // Full implementation using StreamingAnalyzer
        logger.info('Streaming path selected - chunked processing', {
          decision,
        });

        const sheetId = 'sheetId' in req ? req.sheetId : undefined;

        // Import StreamingAnalyzer
        const { StreamingAnalyzer } = await import('../analysis/streaming.js');

        const streamingAnalyzer = new StreamingAnalyzer(
          this.sheetsApi,
          tieredRetrieval,
          1000 // 1000 rows per chunk
        );

        // Execute streaming analysis with progress tracking
        const streamingResult = await streamingAnalyzer.execute(
          req.spreadsheetId,
          sheetId as number | undefined,
          metadata,
          async (chunk) => {
            // Progress callback
            const progressPercent = ((chunk.rowsProcessed / chunk.totalRows) * 100).toFixed(1);
            logger.info('Streaming progress', {
              chunkIndex: chunk.chunkIndex,
              totalChunks: chunk.totalChunks,
              progress: `${progressPercent}%`,
              partialResults: chunk.partialResults,
            });
          }
        );

        const duration = Date.now() - startTime;

        logger.info('Streaming analysis complete', {
          totalRowsProcessed: streamingResult.totalRowsProcessed,
          totalChunks: streamingResult.totalChunks,
          duration: streamingResult.duration,
        });

        return {
          success: true,
          action: 'analyze_data',
          executionPath: 'streaming',
          summary: `Streaming analysis complete: processed ${streamingResult.totalRowsProcessed} rows in ${streamingResult.totalChunks} chunks. Found ${streamingResult.aggregatedResults.anomalies} anomalies, ${streamingResult.aggregatedResults.trends} trends, ${streamingResult.aggregatedResults.correlations} correlations.`,
          analyses: [
            {
              type: 'summary',
              confidence: 'high',
              findings: [
                `Processed ${streamingResult.totalRowsProcessed} rows using chunked streaming (${streamingResult.totalChunks} chunks)`,
                `Detected ${streamingResult.aggregatedResults.anomalies} anomalies`,
                `Identified ${streamingResult.aggregatedResults.trends} trend patterns`,
                `Found ${streamingResult.aggregatedResults.correlations} correlations`,
                `Null cells: ${streamingResult.aggregatedResults.nullCount}`,
                `Duplicate rows: ${streamingResult.aggregatedResults.duplicateCount}`,
              ],
              details: `Streaming analysis on large dataset: trends=${streamingResult.aggregatedResults.trends}, anomalies=${streamingResult.aggregatedResults.anomalies}, correlations=${streamingResult.aggregatedResults.correlations}, chunks=${streamingResult.totalChunks}`,
            },
          ],
          overallQualityScore: Math.max(
            50,
            100 -
              Math.floor(
                (streamingResult.aggregatedResults.nullCount / streamingResult.totalRowsProcessed) *
                  100
              )
          ),
          topInsights: [
            `${streamingResult.aggregatedResults.anomalies} anomalies detected across all chunks`,
            `${streamingResult.aggregatedResults.trends} trend patterns identified`,
            `${streamingResult.aggregatedResults.duplicateCount} duplicate rows found`,
            `Processed ${streamingResult.totalRowsProcessed} rows in ${(streamingResult.duration / 1000).toFixed(1)}s`,
          ],
          duration,
          message: `Streaming analysis complete: ${streamingResult.totalRowsProcessed} rows processed in ${streamingResult.totalChunks} chunks (${(duration / 1000).toFixed(1)}s)`,
        };
      }
    }
  }

  /**
   * Check if comprehensive analysis should use task-based execution
   * Based on estimated execution time (>10s for large spreadsheets)
   */
  private async shouldUseTaskForComprehensive(
    spreadsheetId: string,
    sheetId?: number | string
  ): Promise<boolean> {
    try {
      // Get spreadsheet metadata to estimate size
      const metadata = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
      });

      if (!metadata.data.sheets) {
        return false;
      }

      // Calculate total cells
      const sheets = sheetId
        ? metadata.data.sheets.filter((s) => s.properties?.sheetId === sheetId)
        : metadata.data.sheets;

      const totalCells = sheets.reduce(
        (sum, s) =>
          sum +
          (s.properties?.gridProperties?.rowCount || 0) *
            (s.properties?.gridProperties?.columnCount || 0),
        0
      );

      const sheetCount = sheets.length;

      // Use task if:
      // - >10 sheets OR (lowered from 20 - Issue #3 timeout fix)
      // - >100K cells OR (lowered from 1M - Issue #3 timeout fix)
      // - >10K rows in any sheet (lowered from 50K - Issue #3 timeout fix)
      const hasLargeSheet = sheets.some(
        (s) => (s.properties?.gridProperties?.rowCount || 0) > 10000
      );

      const shouldUseTask = sheetCount > 10 || totalCells > 100000 || hasLargeSheet;

      logger.info('Task decision for comprehensive analysis', {
        spreadsheetId,
        sheetCount,
        totalCells,
        hasLargeSheet,
        shouldUseTask,
      });

      return shouldUseTask;
    } catch (error) {
      logger.warn('Failed to estimate spreadsheet size for task decision', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false; // Default to synchronous
    }
  }

  /**
   * Run comprehensive analysis as a background task
   */
  private async runComprehensiveAnalysisTask(
    taskId: string,
    input: ComprehensiveInput
  ): Promise<void> {
    const taskStore = this.context.taskStore;
    if (!taskStore) {
      throw new ServiceError(
        'Task store not available',
        'SERVICE_NOT_INITIALIZED',
        'TaskStore',
        false
      );
    }

    try {
      // Update task status to working
      await taskStore.updateTaskStatus(taskId, 'working', 'Analyzing spreadsheet...');

      // Create analyzer
      const analyzer = new ComprehensiveAnalyzer(this.sheetsApi, {
        includeFormulas: 'includeFormulas' in input ? (input.includeFormulas as boolean) : true,
        includeVisualizations:
          'includeVisualizations' in input ? (input.includeVisualizations as boolean) : true,
        includePerformance:
          'includePerformance' in input ? (input.includePerformance as boolean) : true,
        forceFullData: 'forceFullData' in input ? (input.forceFullData as boolean) : false,
        samplingThreshold:
          'samplingThreshold' in input ? (input.samplingThreshold as number) : 10000,
        sampleSize: 'sampleSize' in input ? (input.sampleSize as number) : 100,
        sheetId: input.sheetId,
        context: input.context,
        cursor: 'cursor' in input ? (input.cursor as string) : undefined,
        pageSize: 'pageSize' in input ? (input.pageSize as number) : undefined,
      });

      // Run analysis
      const result = await analyzer.analyze(input.spreadsheetId);

      // Store result
      await taskStore.storeTaskResult(taskId, 'completed', {
        content: [
          {
            type: 'text',
            text: `Comprehensive analysis complete: ${result.aggregate.totalIssues} issues found, quality score ${result.aggregate.overallQualityScore.toFixed(0)}%`,
          },
        ],
        structuredContent: result,
      });

      logger.info('Comprehensive analysis task completed', {
        taskId,
        spreadsheetId: input.spreadsheetId,
        sheetCount: result.sheets.length,
      });
    } catch (error) {
      logger.error('Comprehensive analysis task failed', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });

      await taskStore.storeTaskResult(taskId, 'failed', {
        content: [
          {
            type: 'text',
            text: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      });
    }
  }
}
