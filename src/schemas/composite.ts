/**
 * ServalSheets - Composite Operations Schema
 *
 * Schemas for high-level composite operations.
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * @module schemas/composite
 */

import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  SheetNameSchema,
  ErrorDetailSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
} from "./shared.js";

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Sheet reference - name or ID
 */
export const SheetReferenceSchema = z.union([
  SheetNameSchema.describe("Sheet name"),
  SheetIdSchema.describe("Sheet ID"),
]);

/**
 * Verbosity level for responses
 */
export const VerbositySchema = z
  .enum(["minimal", "standard", "verbose"])
  .default("standard")
  .describe("Response verbosity level");

// ============================================================================
// Import CSV Action
// ============================================================================

export const ImportCsvModeSchema = z.enum(["replace", "append", "new_sheet"]);

export const ImportCsvInputSchema = z.object({
  action: z.literal("import_csv"),
  spreadsheetId: SpreadsheetIdSchema,
  sheet: SheetReferenceSchema.optional().describe(
    "Target sheet (creates new if not specified)",
  ),
  csvData: z.string().min(1).describe("CSV data as string"),
  delimiter: z.string().max(5).default(",").describe("Field delimiter"),
  hasHeader: z.boolean().default(true).describe("First row is header"),
  mode: ImportCsvModeSchema.default("replace").describe(
    "How to handle existing data",
  ),
  newSheetName: z
    .string()
    .max(255)
    .optional()
    .describe("Name for new sheet if mode is new_sheet"),
  skipEmptyRows: z.boolean().default(true).describe("Skip empty rows"),
  trimValues: z.boolean().default(true).describe("Trim whitespace from values"),
});

export const ImportCsvOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal("import_csv"),
  rowsImported: z.number().int().min(0),
  columnsImported: z.number().int().min(0),
  range: z.string(),
  sheetId: SheetIdSchema,
  sheetName: SheetNameSchema,
  rowsSkipped: z.number().int().min(0),
  newSheetCreated: z.boolean(),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Smart Append Action
// ============================================================================

export const SmartAppendInputSchema = z.object({
  action: z.literal("smart_append"),
  spreadsheetId: SpreadsheetIdSchema,
  sheet: SheetReferenceSchema.describe("Target sheet"),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .describe("Array of objects with column headers as keys"),
  matchHeaders: z
    .boolean()
    .default(true)
    .describe("Match columns by header name"),
  createMissingColumns: z
    .boolean()
    .default(false)
    .describe("Create columns for unmatched headers"),
  skipEmptyRows: z
    .boolean()
    .default(true)
    .describe("Skip rows with all empty values"),
});

export const SmartAppendOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal("smart_append"),
  rowsAppended: z.number().int().min(0),
  columnsMatched: z.array(z.string()),
  columnsCreated: z.array(z.string()),
  columnsSkipped: z.array(z.string()),
  range: z.string(),
  sheetId: SheetIdSchema,
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Bulk Update Action
// ============================================================================

export const BulkUpdateInputSchema = z.object({
  action: z.literal("bulk_update"),
  spreadsheetId: SpreadsheetIdSchema,
  sheet: SheetReferenceSchema.describe("Target sheet"),
  keyColumn: z.string().min(1).describe("Column header to match rows by"),
  updates: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .describe("Array of objects with key column and update values"),
  createUnmatched: z
    .boolean()
    .default(false)
    .describe("Create new rows for unmatched keys"),
});

export const BulkUpdateOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal("bulk_update"),
  rowsUpdated: z.number().int().min(0),
  rowsCreated: z.number().int().min(0),
  keysNotFound: z.array(z.string()),
  cellsModified: z.number().int().min(0),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Deduplicate Action
// ============================================================================

export const DeduplicateKeepSchema = z.enum(["first", "last"]);

export const DeduplicateInputSchema = z.object({
  action: z.literal("deduplicate"),
  spreadsheetId: SpreadsheetIdSchema,
  sheet: SheetReferenceSchema.describe("Target sheet"),
  keyColumns: z
    .array(z.string().min(1))
    .min(1)
    .describe("Columns to check for duplicates"),
  keep: DeduplicateKeepSchema.default("first").describe(
    "Which duplicate to keep",
  ),
  preview: z
    .boolean()
    .default(false)
    .describe("Preview only, don't delete duplicates"),
});

export const DuplicatePreviewItemSchema = z.object({
  rowNumber: z.number().int().min(1),
  keyValues: z.record(z.string(), z.unknown()),
  keepStatus: z.enum(["keep", "delete"]),
});

export const DeduplicateOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal("deduplicate"),
  totalRows: z.number().int().min(0),
  uniqueRows: z.number().int().min(0),
  duplicatesFound: z.number().int().min(0),
  rowsDeleted: z.number().int().min(0),
  duplicatePreview: z.array(DuplicatePreviewItemSchema).optional(),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Combined Composite Input/Output
// ============================================================================

/**
 * All composite operation inputs
 */
export const CompositeInputSchema = z.discriminatedUnion("action", [
  ImportCsvInputSchema,
  SmartAppendInputSchema,
  BulkUpdateInputSchema,
  DeduplicateInputSchema,
]);

/**
 * Success outputs
 */
export const CompositeSuccessOutputSchema = z.discriminatedUnion("action", [
  ImportCsvOutputSchema,
  SmartAppendOutputSchema,
  BulkUpdateOutputSchema,
  DeduplicateOutputSchema,
]);

/**
 * Error output
 */
export const CompositeErrorOutputSchema = z.object({
  success: z.literal(false),
  error: ErrorDetailSchema,
});

/**
 * Combined composite response
 * Note: Using z.union instead of z.discriminatedUnion because
 * CompositeSuccessOutputSchema is itself a discriminated union
 */
export const CompositeResponseSchema = z.union([
  CompositeSuccessOutputSchema,
  CompositeErrorOutputSchema,
]);

/**
 * Full composite output with response wrapper
 */
export const CompositeOutputSchema = z.object({
  response: CompositeResponseSchema,
});

// ============================================================================
// Type Exports
// ============================================================================

export type SheetReference = z.infer<typeof SheetReferenceSchema>;
export type VerbosityLevel = z.infer<typeof VerbositySchema>;

export type ImportCsvInput = z.infer<typeof ImportCsvInputSchema>;
export type ImportCsvOutput = z.infer<typeof ImportCsvOutputSchema>;

export type SmartAppendInput = z.infer<typeof SmartAppendInputSchema>;
export type SmartAppendOutput = z.infer<typeof SmartAppendOutputSchema>;

export type BulkUpdateInput = z.infer<typeof BulkUpdateInputSchema>;
export type BulkUpdateOutput = z.infer<typeof BulkUpdateOutputSchema>;

export type DeduplicateInput = z.infer<typeof DeduplicateInputSchema>;
export type DeduplicateOutput = z.infer<typeof DeduplicateOutputSchema>;

export type CompositeInput = z.infer<typeof CompositeInputSchema>;
export type CompositeSuccessOutput = z.infer<
  typeof CompositeSuccessOutputSchema
>;
export type CompositeOutput = z.infer<typeof CompositeOutputSchema>;

// ============================================================================
// Tool Annotations
// ============================================================================

export const SHEETS_COMPOSITE_ANNOTATIONS: ToolAnnotations = {
  title: "Composite Operations",
  readOnlyHint: false,
  destructiveHint: true, // Can overwrite/modify data
  idempotentHint: false, // Import/append operations are not idempotent
  openWorldHint: true,
};
