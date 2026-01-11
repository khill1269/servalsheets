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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsSheetInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "add",
        "delete",
        "duplicate",
        "update",
        "copy_to",
        "list",
        "get",
      ])
      .describe("The operation to perform on the sheet/tab"),

    // Required for all actions
    spreadsheetId: SpreadsheetIdSchema.describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),

    // Fields for ADD action
    title: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe(
        "Sheet title (required for: add; optional for: update) - must be unique",
      ),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Position to insert (0 = first, omit = last) (add, update actions)",
      ),
    rowCount: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1000)
      .describe("Initial row count (default: 1000) (add action)"),
    columnCount: z
      .number()
      .int()
      .positive()
      .optional()
      .default(26)
      .describe("Initial column count (default: 26) (add action)"),
    tabColor: ColorSchema.optional().describe(
      "Tab color (RGB) (add, update actions)",
    ),
    hidden: z
      .boolean()
      .optional()
      .default(false)
      .describe("Hide the sheet (default: false) (add, update actions)"),

    // Fields for DELETE, DUPLICATE, UPDATE, COPY_TO, GET actions
    sheetId: SheetIdSchema.optional().describe(
      "Numeric sheet ID (required for: delete, duplicate, update, copy_to, get)",
    ),

    // Fields for DELETE action
    allowMissing: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, don't error when sheet doesn't exist - makes delete idempotent (delete action)",
      ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.) (delete action)",
    ),

    // Fields for DUPLICATE action
    newTitle: z
      .string()
      .optional()
      .describe(
        "Title for duplicated sheet (optional, auto-generated if omitted) (duplicate action)",
      ),
    insertIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Position to insert duplicate (0 = first, omit = after original) (duplicate action)",
      ),

    // Fields for UPDATE action
    rightToLeft: z
      .boolean()
      .optional()
      .describe("Right-to-left text direction (update action)"),

    // Fields for COPY_TO action
    destinationSpreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Target spreadsheet ID (required for: copy_to)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "add":
          return !!data.title;
        case "delete":
        case "duplicate":
        case "update":
        case "get":
          return typeof data.sheetId === "number";
        case "copy_to":
          return (
            typeof data.sheetId === "number" && !!data.destinationSpreadsheetId
          );
        case "list":
          return true; // Only spreadsheetId required (handled by schema)
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type SheetAddInput = SheetsSheetInput & {
  action: "add";
  title: string;
};
export type SheetDeleteInput = SheetsSheetInput & {
  action: "delete";
  sheetId: number;
};
export type SheetDuplicateInput = SheetsSheetInput & {
  action: "duplicate";
  sheetId: number;
};
export type SheetUpdateInput = SheetsSheetInput & {
  action: "update";
  sheetId: number;
};
export type SheetCopyToInput = SheetsSheetInput & {
  action: "copy_to";
  sheetId: number;
  destinationSpreadsheetId: string;
};
export type SheetListInput = SheetsSheetInput & { action: "list" };
export type SheetGetInput = SheetsSheetInput & {
  action: "get";
  sheetId: number;
};
