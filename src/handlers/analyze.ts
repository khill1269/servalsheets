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
import { BaseHandler, unwrapRequest, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import { DataError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import { buildFormulaSamplingRequest } from '../services/sampling-analysis.js';
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
import { storeAnalysisResult } from '../resources/analyze.js';
import { type ScoutResult } from '../analysis/scout.js';
import { ConfidenceScorer, type ComprehensiveAnalysisData } from '../analysis/confidence-scorer.js';
import { getSessionContext } from '../services/session-context.js';
import { handleSuggestVisualizationAction } from './analyze-actions/suggest-visualization.js';
import { handleAnalyzeStructureAction } from './analyze-actions/structure.js';
import { handleDetectPatternsAction } from './analyze-actions/patterns.js';
import { handleAnalyzeQualityAction } from './analyze-actions/quality.js';
import { handleAnalyzePerformanceAction } from './analyze-actions/performance.js';
import { handleAnalyzeFormulasAction } from './analyze-actions/formulas.js';
import { handleExplainAnalysisAction } from './analyze-actions/explain.js';
import { handleQueryNaturalLanguageAction } from './analyze-actions/query-natural-language.js';
import {
  handlePlanAction,
  handleExecutePlanAction,
  handleDrillDownAction,
  handleGenerateActionsAction,
} from './analyze-actions/plan-execute.js';
import {
  handleSuggestNextActionsAction,
  handleAutoEnhanceAction,
  handleDiscoverActionAction,
} from './analyze-actions/suggestions.js';
import { handleScoutAction } from './analyze-actions/scout.js';
import { handleAnalyzeDataAction } from './analyze-actions/analyze-data.js';
import { handleComprehensiveAction } from './analyze-actions/comprehensive.js';

export interface AnalyzeHandlerOptions {
  context: HandlerContext;
}

/**
 * Analyze Handler
 *
 * Uses MCP Sampling to provide AI-powered data analysis.
 */
export class AnalyzeHandler extends BaseHandler<SheetsAnalyzeInput, SheetsAnalyzeOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(
    context: HandlerContext,
    sheetsApi: sheets_v4.Sheets,
    _options?: AnalyzeHandlerOptions
  ) {
    super('sheets_analyze', _options?.context ?? context);
    this.sheetsApi = sheetsApi;
  }

  protected createIntents(_input: SheetsAnalyzeInput): Intent[] {
    return []; // Analyze uses direct API calls, not batch compiler
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
  private applyAnalyzeVerbosityFilter(
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
  private resolveAnalyzeRange(range?: {
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
   * Read data from spreadsheet.
   *
   * Uses metadata-driven range resolution when no range is specified:
   * 1. Fetches sheet metadata to determine actual data bounds (rowCount, columnCount)
   * 2. Constructs a bounded range from the metadata
   * 3. Caps at 10,000 rows × 100 columns to prevent runaway fetches
   *
   * This replaces the previous hardcoded 'A1:ZZ10000' default which fetched 260K cells.
   */
  private async readData(spreadsheetId: string, range?: string): Promise<unknown[][]> {
    let effectiveRange = range;

    if (!effectiveRange) {
      // Metadata-driven: fetch actual sheet bounds first (cheap API call with field mask)
      try {
        const metaResponse = await this.sheetsApi.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets(properties(title,gridProperties(rowCount,columnCount)))',
        });
        const firstSheet = metaResponse.data.sheets?.[0];
        if (firstSheet?.properties?.gridProperties) {
          const { rowCount, columnCount } = firstSheet.properties.gridProperties;
          // Cap at 10,000 rows × 100 columns to prevent runaway fetches
          const maxRows = Math.min(rowCount ?? 1000, 10000);
          const maxCols = Math.min(columnCount ?? 26, 100);
          const colLetter = this.columnIndexToLetter(maxCols - 1);
          const sheetTitle = firstSheet.properties.title ?? 'Sheet1';
          const escapedTitle = sheetTitle.replace(/'/g, "''");
          effectiveRange = `'${escapedTitle}'!A1:${colLetter}${maxRows}`;
        }
      } catch {
        // Fallback: if metadata fetch fails, use a bounded default
        logger.warn('Failed to fetch sheet metadata for range resolution, using bounded default');
      }
      // Final fallback: bounded default (was A1:ZZ10000 = 260K cells, now A1:Z1000 = 26K cells)
      if (!effectiveRange) {
        effectiveRange = 'A1:Z1000';
      }
    }

    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: effectiveRange,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return response.data.values ?? [];
  }

  /**
   * Convert column index (0-based) to A1 notation letter(s).
   * 0 → A, 25 → Z, 26 → AA, etc.
   */
  private columnIndexToLetter(index: number): string {
    let result = '';
    let i = index;
    while (i >= 0) {
      result = String.fromCharCode((i % 26) + 65) + result;
      i = Math.floor(i / 26) - 1;
    }
    return result;
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
          response = await handleAnalyzeDataAction(analyzeInput, {
            sheetsApi: this.sheetsApi,
            hasSampling: !!this.context.server,
            checkSamplingCapability: () => this.checkSamplingCapability(),
            createAIMessage: (samplingRequest) => this.createAIMessage(samplingRequest),
          });
          break;
        }

        case 'generate_formula': {
          // Type assertion: refine() ensures spreadsheetId and description are present
          const formulaInput = req as typeof req & {
            spreadsheetId: string;
            description: string;
          };
          response = await this.handleGenerateFormula(formulaInput, verbosity);
          break;
        }

        case 'suggest_visualization': {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const chartInput = req as typeof req & {
            spreadsheetId: string;
            range: { a1: string } | { sheetName: string; range?: string };
          };
          response = await handleSuggestVisualizationAction(chartInput, {
            checkSamplingCapability: () => this.checkSamplingCapability(),
            resolveAnalyzeRange: (range) => this.resolveAnalyzeRange(range),
            getSheetNameFromRange: (range) => this.getSheetNameFromRange(range),
            resolveSheetId: (spreadsheetId, sheetName) =>
              this.resolveSheetId(spreadsheetId, sheetName),
            readData: (spreadsheetId, range) => this.readData(spreadsheetId, range),
            createAIMessage: (samplingRequest) => this.createAIMessage(samplingRequest),
            samplingServer: this.context.samplingServer,
          });
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
          response = await handleDetectPatternsAction(patternInput, {
            hasServer: !!this.context.server,
            samplingServer: this.context.samplingServer,
            convertRangeInput: (range) => this.convertRangeInput(range),
            resolveAnalyzeRange: (range) => this.resolveAnalyzeRange(range),
            readData: (spreadsheetId, range) => this.readData(spreadsheetId, range),
          });
          break;
        }

        case 'analyze_structure': {
          // Type assertion: refine() ensures spreadsheetId is present
          const structureInput = req as typeof req & {
            spreadsheetId: string;
          };
          response = await handleAnalyzeStructureAction(structureInput, this.sheetsApi);
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
          response = await handleAnalyzeQualityAction(qualityInput, {
            convertRangeInput: (range) => this.convertRangeInput(range),
            resolveAnalyzeRange: (range) => this.resolveAnalyzeRange(range),
            readData: (spreadsheetId, range) => this.readData(spreadsheetId, range),
          });
          break;
        }

        case 'analyze_performance': {
          // Type assertion: refine() ensures spreadsheetId is present
          const perfInput = req as typeof req & {
            spreadsheetId: string;
            maxSheets?: number;
          };
          response = await handleAnalyzePerformanceAction(perfInput, this.sheetsApi);
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
          response = await handleAnalyzeFormulasAction(formulaInput, {
            sheetsApi: this.sheetsApi,
            sendProgress: (current: number, total: number, message?: string) =>
              this.sendProgress(current, total, message),
          });
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
          response = await handleQueryNaturalLanguageAction(nlInput, {
            checkSamplingCapability: () => this.checkSamplingCapability(),
            server: this.context.server!,
            sheetsApi: this.sheetsApi,
          });
          break;
        }

        case 'explain_analysis': {
          // Type assertion: analysisResult should be present
          const explainInput = req as typeof req & {
            analysisResult?: Record<string, unknown>;
            question?: string;
          };
          response = await handleExplainAnalysisAction(
            {
              analysisResult: explainInput.analysisResult,
              question: explainInput.question,
              spreadsheetId: req.spreadsheetId,
            },
            {
              checkSamplingCapability: () => this.checkSamplingCapability(),
              server: this.context.server!,
              samplingServer: this.context.samplingServer,
            }
          );
          break;
        }

        case 'comprehensive': {
          // Type assertion: refine() ensures spreadsheetId is present for 'comprehensive' action
          response = await handleComprehensiveAction(req as ComprehensiveInput, {
            sheetsApi: this.sheetsApi,
            context: this.context,
          });

          // Intelligence cluster: confidence scoring for comprehensive results (non-critical)
          if (response.success) {
            try {
              const respData = response as Record<string, unknown>;
              const comprehensiveData: ComprehensiveAnalysisData = {
                qualityScore:
                  typeof respData['qualityScore'] === 'number'
                    ? (respData['qualityScore'] as number)
                    : undefined,
                issueCount: Array.isArray(respData['issues'])
                  ? (respData['issues'] as unknown[]).length
                  : undefined,
                wasTruncated:
                  typeof respData['wasTruncated'] === 'boolean'
                    ? (respData['wasTruncated'] as boolean)
                    : undefined,
                detectedDomain:
                  typeof respData['detectedDomain'] === 'string'
                    ? (respData['detectedDomain'] as string)
                    : undefined,
                hasVisualizationSuggestions: Array.isArray(respData['visualizationSuggestions'])
                  ? (respData['visualizationSuggestions'] as unknown[]).length > 0
                  : undefined,
              };

              const scorer = new ConfidenceScorer();
              const store = getSessionContext().understandingStore;
              const spreadsheetId = (req as Record<string, unknown>)['spreadsheetId'] as string;

              const assessment = scorer.scoreFromComprehensive(spreadsheetId, comprehensiveData);
              store.updateFromComprehensive(spreadsheetId, assessment, {
                detectedDomain: comprehensiveData.detectedDomain,
              });

              (response as Record<string, unknown>)['confidence'] = {
                overallScore: assessment.overallScore,
                level: assessment.overallLevel,
                dimensions: assessment.dimensions.map((d) => ({
                  dimension: d.dimension,
                  score: d.score,
                  level: d.level,
                  gaps: d.gaps,
                })),
                gaps: assessment.topGaps.map((g) => g.gap),
              };
            } catch (intelligenceErr) {
              logger.warn('Intelligence cluster comprehensive scoring failed (non-critical)', {
                error:
                  intelligenceErr instanceof Error
                    ? intelligenceErr.message
                    : String(intelligenceErr),
              });
            }
          }
          break;
        }

        // ===== PROGRESSIVE ANALYSIS ACTIONS (5 actions) =====

        case 'scout': {
          // Type assertion: refine() ensures spreadsheetId is present
          const scoutInput = req as typeof req & {
            spreadsheetId: string;
            includeColumnTypes?: boolean;
            includeQuickIndicators?: boolean;
            detectIntent?: boolean;
          };
          response = await handleScoutAction(scoutInput, {
            sheetsApi: this.sheetsApi,
            samplingServer: this.context.samplingServer,
          });
          break;
        }

        case 'plan': {
          // Type assertion: refine() ensures spreadsheetId is present
          const planInput = req as typeof req & {
            spreadsheetId: string;
            intent?: ScoutResult['detectedIntent'];
            scoutResult?: unknown;
          };
          response = await handlePlanAction(planInput, this.sheetsApi);
          break;
        }

        case 'execute_plan': {
          // Type assertion: refine() ensures spreadsheetId and plan are present
          const executePlanInput = req as typeof req & {
            spreadsheetId: string;
            plan: {
              steps: Array<{ type: string }>;
            };
          };
          response = await handleExecutePlanAction(executePlanInput);
          break;
        }

        case 'drill_down': {
          // Type assertion: refine() ensures spreadsheetId and target are present
          const drillDownInput = req as typeof req & {
            spreadsheetId: string;
            target:
              | { type: 'issue'; issueId: string }
              | { type: 'sheet'; sheetIndex: number }
              | { type: 'column'; column: string }
              | { type: 'formula'; cell: string }
              | { type: 'pattern'; patternId: string }
              | { type: 'anomaly'; anomalyId: string }
              | { type: 'correlation'; columns: string[] };
            limit?: number;
          };
          response = await handleDrillDownAction(drillDownInput, this.context.samplingServer);
          break;
        }

        case 'generate_actions': {
          // Type assertion: refine() ensures spreadsheetId is present
          const generateActionsInput = req as typeof req & {
            spreadsheetId: string;
            intent?: string;
            findings?: unknown;
            maxActions?: number;
          };
          response = await handleGenerateActionsAction(generateActionsInput);
          break;
        }

        case 'suggest_next_actions': {
          // Type assertion: refine() ensures spreadsheetId is present
          const suggestInput = req as typeof req & {
            spreadsheetId: string;
            range?: { a1?: string; sheetName?: string; range?: string };
            maxSuggestions?: number;
            categories?: Array<
              'formulas' | 'formatting' | 'structure' | 'data_quality' | 'visualization'
            >;
          };
          response = await handleSuggestNextActionsAction(suggestInput, {
            sheetsApi: this.sheetsApi,
            resolveAnalyzeRange: (range) => this.resolveAnalyzeRange(range),
          });
          break;
        }

        case 'auto_enhance': {
          // Type assertion: refine() ensures spreadsheetId is present
          const enhanceInput = req as typeof req & {
            spreadsheetId: string;
            range?: { a1?: string; sheetName?: string; range?: string };
            categories?: Array<
              'formulas' | 'formatting' | 'structure' | 'data_quality' | 'visualization'
            >;
            mode?: 'preview' | 'apply';
            maxEnhancements?: number;
          };
          response = await handleAutoEnhanceAction(enhanceInput, {
            sheetsApi: this.sheetsApi,
            resolveAnalyzeRange: (range) => this.resolveAnalyzeRange(range),
          });
          break;
        }

        case 'discover_action': {
          // Type assertion: refine() ensures query is present
          const discoverInput = req as typeof req & {
            query: string;
            category?: string;
            maxResults?: number;
          };
          response = await handleDiscoverActionAction(discoverInput);
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
              suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
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
      return { response: this.applyAnalyzeVerbosityFilter(response, verbosity) };
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
   * Handle generate_formula action
   * Generate Google Sheets formula from natural language description
   */
  private async handleGenerateFormula(
    req: SheetsAnalyzeInput['request'] & {
      spreadsheetId: string;
      description: string;
    },
    _verbosity: 'minimal' | 'standard' | 'detailed'
  ): Promise<AnalyzeResponse> {
    // Check sampling capability
    const samplingError = await this.checkSamplingCapability();
    if (samplingError) {
      return samplingError;
    }

    const _server = this.context.server!;
    const startTime = Date.now();

    // Read context data if range provided
    let headers: string[] | undefined;
    let sampleData: unknown[][] | undefined;

    if ('range' in req && req.range) {
      const convertedRange = this.convertRangeInput(req.range);
      const rangeStr = this.resolveAnalyzeRange(convertedRange);
      const data = await this.readData(req.spreadsheetId, rangeStr);
      if (data.length > 0) {
        headers = data[0]?.map(String);
        sampleData = data.slice(0, 10);
      }
    }

    // Build sampling request
    const sheetName =
      'range' in req && req.range && 'sheetName' in req.range
        ? (req.range as { sheetName: string }).sheetName
        : undefined;

    const samplingRequest = buildFormulaSamplingRequest(req.description, {
      headers,
      sampleData,
      targetCell: 'targetCell' in req ? req.targetCell : undefined,
      sheetName,
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

      return {
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
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Failed to parse formula response',
          retryable: true,
        },
      };
    }
  }
}
