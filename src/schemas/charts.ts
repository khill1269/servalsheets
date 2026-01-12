/**
 * Tool 8: sheets_charts
 * Chart operations
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  ChartTypeSchema,
  LegendPositionSchema,
  ChartPositionSchema,
  ColorSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const _BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const ChartDataSchema = z.object({
  sourceRange: RangeInputSchema,
  series: z
    .array(
      z.object({
        column: z.number().int().min(0),
        color: ColorSchema.optional(),
      }),
    )
    .optional(),
  categories: z.number().int().min(0).optional(),
  aggregateType: z
    .enum([
      "AVERAGE",
      "COUNT",
      "COUNTA",
      "COUNTUNIQUE",
      "MAX",
      "MEDIAN",
      "MIN",
      "STDEV",
      "STDEVP",
      "SUM",
      "VAR",
      "VARP",
    ])
    .optional(),
});

const ChartOptionsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  legendPosition: LegendPositionSchema.optional(),
  backgroundColor: ColorSchema.optional(),
  is3D: z.boolean().optional(),
  pieHole: z.number().min(0).max(1).optional(),
  stacked: z.boolean().optional(),
  lineSmooth: z.boolean().optional(),
  axisTitle: z
    .object({
      horizontal: z.string().optional(),
      vertical: z.string().optional(),
    })
    .optional(),
});

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsChartsInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "create",
        "update",
        "delete",
        "list",
        "get",
        "move",
        "resize",
        "update_data_range",
        "export",
      ])
      .describe("The operation to perform on the chart"),

    // Fields used by multiple actions
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),
    chartId: z
      .number()
      .int()
      .optional()
      .describe(
        "Numeric chart ID (required for: update, delete, get, move, resize, update_data_range, export)",
      ),
    position: ChartPositionSchema.optional().describe(
      "Chart position and size on the sheet (required for: create, move; optional for: update)",
    ),
    data: ChartDataSchema.optional().describe(
      "Chart data source (range, series, categories) (required for: create, update_data_range; optional for: update)",
    ),
    options: ChartOptionsSchema.optional().describe(
      "Chart options (title, subtitle, legend, colors, 3D, stacking, etc.) (optional for: create, update)",
    ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.) (optional for: update, delete, update_data_range)",
    ),

    // CREATE action fields
    sheetId: SheetIdSchema.optional().describe(
      "Numeric sheet ID where chart will be created (required for: create; optional for: list)",
    ),
    chartType: ChartTypeSchema.optional().describe(
      "Chart type (LINE, BAR, COLUMN, PIE, SCATTER, etc.) (required for: create; optional for: update)",
    ),

    // RESIZE action fields
    width: z
      .number()
      .positive()
      .optional()
      .describe(
        "Width in pixels (must be positive) (required for: resize; optional for: export)",
      ),
    height: z
      .number()
      .positive()
      .optional()
      .describe(
        "Height in pixels (must be positive) (required for: resize; optional for: export)",
      ),

    // EXPORT action fields
    format: z
      .enum(["PNG", "PDF"])
      .optional()
      .default("PNG")
      .describe(
        "Export format (PNG or PDF, default: PNG) (optional for: export)",
      ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "create":
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            !!data.chartType &&
            !!data.data &&
            !!data.position
          );
        case "update":
          return !!data.spreadsheetId && data.chartId !== undefined;
        case "delete":
          return !!data.spreadsheetId && data.chartId !== undefined;
        case "list":
          return !!data.spreadsheetId;
        case "get":
          return !!data.spreadsheetId && data.chartId !== undefined;
        case "move":
          return (
            !!data.spreadsheetId &&
            data.chartId !== undefined &&
            !!data.position
          );
        case "resize":
          return (
            !!data.spreadsheetId &&
            data.chartId !== undefined &&
            data.width !== undefined &&
            data.height !== undefined
          );
        case "update_data_range":
          return (
            !!data.spreadsheetId && data.chartId !== undefined && !!data.data
          );
        case "export":
          return !!data.spreadsheetId && data.chartId !== undefined;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

const ChartsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    chartId: z.number().int().optional(),
    charts: z
      .array(
        z.object({
          chartId: z.number().int(),
          chartType: z.string(),
          sheetId: z.number().int(),
          title: z.string().optional(),
          position: ChartPositionSchema,
        }),
      )
      .optional(),
    exportUrl: z.string().optional(),
    exportData: z.string().optional(), // base64
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsChartsOutputSchema = z.object({
  response: ChartsResponseSchema,
});

export const SHEETS_CHARTS_ANNOTATIONS: ToolAnnotations = {
  title: "Charts",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsChartsInput = z.infer<typeof SheetsChartsInputSchema>;
export type SheetsChartsOutput = z.infer<typeof SheetsChartsOutputSchema>;
export type ChartsResponse = z.infer<typeof ChartsResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type ChartsCreateInput = SheetsChartsInput & {
  action: "create";
  spreadsheetId: string;
  sheetId: number;
  chartType: string;
  data: z.infer<typeof ChartDataSchema>;
  position: z.infer<typeof ChartPositionSchema>;
};
export type ChartsUpdateInput = SheetsChartsInput & {
  action: "update";
  spreadsheetId: string;
  chartId: number;
};
export type ChartsDeleteInput = SheetsChartsInput & {
  action: "delete";
  spreadsheetId: string;
  chartId: number;
};
export type ChartsListInput = SheetsChartsInput & {
  action: "list";
  spreadsheetId: string;
};
export type ChartsGetInput = SheetsChartsInput & {
  action: "get";
  spreadsheetId: string;
  chartId: number;
};
export type ChartsMoveInput = SheetsChartsInput & {
  action: "move";
  spreadsheetId: string;
  chartId: number;
  position: z.infer<typeof ChartPositionSchema>;
};
export type ChartsResizeInput = SheetsChartsInput & {
  action: "resize";
  spreadsheetId: string;
  chartId: number;
  width: number;
  height: number;
};
export type ChartsUpdateDataRangeInput = SheetsChartsInput & {
  action: "update_data_range";
  spreadsheetId: string;
  chartId: number;
  data: z.infer<typeof ChartDataSchema>;
};
export type ChartsExportInput = SheetsChartsInput & {
  action: "export";
  spreadsheetId: string;
  chartId: number;
};
