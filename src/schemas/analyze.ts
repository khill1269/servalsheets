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
 * Input schema - flattened union for MCP SDK compatibility
 * The MCP SDK has issues with z.discriminatedUnion() that can cause validation problems
 * Workaround: Use a single object with all fields optional, validate with refine()
 */
export const SheetsAnalyzeInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum(["analyze", "generate_formula", "suggest_chart", "get_stats"])
      .describe("The analysis operation to perform"),

    // Fields for ANALYZE action
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for: analyze, generate_formula, suggest_chart)",
    ),
    range: RangeRefSchema.optional().describe(
      "Range to analyze or use for context (analyze, generate_formula, suggest_chart)",
    ),
    analysisTypes: z
      .array(AnalysisTypeSchema)
      .min(1)
      .optional()
      .default(["summary", "quality"])
      .describe("Types of analysis to perform (analyze only)"),
    context: z
      .string()
      .optional()
      .describe("Additional context for the analysis (analyze only)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .max(8192)
      .optional()
      .describe("Maximum tokens for AI response, default: 4096 (analyze only)"),

    // Fields for GENERATE_FORMULA action
    description: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Natural language description of the formula (required for: generate_formula)",
      ),
    targetCell: z
      .string()
      .optional()
      .describe("Target cell for the formula (generate_formula only)"),

    // Fields for SUGGEST_CHART action
    goal: z
      .string()
      .optional()
      .describe(
        'Visualization goal, e.g., "show trends", "compare categories" (suggest_chart only)',
      ),
    preferredTypes: z
      .array(z.string())
      .optional()
      .describe("Preferred chart types (suggest_chart only)"),

    // GET_STATS action has no additional fields
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "analyze":
          return !!data.spreadsheetId;
        case "generate_formula":
          return !!data.spreadsheetId && !!data.description;
        case "suggest_chart":
          return !!data.spreadsheetId && !!data.range;
        case "get_stats":
          return true; // No required fields beyond action
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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
  requestsByType: z.record(z.string(), z.number()),
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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type AnalyzeActionInput = SheetsAnalyzeInput & {
  action: "analyze";
  spreadsheetId: string;
};
export type AnalyzeGenerateFormulaInput = SheetsAnalyzeInput & {
  action: "generate_formula";
  spreadsheetId: string;
  description: string;
};
export type AnalyzeSuggestChartInput = SheetsAnalyzeInput & {
  action: "suggest_chart";
  spreadsheetId: string;
  range:
    | { a1: string }
    | { sheetName: string; range?: string };
};
export type AnalyzeGetStatsInput = SheetsAnalyzeInput & {
  action: "get_stats";
};
