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
   * Resolve range to A1 notation
   */
  private resolveRange(range?: {
    a1?: string;
    sheetName?: string;
    range?: string;
  }): string | undefined {
    if (!range) return undefined;
    if ("a1" in range && range.a1) return range.a1;
    if ("sheetName" in range && range.sheetName) {
      return range.range
        ? `${range.sheetName}!${range.range}`
        : range.sheetName;
    }
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
        case "analyze": {
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

          const startTime = Date.now();

          // Read the data
          const rangeStr = this.resolveRange(input.range);
          const data = await this.readData(input.spreadsheetId, rangeStr);

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
          const samplingRequest = buildAnalysisSamplingRequest(data, {
            spreadsheetId: input.spreadsheetId,
            sheetName:
              input.range && "sheetName" in input.range
                ? input.range.sheetName
                : undefined,
            range: rangeStr,
            analysisTypes: input.analysisTypes as AnalysisType[],
            context: input.context,
            maxTokens: input.maxTokens,
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
              input.analysisTypes as AnalysisType[],
            );
            response = {
              success: false,
              error: {
                code: "PARSE_ERROR",
                message: parsed.error ?? "Failed to parse analysis response",
                retryable: true,
              },
            };
            break;
          }

          analysisService.recordSuccess(
            input.analysisTypes as AnalysisType[],
            duration,
          );

          response = {
            success: true,
            action: "analyze",
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
            message: `Analysis complete: ${parsed.result.analyses.length} finding(s) with ${parsed.result.topInsights.length} key insight(s)`,
          };
          break;
        }

        case "generate_formula": {
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

          if (input.range) {
            const rangeStr = this.resolveRange(input.range);
            const data = await this.readData(input.spreadsheetId, rangeStr);
            if (data.length > 0) {
              headers = data[0]?.map(String);
              sampleData = data.slice(0, 10);
            }
          }

          // Build sampling request
          const samplingRequest = buildFormulaSamplingRequest(
            input.description,
            {
              headers,
              sampleData,
              targetCell: input.targetCell,
              sheetName:
                input.range && "sheetName" in input.range
                  ? input.range.sheetName
                  : undefined,
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
          } catch {
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

        case "suggest_chart": {
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
          const rangeStr = this.resolveRange(input.range);
          const data = await this.readData(input.spreadsheetId, rangeStr);

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
            goal: input.goal,
            preferredTypes: input.preferredTypes,
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

            response = {
              success: true,
              action: "suggest_chart",
              chartRecommendations: parsed.recommendations?.map(
                (r: Record<string, unknown>) => ({
                  chartType: r["chartType"],
                  suitabilityScore: r["suitabilityScore"],
                  reasoning: r["reasoning"],
                  configuration: r["configuration"],
                  insights: r["insights"],
                }),
              ),
              dataAssessment: parsed.dataAssessment,
              duration,
              message: `${parsed.recommendations?.length ?? 0} chart type(s) recommended`,
            };
          } catch {
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

        case "get_stats": {
          const stats = analysisService.getStats();
          response = {
            success: true,
            action: "get_stats",
            stats: {
              totalRequests: stats.totalRequests,
              successfulRequests: stats.successfulRequests,
              failedRequests: stats.failedRequests,
              successRate: stats.successRate,
              avgResponseTime: stats.avgResponseTime,
              requestsByType: stats.requestsByType,
            },
            message: `${stats.totalRequests} analysis requests, ${stats.successRate.toFixed(1)}% success rate`,
          };
          break;
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
