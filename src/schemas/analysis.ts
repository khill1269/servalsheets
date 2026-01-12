/**
 * Tool 14: sheets_analysis (DEPRECATED)
 *
 * ⚠️ DEPRECATION NOTICE ⚠️
 * This tool is deprecated and will be removed in a future version.
 * Please migrate to the consolidated `sheets_analyze` tool which provides:
 * - All functionality from sheets_analysis + sheets_analyze
 * - Intelligent routing (fast/AI/streaming paths)
 * - Enhanced AI-powered insights
 * - Auto-creation workflows for charts and pivots
 *
 * Migration guide:
 * - data_quality → analyze_quality
 * - formula_audit → (removed, use analyze_quality)
 * - structure_analysis → analyze_structure
 * - statistics → (removed, use analyze_data)
 * - correlations → detect_patterns (with includeCorrelations:true)
 * - summary → analyze_data
 * - dependencies → (removed)
 * - compare_ranges → (removed)
 * - detect_patterns → detect_patterns
 * - column_analysis → analyze_data
 * - suggest_templates → (removed)
 * - generate_formula → generate_formula
 * - suggest_chart → suggest_visualization
 *
 * Data quality and formula analysis (READ-ONLY)
 *
 * @deprecated Use sheets_analyze instead
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  ErrorDetailSchema,
  CellValueSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const _BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const DataQualityIssueSchema = z.object({
  type: z.enum([
    "EMPTY_HEADER",
    "DUPLICATE_HEADER",
    "MIXED_DATA_TYPES",
    "EMPTY_ROW",
    "EMPTY_COLUMN",
    "TRAILING_WHITESPACE",
    "LEADING_WHITESPACE",
    "INCONSISTENT_FORMAT",
    "STATISTICAL_OUTLIER",
    "MISSING_VALUE",
    "DUPLICATE_ROW",
    "INVALID_EMAIL",
    "INVALID_URL",
    "INVALID_DATE",
    "FORMULA_ERROR",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  location: z.string(),
  description: z.string(),
  autoFixable: z.boolean(),
  fixTool: z.string().optional(),
  fixAction: z.string().optional(),
  fixParams: z.record(z.string(), z.unknown()).optional(),
});

const FormulaIssueSchema = z.object({
  type: z.enum([
    "CIRCULAR_REFERENCE",
    "BROKEN_REFERENCE",
    "VOLATILE_FUNCTION",
    "COMPLEX_FORMULA",
    "HARDCODED_VALUE",
    "INCONSISTENT_FORMULA",
    "ARRAY_FORMULA_ISSUE",
    "DEPRECATED_FUNCTION",
    "PERFORMANCE_ISSUE",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  cell: z.string(),
  formula: z.string(),
  description: z.string(),
  suggestion: z.string().optional(),
});

// INPUT SCHEMA: Flattened z.object() pattern (Zod v4 compatible)
// This exposes all fields at top level for proper MCP client UX
export const SheetsAnalysisInputSchema = z
  .object({
    // Common fields
    action: z.enum([
      "data_quality",
      "formula_audit",
      "structure_analysis",
      "statistics",
      "correlations",
      "summary",
      "dependencies",
      "compare_ranges",
      "detect_patterns",
      "column_analysis",
      "suggest_templates",
      "generate_formula",
      "suggest_chart",
    ]),
    spreadsheetId: SpreadsheetIdSchema.optional(),
    sheetId: SheetIdSchema.optional(),
    range: RangeInputSchema.optional(),

    // data_quality specific
    checks: z
      .array(
        z.enum([
          "headers",
          "data_types",
          "empty_cells",
          "duplicates",
          "outliers",
          "formatting",
          "validation",
          "circular",
          "broken",
          "volatile",
          "complex",
          "hardcoded",
          "inconsistent",
          "performance",
        ]),
      )
      .optional(),
    outlierMethod: z
      .enum(["iqr", "zscore", "modified_zscore"])
      .optional()
      .default("iqr"),
    outlierThreshold: z.number().optional().default(1.5),
    useAI: z
      .boolean()
      .optional()
      .describe("Use AI-powered analysis via sampling (SEP-1577)"),

    // formula_audit specific
    complexityThreshold: z.number().int().optional().default(10),

    // structure_analysis specific
    detectTables: z.boolean().optional().default(true),
    detectHeaders: z.boolean().optional().default(true),

    // statistics specific
    columns: z.array(z.number().int().min(0)).optional(),

    // correlations specific
    method: z.enum(["pearson", "spearman"]).optional().default("pearson"),

    // dependencies specific
    cell: z.string().optional(),
    direction: z
      .enum(["precedents", "dependents", "both"])
      .optional()
      .default("both"),

    // compare_ranges specific
    range1: RangeInputSchema.optional(),
    range2: RangeInputSchema.optional(),
    compareType: z
      .enum(["values", "structure", "both"])
      .optional()
      .default("values"),

    // detect_patterns specific
    includeCorrelations: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include correlation analysis"),
    includeTrends: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include trend detection"),
    includeSeasonality: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include seasonality patterns"),
    includeAnomalies: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include anomaly detection"),

    // column_analysis specific
    analyzeDistribution: z
      .boolean()
      .optional()
      .default(true)
      .describe("Analyze value distribution"),
    detectDataType: z
      .boolean()
      .optional()
      .default(true)
      .describe("Auto-detect data type"),
    checkQuality: z
      .boolean()
      .optional()
      .default(true)
      .describe("Check data quality"),
    findUnique: z
      .boolean()
      .optional()
      .default(true)
      .describe("Count unique values"),

    // suggest_templates specific
    description: z
      .string()
      .optional()
      .describe(
        'Natural language description of needed template (e.g., "project tracker", "budget planner")',
      ),
    includeExample: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include example data structure"),
    maxSuggestions: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .default(3)
      .describe("Number of chart/template suggestions"),

    // generate_formula specific
    targetCell: z
      .string()
      .optional()
      .describe('Target cell for formula context (e.g., "Sheet1!C2")'),
    includeExplanation: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include formula explanation"),

    // suggest_chart specific
    goal: z
      .string()
      .optional()
      .describe(
        'Optional visualization goal (e.g., "show trends", "compare categories")',
      ),
  })
  .refine(
    (data) => {
      switch (data.action) {
        case "data_quality":
        case "formula_audit":
        case "structure_analysis":
        case "summary":
          return !!data.spreadsheetId;

        case "statistics":
        case "correlations":
        case "detect_patterns":
        case "column_analysis":
        case "suggest_chart":
          return !!data.spreadsheetId && !!data.range;

        case "compare_ranges":
          return !!data.spreadsheetId && !!data.range1 && !!data.range2;

        case "dependencies":
          return !!data.spreadsheetId;

        case "suggest_templates":
          return !!data.spreadsheetId && !!data.description;

        case "generate_formula":
          return !!data.spreadsheetId && !!data.description;

        default:
          return false;
      }
    },
    {
      message:
        "Missing required fields for the specified action. Check action-specific requirements.",
    },
  );

// Type narrowing helpers for each action
export type DataQualityInput = Extract<
  SheetsAnalysisInput,
  { action: "data_quality" }
>;
export type FormulaAuditInput = Extract<
  SheetsAnalysisInput,
  { action: "formula_audit" }
>;
export type StructureAnalysisInput = Extract<
  SheetsAnalysisInput,
  { action: "structure_analysis" }
>;
export type StatisticsInput = Extract<
  SheetsAnalysisInput,
  { action: "statistics" }
>;
export type CorrelationsInput = Extract<
  SheetsAnalysisInput,
  { action: "correlations" }
>;
export type SummaryInput = Extract<SheetsAnalysisInput, { action: "summary" }>;
export type DependenciesInput = Extract<
  SheetsAnalysisInput,
  { action: "dependencies" }
>;
export type CompareRangesInput = Extract<
  SheetsAnalysisInput,
  { action: "compare_ranges" }
>;
// DEPRECATED: Use DetectPatternsInput from analyze.ts instead
type AnalysisDetectPatternsInput = Extract<
  SheetsAnalysisInput,
  { action: "detect_patterns" }
>;
export type ColumnAnalysisInput = Extract<
  SheetsAnalysisInput,
  { action: "column_analysis" }
>;
export type SuggestTemplatesInput = Extract<
  SheetsAnalysisInput,
  { action: "suggest_templates" }
>;
export type AnalysisGenerateFormulaInput = Extract<
  SheetsAnalysisInput,
  { action: "generate_formula" }
>;
export type AnalysisSuggestChartInput = Extract<
  SheetsAnalysisInput,
  { action: "suggest_chart" }
>;

const AnalysisResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),

    // Data quality results
    dataQuality: z
      .object({
        score: z.number().min(0).max(100),
        completeness: z.number().min(0).max(100),
        consistency: z.number().min(0).max(100),
        accuracy: z.number().min(0).max(100),
        issues: z.array(DataQualityIssueSchema),
        summary: z.string(),
      })
      .optional(),

    // Formula audit results
    formulaAudit: z
      .object({
        score: z.number().min(0).max(100),
        totalFormulas: z.number().int(),
        uniqueFormulas: z.number().int(),
        issues: z.array(FormulaIssueSchema),
        summary: z.string(),
      })
      .optional(),

    // Structure analysis results
    structure: z
      .object({
        sheets: z.number().int(),
        totalRows: z.number().int(),
        totalColumns: z.number().int(),
        tables: z
          .array(
            z.object({
              sheetId: z.number().int(),
              range: z.string(),
              headers: z.array(z.string()),
              rowCount: z.number().int(),
            }),
          )
          .optional(),
        namedRanges: z
          .array(
            z.object({
              name: z.string(),
              range: z.string(),
            }),
          )
          .optional(),
      })
      .optional(),

    // Statistics results
    statistics: z
      .object({
        columns: z.array(
          z.object({
            index: z.number().int(),
            name: z.string().optional(),
            count: z.number().int(),
            sum: z.number().optional(),
            mean: z.number().optional(),
            median: z.number().optional(),
            stdDev: z.number().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            nullCount: z.number().int(),
            uniqueCount: z.number().int(),
          }),
        ),
      })
      .optional(),

    // Correlations results
    correlations: z
      .object({
        matrix: z.array(z.array(z.number())),
        columns: z.array(z.string()),
      })
      .optional(),

    // Summary
    summary: z
      .object({
        title: z.string(),
        sheets: z.number().int(),
        totalCells: z.number().int(),
        filledCells: z.number().int(),
        formulas: z.number().int(),
        charts: z.number().int(),
        lastModified: z.string(),
      })
      .optional(),

    // Dependencies
    dependencies: z
      .object({
        cell: z.string(),
        precedents: z.array(z.string()).optional(),
        dependents: z.array(z.string()).optional(),
      })
      .optional(),

    // Comparison
    comparison: z
      .object({
        identical: z.boolean(),
        differences: z.array(
          z.object({
            cell: z.string(),
            value1: CellValueSchema,
            value2: CellValueSchema,
          }),
        ),
        diffCount: z.number().int(),
      })
      .optional(),

    // Template suggestions (AI-powered)
    templates: z
      .object({
        suggestions: z.array(
          z.object({
            name: z.string().describe("Template name"),
            description: z.string().describe("Template description"),
            useCase: z.string().describe("Best use case"),
            structure: z
              .object({
                sheets: z.array(
                  z.object({
                    name: z.string(),
                    headers: z.array(z.string()),
                    columnTypes: z.array(z.string()).optional(),
                  }),
                ),
                features: z
                  .array(z.string())
                  .describe(
                    'Recommended features (e.g., "conditional formatting", "data validation")',
                  ),
              })
              .optional(),
            exampleData: z.array(z.array(z.unknown())).optional(),
          }),
        ),
        reasoning: z.string().describe("AI explanation of suggestions"),
      })
      .optional(),

    // Formula generation (AI-powered)
    formula: z
      .object({
        formula: z.string().describe("Generated formula (with = prefix)"),
        explanation: z.string().describe("Formula explanation"),
        components: z
          .array(
            z.object({
              part: z.string(),
              description: z.string(),
            }),
          )
          .optional(),
        alternatives: z
          .array(
            z.object({
              formula: z.string(),
              reason: z.string(),
            }),
          )
          .optional(),
        warnings: z
          .array(z.string())
          .optional()
          .describe("Potential issues or considerations"),
      })
      .optional(),

    // Chart suggestions (AI-powered)
    chartSuggestions: z
      .object({
        suggestions: z.array(
          z.object({
            chartType: z
              .enum([
                "LINE",
                "AREA",
                "COLUMN",
                "BAR",
                "SCATTER",
                "PIE",
                "COMBO",
                "HISTOGRAM",
                "CANDLESTICK",
                "ORG",
                "TREEMAP",
                "WATERFALL",
              ])
              .describe("Recommended chart type"),
            title: z.string(),
            reasoning: z
              .string()
              .describe("Why this chart type is recommended"),
            configuration: z
              .object({
                xAxis: z.string().optional(),
                yAxis: z.string().optional(),
                series: z.array(z.string()).optional(),
                aggregation: z.string().optional(),
              })
              .optional(),
            suitabilityScore: z
              .number()
              .min(0)
              .max(100)
              .describe("How well this chart fits the data (0-100)"),
          }),
        ),
        dataInsights: z.string().describe("AI insights about the data"),
      })
      .optional(),

    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsAnalysisOutputSchema = z.object({
  response: AnalysisResponseSchema,
});

export const SHEETS_ANALYSIS_ANNOTATIONS: ToolAnnotations = {
  title: "Data Analysis (DEPRECATED)",
  readOnlyHint: true, // READ-ONLY
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

/**
 * Deprecation metadata
 * @deprecated Since 2026-01-12. Use sheets_analyze instead.
 */
export const SHEETS_ANALYSIS_DEPRECATION = {
  deprecated: true,
  deprecatedSince: "2026-01-12",
  removalDate: "2026-04-12", // 90 days
  replacement: "sheets_analyze",
  migrationGuide: {
    data_quality: "analyze_quality",
    formula_audit: "analyze_quality",
    structure_analysis: "analyze_structure",
    statistics: "analyze_data",
    correlations: "detect_patterns",
    summary: "analyze_data",
    detect_patterns: "detect_patterns",
    column_analysis: "analyze_data",
    generate_formula: "generate_formula",
    suggest_chart: "suggest_visualization",
  },
} as const;

export type SheetsAnalysisInput = z.infer<typeof SheetsAnalysisInputSchema>;
export type SheetsAnalysisOutput = z.infer<typeof SheetsAnalysisOutputSchema>;

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
