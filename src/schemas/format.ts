/**
 * Tool 5: sheets_format
 * Cell formatting operations
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  RangeInputSchema,
  CellFormatSchema,
  ColorSchema,
  TextFormatSchema,
  NumberFormatSchema,
  BorderSchema,
  BorderStyleSchema as _BorderStyleSchema,
  HorizontalAlignSchema,
  VerticalAlignSchema,
  WrapStrategySchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsFormatInputSchema = z.discriminatedUnion("action", [
  // SET_FORMAT
  BaseSchema.extend({
    action: z.literal("set_format").describe("Apply comprehensive cell formatting"),
    range: RangeInputSchema.describe("Range to format (A1 notation or semantic)"),
    format: CellFormatSchema.describe("Complete cell format specification (background, text, borders, etc.)"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // SET_BACKGROUND
  BaseSchema.extend({
    action: z.literal("set_background").describe("Set cell background color"),
    range: RangeInputSchema.describe("Range to format"),
    color: ColorSchema.describe("Background color (RGB)"),
  }),

  // SET_TEXT_FORMAT
  BaseSchema.extend({
    action: z.literal("set_text_format").describe("Set text formatting (font, size, bold, italic, etc.)"),
    range: RangeInputSchema.describe("Range to format"),
    textFormat: TextFormatSchema.describe("Text format specification (font family, size, bold, italic, color, etc.)"),
  }),

  // SET_NUMBER_FORMAT
  BaseSchema.extend({
    action: z.literal("set_number_format").describe("Set number format (currency, percentage, date, etc.)"),
    range: RangeInputSchema.describe("Range to format"),
    numberFormat: NumberFormatSchema.describe("Number format specification (type, pattern, currency symbol, etc.)"),
  }),

  // SET_ALIGNMENT
  BaseSchema.extend({
    action: z.literal("set_alignment").describe("Set cell alignment and text wrapping"),
    range: RangeInputSchema.describe("Range to format"),
    horizontal: HorizontalAlignSchema.optional().describe("Horizontal alignment (LEFT, CENTER, RIGHT)"),
    vertical: VerticalAlignSchema.optional().describe("Vertical alignment (TOP, MIDDLE, BOTTOM)"),
    wrapStrategy: WrapStrategySchema.optional().describe("Text wrap strategy (OVERFLOW_CELL, LEGACY_WRAP, CLIP, WRAP)"),
  }),

  // SET_BORDERS
  BaseSchema.extend({
    action: z.literal("set_borders").describe("Set cell borders"),
    range: RangeInputSchema.describe("Range to format"),
    top: BorderSchema.optional().describe("Top border style and color"),
    bottom: BorderSchema.optional().describe("Bottom border style and color"),
    left: BorderSchema.optional().describe("Left border style and color"),
    right: BorderSchema.optional().describe("Right border style and color"),
    innerHorizontal: BorderSchema.optional().describe("Inner horizontal borders (between rows)"),
    innerVertical: BorderSchema.optional().describe("Inner vertical borders (between columns)"),
  }),

  // CLEAR_FORMAT
  BaseSchema.extend({
    action: z.literal("clear_format").describe("Remove all formatting from cells (keep values)"),
    range: RangeInputSchema.describe("Range to clear formatting"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // APPLY_PRESET
  BaseSchema.extend({
    action: z.literal("apply_preset").describe("Apply a predefined formatting preset"),
    range: RangeInputSchema.describe("Range to format"),
    preset: z.enum([
      "header_row",
      "alternating_rows",
      "total_row",
      "currency",
      "percentage",
      "date",
      "highlight_positive",
      "highlight_negative",
    ]).describe("Preset name (header_row, alternating_rows, currency, percentage, etc.)"),
  }),

  // AUTO_FIT
  BaseSchema.extend({
    action: z.literal("auto_fit").describe("Auto-resize rows/columns to fit content"),
    range: RangeInputSchema.describe("Range to auto-fit"),
    dimension: z.enum(["ROWS", "COLUMNS", "BOTH"])
      .optional()
      .default("BOTH")
      .describe("Dimension to auto-fit (ROWS, COLUMNS, or BOTH)"),
  }),
]);

const FormatResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    cellsFormatted: z.number().int().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsFormatOutputSchema = z.object({
  response: FormatResponseSchema,
});

export const SHEETS_FORMAT_ANNOTATIONS: ToolAnnotations = {
  title: "Cell Formatting",
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export type SheetsFormatInput = z.infer<typeof SheetsFormatInputSchema>;
export type SheetsFormatOutput = z.infer<typeof SheetsFormatOutputSchema>;
export type FormatResponse = z.infer<typeof FormatResponseSchema>;
