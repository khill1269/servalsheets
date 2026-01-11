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

// INPUT SCHEMA: Flattened z.object() pattern with action-specific validation
// This exposes all fields at top level for proper MCP client UX
export const SheetsFormatInputSchema = z
  .object({
    // Action discriminator
    action: z
      .enum([
        "set_format",
        "set_background",
        "set_text_format",
        "set_number_format",
        "set_alignment",
        "set_borders",
        "clear_format",
        "apply_preset",
        "auto_fit",
      ])
      .describe("Formatting action to perform"),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema,
    range: RangeInputSchema.optional().describe(
      "Range to format (A1 notation or semantic)",
    ),

    // set_format fields
    format: CellFormatSchema.optional().describe(
      "Complete cell format specification (background, text, borders, etc.)",
    ),

    // set_background fields
    color: ColorSchema.optional().describe("Background color (RGB)"),

    // set_text_format fields
    textFormat: TextFormatSchema.optional().describe(
      "Text format specification (font family, size, bold, italic, color, etc.)",
    ),

    // set_number_format fields
    numberFormat: NumberFormatSchema.optional().describe(
      "Number format specification (type, pattern, currency symbol, etc.)",
    ),

    // set_alignment fields
    horizontal: HorizontalAlignSchema.optional().describe(
      "Horizontal alignment (LEFT, CENTER, RIGHT)",
    ),
    vertical: VerticalAlignSchema.optional().describe(
      "Vertical alignment (TOP, MIDDLE, BOTTOM)",
    ),
    wrapStrategy: WrapStrategySchema.optional().describe(
      "Text wrap strategy (OVERFLOW_CELL, LEGACY_WRAP, CLIP, WRAP)",
    ),

    // set_borders fields
    top: BorderSchema.optional().describe("Top border style and color"),
    bottom: BorderSchema.optional().describe("Bottom border style and color"),
    left: BorderSchema.optional().describe("Left border style and color"),
    right: BorderSchema.optional().describe("Right border style and color"),
    innerHorizontal: BorderSchema.optional().describe(
      "Inner horizontal borders (between rows)",
    ),
    innerVertical: BorderSchema.optional().describe(
      "Inner vertical borders (between columns)",
    ),

    // apply_preset fields
    preset: z
      .enum([
        "header_row",
        "alternating_rows",
        "total_row",
        "currency",
        "percentage",
        "date",
        "highlight_positive",
        "highlight_negative",
      ])
      .optional()
      .describe(
        "Preset name (header_row, alternating_rows, currency, percentage, etc.)",
      ),

    // auto_fit fields
    dimension: z
      .enum(["ROWS", "COLUMNS", "BOTH"])
      .optional()
      .describe("Dimension to auto-fit (ROWS, COLUMNS, or BOTH)"),

    // Safety fields (for set_format and clear_format)
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  })
  .refine(
    (data) => {
      switch (data.action) {
        case "set_format":
          return !!data.range && !!data.format;
        case "set_background":
          return !!data.range && !!data.color;
        case "set_text_format":
          return !!data.range && !!data.textFormat;
        case "set_number_format":
          return !!data.range && !!data.numberFormat;
        case "set_alignment":
          return !!data.range;
        case "set_borders":
          return !!data.range;
        case "clear_format":
          return !!data.range;
        case "apply_preset":
          return !!data.range && !!data.preset;
        case "auto_fit":
          return !!data.range;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for each action
export function isSetFormatAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "set_format";
  range: NonNullable<SheetsFormatInput["range"]>;
  format: NonNullable<SheetsFormatInput["format"]>;
} {
  return input.action === "set_format";
}

export function isSetBackgroundAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "set_background";
  range: NonNullable<SheetsFormatInput["range"]>;
  color: NonNullable<SheetsFormatInput["color"]>;
} {
  return input.action === "set_background";
}

export function isSetTextFormatAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "set_text_format";
  range: NonNullable<SheetsFormatInput["range"]>;
  textFormat: NonNullable<SheetsFormatInput["textFormat"]>;
} {
  return input.action === "set_text_format";
}

export function isSetNumberFormatAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "set_number_format";
  range: NonNullable<SheetsFormatInput["range"]>;
  numberFormat: NonNullable<SheetsFormatInput["numberFormat"]>;
} {
  return input.action === "set_number_format";
}

export function isSetAlignmentAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "set_alignment";
  range: NonNullable<SheetsFormatInput["range"]>;
} {
  return input.action === "set_alignment";
}

export function isSetBordersAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "set_borders";
  range: NonNullable<SheetsFormatInput["range"]>;
} {
  return input.action === "set_borders";
}

export function isClearFormatAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "clear_format";
  range: NonNullable<SheetsFormatInput["range"]>;
} {
  return input.action === "clear_format";
}

export function isApplyPresetAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "apply_preset";
  range: NonNullable<SheetsFormatInput["range"]>;
  preset: NonNullable<SheetsFormatInput["preset"]>;
} {
  return input.action === "apply_preset";
}

export function isAutoFitAction(
  input: SheetsFormatInput,
): input is SheetsFormatInput & {
  action: "auto_fit";
  range: NonNullable<SheetsFormatInput["range"]>;
} {
  return input.action === "auto_fit";
}
