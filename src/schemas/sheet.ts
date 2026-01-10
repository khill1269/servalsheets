/**
 * Tool 2: sheets_sheet
 * Sheet/tab operations
 * MCP Protocol: 2025-11-25
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  SheetInfoSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ColorSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsSheetInputSchema = z.discriminatedUnion("action", [
  // ADD
  BaseSchema.extend({
    action: z.literal("add").describe("Add a new sheet/tab to the spreadsheet"),
    title: z.string().min(1).max(255).describe("Sheet title (must be unique)"),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Position to insert (0 = first, omit = last)"),
    rowCount: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1000)
      .describe("Initial row count (default: 1000)"),
    columnCount: z
      .number()
      .int()
      .positive()
      .optional()
      .default(26)
      .describe("Initial column count (default: 26)"),
    tabColor: ColorSchema.optional().describe("Tab color (RGB)"),
    hidden: z
      .boolean()
      .optional()
      .default(false)
      .describe("Hide the sheet (default: false)"),
  }),

  // DELETE
  BaseSchema.extend({
    action: z
      .literal("delete")
      .describe("Delete a sheet/tab from the spreadsheet"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID (not the title)"),
    allowMissing: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, don't error when sheet doesn't exist (makes delete idempotent)",
      ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // DUPLICATE
  BaseSchema.extend({
    action: z
      .literal("duplicate")
      .describe("Duplicate/copy a sheet/tab within the same spreadsheet"),
    sheetId: SheetIdSchema.describe("Sheet ID to duplicate"),
    newTitle: z
      .string()
      .optional()
      .describe(
        "Title for duplicated sheet (optional, auto-generated if omitted)",
      ),
    insertIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Position to insert duplicate (0 = first, omit = after original)",
      ),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal("update").describe("Update sheet/tab properties"),
    sheetId: SheetIdSchema.describe("Sheet ID to update"),
    title: z.string().min(1).max(255).optional().describe("New sheet title"),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("New position (0 = first)"),
    hidden: z.boolean().optional().describe("Hide/show the sheet"),
    tabColor: ColorSchema.optional().describe("New tab color (RGB)"),
    rightToLeft: z
      .boolean()
      .optional()
      .describe("Right-to-left text direction"),
  }),

  // COPY_TO
  BaseSchema.extend({
    action: z
      .literal("copy_to")
      .describe("Copy a sheet/tab to a different spreadsheet"),
    sheetId: SheetIdSchema.describe("Sheet ID to copy"),
    destinationSpreadsheetId: SpreadsheetIdSchema.describe(
      "Target spreadsheet ID",
    ),
  }),

  // LIST
  BaseSchema.extend({
    action: z
      .literal("list")
      .describe("List all sheets/tabs in the spreadsheet"),
  }),

  // GET
  BaseSchema.extend({
    action: z
      .literal("get")
      .describe("Get detailed information about a specific sheet/tab"),
    sheetId: SheetIdSchema.describe("Sheet ID to retrieve"),
  }),
]);

const SheetResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    sheet: SheetInfoSchema.optional(),
    sheets: z.array(SheetInfoSchema).optional(),
    copiedSheetId: z.number().int().optional(),
    /** True if delete was called but sheet was already missing (with allowMissing=true) */
    alreadyDeleted: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsSheetOutputSchema = z.object({
  response: SheetResponseSchema,
});

/**
 * Tool annotations for MCP protocol
 *
 * Note: idempotentHint is false because:
 * - delete: fails on second call unless allowMissing=true
 * - add: creates new sheet each time (different sheetId)
 * - duplicate: creates new sheet each time
 * Only 'update', 'list', 'get' are truly idempotent
 */
export const SHEETS_SHEET_ANNOTATIONS: ToolAnnotations = {
  title: "Sheet Management",
  readOnlyHint: false,
  destructiveHint: true, // delete action is destructive
  idempotentHint: false, // delete without allowMissing fails on repeat
  openWorldHint: true,
};

export type SheetsSheetInput = z.infer<typeof SheetsSheetInputSchema>;
export type SheetsSheetOutput = z.infer<typeof SheetsSheetOutputSchema>;
export type SheetResponse = z.infer<typeof SheetResponseSchema>;
