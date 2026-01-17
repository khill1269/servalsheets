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

import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  SheetNameSchema,
  ErrorDetailSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  SafetyOptionsSchema,
} from './shared.js';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Sheet reference - name or ID
 */
export const SheetReferenceSchema = z.union([
  SheetNameSchema.describe('Sheet name'),
  SheetIdSchema.describe('Sheet ID'),
]);

/**
 * Verbosity level for responses
 */
export const VerbositySchema = z
  .enum(['minimal', 'standard', 'verbose'])
  .default('standard')
  .describe('Response verbosity level');

// ============================================================================
// Import CSV Action
// ============================================================================

export const ImportCsvModeSchema = z.enum(['replace', 'append', 'new_sheet']);

export const ImportCsvInputSchema = z.object({
  action: z.literal('import_csv').describe('Import CSV data into a spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheet: SheetReferenceSchema.optional().describe('Target sheet (creates new if not specified)'),
  csvData: z
    .string()
    .min(1)
    .max(10485760, 'CSV data exceeds 10MB limit')
    .describe('CSV data as string (max 10MB)'),
  delimiter: z
    .string()
    .max(5)
    .default(',')
    .describe('Field delimiter (default: , | alternatives: ;, |, tab)'),
  hasHeader: z
    .boolean()
    .default(true)
    .describe('First row is header (default: true | set false if no header row)'),
  mode: ImportCsvModeSchema.default('replace').describe(
    'How to handle existing data (default: replace | alternatives: append, new_sheet)'
  ),
  newSheetName: z.string().max(255).optional().describe('Name for new sheet if mode is new_sheet'),
  skipEmptyRows: z
    .boolean()
    .default(true)
    .describe('Skip empty rows (default: true | set false to include empty rows)'),
  trimValues: z
    .boolean()
    .default(true)
    .describe('Trim whitespace from values (default: true | set false to preserve whitespace)'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe(
    'Safety options: dryRun for preview, autoSnapshot for automatic backups'
  ),
});

export const ImportCsvOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('import_csv'),
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
  action: z.literal('smart_append').describe('Append data matching column headers'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheet: SheetReferenceSchema.describe('Target sheet - name or ID'),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .describe('Array of objects with column headers as keys'),
  matchHeaders: z
    .boolean()
    .default(true)
    .describe('Match columns by header name (default: true | set false for positional matching)'),
  createMissingColumns: z
    .boolean()
    .default(false)
    .describe(
      'Create columns for unmatched headers (default: false | set true to auto-create columns)'
    ),
  skipEmptyRows: z
    .boolean()
    .default(true)
    .describe('Skip rows with all empty values (default: true | set false to include empty rows)'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe(
    'Safety options: dryRun for preview, autoSnapshot for automatic backups'
  ),
});

export const SmartAppendOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('smart_append'),
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
  action: z.literal('bulk_update').describe('Update rows by matching a key column'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheet: SheetReferenceSchema.describe('Target sheet - name or ID'),
  keyColumn: z.string().min(1).describe('Column header to match rows by'),
  updates: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .describe('Array of objects with key column and update values'),
  createUnmatched: z
    .boolean()
    .default(false)
    .describe(
      'Create new rows for unmatched keys (default: false | set true to insert missing rows)'
    ),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe(
    'Safety options: dryRun for preview, autoSnapshot for automatic backups'
  ),
});

export const BulkUpdateOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('bulk_update'),
  rowsUpdated: z.number().int().min(0),
  rowsCreated: z.number().int().min(0),
  keysNotFound: z.array(z.string()),
  cellsModified: z.number().int().min(0),
  snapshotId: z.string().optional(),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Deduplicate Action
// ============================================================================

export const DeduplicateKeepSchema = z.enum(['first', 'last']);

export const DeduplicateInputSchema = z.object({
  action: z.literal('deduplicate').describe('Remove duplicate rows based on key columns'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheet: SheetReferenceSchema.describe('Target sheet - name or ID'),
  keyColumns: z.array(z.string().min(1)).min(1).describe('Columns to check for duplicates'),
  keep: DeduplicateKeepSchema.default('first').describe(
    'Which duplicate to keep (default: first | alternative: last)'
  ),
  preview: z
    .boolean()
    .default(false)
    .describe("Preview only, don't delete duplicates (default: false | set true for dry run)"),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe(
    'Safety options: dryRun for preview, autoSnapshot for automatic backups'
  ),
});

export const DuplicatePreviewItemSchema = z.object({
  rowNumber: z.number().int().min(1),
  keyValues: z.record(z.string(), z.unknown()),
  keepStatus: z.enum(['keep', 'delete']),
});

export const DeduplicateOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('deduplicate'),
  totalRows: z.number().int().min(0),
  uniqueRows: z.number().int().min(0),
  duplicatesFound: z.number().int().min(0),
  rowsDeleted: z.number().int().min(0),
  duplicatePreview: z.array(DuplicatePreviewItemSchema).optional(),
  snapshotId: z.string().optional(),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Combined Composite Input/Output
// ============================================================================

/**
 * All composite operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const CompositeInputSchema = z.discriminatedUnion('action', [
  ImportCsvInputSchema,
  SmartAppendInputSchema,
  BulkUpdateInputSchema,
  DeduplicateInputSchema,
]);

/**
 * Success outputs
 *
 * Using z.union() (not discriminated union) because output schemas
 * are only used for runtime validation, not for LLM guidance.
 * The discriminator field 'action' is already present in each schema.
 */
export const CompositeSuccessOutputSchema = z.union([
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
export type CompositeSuccessOutput = z.infer<typeof CompositeSuccessOutputSchema>;
export type CompositeOutput = z.infer<typeof CompositeOutputSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type CompositeImportCsvInput = CompositeInput & {
  action: 'import_csv';
  spreadsheetId: string;
  csvData: string;
};
export type CompositeSmartAppendInput = CompositeInput & {
  action: 'smart_append';
  spreadsheetId: string;
  sheet: SheetReference;
  data: Array<Record<string, unknown>>;
};
export type CompositeBulkUpdateInput = CompositeInput & {
  action: 'bulk_update';
  spreadsheetId: string;
  sheet: SheetReference;
  keyColumn: string;
  updates: Array<Record<string, unknown>>;
};
export type CompositeDeduplicateInput = CompositeInput & {
  action: 'deduplicate';
  spreadsheetId: string;
  sheet: SheetReference;
  keyColumns: string[];
};

// ============================================================================
// Tool Annotations
// ============================================================================

export const SHEETS_COMPOSITE_ANNOTATIONS: ToolAnnotations = {
  title: 'Composite Operations',
  readOnlyHint: false,
  destructiveHint: true, // Can overwrite/modify data
  idempotentHint: false, // Import/append operations are not idempotent
  openWorldHint: true,
};
