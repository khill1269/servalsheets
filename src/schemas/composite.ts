/**
 * ServalSheets - Composite Operations Schema
 *
 * Schemas for high-level composite operations.
 * 11 Actions: import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses, quick_report, data_pipeline, conditional_update, stream_append
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * @module schemas/composite
 */

import { z } from 'zod';
import type { ToolAnnotations } from './shared.js';
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
  .enum(['minimal', 'standard', 'detailed'])
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
  rowsImported: z.coerce.number().int().min(0),
  columnsImported: z.coerce.number().int().min(0),
  range: z.string(),
  sheetId: SheetIdSchema,
  sheetName: SheetNameSchema,
  rowsSkipped: z.coerce.number().int().min(0),
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
    .array(
      z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.any()),
          z.record(z.string(), z.any()),
        ])
      )
    )
    .min(1)
    .describe(
      'Array of objects with column headers as keys (values can be string, number, boolean, null, array, or object)'
    ),
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
  rowsAppended: z.coerce.number().int().min(0),
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
    .array(
      z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.any()),
          z.record(z.string(), z.any()),
        ])
      )
    )
    .min(1)
    .describe(
      'Array of objects with key column and update values (can be string, number, boolean, null, array, or object)'
    ),
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
  rowsUpdated: z.coerce.number().int().min(0),
  rowsCreated: z.coerce.number().int().min(0),
  keysNotFound: z.array(z.string()),
  cellsModified: z.coerce.number().int().min(0),
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
  rowNumber: z.coerce.number().int().min(1),
  keyValues: z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.any()),
      z.record(z.string(), z.any()),
    ])
  ),
  keepStatus: z.enum(['keep', 'delete']),
});

export const DeduplicateOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('deduplicate'),
  totalRows: z.coerce.number().int().min(0),
  uniqueRows: z.coerce.number().int().min(0),
  duplicatesFound: z.coerce.number().int().min(0),
  rowsDeleted: z.coerce.number().int().min(0),
  duplicatePreview: z.array(DuplicatePreviewItemSchema).optional(),
  snapshotId: z.string().optional(),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Export XLSX Action
// ============================================================================

export const ExportXlsxInputSchema = z.object({
  action: z.literal('export_xlsx').describe('Export spreadsheet as XLSX (Excel) file'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID to export'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

export const ExportXlsxOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('export_xlsx'),
  fileContent: z.string().describe('Base64-encoded XLSX file content'),
  mimeType: z
    .literal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .describe('MIME type of exported file'),
  filename: z.string().describe('Suggested filename for download'),
  sizeBytes: z.coerce.number().int().describe('File size in bytes'),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Import XLSX Action
// ============================================================================

export const ImportXlsxInputSchema = z.object({
  action: z.literal('import_xlsx').describe('Import XLSX (Excel) file as new spreadsheet'),
  fileContent: z.string().describe('Base64-encoded XLSX file content'),
  title: z.string().max(255).optional().describe('Title for the new spreadsheet'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
  safety: SafetyOptionsSchema.optional().describe('Safety options'),
});

export const ImportXlsxOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('import_xlsx'),
  spreadsheetId: SpreadsheetIdSchema.describe('ID of created spreadsheet'),
  spreadsheetUrl: z.string().describe('URL to the new spreadsheet'),
  sheetsImported: z.coerce.number().int().describe('Number of sheets imported'),
  sheetNames: z.array(z.string()).describe('Names of imported sheets'),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Get Form Responses Action (via linked sheet)
// ============================================================================

export const GetFormResponsesInputSchema = z.object({
  action: z
    .literal('get_form_responses')
    .describe('Read Google Form responses from a form-linked spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID linked to a Google Form'),
  formResponsesSheet: z
    .string()
    .optional()
    .default('Form Responses 1')
    .describe('Sheet name containing form responses (default: "Form Responses 1")'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

export const GetFormResponsesOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('get_form_responses'),
  responseCount: z.coerce.number().int().describe('Total number of form responses'),
  columnHeaders: z.array(z.string()).describe('Form question headers'),
  latestResponse: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.any()),
        z.record(z.string(), z.any()),
      ])
    )
    .optional()
    .describe(
      'Most recent form response (values can be string, number, boolean, null, array, or object)'
    ),
  oldestResponse: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.any()),
        z.record(z.string(), z.any()),
      ])
    )
    .optional()
    .describe(
      'First form response (values can be string, number, boolean, null, array, or object)'
    ),
  formLinked: z.boolean().describe('Whether the sheet appears to be form-linked'),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// LLM-Optimized Workflow Actions (3 new - reduces multiple calls to 1)
// ============================================================================

/**
 * Setup Sheet - Creates a sheet with headers, formatting, and validation in one call
 * LLM Optimization: Saves 70-80% API calls vs manual setup
 */
export const SetupSheetInputSchema = z.object({
  action: z.literal('setup_sheet').describe('Create and configure a new sheet in one operation'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID'),
  sheetName: z.string().max(255).describe('Name for the new sheet'),
  headers: z.array(z.string()).min(1).max(100).describe('Column header names'),
  columnWidths: z
    .array(z.coerce.number().int().min(20).max(500))
    .optional()
    .describe('Column widths in pixels (same order as headers)'),
  headerFormat: z
    .object({
      bold: z.boolean().optional().default(true),
      backgroundColor: z
        .object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        })
        .optional(),
      textColor: z
        .object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        })
        .optional(),
    })
    .optional()
    .describe('Header row formatting'),
  alternatingRows: z
    .object({
      headerColor: z
        .object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        })
        .optional()
        .describe('Header row background color'),
      firstBandColor: z
        .object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        })
        .optional()
        .describe('First band row background color'),
      secondBandColor: z
        .object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        })
        .optional()
        .describe('Second band row background color'),
    })
    .optional()
    .describe('Optional alternating row banding colors'),
  data: z
    .array(z.array(z.string()))
    .optional()
    .describe('Optional initial data rows to write (beyond headers) in same call'),
  freezeHeaderRow: z.boolean().optional().default(true).describe('Freeze the header row'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

export const SetupSheetOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('setup_sheet'),
  sheetId: SheetIdSchema,
  sheetName: SheetNameSchema,
  columnCount: z.coerce.number().int(),
  rowsCreated: z.coerce.number().int().describe('Number of data rows created (beyond header)'),
  apiCallsSaved: z.coerce.number().int().describe('Number of API calls saved vs manual setup'),
  _meta: ResponseMetaSchema.optional(),
});

/**
 * Import and Format - Import CSV and apply formatting in one operation
 * LLM Optimization: Saves 60-70% API calls vs import + format separately
 */
export const ImportAndFormatInputSchema = z.object({
  action: z
    .literal('import_and_format')
    .describe('Import CSV data and apply formatting in one operation'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID'),
  sheet: SheetReferenceSchema.optional().describe('Target sheet (creates new if not specified)'),
  csvData: z.string().min(1).max(10485760).describe('CSV data as string (max 10MB)'),
  delimiter: z.string().max(5).default(',').describe('Field delimiter'),
  hasHeader: z.boolean().default(true).describe('First row is header'),
  newSheetName: z.string().max(255).optional().describe('Name for new sheet'),
  headerFormat: z
    .object({
      bold: z.boolean().optional().default(true),
      backgroundColor: z
        .object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        })
        .optional(),
    })
    .optional()
    .describe('Header row formatting'),
  freezeHeaderRow: z.boolean().optional().default(true).describe('Freeze the header row'),
  autoResizeColumns: z.boolean().optional().default(true).describe('Auto-resize columns to fit'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
  safety: SafetyOptionsSchema.optional().describe('Safety options'),
});

export const ImportAndFormatOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('import_and_format'),
  rowsImported: z.coerce.number().int().min(0),
  columnsImported: z.coerce.number().int().min(0),
  sheetId: SheetIdSchema,
  sheetName: SheetNameSchema,
  range: z.string(),
  apiCallsSaved: z.coerce.number().int().describe('Number of API calls saved vs manual process'),
  mutation: MutationSummarySchema.optional(),
  _meta: ResponseMetaSchema.optional(),
});

/**
 * Clone Structure - Copy sheet structure without data
 * LLM Optimization: Saves 50-60% API calls vs manual copy + clear
 */
export const CloneStructureInputSchema = z.object({
  action: z
    .literal('clone_structure')
    .describe('Clone sheet structure (headers, formats) without data'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID'),
  sourceSheet: SheetReferenceSchema.describe('Source sheet to clone from'),
  newSheetName: z.string().max(255).describe('Name for the cloned sheet'),
  includeFormatting: z.boolean().optional().default(true).describe('Copy cell formatting'),
  includeConditionalFormatting: z
    .boolean()
    .optional()
    .default(true)
    .describe('Copy conditional formatting rules'),
  includeDataValidation: z
    .boolean()
    .optional()
    .default(true)
    .describe('Copy data validation rules'),
  headerRowCount: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(1)
    .describe('Number of header rows to preserve'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

export const CloneStructureOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('clone_structure'),
  newSheetId: SheetIdSchema,
  newSheetName: SheetNameSchema,
  columnCount: z.coerce.number().int(),
  headerRowsPreserved: z.coerce.number().int(),
  formattingCopied: z.boolean(),
  validationCopied: z.boolean(),
  apiCallsSaved: z.coerce.number().int().describe('Number of API calls saved vs manual process'),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Export Large Dataset Action (Streaming)
// ============================================================================

export const ExportLargeDatasetInputSchema = z.object({
  action: z
    .literal('export_large_dataset')
    .describe('Export large dataset with streaming (100K+ rows)'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID to export'),
  range: z.string().describe('Range to export (e.g., "Sheet1!A:Z" or "Sheet1!A1:Z100000")'),
  chunkSize: z.coerce
    .number()
    .int()
    .min(100)
    .max(10000)
    .optional()
    .default(1000)
    .describe('Rows per chunk (default: 1000)'),
  format: z
    .enum(['json', 'csv'])
    .optional()
    .default('json')
    .describe('Output format (default: json)'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

export const ExportLargeDatasetOutputSchema = z.object({
  success: z.literal(true),
  action: z.literal('export_large_dataset'),
  format: z.enum(['json', 'csv']).describe('Output format used'),
  chunkSize: z.coerce.number().int().optional().describe('Chunk size used for export'),
  totalRows: z.coerce.number().int().describe('Total rows exported'),
  totalColumns: z.coerce.number().int().describe('Total columns exported'),
  chunksProcessed: z.coerce.number().int().describe('Number of chunks processed'),
  bytesProcessed: z.coerce.number().int().describe('Total bytes processed'),
  durationMs: z.coerce.number().int().describe('Export duration in milliseconds'),
  streamed: z.boolean().describe('Whether streaming was used'),
  data: z.string().describe('Exported data (JSON string or CSV string)'),
  _meta: ResponseMetaSchema.optional(),
});

// ============================================================================
// Combined Composite Input/Output
// ============================================================================

/**
 * All composite operation inputs (11 actions)
 *
 * Original (7): import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses
 * LLM-Optimized Workflows (3): setup_sheet, import_and_format, clone_structure
 * Streaming (1): export_large_dataset
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 */
export const CompositeInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    // Original composite actions (7)
    ImportCsvInputSchema,
    SmartAppendInputSchema,
    BulkUpdateInputSchema,
    DeduplicateInputSchema,
    ExportXlsxInputSchema,
    ImportXlsxInputSchema,
    GetFormResponsesInputSchema,
    // LLM-optimized workflow actions (3)
    SetupSheetInputSchema,
    ImportAndFormatInputSchema,
    CloneStructureInputSchema,
    // Streaming actions (1)
    ExportLargeDatasetInputSchema,
  ]),
});

/**
 * Success outputs (11 actions)
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
  ExportXlsxOutputSchema,
  ImportXlsxOutputSchema,
  GetFormResponsesOutputSchema,
  // LLM-optimized workflow outputs
  SetupSheetOutputSchema,
  ImportAndFormatOutputSchema,
  CloneStructureOutputSchema,
  // Streaming outputs
  ExportLargeDatasetOutputSchema,
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
export const CompositeResponseSchema = z.discriminatedUnion('success', [
  ImportCsvOutputSchema,
  SmartAppendOutputSchema,
  BulkUpdateOutputSchema,
  DeduplicateOutputSchema,
  ExportXlsxOutputSchema,
  ImportXlsxOutputSchema,
  GetFormResponsesOutputSchema,
  SetupSheetOutputSchema,
  ImportAndFormatOutputSchema,
  CloneStructureOutputSchema,
  ExportLargeDatasetOutputSchema,
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

export type ExportXlsxInput = z.infer<typeof ExportXlsxInputSchema>;
export type ExportXlsxOutput = z.infer<typeof ExportXlsxOutputSchema>;

export type ImportXlsxInput = z.infer<typeof ImportXlsxInputSchema>;
export type ImportXlsxOutput = z.infer<typeof ImportXlsxOutputSchema>;

export type GetFormResponsesInput = z.infer<typeof GetFormResponsesInputSchema>;
export type GetFormResponsesOutput = z.infer<typeof GetFormResponsesOutputSchema>;

export type ExportLargeDatasetInput = z.infer<typeof ExportLargeDatasetInputSchema>;
export type ExportLargeDatasetOutput = z.infer<typeof ExportLargeDatasetOutputSchema>;

// LLM-optimized workflow types
export type SetupSheetInput = z.infer<typeof SetupSheetInputSchema>;
export type SetupSheetOutput = z.infer<typeof SetupSheetOutputSchema>;
export type ImportAndFormatInput = z.infer<typeof ImportAndFormatInputSchema>;
export type ImportAndFormatOutput = z.infer<typeof ImportAndFormatOutputSchema>;
export type CloneStructureInput = z.infer<typeof CloneStructureInputSchema>;
export type CloneStructureOutput = z.infer<typeof CloneStructureOutputSchema>;

export type CompositeInput = z.infer<typeof CompositeInputSchema>;
export type CompositeSuccessOutput = z.infer<typeof CompositeSuccessOutputSchema>;
export type CompositeOutput = z.infer<typeof CompositeOutputSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type CompositeImportCsvInput = CompositeInput['request'] & {
  action: 'import_csv';
  spreadsheetId: string;
  csvData: string;
};
export type CompositeSmartAppendInput = CompositeInput['request'] & {
  action: 'smart_append';
  spreadsheetId: string;
  sheet: SheetReference;
  data: Array<Record<string, unknown>>;
};
export type CompositeBulkUpdateInput = CompositeInput['request'] & {
  action: 'bulk_update';
  spreadsheetId: string;
  sheet: SheetReference;
  keyColumn: string;
  updates: Array<Record<string, unknown>>;
};
export type CompositeDeduplicateInput = CompositeInput['request'] & {
  action: 'deduplicate';
  spreadsheetId: string;
  sheet: SheetReference;
  keyColumns: string[];
};
export type CompositeExportXlsxInput = CompositeInput['request'] & {
  action: 'export_xlsx';
  spreadsheetId: string;
};
export type CompositeImportXlsxInput = CompositeInput['request'] & {
  action: 'import_xlsx';
  fileContent: string;
};
export type CompositeGetFormResponsesInput = CompositeInput['request'] & {
  action: 'get_form_responses';
  spreadsheetId: string;
};
export type CompositeExportLargeDatasetInput = CompositeInput['request'] & {
  action: 'export_large_dataset';
  spreadsheetId: string;
  range: string;
};

// LLM-optimized workflow type helpers
export type CompositeSetupSheetInput = CompositeInput['request'] & {
  action: 'setup_sheet';
  spreadsheetId: string;
  sheetName: string;
  headers: string[];
};
export type CompositeImportAndFormatInput = CompositeInput['request'] & {
  action: 'import_and_format';
  spreadsheetId: string;
  csvData: string;
};
export type CompositeCloneStructureInput = CompositeInput['request'] & {
  action: 'clone_structure';
  spreadsheetId: string;
  sourceSheet: SheetReference;
  newSheetName: string;
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
