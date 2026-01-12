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

import type { sheets_v4 } from "googleapis";
import type { HandlerContext } from "./base.js";
import { logger } from "../utils/logger.js";
import {
  getSamplingAnalysisService,
  buildAnalysisSamplingRequest,
  buildFormulaSamplingRequest,
  buildChartSamplingRequest,
  parseAnalysisResponse,
  type AnalysisType,
} from "../services/sampling-analysis.js";
import type {
  SheetsAnalyzeInput,
  SheetsAnalyzeOutput,
  AnalyzeResponse,
} from "../schemas/analyze.js";
import { getCapabilitiesWithCache } from "../services/capability-cache.js";
import { getHotCache } from "../utils/hot-cache.js";
import { TieredRetrieval } from "../analysis/tiered-retrieval.js";
import { AnalysisRouter } from "../analysis/router.js";
import { storeAnalysisResult } from "../resources/analyze.js";

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
    _options?: AnalyzeHandlerOptions,
  ) {
    // If options.context is provided, use it; otherwise use the passed context
    this.context = _options?.context ?? context;
    this.sheetsApi = sheetsApi;
  }

  /**
   * Convert RangeInput to simple format for resolveRange
   */
  private convertRangeInput(
    range:
      | { a1: string }
      | { namedRange: string }
      | { semantic: unknown }
      | { grid: unknown }
      | undefined,
  ): { a1?: string; sheetName?: string; range?: string } | undefined {
    if (!range) return undefined;
    if ("a1" in range) return { a1: range.a1 };
    if ("namedRange" in range) return { a1: range.namedRange };
    // Semantic and grid ranges will be supported in Phase 2
    return undefined;
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
    if ("a1" in range && range.a1) return range.a1;
    if ("sheetName" in range && range.sheetName) {
      return range.range
        ? `${range.sheetName}!${range.range}`
        : range.sheetName;
    }
    // OK: Explicit empty - typed as optional, invalid range format
    return undefined;
  }

  /**
   * Read data from spreadsheet
   */
  private async readData(
    spreadsheetId: string,
    range?: string,
  ): Promise<unknown[][]> {
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: range ?? "A:ZZ",
      valueRenderOption: "FORMATTED_VALUE",
    });
    return response.data.values ?? [];
  }

  /**
   * Handle analysis requests
   */
  async handle(input: SheetsAnalyzeInput): Promise<SheetsAnalyzeOutput> {
    // Input is now the action directly (no request wrapper)
    const analysisService = getSamplingAnalysisService();

    try {
      let response: AnalyzeResponse;

      switch (input.action) {
        case "analyze_data": {
          // Type assertion: refine() ensures spreadsheetId is present for 'analyze_data' action
          const analyzeInput = input as typeof input & {
            spreadsheetId: string;
          };

          const startTime = Date.now();

          // PHASE 1 P0: Intelligent Routing with Tiered Retrieval
          // Create tiered retrieval instance
          const tieredRetrieval = new TieredRetrieval({
            cache: getHotCache(),
            sheetsApi: this.sheetsApi,
            defaultSampleSize: 100,
            maxSampleSize: 500,
          });

          // Get metadata first (fast, ~0.3s, cached 5min)
          const metadata = await tieredRetrieval.getMetadata(
            analyzeInput.spreadsheetId,
          );

          // Route to optimal execution path
          const router = new AnalysisRouter({
            hasSampling: !!this.context.server,
            hasTasks: true, // P1: Task support now enabled (taskSupport: "optional")
          });
          const decision = router.route(analyzeInput, metadata);

          logger.info("Analysis routing decision", {
            spreadsheetId: analyzeInput.spreadsheetId,
            path: decision.path,
            reason: decision.reason,
            estimatedDuration: decision.estimatedDuration,
          });

          // Execute based on routing decision
          switch (decision.path) {
            case "fast": {
              // Fast path: Traditional statistics without LLM
              // Use tiered retrieval - sample data is sufficient for fast analysis (95%+ accuracy)
              const sheetId =
                "sheetId" in analyzeInput ? analyzeInput.sheetId : undefined;
              const sampleResult = await tieredRetrieval.getSample(
                analyzeInput.spreadsheetId,
                sheetId as number | undefined,
                100, // Default sample size
              );

              // Extract sample data
              const data = sampleResult.sampleData.rows;
              if (!data || data.length === 0) {
                response = {
                  success: false,
                  error: {
                    code: "NO_DATA",
                    message: "No data found in the specified range",
                    retryable: false,
                  },
                };
                break;
              }

              logger.info("Fast path using tier 3 (sample)", {
                sampleSize: sampleResult.sampleData.sampleSize,
                totalRows: sampleResult.sampleData.totalRows,
                samplingMethod: sampleResult.sampleData.samplingMethod,
              });

              // Use helper functions for fast statistical analysis
              const {
                analyzeTrends,
                detectAnomalies,
                analyzeCorrelationsData,
              } = await import("../analysis/helpers.js");

              const trends = analyzeTrends(data);
              const anomalies = detectAnomalies(data);
              const correlations = analyzeCorrelationsData(data);

              const duration = Date.now() - startTime;

              response = {
                success: true,
                action: "analyze_data",
                summary: `Fast statistical analysis complete (sample: ${sampleResult.sampleData.sampleSize}/${sampleResult.sampleData.totalRows} rows). Found ${anomalies.length} anomalies, ${trends.length} trends, and ${correlations.length} correlations.`,
                analyses: [
                  {
                    type: "summary",
                    confidence: "high",
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
              break;
            }

            case "ai": {
              // AI path: LLM-powered analysis via MCP Sampling
              // Check if server is available
              if (!this.context.server) {
                response = {
                  success: false,
                  error: {
                    code: "SAMPLING_UNAVAILABLE",
                    message:
                      "MCP Server instance not available. Cannot perform sampling.",
                    retryable: false,
                  },
                };
                break;
              }

              // Check if client supports sampling (with caching)
              const sessionId = this.context.requestId || "default";
              const clientCapabilities = await getCapabilitiesWithCache(
                sessionId,
                this.context.server,
              );
              if (!clientCapabilities?.sampling) {
                response = {
                  success: false,
                  error: {
                    code: "SAMPLING_UNAVAILABLE",
                    message:
                      "MCP Sampling capability not available. The client must support sampling (SEP-1577).",
                    retryable: false,
                  },
                };
                break;
              }

              // Use tiered retrieval - sample for medium datasets, full for explicit requests
              const sheetId =
                "sheetId" in analyzeInput ? analyzeInput.sheetId : undefined;

              // Determine which tier to use based on request
              const useFullData =
                "analysisTypes" in analyzeInput &&
                Array.isArray(analyzeInput.analysisTypes) &&
                analyzeInput.analysisTypes.includes("quality"); // Quality analysis benefits from full data

              const dataResult = useFullData
                ? await tieredRetrieval.getFull(
                    analyzeInput.spreadsheetId,
                    sheetId as number | undefined,
                  )
                : await tieredRetrieval.getSample(
                    analyzeInput.spreadsheetId,
                    sheetId as number | undefined,
                    200, // Larger sample for AI analysis
                  );

              // Extract data (sample or full)
              const data = useFullData
                ? "fullData" in dataResult
                  ? dataResult.fullData.values
                  : []
                : "sampleData" in dataResult
                  ? dataResult.sampleData.rows
                  : [];

              if (!data || data.length === 0) {
                response = {
                  success: false,
                  error: {
                    code: "NO_DATA",
                    message: "No data found in the specified range",
                    retryable: false,
                  },
                };
                break;
              }

              logger.info(
                `AI path using tier ${useFullData ? "4 (full)" : "3 (sample)"}`,
                {
                  dataSize: data.length,
                  useFullData,
                },
              );

              // Build sampling request
              const targetSheet =
                sheetId !== undefined
                  ? metadata.sheets.find((s) => s.sheetId === sheetId)
                  : metadata.sheets[0];
              const sheetName = targetSheet?.title;

              const samplingRequest = buildAnalysisSamplingRequest(data, {
                spreadsheetId: analyzeInput.spreadsheetId,
                sheetName,
                range: undefined, // Tiered retrieval handles range
                analysisTypes: analyzeInput.analysisTypes as AnalysisType[],
                context: analyzeInput.context,
                maxTokens: analyzeInput.maxTokens,
              });

              // Call LLM via MCP Sampling
              const samplingResult =
                await this.context.server.createMessage(samplingRequest);
              const duration = Date.now() - startTime;

              // Parse the response (extract text from content)
              const contentText =
                typeof samplingResult.content === "string"
                  ? samplingResult.content
                  : samplingResult.content.type === "text"
                    ? samplingResult.content.text
                    : "";
              const parsed = parseAnalysisResponse(contentText);

              if (!parsed.success || !parsed.result) {
                analysisService.recordFailure(
                  analyzeInput.analysisTypes as AnalysisType[],
                );
                response = {
                  success: false,
                  error: {
                    code: "PARSE_ERROR",
                    message:
                      parsed.error ?? "Failed to parse analysis response",
                    retryable: true,
                  },
                };
                break;
              }

              analysisService.recordSuccess(
                analyzeInput.analysisTypes as AnalysisType[],
                duration,
              );

              response = {
                success: true,
                action: "analyze_data",
                summary: parsed.result.summary,
                analyses: parsed.result.analyses.map((a) => ({
                  type: a.type as AnalysisType,
                  confidence: a.confidence as "high" | "medium" | "low",
                  findings: a.findings,
                  details: a.details,
                  affectedCells: a.affectedCells,
                  recommendations: a.recommendations,
                })),
                overallQualityScore: parsed.result.overallQualityScore,
                topInsights: parsed.result.topInsights,
                duration,
                message: `AI path analysis complete (tier ${useFullData ? "4" : "3"}): ${parsed.result.analyses.length} finding(s) with ${parsed.result.topInsights.length} key insight(s)`,
              };
              break;
            }

            case "streaming": {
              // Streaming path: Task-based chunked processing
              // Full implementation using StreamingAnalyzer
              logger.info("Streaming path selected - chunked processing", {
                decision,
              });

              const sheetId =
                "sheetId" in analyzeInput ? analyzeInput.sheetId : undefined;

              // Import StreamingAnalyzer
              const { StreamingAnalyzer } =
                await import("../analysis/streaming.js");

              const streamingAnalyzer = new StreamingAnalyzer(
                this.sheetsApi,
                tieredRetrieval,
                1000, // 1000 rows per chunk
              );

              // Execute streaming analysis with progress tracking
              const streamingResult = await streamingAnalyzer.execute(
                analyzeInput.spreadsheetId,
                sheetId as number | undefined,
                metadata,
                async (chunk) => {
                  // Progress callback
                  const progressPercent = (
                    (chunk.rowsProcessed / chunk.totalRows) *
                    100
                  ).toFixed(1);
                  logger.info("Streaming progress", {
                    chunkIndex: chunk.chunkIndex,
                    totalChunks: chunk.totalChunks,
                    progress: `${progressPercent}%`,
                    partialResults: chunk.partialResults,
                  });
                },
              );

              const duration = Date.now() - startTime;

              logger.info("Streaming analysis complete", {
                totalRowsProcessed: streamingResult.totalRowsProcessed,
                totalChunks: streamingResult.totalChunks,
                duration: streamingResult.duration,
              });

              response = {
                success: true,
                action: "analyze_data",
                executionPath: "streaming",
                summary: `Streaming analysis complete: processed ${streamingResult.totalRowsProcessed} rows in ${streamingResult.totalChunks} chunks. Found ${streamingResult.aggregatedResults.anomalies} anomalies, ${streamingResult.aggregatedResults.trends} trends, ${streamingResult.aggregatedResults.correlations} correlations.`,
                analyses: [
                  {
                    type: "summary",
                    confidence: "high",
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
                      (streamingResult.aggregatedResults.nullCount /
                        streamingResult.totalRowsProcessed) *
                        100,
                    ),
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
              break;
            }
          }
          break;
        }

        case "generate_formula": {
          // Type assertion: refine() ensures spreadsheetId and description are present
          const formulaInput = input as typeof input & {
            spreadsheetId: string;
            description: string;
          };

          // Check if server is available
          if (!this.context.server) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Server instance not available. Cannot perform sampling.",
                retryable: false,
              },
            };
            break;
          }

          // Check if client supports sampling (with caching)
          const sessionId2 = this.context.requestId || "default";
          const clientCapabilities2 = await getCapabilitiesWithCache(
            sessionId2,
            this.context.server,
          );
          if (!clientCapabilities2?.sampling) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Sampling capability not available. The client must support sampling (SEP-1577).",
                retryable: false,
              },
            };
            break;
          }

          const startTime = Date.now();

          // Read context data if range provided
          let headers: string[] | undefined;
          let sampleData: unknown[][] | undefined;

          if (formulaInput.range) {
            const convertedFormulaRange = this.convertRangeInput(
              formulaInput.range,
            );
            const rangeStr = this.resolveRange(convertedFormulaRange);
            const data = await this.readData(
              formulaInput.spreadsheetId,
              rangeStr,
            );
            if (data.length > 0) {
              headers = data[0]?.map(String);
              sampleData = data.slice(0, 10);
            }
          }

          // Build sampling request
          const formulaSheetName =
            formulaInput.range && "sheetName" in formulaInput.range
              ? (formulaInput.range as { sheetName: string }).sheetName
              : undefined;

          const samplingRequest = buildFormulaSamplingRequest(
            formulaInput.description,
            {
              headers,
              sampleData,
              targetCell: formulaInput.targetCell,
              sheetName: formulaSheetName,
            },
          );

          // Call LLM via MCP Sampling
          const samplingResult =
            await this.context.server.createMessage(samplingRequest);
          const duration = Date.now() - startTime;

          // Parse the response (extract text from content)
          const contentText =
            typeof samplingResult.content === "string"
              ? samplingResult.content
              : samplingResult.content.type === "text"
                ? samplingResult.content.text
                : "";

          try {
            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON in response");
            const parsed = JSON.parse(jsonMatch[0]);

            response = {
              success: true,
              action: "generate_formula",
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
            logger.error("Failed to parse formula response", {
              component: "analyze-handler",
              action: "generate_formula",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "PARSE_ERROR",
                message: "Failed to parse formula response",
                retryable: true,
              },
            };
          }
          break;
        }

        case "suggest_visualization": {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const chartInput = input as typeof input & {
            spreadsheetId: string;
            range: { a1: string } | { sheetName: string; range?: string };
          };

          // Check if server is available
          if (!this.context.server) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Server instance not available. Cannot perform sampling.",
                retryable: false,
              },
            };
            break;
          }

          // Check if client supports sampling (with caching)
          const sessionId3 = this.context.requestId || "default";
          const clientCapabilities3 = await getCapabilitiesWithCache(
            sessionId3,
            this.context.server,
          );
          if (!clientCapabilities3?.sampling) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Sampling capability not available. The client must support sampling (SEP-1577).",
                retryable: false,
              },
            };
            break;
          }

          const startTime = Date.now();

          // Read the data
          const rangeStr = this.resolveRange(chartInput.range);
          const data = await this.readData(chartInput.spreadsheetId, rangeStr);

          if (data.length === 0) {
            response = {
              success: false,
              error: {
                code: "NO_DATA",
                message: "No data found in the specified range",
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

          // Call LLM via MCP Sampling
          const samplingResult =
            await this.context.server.createMessage(samplingRequest);
          const duration = Date.now() - startTime;

          // Parse the response (extract text from content)
          const contentText =
            typeof samplingResult.content === "string"
              ? samplingResult.content
              : samplingResult.content.type === "text"
                ? samplingResult.content.text
                : "";

          try {
            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON in response");
            const parsed = JSON.parse(jsonMatch[0]);

            // Build chart recommendations with executable params
            const chartRecommendations = parsed.recommendations?.map(
              (r: Record<string, unknown>) => {
                const config = r["configuration"] as
                  | Record<string, unknown>
                  | undefined;

                // Build executable params for sheets_charts:create
                const executionParams = {
                  tool: "sheets_charts" as const,
                  action: "create" as const,
                  params: {
                    spreadsheetId: chartInput.spreadsheetId,
                    chartType: String(r["chartType"] || "LINE"),
                    dataRange: rangeStr,
                    title: String(
                      config?.["title"] || `${r["chartType"]} Chart`,
                    ),
                    xAxisTitle: String(config?.["categories"] || ""),
                    yAxisTitle: "Values",
                    legendPosition: "BOTTOM_LEGEND",
                  },
                };

                return {
                  chartType: r["chartType"],
                  suitabilityScore: r["suitabilityScore"],
                  reasoning: r["reasoning"],
                  configuration: r["configuration"],
                  insights: r["insights"],
                  executionParams,
                };
              },
            );

            response = {
              success: true,
              action: "suggest_chart",
              chartRecommendations,
              dataAssessment: parsed.dataAssessment,
              duration,
              message: `${chartRecommendations?.length ?? 0} chart type(s) recommended with executable params`,
            };
          } catch (error) {
            logger.error("Failed to parse chart recommendation response", {
              component: "analyze-handler",
              action: "suggest_chart",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "PARSE_ERROR",
                message: "Failed to parse chart recommendation response",
                retryable: true,
              },
            };
          }
          break;
        }

        case "detect_patterns": {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const patternInput = input as typeof input & {
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
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Sampling is not available. detect_patterns requires an LLM via Sampling.",
                retryable: false,
              },
            };
            break;
          }

          const startTime = Date.now();

          // Read the data
          const convertedPatternRange = this.convertRangeInput(
            patternInput.range,
          );
          const rangeStr = this.resolveRange(convertedPatternRange);
          const data = await this.readData(
            patternInput.spreadsheetId,
            rangeStr,
          );

          if (data.length === 0) {
            response = {
              success: false,
              error: {
                code: "NO_DATA",
                message: "No data found in the specified range",
                retryable: false,
              },
            };
            break;
          }

          // Use helpers from analysis/helpers.ts for pattern detection
          const { detectAnomalies, analyzeTrends, analyzeCorrelationsData } =
            await import("../analysis/helpers.js");

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
              action: "detect_patterns",
              patterns: {
                anomalies: anomalies.map((a) => ({
                  location: a.cell,
                  value: a.value,
                  severity:
                    parseFloat(a.zScore) > 3
                      ? "high"
                      : parseFloat(a.zScore) > 2
                        ? "medium"
                        : "low",
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
                  columns: correlations.map(
                    (c) => `Columns ${c.columns.join(" & ")}`,
                  ),
                },
              },
              duration,
              message: `Found ${anomalies.length} anomalies, ${trends.length} trends, ${correlations.length} correlations`,
            };
          } catch (error) {
            logger.error("Failed to detect patterns", {
              component: "analyze-handler",
              action: "detect_patterns",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to detect patterns",
                retryable: true,
              },
            };
          }
          break;
        }

        case "analyze_structure": {
          // Type assertion: refine() ensures spreadsheetId is present
          const structureInput = input as typeof input & {
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
              (sum, sheet) =>
                sum + (sheet.properties?.gridProperties?.rowCount ?? 0),
              0,
            );
            const totalColumns = sheets.reduce(
              (sum, sheet) =>
                sum + (sheet.properties?.gridProperties?.columnCount ?? 0),
              0,
            );

            const structure = {
              sheets: sheets.length,
              totalRows,
              totalColumns,
              namedRanges: namedRanges.map((nr) => ({
                name: nr.name ?? "Unnamed",
                range:
                  nr.range?.startRowIndex !== undefined &&
                  nr.range.startRowIndex !== null
                    ? `${sheets[nr.range.sheetId ?? 0]?.properties?.title ?? "Sheet1"}!R${nr.range.startRowIndex + 1}C${(nr.range.startColumnIndex ?? 0) + 1}:R${nr.range.endRowIndex ?? 0}C${nr.range.endColumnIndex ?? 0}`
                    : "Unknown",
              })),
            };

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: "analyze_structure",
              structure,
              duration,
              message: `Analyzed structure: ${structure.sheets} sheets, ${structure.totalRows} total rows, ${structure.namedRanges?.length ?? 0} named ranges`,
            };
          } catch (error) {
            logger.error("Failed to analyze structure", {
              component: "analyze-handler",
              action: "analyze_structure",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to analyze structure",
                retryable: true,
              },
            };
          }
          break;
        }

        case "analyze_quality": {
          // Type assertion: refine() ensures spreadsheetId and range are present
          const qualityInput = input as typeof input & {
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
            const convertedQualityRange = this.convertRangeInput(
              qualityInput.range,
            );
            const rangeStr = this.resolveRange(convertedQualityRange);
            const data = await this.readData(
              qualityInput.spreadsheetId,
              rangeStr,
            );

            if (data.length === 0) {
              response = {
                success: false,
                error: {
                  code: "NO_DATA",
                  message: "No data found in the specified range",
                  retryable: false,
                },
              };
              break;
            }

            // Use helpers from analysis/helpers.ts for quality analysis
            const { checkColumnQuality, detectDataType } =
              await import("../analysis/helpers.js");

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
              columnResults.reduce((sum, col) => sum + col.completeness, 0) /
              columnResults.length;
            const avgConsistency =
              columnResults.reduce((sum, col) => sum + col.consistency, 0) /
              columnResults.length;
            const overallScore = (avgCompleteness + avgConsistency) / 2;

            // Build issues array
            const issues = columnResults.flatMap((col) =>
              col.issues.map((issue) => ({
                type: "MIXED_DATA_TYPES" as const,
                severity: "medium" as const,
                location: col.column,
                description: issue,
                autoFixable: false,
                fixTool: undefined,
                fixAction: undefined,
              })),
            );

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: "analyze_quality",
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
            logger.error("Failed to analyze quality", {
              component: "analyze-handler",
              action: "analyze_quality",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to analyze quality",
                retryable: true,
              },
            };
          }
          break;
        }

        case "analyze_performance": {
          // Type assertion: refine() ensures spreadsheetId is present
          const perfInput = input as typeof input & {
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
                  const cols =
                    sheet.properties?.gridProperties?.columnCount ?? 0;
                  return rows * cols > 50000;
                })
                .map((sheet) => sheet.properties?.title ?? "Untitled"),
              complexFormulas: sheets.reduce(
                (sum, sheet) =>
                  sum +
                  (sheet.data?.[0]?.rowData?.filter((row) =>
                    row.values?.some(
                      (cell) => cell.userEnteredValue?.formulaValue,
                    ),
                  ).length ?? 0),
                0,
              ),
              conditionalFormats: sheets.reduce(
                (sum, sheet) => sum + (sheet.conditionalFormats?.length ?? 0),
                0,
              ),
              charts: sheets.reduce(
                (sum, sheet) => sum + (sheet.charts?.length ?? 0),
                0,
              ),
            };

            const recommendations: Array<{
              type:
                | "VOLATILE_FORMULAS"
                | "EXCESSIVE_FORMULAS"
                | "LARGE_RANGES"
                | "CIRCULAR_REFERENCES"
                | "INEFFICIENT_STRUCTURE"
                | "TOO_MANY_SHEETS";
              severity: "low" | "medium" | "high";
              description: string;
              estimatedImpact: string;
              recommendation: string;
            }> = [];

            if (performance.totalCells > 1000000) {
              recommendations.push({
                type: "LARGE_RANGES",
                severity: "high",
                description: `Spreadsheet has ${performance.totalCells.toLocaleString()} cells`,
                estimatedImpact: "Slow load times, high memory usage",
                recommendation:
                  "Consider splitting into multiple smaller spreadsheets",
              });
            }
            if (performance.largeSheets.length > 0) {
              recommendations.push({
                type: "INEFFICIENT_STRUCTURE",
                severity: "medium",
                description: `Large sheets detected: ${performance.largeSheets.join(", ")}`,
                estimatedImpact: "Slower sheet switching and rendering",
                recommendation: "Archive or split large sheets",
              });
            }
            if (performance.conditionalFormats > 50) {
              recommendations.push({
                type: "INEFFICIENT_STRUCTURE",
                severity: "medium",
                description: `${performance.conditionalFormats} conditional format rules`,
                estimatedImpact: "Increased rendering time",
                recommendation:
                  "Consolidate or remove unused conditional formats",
              });
            }
            if (performance.charts > 20) {
              recommendations.push({
                type: "INEFFICIENT_STRUCTURE",
                severity: "low",
                description: `${performance.charts} charts present`,
                estimatedImpact: "Slower initial load",
                recommendation:
                  "Consider moving charts to separate dashboard sheets",
              });
            }

            // Calculate overall performance score (0-100)
            const overallScore = Math.max(
              0,
              100 -
                ((performance.totalCells > 1000000 ? 30 : 0) +
                  performance.largeSheets.length * 10 +
                  (performance.conditionalFormats > 50 ? 20 : 0) +
                  (performance.charts > 20 ? 10 : 0)),
            );

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: "analyze_performance",
              performance: {
                overallScore,
                recommendations,
                estimatedImprovementPotential:
                  recommendations.length > 0
                    ? `${recommendations.length} optimization${recommendations.length > 1 ? "s" : ""} available`
                    : "No major optimizations needed",
              },
              duration,
              message: `Performance score: ${overallScore}/100 (${recommendations.length} recommendations)`,
            };
          } catch (error) {
            logger.error("Failed to analyze performance", {
              component: "analyze-handler",
              action: "analyze_performance",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to analyze performance",
                retryable: true,
              },
            };
          }
          break;
        }

        case "analyze_formulas": {
          // Type assertion: refine() ensures spreadsheetId is present
          const formulaInput = input as typeof input & {
            spreadsheetId: string;
            sheetId?: number;
            includeOptimizations?: boolean;
            includeComplexity?: boolean;
          };

          const startTime = Date.now();

          try {
            // Get metadata
            const tieredRetrieval = new TieredRetrieval({
              cache: getHotCache(),
              sheetsApi: this.sheetsApi,
            });

            // Get metadata to know which sheets to analyze
            const metadata = await tieredRetrieval.getMetadata(
              formulaInput.spreadsheetId,
            );

            // Extract all formulas from sheets using Google Sheets API
            const formulas: Array<{ cell: string; formula: string }> = [];

            // Fetch formulas from each sheet using includeGridData with fields filter
            for (const sheet of metadata.sheets) {
              const response = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: formulaInput.spreadsheetId,
                ranges: [`'${sheet.title}'`],
                includeGridData: true,
                fields:
                  "sheets(data(rowData(values(userEnteredValue))),properties(title))",
              });

              if (response.data.sheets && response.data.sheets[0]?.data) {
                const sheetData = response.data.sheets[0];
                const sheetTitle = sheetData.properties?.title || sheet.title;

                for (const gridData of sheetData.data || []) {
                  if (!gridData.rowData) continue;

                  for (
                    let rowIdx = 0;
                    rowIdx < gridData.rowData.length;
                    rowIdx++
                  ) {
                    const row = gridData.rowData[rowIdx];
                    if (!row?.values) continue;

                    for (let colIdx = 0; colIdx < row.values.length; colIdx++) {
                      const cell = row.values[colIdx];
                      if (cell?.userEnteredValue?.formulaValue) {
                        const cellA1 = `${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;
                        formulas.push({
                          cell: `${sheetTitle}!${cellA1}`,
                          formula: cell.userEnteredValue.formulaValue,
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
            } = await import("../analysis/formula-helpers.js");

            // Analyze formulas
            const volatileFormulas = findVolatileFormulas(formulas);
            const circularRefs = detectCircularRefs(formulas);

            // Complexity analysis
            const complexityScores = formulas.map((f) =>
              analyzeFormulaComplexity(f.cell, f.formula),
            );

            const complexityDistribution = {
              simple: complexityScores.filter((c) => c.category === "simple")
                .length,
              moderate: complexityScores.filter(
                (c) => c.category === "moderate",
              ).length,
              complex: complexityScores.filter((c) => c.category === "complex")
                .length,
              very_complex: complexityScores.filter(
                (c) => c.category === "very_complex",
              ).length,
            };

            // Optimization suggestions
            const optimizationOpportunities =
              formulaInput.includeOptimizations !== false
                ? generateOptimizations(formulas)
                : [];

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: "analyze_formulas",
              formulaAnalysis: {
                totalFormulas: formulas.length,
                complexityDistribution,
                volatileFormulas: volatileFormulas.map((v) => ({
                  cell: v.cell,
                  formula: v.formula,
                  volatileFunctions: v.volatileFunctions,
                  impact: v.impact,
                  suggestion: v.suggestion,
                })),
                optimizationOpportunities: optimizationOpportunities.map(
                  (o) => ({
                    type: o.type,
                    priority: o.priority,
                    affectedCells: o.affectedCells,
                    currentFormula: o.currentFormula,
                    suggestedFormula: o.suggestedFormula,
                    reasoning: o.reasoning,
                  }),
                ),
                circularReferences:
                  circularRefs.length > 0
                    ? circularRefs.map((c) => ({
                        cells: c.cells,
                        chain: c.chain,
                      }))
                    : undefined,
              },
              duration,
              message: `Analyzed ${formulas.length} formulas: ${volatileFormulas.length} volatile, ${optimizationOpportunities.length} optimizations available`,
            };
          } catch (error) {
            logger.error("Failed to analyze formulas", {
              component: "analyze-handler",
              action: "analyze_formulas",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to analyze formulas",
                retryable: true,
              },
            };
          }
          break;
        }

        case "query_natural_language": {
          // Type assertion: refine() ensures spreadsheetId and query are present
          const nlInput = input as typeof input & {
            spreadsheetId: string;
            query: string;
            sheetId?: number;
            conversationId?: string;
          };

          // Check if server is available
          if (!this.context.server) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Server instance not available. Cannot perform sampling.",
                retryable: false,
              },
            };
            break;
          }

          // Check if client supports sampling
          const sessionId = this.context.requestId || "default";
          const clientCapabilities = await getCapabilitiesWithCache(
            sessionId,
            this.context.server,
          );
          if (!clientCapabilities?.sampling) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Sampling capability not available. The client must support sampling (SEP-1577).",
                retryable: false,
              },
            };
            break;
          }

          const startTime = Date.now();

          try {
            // Get metadata and sample data
            const tieredRetrieval = new TieredRetrieval({
              cache: getHotCache(),
              sheetsApi: this.sheetsApi,
            });

            const metadata = await tieredRetrieval.getMetadata(
              nlInput.spreadsheetId,
            );
            const sampleData = await tieredRetrieval.getSample(
              nlInput.spreadsheetId,
            );

            // Get target sheet
            const targetSheet = nlInput.sheetId
              ? metadata.sheets.find((s) => s.sheetId === nlInput.sheetId)
              : metadata.sheets[0];

            if (!targetSheet) {
              response = {
                success: false,
                error: {
                  code: "SHEET_NOT_FOUND",
                  message: "Target sheet not found",
                  retryable: false,
                },
              };
              break;
            }

            // Import conversational helpers
            const {
              detectQueryIntent,
              buildNLQuerySamplingRequest,
              validateQuery,
            } = await import("../analysis/conversational-helpers.js");
            const { inferSchema } =
              await import("../analysis/structure-helpers.js");

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
                  code: "VALIDATION_ERROR",
                  message: validation.reason || "Invalid query",
                  retryable: false,
                },
              };
              break;
            }

            // Build sampling request
            const samplingRequest = buildNLQuerySamplingRequest(
              nlInput.query,
              context,
            );

            // Call LLM via MCP Sampling
            const samplingResult =
              await this.context.server.createMessage(samplingRequest);

            // Parse response
            const contentText =
              typeof samplingResult.content === "string"
                ? samplingResult.content
                : samplingResult.content.type === "text"
                  ? samplingResult.content.text
                  : "";

            const jsonMatch = contentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new Error("No JSON in response");
            }
            const parsed = JSON.parse(jsonMatch[0]);

            const duration = Date.now() - startTime;

            response = {
              success: true,
              action: "query_natural_language",
              queryResult: {
                query: nlInput.query,
                answer: parsed.answer || "No answer provided",
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
            logger.error("Failed to process natural language query", {
              component: "analyze-handler",
              action: "query_natural_language",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to process natural language query",
                retryable: true,
              },
            };
          }
          break;
        }

        case "explain_analysis": {
          // Type assertion: analysisResult should be present
          const explainInput = input as typeof input & {
            analysisResult?: Record<string, unknown>;
            question?: string;
          };

          // Check if server is available
          if (!this.context.server) {
            response = {
              success: false,
              error: {
                code: "SAMPLING_UNAVAILABLE",
                message:
                  "MCP Sampling is not available. explain_analysis requires an LLM via Sampling.",
                retryable: false,
              },
            };
            break;
          }

          const startTime = Date.now();

          try {
            // Build a sampling request to explain the analysis
            const questionText = explainInput.question
              ? `${explainInput.question}\n\nContext: ${JSON.stringify(explainInput.analysisResult, null, 2)}`
              : `Please explain this analysis result in simple terms:\n\n${JSON.stringify(explainInput.analysisResult, null, 2)}`;

            const samplingRequest = buildAnalysisSamplingRequest(
              [[questionText]],
              {
                spreadsheetId: "",
                analysisTypes: ["summary" as const],
                maxTokens: 1000,
              },
            );

            const samplingResult =
              await this.context.server.createMessage(samplingRequest);
            const duration = Date.now() - startTime;

            // Extract text from response
            const explanation =
              typeof samplingResult.content === "string"
                ? samplingResult.content
                : samplingResult.content.type === "text"
                  ? samplingResult.content.text
                  : "Unable to extract explanation from response";

            response = {
              success: true,
              action: "explain_analysis",
              explanation,
              duration,
              message: "Analysis explained successfully",
            };
          } catch (error) {
            logger.error("Failed to explain analysis", {
              component: "analyze-handler",
              action: "explain_analysis",
              error: error instanceof Error ? error.message : String(error),
            });
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to explain analysis",
                retryable: true,
              },
            };
          }
          break;
        }

        default: {
          // Should never reach here due to Zod validation
          response = {
            success: false,
            error: {
              code: "INVALID_PARAMS",
              message: `Unknown action: ${input.action}`,
              retryable: false,
            },
          };
        }
      }

      // P1: Store analysis results for MCP Resources
      // Store results for analyze_data actions so they can be referenced via analyze://results/{id}
      if (
        response.success &&
        input.action === "analyze_data" &&
        "spreadsheetId" in input &&
        typeof input.spreadsheetId === "string"
      ) {
        try {
          const analysisId = storeAnalysisResult(input.spreadsheetId, response);
          logger.info("Stored analysis result for MCP Resources", {
            analysisId,
            spreadsheetId: input.spreadsheetId,
            resourceUri: `analyze://results/${analysisId}`,
          });

          // Add resource URI to response message
          if ("message" in response && typeof response.message === "string") {
            response.message = `${response.message} (stored as analyze://results/${analysisId})`;
          }
        } catch (error) {
          // Storage failure should not block the response
          logger.warn("Failed to store analysis result", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return { response };
    } catch (error) {
      return {
        response: {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
