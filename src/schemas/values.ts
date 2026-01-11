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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsValuesInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "read",
        "write",
        "append",
        "clear",
        "batch_read",
        "batch_write",
        "batch_clear",
        "find",
        "replace",
      ])
      .describe("The operation to perform on cell values"),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),
    range: RangeInputSchema.optional().describe(
      "Range to operate on (A1 notation or semantic) (required for: read, write, append, clear; optional for: find, replace)",
    ),

    // Read-specific fields
    valueRenderOption: ValueRenderOptionSchema.optional().describe(
      "How values should be rendered (FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA) (read, batch_read)",
    ),
    majorDimension: MajorDimensionSchema.optional().describe(
      "Major dimension (ROWS or COLUMNS) (read, batch_read)",
    ),
    streaming: z
      .boolean()
      .optional()
      .describe(
        "Enable streaming mode for large reads (chunks data to respect deadlines) (read only)",
      ),
    chunkSize: z
      .number()
      .int()
      .positive()
      .default(1000)
      .optional()
      .describe("Rows per chunk in streaming mode (default: 1000) (read only)"),

    // Write/Append-specific fields
    values: ValuesArraySchema.optional().describe(
      "2D array of cell values (rows × columns) (required for: write, append)",
    ),
    valueInputOption: ValueInputOptionSchema.optional().describe(
      "How input data should be interpreted (RAW or USER_ENTERED) (write, append, batch_write)",
    ),
    includeValuesInResponse: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Return the written values for verification (write, batch_write)",
      ),

    // Append-specific fields
    insertDataOption: InsertDataOptionSchema.optional().describe(
      "Whether to overwrite or insert rows (OVERWRITE or INSERT_ROWS) (append only)",
    ),

    // Batch operations fields
    ranges: z
      .array(RangeInputSchema)
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Array of ranges to read/clear (1-100 ranges) (required for: batch_read, batch_clear)",
      ),
    data: z
      .array(
        z.object({
          range: RangeInputSchema.describe("Target range"),
          values: ValuesArraySchema.describe("2D array of cell values"),
        }),
      )
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Array of range-value pairs to write (1-100 ranges) (required for: batch_write)",
      ),

    // Find/Replace-specific fields
    query: z
      .string()
      .optional()
      .describe("Search query (text or pattern to find) (required for: find)"),
    find: z
      .string()
      .optional()
      .describe("Text to find (required for: replace)"),
    replacement: z
      .string()
      .optional()
      .describe("Text to replace with (required for: replace)"),
    matchCase: z
      .boolean()
      .optional()
      .default(false)
      .describe("Case-sensitive search (default: false) (find, replace)"),
    matchEntireCell: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Match entire cell content (default: false, allows partial matches) (find, replace)",
      ),
    includeFormulas: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Search formula text in addition to values (default: false) (find only)",
      ),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Maximum number of matches to return (default: 100) (find only)"),

    // Safety and diff options (common to write operations)
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.) (write, append, clear, batch_write, batch_clear, replace)",
    ),
    diffOptions: DiffOptionsSchema.optional().describe(
      "Diff generation options (tier, sampleSize, maxFullDiffCells) (write, batch_write)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "read":
          return !!data.spreadsheetId && !!data.range;
        case "write":
          return !!data.spreadsheetId && !!data.range && !!data.values;
        case "append":
          return !!data.spreadsheetId && !!data.range && !!data.values;
        case "clear":
          return !!data.spreadsheetId && !!data.range;
        case "batch_read":
          return !!data.spreadsheetId && !!data.ranges && data.ranges.length > 0;
        case "batch_write":
          return !!data.spreadsheetId && !!data.data && data.data.length > 0;
        case "batch_clear":
          return !!data.spreadsheetId && !!data.ranges && data.ranges.length > 0;
        case "find":
          return !!data.spreadsheetId && !!data.query;
        case "replace":
          return (
            !!data.spreadsheetId && !!data.find && data.replacement !== undefined
          );
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type ValuesReadInput = SheetsValuesInput & {
  action: "read";
  spreadsheetId: string;
  range: string | { a1: string } | { semantic: string };
};
export type ValuesWriteInput = SheetsValuesInput & {
  action: "write";
  spreadsheetId: string;
  range: string | { a1: string } | { semantic: string };
  values: unknown[][];
};
export type ValuesAppendInput = SheetsValuesInput & {
  action: "append";
  spreadsheetId: string;
  range: string | { a1: string } | { semantic: string };
  values: unknown[][];
};
export type ValuesClearInput = SheetsValuesInput & {
  action: "clear";
  spreadsheetId: string;
  range: string | { a1: string } | { semantic: string };
};
export type ValuesBatchReadInput = SheetsValuesInput & {
  action: "batch_read";
  spreadsheetId: string;
  ranges: Array<string | { a1: string } | { semantic: string }>;
};
export type ValuesBatchWriteInput = SheetsValuesInput & {
  action: "batch_write";
  spreadsheetId: string;
  data: Array<{
    range: string | { a1: string } | { semantic: string };
    values: unknown[][];
  }>;
};
export type ValuesBatchClearInput = SheetsValuesInput & {
  action: "batch_clear";
  spreadsheetId: string;
  ranges: Array<string | { a1: string } | { semantic: string }>;
};
export type ValuesFindInput = SheetsValuesInput & {
  action: "find";
  spreadsheetId: string;
  query: string;
};
export type ValuesReplaceInput = SheetsValuesInput & {
  action: "replace";
  spreadsheetId: string;
  find: string;
  replacement: string;
};
