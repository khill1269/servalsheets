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

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
  sheetId: SheetIdSchema,
});

const DestructiveBaseSchema = BaseSchema.extend({
  safety: SafetyOptionsSchema.optional(),
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsDimensionsInputSchema = z.discriminatedUnion("action", [
  // INSERT_ROWS
  BaseSchema.extend({
    action: z.literal("insert_rows").describe("Insert new rows into the sheet"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based row index to insert at (0 = before first row)"),
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe("Number of rows to insert (default: 1)"),
    inheritFromBefore: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Inherit formatting from row before (false = inherit from row after)",
      ),
  }),

  // INSERT_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("insert_columns")
      .describe("Insert new columns into the sheet"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe(
        "Zero-based column index to insert at (0 = before first column)",
      ),
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe("Number of columns to insert (default: 1)"),
    inheritFromBefore: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Inherit formatting from column before (false = inherit from column after)",
      ),
  }),

  // DELETE_ROWS
  DestructiveBaseSchema.extend({
    action: z.literal("delete_rows").describe("Delete rows from the sheet"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to delete"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe(
        "Zero-based index after last row to delete (exclusive, e.g., startIndex=0, endIndex=5 deletes rows 0-4)",
      ),
    allowMissing: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, don't error when rows don't exist (makes delete idempotent)",
      ),
  }),

  // DELETE_COLUMNS
  DestructiveBaseSchema.extend({
    action: z
      .literal("delete_columns")
      .describe("Delete columns from the sheet"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to delete"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to delete (exclusive)"),
    allowMissing: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, don't error when columns don't exist (makes delete idempotent)",
      ),
  }),

  // MOVE_ROWS
  DestructiveBaseSchema.extend({
    action: z
      .literal("move_rows")
      .describe("Move rows to a different position in the sheet"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to move"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last row to move (exclusive)"),
    destinationIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index where rows should be moved to"),
  }),

  // MOVE_COLUMNS
  DestructiveBaseSchema.extend({
    action: z
      .literal("move_columns")
      .describe("Move columns to a different position in the sheet"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to move"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to move (exclusive)"),
    destinationIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index where columns should be moved to"),
  }),

  // RESIZE_ROWS
  BaseSchema.extend({
    action: z
      .literal("resize_rows")
      .describe("Set row height to a specific pixel size"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to resize"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last row to resize (exclusive)"),
    pixelSize: z
      .number()
      .positive()
      .describe("Height in pixels (must be positive)"),
  }),

  // RESIZE_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("resize_columns")
      .describe("Set column width to a specific pixel size"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to resize"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to resize (exclusive)"),
    pixelSize: z
      .number()
      .positive()
      .describe("Width in pixels (must be positive)"),
  }),

  // AUTO_RESIZE
  BaseSchema.extend({
    action: z
      .literal("auto_resize")
      .describe("Auto-resize rows or columns to fit content"),
    dimension: DimensionSchema.describe(
      "Which dimension to resize: ROWS or COLUMNS",
    ),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first dimension to auto-resize"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe(
        "Zero-based index after last dimension to auto-resize (exclusive)",
      ),
  }),

  // HIDE_ROWS
  BaseSchema.extend({
    action: z
      .literal("hide_rows")
      .describe("Hide rows (they remain but are not visible)"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to hide"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last row to hide (exclusive)"),
  }),

  // HIDE_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("hide_columns")
      .describe("Hide columns (they remain but are not visible)"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to hide"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to hide (exclusive)"),
  }),

  // SHOW_ROWS
  BaseSchema.extend({
    action: z.literal("show_rows").describe("Show previously hidden rows"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to show"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last row to show (exclusive)"),
  }),

  // SHOW_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("show_columns")
      .describe("Show previously hidden columns"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to show"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to show (exclusive)"),
  }),

  // FREEZE_ROWS
  BaseSchema.extend({
    action: z
      .literal("freeze_rows")
      .describe("Freeze top rows (they stay visible when scrolling down)"),
    frozenRowCount: z
      .number()
      .int()
      .min(0)
      .describe("Number of rows to freeze from the top (0 = unfreeze all)"),
  }),

  // FREEZE_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("freeze_columns")
      .describe("Freeze left columns (they stay visible when scrolling right)"),
    frozenColumnCount: z
      .number()
      .int()
      .min(0)
      .describe("Number of columns to freeze from the left (0 = unfreeze all)"),
  }),

  // GROUP_ROWS
  BaseSchema.extend({
    action: z
      .literal("group_rows")
      .describe("Group rows together (allows collapsing/expanding)"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to group"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last row to group (exclusive)"),
    depth: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .default(1)
      .describe("Nesting depth level (1-8, default: 1)"),
  }),

  // GROUP_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("group_columns")
      .describe("Group columns together (allows collapsing/expanding)"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to group"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to group (exclusive)"),
    depth: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .default(1)
      .describe("Nesting depth level (1-8, default: 1)"),
  }),

  // UNGROUP_ROWS
  BaseSchema.extend({
    action: z.literal("ungroup_rows").describe("Remove grouping from rows"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first row to ungroup"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last row to ungroup (exclusive)"),
  }),

  // UNGROUP_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("ungroup_columns")
      .describe("Remove grouping from columns"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of first column to ungroup"),
    endIndex: z
      .number()
      .int()
      .min(1)
      .describe("Zero-based index after last column to ungroup (exclusive)"),
  }),

  // APPEND_ROWS
  BaseSchema.extend({
    action: z
      .literal("append_rows")
      .describe("Add new rows at the end of the sheet"),
    count: z.number().int().positive().describe("Number of rows to append"),
  }),

  // APPEND_COLUMNS
  BaseSchema.extend({
    action: z
      .literal("append_columns")
      .describe("Add new columns at the end of the sheet"),
    count: z.number().int().positive().describe("Number of columns to append"),
  }),
]);

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
