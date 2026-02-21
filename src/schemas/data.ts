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
  DataFilterSchema,
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
  type DataFilter,
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
// CONSOLIDATED INPUT SCHEMA (18 actions)
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
  action: z.literal('read').describe('Read cell values from a range'),
  range: RangeInputSchema.optional().describe(
    'Range to read in A1 notation or semantic (e.g., "Sheet1!A1:B10"). Use dataFilter for dynamic queries that survive insertions/deletions.'
  ),
  dataFilter: DataFilterSchema.optional().describe(
    'Dynamic range filter (survives insertions/deletions). Use developerMetadataLookup to query by metadata tags instead of hard-coded ranges.'
  ),
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
}).superRefine((val, ctx) => {
  // Exactly ONE of range or dataFilter must be provided
  if (!val.range && !val.dataFilter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or dataFilter for read',
      path: ['range'],
    });
  }
  if (val.range && val.dataFilter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or dataFilter (not both) for read',
      path: ['dataFilter'],
    });
  }
});

const WriteActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('write')
    .describe('Write values to a specific range (overwrites existing data)'),
  range: RangeInputSchema.optional().describe(
    'Range to write to in A1 notation or semantic (e.g., "Sheet1!A1:B10"). Use dataFilter for dynamic location that survives insertions/deletions.'
  ),
  dataFilter: DataFilterSchema.optional().describe(
    'Dynamic range filter for write target (survives insertions/deletions). Use developerMetadataLookup to write to tagged ranges without knowing exact location.'
  ),
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
}).superRefine((val, ctx) => {
  // Exactly ONE of range or dataFilter must be provided
  if (!val.range && !val.dataFilter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or dataFilter for write',
      path: ['range'],
    });
  }
  if (val.range && val.dataFilter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or dataFilter (not both) for write',
      path: ['dataFilter'],
    });
  }
});

const AppendActionSchema = CommonFieldsSchema.extend({
  action: z.literal('append').describe('Append rows after the last row of data in a range'),
  range: RangeInputSchema.optional().describe('Range to append to (ignored if tableId provided)'),
  tableId: z.string().optional().describe('Table ID to append to (preferred for table ranges)'),
  values: ValuesArraySchema.describe('2D array of cell values to append'),
  valueInputOption: ValueInputOptionSchema.optional()
    .default('USER_ENTERED')
    .describe('How input data should be interpreted'),
  insertDataOption: InsertDataOptionSchema.optional()
    .default('INSERT_ROWS')
    .describe('Whether to overwrite or insert rows (INSERT_ROWS or OVERWRITE)'),
}).superRefine((val, ctx) => {
  if (!val.range && !val.tableId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or tableId for append',
      path: ['range'],
    });
  }
});

const ClearActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear').describe('Clear cell values from a range (keeps formatting)'),
  range: RangeInputSchema.optional().describe(
    'Range to clear in A1 notation or semantic (e.g., "Sheet1!A1:B10"). Use dataFilter for dynamic targeting that survives insertions/deletions.'
  ),
  dataFilter: DataFilterSchema.optional().describe(
    'Dynamic range filter for clear target (survives insertions/deletions). Use developerMetadataLookup to clear tagged ranges without knowing exact location.'
  ),
  previewMode: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show what would change without applying'),
}).superRefine((val, ctx) => {
  // Exactly ONE of range or dataFilter must be provided
  if (!val.range && !val.dataFilter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or dataFilter for clear',
      path: ['range'],
    });
  }
  if (val.range && val.dataFilter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either range or dataFilter (not both) for clear',
      path: ['dataFilter'],
    });
  }
});

const BatchWriteEntrySchema = z
  .object({
    range: RangeInputSchema.optional().describe('Target range'),
    dataFilter: DataFilterSchema.optional().describe('Data filter for target range'),
    values: ValuesArraySchema.describe('2D array of cell values'),
    majorDimension: MajorDimensionSchema.optional().describe('Major dimension for data layout'),
  })
  .superRefine((val, ctx) => {
    if (!val.range && !val.dataFilter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either range or dataFilter for each batch_write entry',
        path: ['range'],
      });
    }
    if (val.range && val.dataFilter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either range or dataFilter (not both) for each batch_write entry',
        path: ['dataFilter'],
      });
    }
  });

const BatchReadActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_read').describe('Read multiple ranges in a single API call'),
  ranges: z
    .array(RangeInputSchema)
    .min(1)
    .max(100)
    .optional()
    .describe('Array of ranges to read (1-100 ranges)'),
  dataFilters: z
    .array(DataFilterSchema)
    .min(1)
    .max(100)
    .optional()
    .describe('Array of data filters to read (1-100 filters)'),
  valueRenderOption: ValueRenderOptionSchema.optional()
    .default('FORMATTED_VALUE')
    .describe('How values should be rendered'),
  majorDimension: MajorDimensionSchema.optional().default('ROWS').describe('Major dimension'),
  cursor: z.string().optional().describe('Pagination cursor'),
  pageSize: z.coerce.number().int().positive().max(10000).optional().describe('Rows per page'),
}).superRefine((val, ctx) => {
  const hasRanges = Boolean(val.ranges && val.ranges.length > 0);
  const hasFilters = Boolean(val.dataFilters && val.dataFilters.length > 0);
  if (!hasRanges && !hasFilters) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either ranges or dataFilters for batch_read',
      path: ['ranges'],
    });
  }
  if (hasRanges && hasFilters) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either ranges or dataFilters, not both, for batch_read',
      path: ['dataFilters'],
    });
  }
});

const BatchWriteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_write').describe('Write to multiple ranges in a single API call'),
  data: z
    .array(BatchWriteEntrySchema)
    .min(1)
    .max(100)
    .describe('Array of range-value or filter-value pairs to write (1-100 entries)'),
  valueInputOption: ValueInputOptionSchema.optional()
    .default('USER_ENTERED')
    .describe('How input data should be interpreted'),
  includeValuesInResponse: z.boolean().optional().default(false).describe('Return written values'),
  diffOptions: DiffOptionsSchema.optional().describe('Diff generation options'),
}).superRefine((val, ctx) => {
  const hasRanges = val.data.some((entry) => entry.range !== undefined);
  const hasFilters = val.data.some((entry) => entry.dataFilter !== undefined);
  if (hasRanges && hasFilters) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Do not mix range-based and dataFilter-based entries in batch_write',
      path: ['data'],
    });
  }
});

const BatchClearActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_clear').describe('Clear multiple ranges in a single API call'),
  ranges: z
    .array(RangeInputSchema)
    .min(1)
    .max(100)
    .optional()
    .describe('Array of ranges to clear (1-100 ranges)'),
  dataFilters: z
    .array(DataFilterSchema)
    .min(1)
    .max(100)
    .optional()
    .describe('Array of data filters to clear (1-100 filters)'),
  previewMode: z.boolean().optional().default(false).describe('Preview changes without applying'),
}).superRefine((val, ctx) => {
  const hasRanges = Boolean(val.ranges && val.ranges.length > 0);
  const hasFilters = Boolean(val.dataFilters && val.dataFilters.length > 0);
  if (!hasRanges && !hasFilters) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either ranges or dataFilters for batch_clear',
      path: ['ranges'],
    });
  }
  if (hasRanges && hasFilters) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either ranges or dataFilters, not both, for batch_clear',
      path: ['dataFilters'],
    });
  }
});

const FindReplaceActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('find_replace')
    .describe('Find text/patterns and optionally replace across cells'),
  find: z.string().min(1, 'Find pattern cannot be empty').describe('Text or pattern to find'),
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
// CELL ACTION SCHEMAS (10 actions)
// ============================================================================

const AddNoteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('add_note').describe('Add or update a note on a cell'),
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
  action: z.literal('get_note').describe('Get the note text from a cell'),
  cell: z.string().describe("Cell reference in A1 notation. Also accepts 'range' as alias."),
});

const ClearNoteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear_note').describe('Remove a note from a cell'),
  cell: z.string().describe("Cell reference in A1 notation. Also accepts 'range' as alias."),
});

// Data validation actions removed in v2.0 - moved to sheets_format
// Use sheets_format.set_data_validation and sheets_format.clear_data_validation instead

const SetHyperlinkActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_hyperlink').describe('Add a clickable hyperlink to a cell'),
  cell: z.string().describe("Cell reference in A1 notation. Also accepts 'range' as alias."),
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
  action: z.literal('clear_hyperlink').describe('Remove a hyperlink from a cell'),
  cell: z.string().describe("Cell reference in A1 notation. Also accepts 'range' as alias."),
});

const MergeCellsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('merge_cells').describe('Merge a range of cells into one'),
  range: RangeInputSchema.describe('Range to merge'),
  mergeType: z
    .enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'])
    .optional()
    .default('MERGE_ALL')
    .describe('Type of merge: MERGE_ALL (single cell), MERGE_COLUMNS, MERGE_ROWS'),
});

const UnmergeCellsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('unmerge_cells').describe('Unmerge previously merged cells'),
  range: RangeInputSchema.describe('Range to unmerge'),
});

const GetMergesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_merges').describe('List all merged cell ranges in a sheet'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to query for merged cells'),
});

const CutPasteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('cut_paste').describe('Cut cells from source and paste to destination'),
  source: RangeInputSchema.describe('Source range to cut from'),
  destination: z.string().describe('Destination cell in A1 notation (top-left of paste area)'),
  pasteType: z
    .enum(['PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT', 'PASTE_NO_BORDERS', 'PASTE_FORMULA'])
    .optional()
    .default('PASTE_NORMAL')
    .describe('What to paste: NORMAL (all), VALUES, FORMAT, NO_BORDERS, FORMULA'),
});

const CopyPasteActionSchema = CommonFieldsSchema.extend({
  action: z.literal('copy_paste').describe('Copy cells from source and paste to destination'),
  source: RangeInputSchema.describe('Source range to copy from'),
  destination: z
    .string()
    .describe(
      'Destination: MUST be a single cell (e.g. "Sheet1!A1"), NOT a range. This is the top-left corner where paste begins. The paste area size is determined by the source range.'
    ),
  pasteType: z
    .enum(['PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT', 'PASTE_NO_BORDERS', 'PASTE_FORMULA'])
    .optional()
    .default('PASTE_NORMAL')
    .describe('What to paste: NORMAL (all), VALUES, FORMAT, NO_BORDERS, FORMULA'),
});

const DetectSpillRangesActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('detect_spill_ranges')
    .describe('Detect dynamic array / spill range formulas in a sheet'),
  range: RangeInputSchema.optional().describe('Range to scan (omit to scan entire active sheet)'),
  sheetId: z.coerce.number().int().optional().describe('Sheet ID to scan (alternative to range)'),
});

// ============================================================================
// DISCRIMINATED UNION (19 actions)
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
  // Use Object.hasOwn to prevent prototype pollution (e.g., __proto__, constructor)
  if (action && Object.hasOwn(DEPRECATED_ACTIONS, action)) {
    throw new Error(DEPRECATED_ACTIONS[action]);
  }

  // Alias: 'range' → 'cell' for cell-based actions (LLM compatibility)
  const cellActions = ['add_note', 'get_note', 'clear_note', 'set_hyperlink', 'clear_hyperlink'];
  if (cellActions.includes(action) && obj['range'] && !obj['cell']) {
    return { ...obj, cell: obj['range'] };
  }

  return val;
};

/**
 * Input schema for sheets_data tool
 *
 * @tool sheets_data
 * @actions 18 total (8 value operations + 10 cell operations)
 * @category Data Operations
 *
 * This discriminated union uses the `action` field to determine which operation to perform.
 * TypeScript will automatically narrow the type based on the action value.
 *
 * @example
 * ```typescript
 * // Read action - TypeScript knows 'range' exists
 * const input: SheetsDataInput = {
 *   request: { action: 'read', spreadsheetId: '...', range: 'A1:B10' }
 * };
 *
 * // Write action - TypeScript knows 'values' exists
 * const input: SheetsDataInput = {
 *   request: { action: 'write', spreadsheetId: '...', range: 'A1:B10', values: [[...]] }
 * };
 * ```
 */
export const SheetsDataInputSchema = z.object({
  request: z.preprocess(
    normalizeDataRequest,
    z.discriminatedUnion('action', [
      // Value actions (8) - Core cell value operations
      ReadActionSchema, // Read values from range or filter
      WriteActionSchema, // Write values to range
      AppendActionSchema, // Append rows to sheet
      ClearActionSchema, // Clear cell values
      BatchReadActionSchema, // Read multiple ranges at once
      BatchWriteActionSchema, // Write to multiple ranges at once
      BatchClearActionSchema, // Clear multiple ranges at once
      FindReplaceActionSchema, // Find and replace values (v2.0: merged)

      // Cell actions (10) - Cell metadata operations (was 12, validation moved to sheets_format)
      AddNoteActionSchema, // Add note/comment to cell
      GetNoteActionSchema, // Retrieve cell note
      ClearNoteActionSchema, // Remove cell note
      // SetValidationActionSchema - REMOVED: moved to sheets_format
      // ClearValidationActionSchema - REMOVED: moved to sheets_format
      SetHyperlinkActionSchema, // Add hyperlink to cell
      ClearHyperlinkActionSchema, // Remove hyperlink
      MergeCellsActionSchema, // Merge cells (v2.0: renamed from merge)
      UnmergeCellsActionSchema, // Unmerge cells (v2.0: renamed from unmerge)
      GetMergesActionSchema, // Get merged cell ranges
      CutPasteActionSchema, // Cut and paste cells (v2.0: renamed from cut)
      CopyPasteActionSchema, // Copy and paste cells (v2.0: renamed from copy)

      // Dynamic array action (1)
      DetectSpillRangesActionSchema, // Detect dynamic array / spill ranges
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

    // Spill range response (for detect_spill_ranges action)
    spillRanges: z
      .array(
        z.object({
          sourceCell: z.string().describe('Cell containing the array formula (A1 notation)'),
          formula: z.string().describe('The array formula in the source cell'),
          spillRange: z.string().describe('Full spill range in A1 notation'),
          rows: z.coerce.number().int().describe('Number of rows in the spill'),
          cols: z.coerce.number().int().describe('Number of columns in the spill'),
        })
      )
      .optional()
      .describe('Detected dynamic array / spill ranges (for detect_spill_ranges action)'),

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
  range?: RangeInput;
  dataFilter?: DataFilter;
};

export type DataWriteInput = SheetsDataInput['request'] & {
  action: 'write';
  spreadsheetId: string;
  range?: RangeInput;
  dataFilter?: DataFilter;
  values: unknown[][];
};

export type DataAppendInput = SheetsDataInput['request'] & {
  action: 'append';
  spreadsheetId: string;
  range?: RangeInput;
  tableId?: string;
  values: unknown[][];
};

export type DataClearInput = SheetsDataInput['request'] & {
  action: 'clear';
  spreadsheetId: string;
  range?: RangeInput;
  dataFilter?: DataFilter;
};

export type DataBatchReadInput = SheetsDataInput['request'] & {
  action: 'batch_read';
  spreadsheetId: string;
  ranges?: RangeInput[];
  dataFilters?: DataFilter[];
};

export type DataBatchWriteInput = SheetsDataInput['request'] & {
  action: 'batch_write';
  spreadsheetId: string;
  data: Array<{
    range?: RangeInput;
    dataFilter?: DataFilter;
    values: unknown[][];
  }>;
};

export type DataBatchClearInput = SheetsDataInput['request'] & {
  action: 'batch_clear';
  spreadsheetId: string;
  ranges?: RangeInput[];
  dataFilters?: DataFilter[];
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

export type DataDetectSpillRangesInput = SheetsDataInput['request'] & {
  action: 'detect_spill_ranges';
  spreadsheetId: string;
};
