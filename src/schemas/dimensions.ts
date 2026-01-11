/**
 * Tool 6: sheets_dimensions
 * Row and column operations
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  DimensionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsDimensionsInputSchema = z.object({
  // Required action discriminator
  action: z.enum([
    "insert_rows",
    "insert_columns",
    "delete_rows",
    "delete_columns",
    "move_rows",
    "move_columns",
    "resize_rows",
    "resize_columns",
    "auto_resize",
    "hide_rows",
    "hide_columns",
    "show_rows",
    "show_columns",
    "freeze_rows",
    "freeze_columns",
    "group_rows",
    "group_columns",
    "ungroup_rows",
    "ungroup_columns",
    "append_rows",
    "append_columns",
  ]).describe("The dimension operation to perform"),

  // Common fields (required for most actions)
  spreadsheetId: SpreadsheetIdSchema.optional().describe("Spreadsheet ID from URL (required for all actions)"),
  sheetId: SheetIdSchema.optional().describe("Sheet ID (required for all actions)"),

  // Safety options (for destructive operations)
  safety: SafetyOptionsSchema.optional().describe("Safety options for destructive operations (delete_rows, delete_columns, move_rows, move_columns)"),

  // Index fields (used by most actions)
  startIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Zero-based index of first row/column (required for: insert_rows, insert_columns, delete_rows, delete_columns, move_rows, move_columns, resize_rows, resize_columns, auto_resize, hide_rows, hide_columns, show_rows, show_columns, group_rows, group_columns, ungroup_rows, ungroup_columns)"),
  endIndex: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Zero-based index after last row/column, exclusive (required for: delete_rows, delete_columns, move_rows, move_columns, resize_rows, resize_columns, auto_resize, hide_rows, hide_columns, show_rows, show_columns, group_rows, group_columns, ungroup_rows, ungroup_columns)"),

  // Count field (for insert and append operations)
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Number of rows/columns to insert or append (optional for: insert_rows, insert_columns with default 1; required for: append_rows, append_columns)"),

  // Formatting inheritance (for insert operations)
  inheritFromBefore: z
    .boolean()
    .optional()
    .describe("Inherit formatting from row/column before (false = inherit from after) (optional for: insert_rows, insert_columns)"),

  // Destination index (for move operations)
  destinationIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Zero-based index where rows/columns should be moved to (required for: move_rows, move_columns)"),

  // Pixel size (for resize operations)
  pixelSize: z
    .number()
    .positive()
    .optional()
    .describe("Height/width in pixels, must be positive (required for: resize_rows, resize_columns)"),

  // Dimension (for auto_resize)
  dimension: DimensionSchema.optional().describe("Which dimension to resize: ROWS or COLUMNS (required for: auto_resize)"),

  // Frozen count (for freeze operations)
  frozenRowCount: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of rows to freeze from the top, 0 = unfreeze all (required for: freeze_rows)"),
  frozenColumnCount: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of columns to freeze from the left, 0 = unfreeze all (required for: freeze_columns)"),

  // Depth (for group operations)
  depth: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe("Nesting depth level, 1-8 (optional for: group_rows, group_columns, default: 1)"),

  // Allow missing (for delete operations)
  allowMissing: z
    .boolean()
    .optional()
    .describe("If true, don't error when rows/columns don't exist, makes delete idempotent (optional for: delete_rows, delete_columns)"),
}).refine((data) => {
  // Validate required fields based on action
  if (!data.spreadsheetId || data.sheetId === undefined) {
    return false;
  }

  switch (data.action) {
    case "insert_rows":
    case "insert_columns":
      return data.startIndex !== undefined;

    case "delete_rows":
    case "delete_columns":
      return data.startIndex !== undefined && data.endIndex !== undefined;

    case "move_rows":
    case "move_columns":
      return data.startIndex !== undefined && data.endIndex !== undefined && data.destinationIndex !== undefined;

    case "resize_rows":
    case "resize_columns":
      return data.startIndex !== undefined && data.endIndex !== undefined && data.pixelSize !== undefined;

    case "auto_resize":
      return data.startIndex !== undefined && data.endIndex !== undefined && !!data.dimension;

    case "hide_rows":
    case "hide_columns":
    case "show_rows":
    case "show_columns":
    case "group_rows":
    case "group_columns":
    case "ungroup_rows":
    case "ungroup_columns":
      return data.startIndex !== undefined && data.endIndex !== undefined;

    case "freeze_rows":
      return data.frozenRowCount !== undefined;

    case "freeze_columns":
      return data.frozenColumnCount !== undefined;

    case "append_rows":
    case "append_columns":
      return data.count !== undefined;

    default:
      return false;
  }
}, {
  message: "Missing required fields for the specified action",
});

const DimensionsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    rowsAffected: z.number().int().optional(),
    columnsAffected: z.number().int().optional(),
    newSize: z
      .object({
        rowCount: z.number().int(),
        columnCount: z.number().int(),
      })
      .optional(),
    alreadyMissing: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsDimensionsOutputSchema = z.object({
  response: DimensionsResponseSchema,
});

export const SHEETS_DIMENSIONS_ANNOTATIONS: ToolAnnotations = {
  title: "Rows & Columns",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsDimensionsInput = z.infer<typeof SheetsDimensionsInputSchema>;
export type SheetsDimensionsOutput = z.infer<
  typeof SheetsDimensionsOutputSchema
>;
export type DimensionsResponse = z.infer<typeof DimensionsResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type DimensionsInsertRowsInput = SheetsDimensionsInput & { action: "insert_rows"; spreadsheetId: string; sheetId: number; startIndex: number };
export type DimensionsInsertColumnsInput = SheetsDimensionsInput & { action: "insert_columns"; spreadsheetId: string; sheetId: number; startIndex: number };
export type DimensionsDeleteRowsInput = SheetsDimensionsInput & { action: "delete_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsDeleteColumnsInput = SheetsDimensionsInput & { action: "delete_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsMoveRowsInput = SheetsDimensionsInput & { action: "move_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number; destinationIndex: number };
export type DimensionsMoveColumnsInput = SheetsDimensionsInput & { action: "move_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number; destinationIndex: number };
export type DimensionsResizeRowsInput = SheetsDimensionsInput & { action: "resize_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number; pixelSize: number };
export type DimensionsResizeColumnsInput = SheetsDimensionsInput & { action: "resize_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number; pixelSize: number };
export type DimensionsAutoResizeInput = SheetsDimensionsInput & { action: "auto_resize"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number; dimension: "ROWS" | "COLUMNS" };
export type DimensionsHideRowsInput = SheetsDimensionsInput & { action: "hide_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsHideColumnsInput = SheetsDimensionsInput & { action: "hide_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsShowRowsInput = SheetsDimensionsInput & { action: "show_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsShowColumnsInput = SheetsDimensionsInput & { action: "show_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsFreezeRowsInput = SheetsDimensionsInput & { action: "freeze_rows"; spreadsheetId: string; sheetId: number; frozenRowCount: number };
export type DimensionsFreezeColumnsInput = SheetsDimensionsInput & { action: "freeze_columns"; spreadsheetId: string; sheetId: number; frozenColumnCount: number };
export type DimensionsGroupRowsInput = SheetsDimensionsInput & { action: "group_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsGroupColumnsInput = SheetsDimensionsInput & { action: "group_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsUngroupRowsInput = SheetsDimensionsInput & { action: "ungroup_rows"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsUngroupColumnsInput = SheetsDimensionsInput & { action: "ungroup_columns"; spreadsheetId: string; sheetId: number; startIndex: number; endIndex: number };
export type DimensionsAppendRowsInput = SheetsDimensionsInput & { action: "append_rows"; spreadsheetId: string; sheetId: number; count: number };
export type DimensionsAppendColumnsInput = SheetsDimensionsInput & { action: "append_columns"; spreadsheetId: string; sheetId: number; count: number };
