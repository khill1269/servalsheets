/**
 * Tool 14: sheets_analysis
 * Data quality and formula analysis (READ-ONLY)
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

const BaseSchema = z.object({
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

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsAnalysisInputSchema = z.discriminatedUnion("action", [
  // DATA_QUALITY
  BaseSchema.extend({
    action: z.literal("data_quality"),
    range: RangeInputSchema.optional(),
    sheetId: SheetIdSchema.optional(),
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
  }),

  // FORMULA_AUDIT
  BaseSchema.extend({
    action: z.literal("formula_audit"),
    range: RangeInputSchema.optional(),
    sheetId: SheetIdSchema.optional(),
    checks: z
      .array(
        z.enum([
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
    complexityThreshold: z.number().int().optional().default(10),
  }),

  // STRUCTURE_ANALYSIS
  BaseSchema.extend({
    action: z.literal("structure_analysis"),
    sheetId: SheetIdSchema.optional(),
    detectTables: z.boolean().optional().default(true),
    detectHeaders: z.boolean().optional().default(true),
  }),

  // STATISTICS
  BaseSchema.extend({
    action: z.literal("statistics"),
    range: RangeInputSchema,
    columns: z.array(z.number().int().min(0)).optional(),
  }),

  // CORRELATIONS
  BaseSchema.extend({
    action: z.literal("correlations"),
    range: RangeInputSchema,
    method: z.enum(["pearson", "spearman"]).optional().default("pearson"),
  }),

  // SUMMARY
  BaseSchema.extend({
    action: z.literal("summary"),
    sheetId: SheetIdSchema.optional(),
  }),

  // DEPENDENCIES
  BaseSchema.extend({
    action: z.literal("dependencies"),
    cell: z.string().optional(),
    sheetId: SheetIdSchema.optional(),
    direction: z
      .enum(["precedents", "dependents", "both"])
      .optional()
      .default("both"),
  }),

  // COMPARE_RANGES
  BaseSchema.extend({
    action: z.literal("compare_ranges"),
    range1: RangeInputSchema,
    range2: RangeInputSchema,
    compareType: z
      .enum(["values", "structure", "both"])
      .optional()
      .default("values"),
  }),

  // DETECT_PATTERNS
  BaseSchema.extend({
    action: z.literal("detect_patterns"),
    range: RangeInputSchema,
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
    useAI: z.boolean().optional().describe("Use AI for pattern explanation"),
  }),

  // COLUMN_ANALYSIS
  BaseSchema.extend({
    action: z.literal("column_analysis"),
    range: RangeInputSchema.describe(
      "Single column range (e.g., Sheet1!D2:D100)",
    ),
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
    useAI: z.boolean().optional().describe("Use AI for insights"),
  }),

  // SUGGEST_TEMPLATES (AI-powered - SEP-1577)
  BaseSchema.extend({
    action: z.literal("suggest_templates"),
    description: z
      .string()
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
      .describe("Number of template suggestions"),
  }),

  // GENERATE_FORMULA (AI-powered - SEP-1577)
  BaseSchema.extend({
    action: z.literal("generate_formula"),
    description: z
      .string()
      .describe(
        'Natural language description of formula logic (e.g., "sum all values in column A")',
      ),
    targetCell: z
      .string()
      .optional()
      .describe('Target cell for formula context (e.g., "Sheet1!C2")'),
    range: RangeInputSchema.optional().describe(
      "Optional range for context understanding",
    ),
    includeExplanation: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include formula explanation"),
  }),

  // SUGGEST_CHART (AI-powered - SEP-1577)
  BaseSchema.extend({
    action: z.literal("suggest_chart"),
    range: RangeInputSchema.describe("Data range for chart analysis"),
    goal: z
      .string()
      .optional()
      .describe(
        'Optional visualization goal (e.g., "show trends", "compare categories")',
      ),
    maxSuggestions: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .default(3)
      .describe("Number of chart suggestions"),
  }),
]);


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
  title: "Data Analysis",
  readOnlyHint: true, // READ-ONLY
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export type SheetsAnalysisInput = z.infer<typeof SheetsAnalysisInputSchema>;
export type SheetsAnalysisOutput = z.infer<typeof SheetsAnalysisOutputSchema>;

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
