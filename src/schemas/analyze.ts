/**
 * Tool: sheets_analyze
 *
 * AI-powered data analysis using MCP Sampling (SEP-1577).
 * Instead of implementing custom ML/statistics, we leverage the LLM
 * via the Sampling capability for intelligent analysis.
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Sampling section
 * @see MCP_SEP_SPECIFICATIONS_COMPLETE.md - SEP-1577
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

/**
 * Analysis types available
 */
const AnalysisTypeSchema = z.enum([
  "summary", // Overall data summary
  "patterns", // Pattern recognition
  "anomalies", // Outlier/anomaly detection
  "trends", // Trend analysis
  "quality", // Data quality assessment
  "correlations", // Relationship discovery
  "recommendations", // Actionable recommendations
]);

/**
 * Range reference schema (simplified)
 */
const RangeRefSchema = z.union([
  z.object({
    a1: z.string().min(1).describe('A1 notation (e.g., "Sheet1!A1:C10")'),
  }),
  z.object({
    sheetName: z.string().describe("Sheet name"),
    range: z
      .string()
      .optional()
      .describe('Range within sheet (e.g., "A1:Z100")'),
  }),
]);

/**
 * Input schema - discriminated union for actions
 * Direct export (no wrapper) exposes all fields at top level for proper MCP client UX
 */
export const SheetsAnalyzeInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z
      .literal("analyze")
      .describe("Analyze spreadsheet data using AI sampling"),
    spreadsheetId: SpreadsheetIdSchema,
    range: RangeRefSchema.optional().describe(
      "Range to analyze (entire sheet if omitted)",
    ),
    analysisTypes: z
      .array(AnalysisTypeSchema)
      .min(1)
      .default(["summary", "quality"])
      .describe("Types of analysis to perform"),
    context: z
      .string()
      .optional()
      .describe("Additional context for the analysis"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .max(8192)
      .optional()
      .describe("Maximum tokens for AI response (default: 4096)"),
  }),
  z.object({
    action: z
      .literal("generate_formula")
      .describe(
        "Generate a spreadsheet formula from natural language description",
      ),
    spreadsheetId: SpreadsheetIdSchema,
    description: z
      .string()
      .min(1)
      .describe("Natural language description of the formula"),
    range: RangeRefSchema.optional().describe("Range context for the formula"),
    targetCell: z.string().optional().describe("Target cell for the formula"),
  }),
  z.object({
    action: z
      .literal("suggest_chart")
      .describe(
        "Suggest chart types and configurations for data visualization",
      ),
    spreadsheetId: SpreadsheetIdSchema,
    range: RangeRefSchema.describe("Data range to visualize"),
    goal: z
      .string()
      .optional()
      .describe(
        'Visualization goal (e.g., "show trends", "compare categories")',
      ),
    preferredTypes: z
      .array(z.string())
      .optional()
      .describe("Preferred chart types"),
  }),
  z.object({
    action: z.literal("get_stats").describe("Get analysis request statistics"),
  }),
]);

/**
 * Analysis finding schema
 */
const AnalysisFindingSchema = z.object({
  type: AnalysisTypeSchema,
  confidence: z.enum(["high", "medium", "low"]),
  findings: z.array(z.string()),
  details: z.string(),
  affectedCells: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

/**
 * Formula suggestion schema
 */
const FormulaSuggestionSchema = z.object({
  formula: z.string(),
  explanation: z.string(),
  assumptions: z.array(z.string()).optional(),
  alternatives: z
    .array(
      z.object({
        formula: z.string(),
        useCase: z.string(),
      }),
    )
    .optional(),
  tips: z.array(z.string()).optional(),
});

/**
 * Chart recommendation schema
 */
const ChartRecommendationSchema = z.object({
  chartType: z.string(),
  suitabilityScore: z.number().min(0).max(100),
  reasoning: z.string(),
  configuration: z
    .object({
      categories: z.string().optional(),
      series: z.array(z.string()).optional(),
      stacked: z.boolean().optional(),
      title: z.string().optional(),
    })
    .optional(),
  insights: z.array(z.string()).optional(),
});

/**
 * Stats schema
 */
const AnalyzeStatsSchema = z.object({
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  successRate: z.number(),
  avgResponseTime: z.number(),
  requestsByType: z.record(z.number()),
});

/**
 * Response schema
 */
const AnalyzeResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // For analyze action
    summary: z.string().optional(),
    analyses: z.array(AnalysisFindingSchema).optional(),
    overallQualityScore: z.number().min(0).max(100).optional(),
    topInsights: z.array(z.string()).optional(),
    // For generate_formula action
    formula: FormulaSuggestionSchema.optional(),
    // For suggest_chart action
    chartRecommendations: z.array(ChartRecommendationSchema).optional(),
    dataAssessment: z
      .object({
        dataType: z.string(),
        rowCount: z.number(),
        columnCount: z.number(),
        hasHeaders: z.boolean(),
      })
      .optional(),
    // For get_stats action
    stats: AnalyzeStatsSchema.optional(),
    // Common
    duration: z.number().optional(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsAnalyzeOutputSchema = z.object({
  response: AnalyzeResponseSchema,
});

/**
 * Tool annotations following MCP 2025-11-25
 */
export const SHEETS_ANALYZE_ANNOTATIONS: ToolAnnotations = {
  title: "AI Data Analysis",
  readOnlyHint: true, // Analysis doesn't modify data
  destructiveHint: false, // No data changes
  idempotentHint: false, // AI responses may vary
  openWorldHint: true, // Uses MCP Sampling to call LLM
};

// Type exports
export type SheetsAnalyzeInput = z.infer<typeof SheetsAnalyzeInputSchema>;
export type SheetsAnalyzeOutput = z.infer<typeof SheetsAnalyzeOutputSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type AnalysisType = z.infer<typeof AnalysisTypeSchema>;
export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;
