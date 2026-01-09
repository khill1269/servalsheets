/**
 * Tool 4: sheets_cells
 * Cell-level operations (notes, validation, hyperlinks)
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  ConditionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const DataValidationSchema = z.object({
  condition: ConditionSchema,
  inputMessage: z.string().optional(),
  strict: z.boolean().optional().default(true),
  showDropdown: z.boolean().optional().default(true),
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsCellsInputSchema = z.discriminatedUnion("action", [
  // ADD_NOTE
  BaseSchema.extend({
    action: z.literal("add_note").describe("Add or update a note/comment on a cell"),
    cell: z.string().describe("Cell reference in A1 notation (e.g., 'A1' or 'Sheet1!B2')"),
    note: z.string().describe("Note/comment text to add to the cell"),
  }),

  // GET_NOTE
  BaseSchema.extend({
    action: z.literal("get_note").describe("Get the note/comment text from a cell"),
    cell: z.string().describe("Cell reference in A1 notation"),
  }),

  // CLEAR_NOTE
  BaseSchema.extend({
    action: z.literal("clear_note").describe("Remove the note/comment from a cell"),
    cell: z.string().describe("Cell reference in A1 notation"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // SET_VALIDATION
  BaseSchema.extend({
    action: z.literal("set_validation").describe("Set data validation rules for a range of cells"),
    range: RangeInputSchema.describe("Range to apply validation (A1 notation or semantic)"),
    validation: DataValidationSchema.describe("Data validation rules (condition, input message, strict mode, dropdown)"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // CLEAR_VALIDATION
  BaseSchema.extend({
    action: z.literal("clear_validation").describe("Remove data validation rules from a range"),
    range: RangeInputSchema.describe("Range to clear validation from"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // SET_HYPERLINK
  BaseSchema.extend({
    action: z.literal("set_hyperlink").describe("Add or update a hyperlink in a cell"),
    cell: z.string().describe("Cell reference in A1 notation"),
    url: z.string().url().describe("URL to link to (must be valid HTTP/HTTPS URL)"),
    label: z.string().optional().describe("Optional link text (defaults to URL if omitted)"),
  }),

  // CLEAR_HYPERLINK
  BaseSchema.extend({
    action: z.literal("clear_hyperlink").describe("Remove a hyperlink from a cell (keeps cell content)"),
    cell: z.string().describe("Cell reference in A1 notation"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // MERGE
  BaseSchema.extend({
    action: z.literal("merge").describe("Merge multiple cells into one cell"),
    range: RangeInputSchema.describe("Range of cells to merge"),
    mergeType: z
      .enum(["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"])
      .optional()
      .default("MERGE_ALL")
      .describe("Type of merge: MERGE_ALL (single cell), MERGE_COLUMNS (merge columns), MERGE_ROWS (merge rows)"),
  }),

  // UNMERGE
  BaseSchema.extend({
    action: z.literal("unmerge").describe("Unmerge previously merged cells"),
    range: RangeInputSchema.describe("Range containing merged cells to unmerge"),
  }),

  // GET_MERGES
  BaseSchema.extend({
    action: z.literal("get_merges").describe("Get all merged cell ranges in a sheet"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID to query for merged cells"),
  }),

  // CUT
  BaseSchema.extend({
    action: z.literal("cut").describe("Cut cells (move) from source to destination"),
    source: RangeInputSchema.describe("Source range to cut from"),
    destination: z.string().describe("Destination cell in A1 notation (top-left of paste area)"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // COPY
  BaseSchema.extend({
    action: z.literal("copy").describe("Copy cells from source to destination"),
    source: RangeInputSchema.describe("Source range to copy from"),
    destination: z.string().describe("Destination cell in A1 notation (top-left of paste area)"),
    pasteType: z
      .enum([
        "PASTE_NORMAL",
        "PASTE_VALUES",
        "PASTE_FORMAT",
        "PASTE_NO_BORDERS",
        "PASTE_FORMULA",
      ])
      .optional()
      .default("PASTE_NORMAL")
      .describe("What to paste: NORMAL (all), VALUES (only values), FORMAT (only formatting), NO_BORDERS (exclude borders), FORMULA (formulas)"),
  }),
]);

const CellsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    note: z.string().optional(),
    merges: z
      .array(
        z.object({
          startRow: z.number().int(),
          endRow: z.number().int(),
          startColumn: z.number().int(),
          endColumn: z.number().int(),
        }),
      )
      .optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsCellsOutputSchema = z.object({
  response: CellsResponseSchema,
});

export const SHEETS_CELLS_ANNOTATIONS: ToolAnnotations = {
  title: "Cell Operations",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsCellsInput = z.infer<typeof SheetsCellsInputSchema>;
export type SheetsCellsOutput = z.infer<typeof SheetsCellsOutputSchema>;
export type CellsResponse = z.infer<typeof CellsResponseSchema>;
