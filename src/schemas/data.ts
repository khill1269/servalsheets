/**
 * Tool: sheets_data
 * Consolidated data operations: cell values, notes, hyperlinks, and clipboard operations
 * Merges: values.ts (8 actions) + cells.ts (10 actions) = 18 actions
 * v2.0: Merged find + replace → find_replace
 * v2.0: Validation actions moved to sheets_format (set_validation, clear_validation)
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  ValuesArraySchema,
  ValueRenderOptionSchema,
  ValueInputOptionSchema,
  InsertDataOptionSchema,
  MajorDimensionSchema,
  ConditionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  DiffOptionsSchema,
  type ToolAnnotations,
  type RangeInput,
} from './shared.js';
import {
  CELL_NOTE_MAX_LENGTH,
  HYPERLINK_URL_MAX_LENGTH,
  MAX_CHARACTERS_PER_CELL,
  URL_REGEX,
} from '../config/google-limits.js';

// ============================================================================
// CELL-SPECIFIC SCHEMAS (from cells.ts)
// ============================================================================

export const DataValidationSchema = z.object({
  condition: ConditionSchema,
  inputMessage: z
    .string()
    .max(500, 'Input message exceeds Google Sheets limit of 500 characters')
    .optional(),
  strict: z.boolean().optional().default(true),
  showDropdown: z.boolean().optional().default(true),
});

// ============================================================================
// CONSOLIDATED INPUT SCHEMA (20 actions)
// ============================================================================

// Common fields used across multiple actions
const CommonFieldsSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential data only, ~60% less tokens), standard (balanced), detailed (full metadata)'
    ),
});

// ============================================================================
// VALUE ACTION SCHEMAS (8 actions)
// ============================================================================

const ReadActionSchema = CommonFieldsSchema.extend({
  action: z.literal('read'),
  range: RangeInputSchema.describe('Range to read in A1 notation or semantic'),
  valueRenderOption: ValueRenderOptionSchema.optional()
    .default('FORMATTED_VALUE')
    .describe('How values should be rendered (FORMATTED_VALUE, UNFORMATTED_VALUE, FORMULA)'),
  majorDimension: MajorDimensionSchema.optional()
    .default('ROWS')
    .describe('Major dimension for data layout (ROWS or COLUMNS)'),
  streaming: z.boolean().optional().describe('Enable streaming mode for large reads'),
  chunkSize: z
    .number()
    .int()
    .positive()
    .default(1000)
    .optional()
    .describe('Rows per chunk in streaming mode'),
  cursor: z.string().optional().describe('Opaque pagination cursor from previous response'),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(10000)
    .optional()
    .describe('Maximum number of rows per page (default: 1000, max: 10000)'),
});

const WriteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('write'),
  range: RangeInputSchema.describe('Range to write to in A1 notation or semantic'),
  values: ValuesArraySchema.describe('2D array of cell values (rows × columns)'),
  valueInputOption: ValueInputOptionSchema.optional()
    .default('USER_ENTERED')
    .describe('How input data should be interpreted (USER_ENTERED or RAW)'),
  includeValuesInResponse: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return the written values for verification'),
  diffOptions: DiffOptionsSchema.optional().describe('Diff generation options'),
});

const AppendActionSchema = CommonFieldsSchema.extend({
  action: z.literal('append'),
  range: RangeInputSchema.describe('Range to append to (table or sheet range)'),
  values: ValuesArraySchema.describe('2D array of cell values to append'),
  valueInputOption: ValueInputOptionSchema.optional()
    .default('USER_ENTERED')
    .describe('How input data should be interpreted'),
  insertDataOption: InsertDataOptionSchema.optional()
    .default('INSERT_ROWS')
    .describe('Whether to overwrite or insert rows (INSERT_ROWS or OVERWRITE)'),
});

const ClearActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear'),
  range: RangeInputSchema.describe('Range to clear'),
  previewMode: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show what would change without applying'),
});

const BatchReadActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_read'),
  ranges: z
    .array(RangeInputSchema)
    .min(1)
    .max(100)
    .describe('Array of ranges to read (1-100 ranges)'),
  valueRenderOption: ValueRenderOptionSchema.optional()
    .default('FORMATTED_VALUE')
    .describe('How values should be rendered'),
  majorDimension: MajorDimensionSchema.optional().default('ROWS').describe('Major dimension'),
  cursor: z.string().optional().describe('Pagination cursor'),
  pageSize: z.coerce.number().int().positive().max(10000).optional().describe('Rows per page'),
});

const BatchWriteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_write'),
  data: z
    .array(
      z.object({
        range: RangeInputSchema.describe('Target range'),
        values: ValuesArraySchema.describe('2D array of cell values'),
      })
    )
    .min(1)
    .max(100)
    .describe('Array of range-value pairs to write (1-100 ranges)'),
  valueInputOption: ValueInputOptionSchema.optional()
    .default('USER_ENTERED')
    .describe('How input data should be interpreted'),
  includeValuesInResponse: z.boolean().optional().default(false).describe('Return written values'),
  diffOptions: DiffOptionsSchema.optional().describe('Diff generation options'),
});

const BatchClearActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_clear'),
  ranges: z
    .array(RangeInputSchema)
    .min(1)
    .max(100)
    .describe('Array of ranges to clear (1-100 ranges)'),
  previewMode: z.boolean().optional().default(false).describe('Preview changes without applying'),
});

const FindReplaceActionSchema = CommonFieldsSchema.extend({
  action: z.literal('find_replace'),
  find: z.string().describe('Text or pattern to find'),
  replacement: z
    .string()
    .optional()
    .describe(
      'Text to replace with (optional - if omitted, performs find-only without replacement)'
    ),
  range: RangeInputSchema.optional().describe('Optional range to limit search/replacement'),
  matchCase: z
    .boolean()
    .optional()
    .default(false)
    .describe('Case-sensitive search (default: false)'),
  matchEntireCell: z
    .boolean()
    .optional()
    .default(false)
    .describe('Match entire cell content (default: false)'),
  searchByRegex: z
    .boolean()
    .optional()
    .default(false)
    .describe('Use regular expression for find pattern (default: false)'),
  includeFormulas: z
    .boolean()
    .optional()
    .default(false)
    .describe('Search formula text in addition to values'),
  allSheets: z
    .boolean()
    .optional()
    .default(false)
    .describe('Search all sheets (default: false - current sheet only)'),
  previewMode: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview changes without applying (only relevant when replacement is provided)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Maximum number of matches to return (find-only mode) or replace (replace mode)'),
});

// ============================================================================
// CELL ACTION SCHEMAS (12 actions)
// ============================================================================

const AddNoteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('add_note'),
  cell: z
    .string()
    .describe(
      "Cell reference in A1 notation (e.g., 'A1' or 'Sheet1!B2'). Also accepts 'range' as alias."
    ),
  note: z
    .string()
    .min(1, 'Note cannot be empty')
    .max(
      CELL_NOTE_MAX_LENGTH,
      `Note exceeds Google Sheets limit of ${CELL_NOTE_MAX_LENGTH} characters`
    )
    .describe('Note/comment text to add to the cell (max 50,000 chars)'),
});

const GetNoteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_note'),
  cell: z.string().describe("Cell reference in A1 notation. Also accepts 'range' as alias."),
});

const ClearNoteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear_note'),
  cell: z.string().describe("Cell reference in A1 notation. Also accepts 'range' as alias."),
});

// Data validation actions removed in v2.0 - moved to sheets_format
// Use sheets_format.set_data_validation and sheets_format.clear_data_validation instead

const SetHyperlinkActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_hyperlink'),
  cell: z.string().describe('Cell reference in A1 notation'),
  url: z
    .string()
    .regex(URL_REGEX, 'Invalid URL format')
    .max(
      HYPERLINK_URL_MAX_LENGTH,
      `URL exceeds Google Sheets limit of ${HYPERLINK_URL_MAX_LENGTH} characters`
    )
    .describe('URL to link to (must be valid HTTP/HTTPS URL, max 50,000 chars)'),
  label: z
    .string()
    .max(
      MAX_CHARACTERS_PER_CELL,
      `Label exceeds Google Sheets limit of ${MAX_CHARACTERS_PER_CELL} characters`
    )
    .optional()
    .describe('Optional link text (defaults to URL if omitted, max 50,000 chars)'),
});

const ClearHyperlinkActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear_hyperlink'),
  cell: z.string().describe('Cell reference in A1 notation'),
});

const MergeCellsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('merge_cells'),
  range: RangeInputSchema.describe('Range to merge'),
  mergeType: z
    .enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'])
    .optional()
    .default('MERGE_ALL')
    .describe('Type of merge: MERGE_ALL (single cell), MERGE_COLUMNS, MERGE_ROWS'),
});

const UnmergeCellsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('unmerge_cells'),
  range: RangeInputSchema.describe('Range to unmerge'),
});

const GetMergesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_merges'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to query for merged cells'),
});

const CutPasteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('cut_paste'),
  source: RangeInputSchema.describe('Source range to cut from'),
  destination: z.string().describe('Destination cell in A1 notation (top-left of paste area)'),
  pasteType: z
    .enum(['PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT', 'PASTE_NO_BORDERS', 'PASTE_FORMULA'])
    .optional()
    .default('PASTE_NORMAL')
    .describe('What to paste: NORMAL (all), VALUES, FORMAT, NO_BORDERS, FORMULA'),
});

const CopyPasteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('copy_paste'),
  source: RangeInputSchema.describe('Source range to copy from'),
  destination: z.string().describe('Destination cell in A1 notation (top-left of paste area)'),
  pasteType: z
    .enum(['PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT', 'PASTE_NO_BORDERS', 'PASTE_FORMULA'])
    .optional()
    .default('PASTE_NORMAL')
    .describe('What to paste: NORMAL (all), VALUES, FORMAT, NO_BORDERS, FORMULA'),
});

// ============================================================================
// DISCRIMINATED UNION (18 actions)
// v2.0: find + replace merged into find_replace
// v2.0: validation actions moved to sheets_format (set_validation, clear_validation)
// ============================================================================

// Deprecated action mappings with helpful migration messages
const DEPRECATED_ACTIONS: Record<string, string> = {
  set_validation:
    "Action 'set_validation' was moved to sheets_format tool in v2.0. Use sheets_format with action 'set_data_validation' instead. Example: { tool: 'sheets_format', action: 'set_data_validation', range: '...', condition: { type: 'ONE_OF_LIST', values: ['A', 'B', 'C'] } }",
  clear_validation:
    "Action 'clear_validation' was moved to sheets_format tool in v2.0. Use sheets_format with action 'clear_data_validation' instead. Example: { tool: 'sheets_format', action: 'clear_data_validation', range: '...' }",
};

// Preprocess to normalize common LLM input variations
const normalizeDataRequest = (val: unknown): unknown => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;
  const action = obj['action'] as string;

  // Check for deprecated actions and throw helpful error
  if (action && DEPRECATED_ACTIONS[action]) {
    throw new Error(DEPRECATED_ACTIONS[action]);
  }

  // Alias: 'range' → 'cell' for note actions (LLM compatibility)
  const noteActions = ['add_note', 'get_note', 'clear_note'];
  if (noteActions.includes(action) && obj['range'] && !obj['cell']) {
    return { ...obj, cell: obj['range'] };
  }

  return val;
};

export const SheetsDataInputSchema = z.object({
  request: z.preprocess(
    normalizeDataRequest,
    z.discriminatedUnion('action', [
      // Value actions (8)
      ReadActionSchema,
      WriteActionSchema,
      AppendActionSchema,
      ClearActionSchema,
      BatchReadActionSchema,
      BatchWriteActionSchema,
      BatchClearActionSchema,
      FindReplaceActionSchema,
      // v2.0: merged find + replace
      // Cell actions (10) - was 12, validation moved to sheets_format
      AddNoteActionSchema,
      GetNoteActionSchema,
      ClearNoteActionSchema,
      // SetValidationActionSchema - REMOVED: moved to sheets_format
      // ClearValidationActionSchema - REMOVED: moved to sheets_format
      SetHyperlinkActionSchema,
      ClearHyperlinkActionSchema,
      MergeCellsActionSchema,
      // v2.0: renamed from merge
      UnmergeCellsActionSchema,
      // v2.0: renamed from unmerge
      GetMergesActionSchema,
      CutPasteActionSchema,
      // v2.0: renamed from cut
      CopyPasteActionSchema,
      // v2.0: renamed from copy,
    ])
  ),
});

// ============================================================================
// CONSOLIDATED OUTPUT SCHEMA
// ============================================================================

const DataResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),

    // ========================================================================
    // VALUE OPERATION RESPONSE FIELDS
    // ========================================================================

    // Read results
    values: ValuesArraySchema.optional().describe('2D array of cell values (for read actions)'),
    range: z.string().optional().describe('A1 notation range that was operated on'),
    majorDimension: z.string().optional().describe('Major dimension of the data'),

    // Pagination (MCP 2025-11-25)
    nextCursor: z.string().optional().describe('Cursor for next page (null = no more data)'),
    hasMore: z.boolean().optional().describe('True if more data available'),
    totalRows: z.coerce.number().int().optional().describe('Total rows available (if known)'),

    // Batch read
    valueRanges: z
      .array(
        z.object({
          range: z.string(),
          values: ValuesArraySchema.optional(),
        })
      )
      .optional()
      .describe('Array of range-value pairs (for batch_read action)'),

    // Write results
    updatedCells: z.coerce.number().int().optional().describe('Number of cells updated'),
    updatedRows: z.coerce.number().int().optional().describe('Number of rows updated'),
    updatedColumns: z.coerce.number().int().optional().describe('Number of columns updated'),
    updatedRange: z.string().optional().describe('A1 notation range that was updated'),

    // Find results
    matches: z
      .array(
        z.object({
          cell: z.string(),
          value: z.string(),
          row: z.coerce.number().int(),
          column: z.coerce.number().int(),
        })
      )
      .optional()
      .describe('Array of matching cells (for find action)'),

    // Replace results
    replacementsCount: z.coerce.number().int().optional().describe('Number of replacements made'),
    replacementPreview: z
      .array(
        z.object({
          cell: z.string().describe('Cell address (e.g., A1)'),
          oldValue: z.string().describe('Current value'),
          newValue: z.string().describe('Value after replacement'),
          row: z.coerce.number().int(),
          column: z.coerce.number().int(),
        })
      )
      .optional()
      .describe('Preview of changes (when previewMode=true or dryRun=true)'),

    // Clear preview results
    clearPreview: z
      .array(
        z.object({
          cell: z.string().describe('Cell address (e.g., A1)'),
          currentValue: z.string().describe('Value that will be cleared'),
          row: z.coerce.number().int(),
          column: z.coerce.number().int(),
        })
      )
      .optional()
      .describe('Preview of cells to be cleared (when previewMode=true for clear/batch_clear)'),
    clearedCells: z.coerce.number().int().optional().describe('Number of cells cleared'),
    clearedRanges: z
      .array(z.string())
      .optional()
      .describe('A1 ranges cleared (for batch_clear action)'),

    // Large data
    truncated: z.boolean().optional().describe('True if response was truncated due to size'),
    resourceUri: z.string().optional().describe('URI to full resource for truncated data'),

    // ========================================================================
    // CELL OPERATION RESPONSE FIELDS
    // ========================================================================

    // Note response
    note: z.string().optional().describe('Note content (for get_note action)'),

    // Merge response
    merges: z
      .array(
        z.object({
          startRow: z.coerce.number().int(),
          endRow: z.coerce.number().int(),
          startColumn: z.coerce.number().int(),
          endColumn: z.coerce.number().int(),
        })
      )
      .optional()
      .describe('Array of merged cell ranges (for get_merges action)'),

    // ========================================================================
    // SHARED RESPONSE FIELDS
    // ========================================================================

    // Safety
    dryRun: z.boolean().optional().describe('True if this was a dry run (no changes made)'),
    mutation: MutationSummarySchema.optional().describe('Summary of mutation for tracking'),
    snapshotId: z.string().optional().describe('Snapshot ID for rollback (if created)'),

    // Response metadata (suggestions, cost estimates, related tools)
    _meta: ResponseMetaSchema.optional().describe('Metadata about the response'),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsDataOutputSchema = z.object({
  response: DataResponseSchema,
});

// ============================================================================
// ANNOTATIONS
// ============================================================================

export const SHEETS_DATA_ANNOTATIONS: ToolAnnotations = {
  title: 'Data Operations',
  readOnlyHint: false,
  destructiveHint: true, // write, clear, cut operations can modify data
  idempotentHint: false, // append is not idempotent
  openWorldHint: true,
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SheetsDataInput = z.infer<typeof SheetsDataInputSchema>;
export type SheetsDataOutput = z.infer<typeof SheetsDataOutputSchema>;
export type DataResponse = z.infer<typeof DataResponseSchema>;

// ============================================================================
// TYPE NARROWING HELPERS (20 action types)
// ============================================================================

// Value action types (9)
export type DataReadInput = SheetsDataInput['request'] & {
  action: 'read';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataWriteInput = SheetsDataInput['request'] & {
  action: 'write';
  spreadsheetId: string;
  range: RangeInput;
  values: unknown[][];
};

export type DataAppendInput = SheetsDataInput['request'] & {
  action: 'append';
  spreadsheetId: string;
  range: RangeInput;
  values: unknown[][];
};

export type DataClearInput = SheetsDataInput['request'] & {
  action: 'clear';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataBatchReadInput = SheetsDataInput['request'] & {
  action: 'batch_read';
  spreadsheetId: string;
  ranges: RangeInput[];
};

export type DataBatchWriteInput = SheetsDataInput['request'] & {
  action: 'batch_write';
  spreadsheetId: string;
  data: Array<{
    range: RangeInput;
    values: unknown[][];
  }>;
};

export type DataBatchClearInput = SheetsDataInput['request'] & {
  action: 'batch_clear';
  spreadsheetId: string;
  ranges: RangeInput[];
};

export type DataFindReplaceInput = SheetsDataInput['request'] & {
  action: 'find_replace';
  spreadsheetId: string;
  find: string;
};

// Cell action types (12)
export type DataAddNoteInput = SheetsDataInput['request'] & {
  action: 'add_note';
  spreadsheetId: string;
  cell: string;
  note: string;
};

export type DataGetNoteInput = SheetsDataInput['request'] & {
  action: 'get_note';
  spreadsheetId: string;
  cell: string;
};

export type DataClearNoteInput = SheetsDataInput['request'] & {
  action: 'clear_note';
  spreadsheetId: string;
  cell: string;
};

// Note: DataSetValidationInput and DataClearValidationInput removed in v2.0
// Validation actions are now in sheets_format (set_data_validation, clear_data_validation)

export type DataSetHyperlinkInput = SheetsDataInput['request'] & {
  action: 'set_hyperlink';
  spreadsheetId: string;
  cell: string;
  url: string;
};

export type DataClearHyperlinkInput = SheetsDataInput['request'] & {
  action: 'clear_hyperlink';
  spreadsheetId: string;
  cell: string;
};

export type DataMergeCellsInput = SheetsDataInput['request'] & {
  action: 'merge_cells';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataUnmergeCellsInput = SheetsDataInput['request'] & {
  action: 'unmerge_cells';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataGetMergesInput = SheetsDataInput['request'] & {
  action: 'get_merges';
  spreadsheetId: string;
  sheetId: number;
};

export type DataCutPasteInput = SheetsDataInput['request'] & {
  action: 'cut_paste';
  spreadsheetId: string;
  source: RangeInput;
  destination: string;
};

export type DataCopyPasteInput = SheetsDataInput['request'] & {
  action: 'copy_paste';
  spreadsheetId: string;
  source: RangeInput;
  destination: string;
};
