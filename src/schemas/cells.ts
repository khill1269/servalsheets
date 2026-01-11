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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsCellsInputSchema = z.object({
  // Required action discriminator
  action: z.enum([
    "add_note",
    "get_note",
    "clear_note",
    "set_validation",
    "clear_validation",
    "set_hyperlink",
    "clear_hyperlink",
    "merge",
    "unmerge",
    "get_merges",
    "cut",
    "copy",
  ]).describe("The cell operation to perform"),

  // Common fields
  spreadsheetId: SpreadsheetIdSchema.optional().describe("Spreadsheet ID from URL (required for all actions)"),

  // Cell reference fields (add_note, get_note, clear_note, set_hyperlink, clear_hyperlink)
  cell: z.string().optional().describe("Cell reference in A1 notation (e.g., 'A1' or 'Sheet1!B2')"),

  // Note fields (add_note)
  note: z.string().optional().describe("Note/comment text to add to the cell"),

  // Range fields (set_validation, clear_validation, merge, unmerge, cut, copy)
  range: RangeInputSchema.optional().describe("Range to operate on (A1 notation or semantic)"),

  // Validation fields (set_validation)
  validation: DataValidationSchema.optional().describe("Data validation rules (condition, input message, strict mode, dropdown)"),

  // Hyperlink fields (set_hyperlink)
  url: z.string().url().optional().describe("URL to link to (must be valid HTTP/HTTPS URL)"),
  label: z.string().optional().describe("Optional link text (defaults to URL if omitted)"),

  // Merge fields (merge)
  mergeType: z.enum(["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"]).optional().default("MERGE_ALL").describe("Type of merge: MERGE_ALL (single cell), MERGE_COLUMNS (merge columns), MERGE_ROWS (merge rows)"),

  // Sheet ID fields (get_merges)
  sheetId: SheetIdSchema.optional().describe("Numeric sheet ID to query for merged cells"),

  // Cut/Copy fields (cut, copy)
  source: RangeInputSchema.optional().describe("Source range to cut/copy from"),
  destination: z.string().optional().describe("Destination cell in A1 notation (top-left of paste area)"),
  pasteType: z.enum([
    "PASTE_NORMAL",
    "PASTE_VALUES",
    "PASTE_FORMAT",
    "PASTE_NO_BORDERS",
    "PASTE_FORMULA",
  ]).optional().default("PASTE_NORMAL").describe("What to paste: NORMAL (all), VALUES (only values), FORMAT (only formatting), NO_BORDERS (exclude borders), FORMULA (formulas)"),

  // Safety options (clear_note, set_validation, clear_validation, clear_hyperlink, cut)
  safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
}).refine((data) => {
  // Validate required fields based on action
  if (!data.spreadsheetId) return false;

  switch (data.action) {
    case "add_note":
      return !!data.cell && !!data.note;
    case "get_note":
    case "clear_note":
    case "set_hyperlink":
    case "clear_hyperlink":
      return !!data.cell;
    case "set_validation":
      return !!data.range && !!data.validation;
    case "clear_validation":
    case "merge":
    case "unmerge":
      return !!data.range;
    case "get_merges":
      return data.sheetId !== undefined;
    case "cut":
    case "copy":
      return !!data.source && !!data.destination;
    default:
      return false;
  }
}, {
  message: "Missing required fields for the specified action",
});

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type CellsAddNoteInput = SheetsCellsInput & { action: "add_note"; spreadsheetId: string; cell: string; note: string };
export type CellsGetNoteInput = SheetsCellsInput & { action: "get_note"; spreadsheetId: string; cell: string };
export type CellsClearNoteInput = SheetsCellsInput & { action: "clear_note"; spreadsheetId: string; cell: string };
export type CellsSetValidationInput = SheetsCellsInput & { action: "set_validation"; spreadsheetId: string; range: string | { semantic: string }; validation: z.infer<typeof DataValidationSchema> };
export type CellsClearValidationInput = SheetsCellsInput & { action: "clear_validation"; spreadsheetId: string; range: string | { semantic: string } };
export type CellsSetHyperlinkInput = SheetsCellsInput & { action: "set_hyperlink"; spreadsheetId: string; cell: string; url: string };
export type CellsClearHyperlinkInput = SheetsCellsInput & { action: "clear_hyperlink"; spreadsheetId: string; cell: string };
export type CellsMergeInput = SheetsCellsInput & { action: "merge"; spreadsheetId: string; range: string | { semantic: string } };
export type CellsUnmergeInput = SheetsCellsInput & { action: "unmerge"; spreadsheetId: string; range: string | { semantic: string } };
export type CellsGetMergesInput = SheetsCellsInput & { action: "get_merges"; spreadsheetId: string; sheetId: number };
export type CellsCutInput = SheetsCellsInput & { action: "cut"; spreadsheetId: string; source: string | { semantic: string }; destination: string };
export type CellsCopyInput = SheetsCellsInput & { action: "copy"; spreadsheetId: string; source: string | { semantic: string }; destination: string };
