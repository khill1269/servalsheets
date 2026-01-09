/**
 * Tool 3: sheets_values
 * Cell value operations (read/write)
 *
 * SCHEMA PATTERN: Direct discriminated union (no wrapper)
 * This exposes all fields at top level for proper MCP client UX.
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  ValuesArraySchema,
  RangeInputSchema,
  ValueRenderOptionSchema,
  ValueInputOptionSchema,
  InsertDataOptionSchema,
  MajorDimensionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  DiffOptionsSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsValuesInputSchema = z.discriminatedUnion("action", [
  // READ
  BaseSchema.extend({
    action: z.literal("read").describe("Read cell values from a range"),
    range: RangeInputSchema.describe("Range to read (A1 notation or semantic)"),
    valueRenderOption: ValueRenderOptionSchema.optional().describe(
      "How values should be rendered (FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA)",
    ),
    majorDimension: MajorDimensionSchema.optional().describe(
      "Major dimension (ROWS or COLUMNS)",
    ),
    streaming: z
      .boolean()
      .optional()
      .describe(
        "Enable streaming mode for large reads (chunks data to respect deadlines)",
      ),
    chunkSize: z
      .number()
      .int()
      .positive()
      .default(1000)
      .optional()
      .describe("Rows per chunk in streaming mode (default: 1000)"),
  }),

  // WRITE (idempotent - set exact values)
  BaseSchema.extend({
    action: z.literal("write").describe("Write values to cells (overwrites existing data)"),
    range: RangeInputSchema.describe("Target range (A1 notation or semantic)"),
    values: ValuesArraySchema.describe("2D array of cell values (rows × columns)"),
    valueInputOption: ValueInputOptionSchema.optional().describe(
      "How input data should be interpreted (RAW or USER_ENTERED)",
    ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
    diffOptions: DiffOptionsSchema.optional().describe(
      "Diff generation options (tier, sampleSize, maxFullDiffCells)",
    ),
    includeValuesInResponse: z
      .boolean()
      .optional()
      .default(false)
      .describe("Return the written values for verification"),
  }),

  // APPEND (NOT idempotent - adds rows)
  BaseSchema.extend({
    action: z.literal("append").describe("Append rows to the end of a range"),
    range: RangeInputSchema.describe("Target range (determines where to append)"),
    values: ValuesArraySchema.describe("2D array of cell values to append"),
    valueInputOption: ValueInputOptionSchema.optional().describe(
      "How input data should be interpreted (RAW or USER_ENTERED)",
    ),
    insertDataOption: InsertDataOptionSchema.optional().describe(
      "Whether to overwrite or insert rows (OVERWRITE or INSERT_ROWS)",
    ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // CLEAR
  BaseSchema.extend({
    action: z.literal("clear").describe("Clear cell values in a range (delete contents)"),
    range: RangeInputSchema.describe("Range to clear (A1 notation or semantic)"),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // BATCH_READ
  BaseSchema.extend({
    action: z.literal("batch_read").describe("Read multiple ranges efficiently (single API call)"),
    ranges: z
      .array(RangeInputSchema)
      .min(1)
      .max(100)
      .describe("Array of ranges to read (1-100 ranges)"),
    valueRenderOption: ValueRenderOptionSchema.optional().describe(
      "How values should be rendered (FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA)",
    ),
    majorDimension: MajorDimensionSchema.optional().describe(
      "Major dimension (ROWS or COLUMNS)",
    ),
  }),

  // BATCH_WRITE
  BaseSchema.extend({
    action: z.literal("batch_write").describe("Write to multiple ranges efficiently (single API call)"),
    data: z
      .array(
        z.object({
          range: RangeInputSchema.describe("Target range"),
          values: ValuesArraySchema.describe("2D array of cell values"),
        }),
      )
      .min(1)
      .max(100)
      .describe("Array of range-value pairs to write (1-100 ranges)"),
    valueInputOption: ValueInputOptionSchema.optional().describe(
      "How input data should be interpreted (RAW or USER_ENTERED)",
    ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
    diffOptions: DiffOptionsSchema.optional().describe(
      "Diff generation options (tier, sampleSize, maxFullDiffCells)",
    ),
    includeValuesInResponse: z
      .boolean()
      .optional()
      .default(false)
      .describe("Return the written values for verification"),
  }),

  // BATCH_CLEAR
  BaseSchema.extend({
    action: z.literal("batch_clear").describe("Clear multiple ranges efficiently (single API call)"),
    ranges: z
      .array(RangeInputSchema)
      .min(1)
      .max(100)
      .describe("Array of ranges to clear (1-100 ranges)"),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // FIND
  BaseSchema.extend({
    action: z.literal("find").describe("Search for cells matching a query"),
    range: RangeInputSchema.optional().describe(
      "Range to search (optional, searches entire sheet if omitted)",
    ),
    query: z.string().describe("Search query (text or pattern to find)"),
    matchCase: z
      .boolean()
      .optional()
      .default(false)
      .describe("Case-sensitive search (default: false)"),
    matchEntireCell: z
      .boolean()
      .optional()
      .default(false)
      .describe("Match entire cell content (default: false, allows partial matches)"),
    includeFormulas: z
      .boolean()
      .optional()
      .default(false)
      .describe("Search formula text in addition to values (default: false)"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Maximum number of matches to return (default: 100)"),
  }),

  // REPLACE
  BaseSchema.extend({
    action: z.literal("replace").describe("Find and replace cell contents"),
    range: RangeInputSchema.optional().describe(
      "Range to search (optional, searches entire sheet if omitted)",
    ),
    find: z.string().describe("Text to find"),
    replacement: z.string().describe("Text to replace with"),
    matchCase: z
      .boolean()
      .optional()
      .default(false)
      .describe("Case-sensitive search (default: false)"),
    matchEntireCell: z
      .boolean()
      .optional()
      .default(false)
      .describe("Match entire cell content (default: false, allows partial matches)"),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),
]);

// Output response union
const ValuesResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Read results
    values: ValuesArraySchema.optional(),
    range: z.string().optional(),
    majorDimension: z.string().optional(),
    // Batch read
    valueRanges: z
      .array(
        z.object({
          range: z.string(),
          values: ValuesArraySchema.optional(),
        }),
      )
      .optional(),
    // Write results
    updatedCells: z.number().int().optional(),
    updatedRows: z.number().int().optional(),
    updatedColumns: z.number().int().optional(),
    updatedRange: z.string().optional(),
    // Find results
    matches: z
      .array(
        z.object({
          cell: z.string(),
          value: z.string(),
          row: z.number().int(),
          column: z.number().int(),
        }),
      )
      .optional(),
    // Replace results
    replacementsCount: z.number().int().optional(),
    // Large data
    truncated: z.boolean().optional(),
    resourceUri: z.string().optional(),
    // Safety
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    // Response metadata (suggestions, cost estimates, related tools)
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

// TOP-LEVEL OUTPUT SCHEMA (z.object with union inside)
export const SheetsValuesOutputSchema = z.object({
  response: ValuesResponseSchema,
});

export const SHEETS_VALUES_ANNOTATIONS: ToolAnnotations = {
  title: "Cell Values",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false, // append is not
  openWorldHint: true,
};

export type SheetsValuesInput = z.infer<typeof SheetsValuesInputSchema>;
export type SheetsValuesOutput = z.infer<typeof SheetsValuesOutputSchema>;
export type ValuesResponse = z.infer<typeof ValuesResponseSchema>;
