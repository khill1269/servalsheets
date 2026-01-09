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

const BaseSchema = z.object({
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

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsChartsInputSchema = z.discriminatedUnion("action", [
  // CREATE
  BaseSchema.extend({
    action: z.literal("create").describe("Create a new chart in a sheet"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID where chart will be created"),
    chartType: ChartTypeSchema.describe("Chart type (LINE, BAR, COLUMN, PIE, SCATTER, etc.)"),
    data: ChartDataSchema.describe("Chart data source (range, series, categories)"),
    position: ChartPositionSchema.describe("Chart position and size on the sheet"),
    options: ChartOptionsSchema.optional().describe("Chart options (title, subtitle, legend, colors, 3D, stacking, etc.)"),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal("update").describe("Update an existing chart's properties"),
    chartId: z.number().int().describe("Numeric chart ID to update"),
    chartType: ChartTypeSchema.optional().describe("New chart type (omit to keep current)"),
    data: ChartDataSchema.optional().describe("New data source (omit to keep current)"),
    position: ChartPositionSchema.optional().describe("New position/size (omit to keep current)"),
    options: ChartOptionsSchema.optional().describe("New chart options (omit to keep current)"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // DELETE
  BaseSchema.extend({
    action: z.literal("delete").describe("Delete a chart from the spreadsheet"),
    chartId: z.number().int().describe("Numeric chart ID to delete"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // LIST
  BaseSchema.extend({
    action: z.literal("list").describe("List all charts in the spreadsheet or a specific sheet"),
    sheetId: SheetIdSchema.optional().describe("Optional sheet ID to filter charts (omit = all sheets)"),
  }),

  // GET
  BaseSchema.extend({
    action: z.literal("get").describe("Get detailed information about a specific chart"),
    chartId: z.number().int().describe("Numeric chart ID to retrieve"),
  }),

  // MOVE
  BaseSchema.extend({
    action: z.literal("move").describe("Move a chart to a new position"),
    chartId: z.number().int().describe("Numeric chart ID to move"),
    position: ChartPositionSchema.describe("New position and size for the chart"),
  }),

  // RESIZE
  BaseSchema.extend({
    action: z.literal("resize").describe("Resize a chart to specific dimensions"),
    chartId: z.number().int().describe("Numeric chart ID to resize"),
    width: z.number().positive().describe("New width in pixels (must be positive)"),
    height: z.number().positive().describe("New height in pixels (must be positive)"),
  }),

  // UPDATE_DATA_RANGE
  BaseSchema.extend({
    action: z.literal("update_data_range").describe("Update the data source range for a chart"),
    chartId: z.number().int().describe("Numeric chart ID to update"),
    data: ChartDataSchema.describe("New data source specification"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // EXPORT
  BaseSchema.extend({
    action: z.literal("export").describe("Export a chart as an image (PNG or PDF)"),
    chartId: z.number().int().describe("Numeric chart ID to export"),
    format: z.enum(["PNG", "PDF"]).optional().default("PNG").describe("Export format (PNG or PDF, default: PNG)"),
    width: z.number().positive().optional().describe("Optional custom width in pixels"),
    height: z.number().positive().optional().describe("Optional custom height in pixels"),
  }),
]);

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
