/**
 * Tool: sheets_data
 * Consolidated data operations: cell values, notes, validation, hyperlinks, and clipboard operations
 * Merges: values.ts (9 actions) + cells.ts (12 actions) = 21 actions
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

// ============================================================================
// CELL-SPECIFIC SCHEMAS (from cells.ts)
// ============================================================================

const DataValidationSchema = z.object({
  condition: ConditionSchema,
  inputMessage: z.string().optional(),
  strict: z.boolean().optional().default(true),
  showDropdown: z.boolean().optional().default(true),
});

// ============================================================================
// CONSOLIDATED INPUT SCHEMA (21 actions)
// ============================================================================

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsDataInputSchema = z
  .object({
    // Required action discriminator (21 actions total)
    action: z
      .enum([
        // Value actions (9 actions)
        'read',
        'write',
        'append',
        'clear',
        'batch_read',
        'batch_write',
        'batch_clear',
        'find',
        'replace',
        // Cell actions (12 actions)
        'add_note',
        'get_note',
        'clear_note',
        'set_validation',
        'clear_validation',
        'set_hyperlink',
        'clear_hyperlink',
        'merge',
        'unmerge',
        'get_merges',
        'cut',
        'copy',
      ])
      .describe(
        'The data operation to perform (values, notes, validation, hyperlinks, or clipboard)'
      ),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      'Spreadsheet ID from URL (required for all actions)'
    ),

    // ========================================================================
    // VALUE OPERATION FIELDS (from values.ts)
    // ========================================================================

    // Range field for value operations (read, write, append, clear)
    range: RangeInputSchema.optional().describe(
      'Range to operate on (A1 notation or semantic) (required for: read, write, append, clear, set_validation, clear_validation, merge, unmerge; optional for: find, replace)'
    ),

    // Read-specific fields
    valueRenderOption: ValueRenderOptionSchema.optional().describe(
      'How values should be rendered (FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA) (read, batch_read)'
    ),
    majorDimension: MajorDimensionSchema.optional().describe(
      'Major dimension (ROWS or COLUMNS) (read, batch_read)'
    ),
    streaming: z
      .boolean()
      .optional()
      .describe(
        'Enable streaming mode for large reads (chunks data to respect deadlines) (read only)'
      ),
    chunkSize: z
      .number()
      .int()
      .positive()
      .default(1000)
      .optional()
      .describe('Rows per chunk in streaming mode (default: 1000) (read only)'),

    // Pagination fields (MCP 2025-11-25 compliance)
    cursor: z
      .string()
      .optional()
      .describe('Opaque pagination cursor from previous response (read, batch_read)'),
    pageSize: z
      .number()
      .int()
      .positive()
      .max(10000)
      .optional()
      .describe('Maximum number of rows per page (default: 1000, max: 10000) (read, batch_read)'),

    // Write/Append-specific fields
    values: ValuesArraySchema.optional().describe(
      '2D array of cell values (rows × columns) (required for: write, append)'
    ),
    valueInputOption: ValueInputOptionSchema.optional().describe(
      'How input data should be interpreted (RAW or USER_ENTERED) (write, append, batch_write)'
    ),
    includeValuesInResponse: z
      .boolean()
      .optional()
      .default(false)
      .describe('Return the written values for verification (write, batch_write)'),

    // Append-specific fields
    insertDataOption: InsertDataOptionSchema.optional().describe(
      'Whether to overwrite or insert rows (OVERWRITE or INSERT_ROWS) (append only)'
    ),

    // Batch operations fields
    ranges: z
      .array(RangeInputSchema)
      .min(1)
      .max(100)
      .optional()
      .describe(
        'Array of ranges to read/clear (1-100 ranges) (required for: batch_read, batch_clear)'
      ),
    data: z
      .array(
        z.object({
          range: RangeInputSchema.describe('Target range'),
          values: ValuesArraySchema.describe('2D array of cell values'),
        })
      )
      .min(1)
      .max(100)
      .optional()
      .describe('Array of range-value pairs to write (1-100 ranges) (required for: batch_write)'),

    // Find/Replace-specific fields
    query: z
      .string()
      .optional()
      .describe('Search query (text or pattern to find) (required for: find)'),
    find: z.string().optional().describe('Text to find (required for: replace)'),
    replacement: z.string().optional().describe('Text to replace with (required for: replace)'),
    matchCase: z
      .boolean()
      .optional()
      .default(false)
      .describe('Case-sensitive search (default: false) (find, replace)'),
    matchEntireCell: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Match entire cell content (default: false, allows partial matches) (find, replace)'
      ),
    includeFormulas: z
      .boolean()
      .optional()
      .default(false)
      .describe('Search formula text in addition to values (default: false) (find only)'),
    previewMode: z
      .boolean()
      .optional()
      .default(false)
      .describe('Show what would change without applying (replace, clear, batch_clear)'),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe('Maximum number of matches to return (default: 100) (find only)'),

    // ========================================================================
    // CELL OPERATION FIELDS (from cells.ts)
    // ========================================================================

    // Cell reference fields (add_note, get_note, clear_note, set_hyperlink, clear_hyperlink)
    cell: z
      .string()
      .optional()
      .describe(
        "Cell reference in A1 notation (e.g., 'A1' or 'Sheet1!B2') (required for: add_note, get_note, clear_note, set_hyperlink, clear_hyperlink)"
      ),

    // Note fields (add_note)
    note: z
      .string()
      .optional()
      .describe('Note/comment text to add to the cell (required for: add_note)'),

    // Validation fields (set_validation)
    validation: DataValidationSchema.optional().describe(
      'Data validation rules (condition, input message, strict mode, dropdown) (required for: set_validation)'
    ),

    // Hyperlink fields (set_hyperlink)
    url: z
      .string()
      .url()
      .optional()
      .describe('URL to link to (must be valid HTTP/HTTPS URL) (required for: set_hyperlink)'),
    label: z
      .string()
      .optional()
      .describe('Optional link text (defaults to URL if omitted) (set_hyperlink only)'),

    // Merge fields (merge)
    mergeType: z
      .enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'])
      .optional()
      .default('MERGE_ALL')
      .describe(
        'Type of merge: MERGE_ALL (single cell), MERGE_COLUMNS (merge columns), MERGE_ROWS (merge rows) (merge only)'
      ),

    // Sheet ID fields (get_merges)
    sheetId: SheetIdSchema.optional().describe(
      'Numeric sheet ID to query for merged cells (required for: get_merges)'
    ),

    // Cut/Copy fields (cut, copy)
    source: RangeInputSchema.optional().describe(
      'Source range to cut/copy from (required for: cut, copy)'
    ),
    destination: z
      .string()
      .optional()
      .describe(
        'Destination cell in A1 notation (top-left of paste area) (required for: cut, copy)'
      ),
    pasteType: z
      .enum(['PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT', 'PASTE_NO_BORDERS', 'PASTE_FORMULA'])
      .optional()
      .default('PASTE_NORMAL')
      .describe(
        'What to paste: NORMAL (all), VALUES (only values), FORMAT (only formatting), NO_BORDERS (exclude borders), FORMULA (formulas) (cut, copy only)'
      ),

    // ========================================================================
    // SHARED FIELDS (used by multiple operations)
    // ========================================================================

    // Safety and diff options (common to write operations)
    safety: SafetyOptionsSchema.optional().describe(
      'Safety options (dryRun, createSnapshot, etc.) (write, append, clear, batch_write, batch_clear, replace, clear_note, set_validation, clear_validation, clear_hyperlink, cut)'
    ),
    diffOptions: DiffOptionsSchema.optional().describe(
      'Diff generation options (tier, sampleSize, maxFullDiffCells) (write, batch_write)'
    ),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (essential data only, ~60% less tokens), standard (balanced), detailed (full metadata)'
      ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        // Value actions
        case 'read':
          return !!data.spreadsheetId && !!data.range;
        case 'write':
          return !!data.spreadsheetId && !!data.range && !!data.values;
        case 'append':
          return !!data.spreadsheetId && !!data.range && !!data.values;
        case 'clear':
          return !!data.spreadsheetId && !!data.range;
        case 'batch_read':
          return !!data.spreadsheetId && !!data.ranges && data.ranges.length > 0;
        case 'batch_write':
          return !!data.spreadsheetId && !!data.data && data.data.length > 0;
        case 'batch_clear':
          return !!data.spreadsheetId && !!data.ranges && data.ranges.length > 0;
        case 'find':
          return !!data.spreadsheetId && !!data.query;
        case 'replace':
          return !!data.spreadsheetId && !!data.find && data.replacement !== undefined;

        // Cell actions
        case 'add_note':
          return !!data.spreadsheetId && !!data.cell && !!data.note;
        case 'get_note':
        case 'clear_note':
        case 'set_hyperlink':
        case 'clear_hyperlink':
          return !!data.spreadsheetId && !!data.cell;
        case 'set_validation':
          return !!data.spreadsheetId && !!data.range && !!data.validation;
        case 'clear_validation':
        case 'merge':
        case 'unmerge':
          return !!data.spreadsheetId && !!data.range;
        case 'get_merges':
          return !!data.spreadsheetId && data.sheetId !== undefined;
        case 'cut':
        case 'copy':
          return !!data.spreadsheetId && !!data.source && !!data.destination;

        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

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
    totalRows: z.number().int().optional().describe('Total rows available (if known)'),

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
    updatedCells: z.number().int().optional().describe('Number of cells updated'),
    updatedRows: z.number().int().optional().describe('Number of rows updated'),
    updatedColumns: z.number().int().optional().describe('Number of columns updated'),
    updatedRange: z.string().optional().describe('A1 notation range that was updated'),

    // Find results
    matches: z
      .array(
        z.object({
          cell: z.string(),
          value: z.string(),
          row: z.number().int(),
          column: z.number().int(),
        })
      )
      .optional()
      .describe('Array of matching cells (for find action)'),

    // Replace results
    replacementsCount: z.number().int().optional().describe('Number of replacements made'),
    replacementPreview: z
      .array(
        z.object({
          cell: z.string().describe('Cell address (e.g., A1)'),
          oldValue: z.string().describe('Current value'),
          newValue: z.string().describe('Value after replacement'),
          row: z.number().int(),
          column: z.number().int(),
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
          row: z.number().int(),
          column: z.number().int(),
        })
      )
      .optional()
      .describe('Preview of cells to be cleared (when previewMode=true for clear/batch_clear)'),
    clearedCells: z.number().int().optional().describe('Number of cells cleared'),

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
          startRow: z.number().int(),
          endRow: z.number().int(),
          startColumn: z.number().int(),
          endColumn: z.number().int(),
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
// TYPE NARROWING HELPERS (21 action types)
// ============================================================================

// Value action types (9)
export type DataReadInput = SheetsDataInput & {
  action: 'read';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataWriteInput = SheetsDataInput & {
  action: 'write';
  spreadsheetId: string;
  range: RangeInput;
  values: unknown[][];
};

export type DataAppendInput = SheetsDataInput & {
  action: 'append';
  spreadsheetId: string;
  range: RangeInput;
  values: unknown[][];
};

export type DataClearInput = SheetsDataInput & {
  action: 'clear';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataBatchReadInput = SheetsDataInput & {
  action: 'batch_read';
  spreadsheetId: string;
  ranges: RangeInput[];
};

export type DataBatchWriteInput = SheetsDataInput & {
  action: 'batch_write';
  spreadsheetId: string;
  data: Array<{
    range: RangeInput;
    values: unknown[][];
  }>;
};

export type DataBatchClearInput = SheetsDataInput & {
  action: 'batch_clear';
  spreadsheetId: string;
  ranges: RangeInput[];
};

export type DataFindInput = SheetsDataInput & {
  action: 'find';
  spreadsheetId: string;
  query: string;
};

export type DataReplaceInput = SheetsDataInput & {
  action: 'replace';
  spreadsheetId: string;
  find: string;
  replacement: string;
};

// Cell action types (12)
export type DataAddNoteInput = SheetsDataInput & {
  action: 'add_note';
  spreadsheetId: string;
  cell: string;
  note: string;
};

export type DataGetNoteInput = SheetsDataInput & {
  action: 'get_note';
  spreadsheetId: string;
  cell: string;
};

export type DataClearNoteInput = SheetsDataInput & {
  action: 'clear_note';
  spreadsheetId: string;
  cell: string;
};

export type DataSetValidationInput = SheetsDataInput & {
  action: 'set_validation';
  spreadsheetId: string;
  range: RangeInput;
  validation: z.infer<typeof DataValidationSchema>;
};

export type DataClearValidationInput = SheetsDataInput & {
  action: 'clear_validation';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataSetHyperlinkInput = SheetsDataInput & {
  action: 'set_hyperlink';
  spreadsheetId: string;
  cell: string;
  url: string;
};

export type DataClearHyperlinkInput = SheetsDataInput & {
  action: 'clear_hyperlink';
  spreadsheetId: string;
  cell: string;
};

export type DataMergeInput = SheetsDataInput & {
  action: 'merge';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataUnmergeInput = SheetsDataInput & {
  action: 'unmerge';
  spreadsheetId: string;
  range: RangeInput;
};

export type DataGetMergesInput = SheetsDataInput & {
  action: 'get_merges';
  spreadsheetId: string;
  sheetId: number;
};

export type DataCutInput = SheetsDataInput & {
  action: 'cut';
  spreadsheetId: string;
  source: RangeInput;
  destination: string;
};

export type DataCopyInput = SheetsDataInput & {
  action: 'copy';
  spreadsheetId: string;
  source: RangeInput;
  destination: string;
};
