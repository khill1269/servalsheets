/**
 * Tool 6: sheets_dimensions
 * Row and column operations, filtering, and sorting
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  DimensionSchema,
  RangeInputSchema,
  GridRangeSchema,
  SortOrderSchema,
  ConditionSchema,
  ColorSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

// ============================================================================
// Common Schemas
// ============================================================================

const CommonFieldsSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (summary only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe('Safety options for destructive operations'),
});

// Filter and Sort Schemas (merged from filter-sort.ts)
const FilterCriteriaSchema = z.object({
  hiddenValues: z.array(z.string()).optional(),
  condition: ConditionSchema.optional(),
  visibleBackgroundColor: ColorSchema.optional(),
  visibleForegroundColor: ColorSchema.optional(),
});

const SortSpecSchema = z.object({
  columnIndex: z.number().int().min(0),
  sortOrder: SortOrderSchema.optional().default('ASCENDING'),
  foregroundColor: ColorSchema.optional(),
  backgroundColor: ColorSchema.optional(),
});

const SlicerPositionSchema = z.object({
  anchorCell: z.string(),
  offsetX: z.number().min(0, 'Offset X must be non-negative').optional().default(0),
  offsetY: z.number().min(0, 'Offset Y must be non-negative').optional().default(0),
  width: z.number().positive('Width must be positive').optional().default(200),
  height: z.number().positive('Height must be positive').optional().default(150),
});

// ============================================================================
// Dimension Action Schemas (21 actions)
// ============================================================================

const InsertRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('insert_rows').describe('Insert rows at a specific index'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to insert'),
  count: z.number().int().positive().optional().default(1).describe('Number of rows to insert'),
  inheritFromBefore: z
    .boolean()
    .optional()
    .describe('Inherit formatting from row before (false = inherit from after)'),
});

const InsertColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('insert_columns').describe('Insert columns at a specific index'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to insert'),
  count: z.number().int().positive().optional().default(1).describe('Number of columns to insert'),
  inheritFromBefore: z
    .boolean()
    .optional()
    .describe('Inherit formatting from column before (false = inherit from after)'),
});

const DeleteRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_rows').describe('Delete rows from a specific range'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to delete'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
  allowMissing: z
    .boolean()
    .optional()
    .describe("If true, don't error when rows don't exist, makes delete idempotent"),
});

const DeleteColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_columns').describe('Delete columns from a specific range'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to delete'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
  allowMissing: z
    .boolean()
    .optional()
    .describe("If true, don't error when columns don't exist, makes delete idempotent"),
});

const MoveRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('move_rows').describe('Move rows to a different location'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to move'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
  destinationIndex: z.number().int().min(0).describe('Zero-based index where rows should be moved'),
});

const MoveColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('move_columns').describe('Move columns to a different location'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to move'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
  destinationIndex: z
    .number()
    .int()
    .min(0)
    .describe('Zero-based index where columns should be moved'),
});

const ResizeRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('resize_rows').describe('Resize rows to a specific height'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to resize'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
  pixelSize: z
    .number()
    .positive()
    .max(10000, 'Pixel size exceeds 10000 pixel limit')
    .describe('Height in pixels, must be positive'),
});

const ResizeColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('resize_columns').describe('Resize columns to a specific width'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to resize'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
  pixelSize: z
    .number()
    .positive()
    .max(10000, 'Pixel size exceeds 10000 pixel limit')
    .describe('Width in pixels, must be positive'),
});

const AutoResizeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('auto_resize').describe('Auto-resize rows or columns to fit content'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row/column to resize'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row/column, exclusive'),
  dimension: DimensionSchema.describe('Which dimension to resize: ROWS or COLUMNS'),
});

const HideRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('hide_rows').describe('Hide rows'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to hide'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
});

const HideColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('hide_columns').describe('Hide columns'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to hide'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
});

const ShowRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('show_rows').describe('Show hidden rows'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to show'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
});

const ShowColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('show_columns').describe('Show hidden columns'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to show'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
});

const FreezeRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('freeze_rows').describe('Freeze rows from the top'),
  frozenRowCount: z
    .number()
    .int()
    .min(0)
    .describe('Number of rows to freeze from the top, 0 = unfreeze all'),
});

const FreezeColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('freeze_columns').describe('Freeze columns from the left'),
  frozenColumnCount: z
    .number()
    .int()
    .min(0)
    .describe('Number of columns to freeze from the left, 0 = unfreeze all'),
});

const GroupRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('group_rows').describe('Group rows for collapsing'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to group'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
  depth: z.number().int().min(1).max(8).optional().default(1).describe('Nesting depth level, 1-8'),
});

const GroupColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('group_columns').describe('Group columns for collapsing'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to group'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
  depth: z.number().int().min(1).max(8).optional().default(1).describe('Nesting depth level, 1-8'),
});

const UngroupRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('ungroup_rows').describe('Ungroup rows'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first row to ungroup'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last row, exclusive'),
});

const UngroupColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('ungroup_columns').describe('Ungroup columns'),
  startIndex: z.number().int().min(0).describe('Zero-based index of first column to ungroup'),
  endIndex: z.number().int().min(1).describe('Zero-based index after last column, exclusive'),
});

const AppendRowsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('append_rows').describe('Append rows to the end of the sheet'),
  count: z.number().int().positive().describe('Number of rows to append'),
});

const AppendColumnsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('append_columns').describe('Append columns to the end of the sheet'),
  count: z.number().int().positive().describe('Number of columns to append'),
});

// ============================================================================
// Filter and Sort Action Schemas (14 actions)
// ============================================================================

const FilterSetBasicFilterActionSchema = CommonFieldsSchema.extend({
  action: z.literal('filter_set_basic_filter').describe('Set basic filter on a sheet'),
  range: RangeInputSchema.optional().describe('Range to filter (optional, defaults to sheet)'),
  criteria: z
    .record(z.number(), FilterCriteriaSchema)
    .optional()
    .describe('Filter criteria by column index'),
});

const FilterClearBasicFilterActionSchema = CommonFieldsSchema.extend({
  action: z.literal('filter_clear_basic_filter').describe('Clear basic filter from a sheet'),
});

const FilterGetBasicFilterActionSchema = CommonFieldsSchema.extend({
  action: z.literal('filter_get_basic_filter').describe('Get basic filter from a sheet'),
});

const FilterUpdateFilterCriteriaActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('filter_update_filter_criteria')
    .describe('Update filter criteria for a column'),
  columnIndex: z.number().int().min(0).describe('Column index for filter criteria'),
  criteria: z.record(z.number(), FilterCriteriaSchema).describe('Filter criteria to apply'),
});

const FilterSortRangeActionSchema = z.object({
  action: z.literal('filter_sort_range').describe('Sort a range'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
  range: RangeInputSchema.describe('Range to sort'),
  sortSpecs: z.array(SortSpecSchema).min(1).describe('Sort specifications (at least one required)'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

const FilterCreateFilterViewActionSchema = CommonFieldsSchema.extend({
  action: z.literal('filter_create_filter_view').describe('Create a filter view'),
  title: z.string().describe('Title for the filter view'),
  range: RangeInputSchema.optional().describe('Range for the filter view'),
  criteria: z
    .record(z.number(), FilterCriteriaSchema)
    .optional()
    .describe('Filter criteria by column index'),
  sortSpecs: z.array(SortSpecSchema).optional().describe('Sort specifications'),
});

const FilterUpdateFilterViewActionSchema = z.object({
  action: z.literal('filter_update_filter_view').describe('Update a filter view'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
  filterViewId: z.number().int().describe('Filter view ID'),
  title: z.string().optional().describe('New title for the filter view'),
  criteria: z
    .record(z.number(), FilterCriteriaSchema)
    .optional()
    .describe('Filter criteria by column index'),
  sortSpecs: z.array(SortSpecSchema).optional().describe('Sort specifications'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
  safety: SafetyOptionsSchema.optional().describe('Safety options'),
});

const FilterDeleteFilterViewActionSchema = z.object({
  action: z.literal('filter_delete_filter_view').describe('Delete a filter view'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
  filterViewId: z.number().int().describe('Filter view ID'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
  safety: SafetyOptionsSchema.optional().describe('Safety options'),
});

const FilterListFilterViewsActionSchema = z.object({
  action: z.literal('filter_list_filter_views').describe('List all filter views'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID to filter results'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

const FilterGetFilterViewActionSchema = z.object({
  action: z.literal('filter_get_filter_view').describe('Get a filter view'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
  filterViewId: z.number().int().describe('Filter view ID'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

const FilterCreateSlicerActionSchema = CommonFieldsSchema.extend({
  action: z.literal('filter_create_slicer').describe('Create a slicer'),
  title: z.string().optional().describe('Title for the slicer'),
  dataRange: RangeInputSchema.describe('Data range for the slicer'),
  filterColumn: z.number().int().min(0).describe('Filter column index'),
  position: SlicerPositionSchema.describe('Slicer position'),
});

const FilterUpdateSlicerActionSchema = z.object({
  action: z.literal('filter_update_slicer').describe('Update a slicer'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
  slicerId: z.number().int().describe('Slicer ID'),
  title: z.string().optional().describe('New title for the slicer'),
  filterColumn: z.number().int().min(0).optional().describe('Filter column index'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
  safety: SafetyOptionsSchema.optional().describe('Safety options'),
});

const FilterDeleteSlicerActionSchema = z.object({
  action: z.literal('filter_delete_slicer').describe('Delete a slicer'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
  slicerId: z.number().int().describe('Slicer ID'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
  safety: SafetyOptionsSchema.optional().describe('Safety options'),
});

const FilterListSlicersActionSchema = z.object({
  action: z.literal('filter_list_slicers').describe('List all slicers'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe('Optional sheet ID to filter results'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail level'),
});

// ============================================================================
// Combined Input Schema
// ============================================================================

/**
 * All dimension, filter, and sort operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsDimensionsInputSchema = z.discriminatedUnion('action', [
  // Dimension actions (21)
  InsertRowsActionSchema,
  InsertColumnsActionSchema,
  DeleteRowsActionSchema,
  DeleteColumnsActionSchema,
  MoveRowsActionSchema,
  MoveColumnsActionSchema,
  ResizeRowsActionSchema,
  ResizeColumnsActionSchema,
  AutoResizeActionSchema,
  HideRowsActionSchema,
  HideColumnsActionSchema,
  ShowRowsActionSchema,
  ShowColumnsActionSchema,
  FreezeRowsActionSchema,
  FreezeColumnsActionSchema,
  GroupRowsActionSchema,
  GroupColumnsActionSchema,
  UngroupRowsActionSchema,
  UngroupColumnsActionSchema,
  AppendRowsActionSchema,
  AppendColumnsActionSchema,
  // Filter and sort actions (14)
  FilterSetBasicFilterActionSchema,
  FilterClearBasicFilterActionSchema,
  FilterGetBasicFilterActionSchema,
  FilterUpdateFilterCriteriaActionSchema,
  FilterSortRangeActionSchema,
  FilterCreateFilterViewActionSchema,
  FilterUpdateFilterViewActionSchema,
  FilterDeleteFilterViewActionSchema,
  FilterListFilterViewsActionSchema,
  FilterGetFilterViewActionSchema,
  FilterCreateSlicerActionSchema,
  FilterUpdateSlicerActionSchema,
  FilterDeleteSlicerActionSchema,
  FilterListSlicersActionSchema,
]);

const DimensionsResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Dimension response fields
    rowsAffected: z.number().int().optional(),
    columnsAffected: z.number().int().optional(),
    newSize: z
      .object({
        rowCount: z.number().int(),
        columnCount: z.number().int(),
      })
      .optional(),
    alreadyMissing: z.boolean().optional(),
    // Filter and sort response fields
    filter: z
      .object({
        range: GridRangeSchema,
        criteria: z.record(z.string(), z.unknown()),
      })
      .optional(),
    filterViews: z
      .array(
        z.object({
          filterViewId: z.number().int(),
          title: z.string(),
          range: GridRangeSchema,
        })
      )
      .optional(),
    filterViewId: z.number().int().optional(),
    slicers: z
      .array(
        z.object({
          slicerId: z.number().int(),
          sheetId: z.number().int(),
          title: z.string().optional(),
        })
      )
      .optional(),
    slicerId: z.number().int().optional(),
    // Common fields
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsDimensionsOutputSchema = z.object({
  response: DimensionsResponseSchema,
});

export const SHEETS_DIMENSIONS_ANNOTATIONS: ToolAnnotations = {
  title: 'Rows, Columns, Filters & Sort',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsDimensionsInput = z.infer<typeof SheetsDimensionsInputSchema>;
export type SheetsDimensionsOutput = z.infer<typeof SheetsDimensionsOutputSchema>;
export type DimensionsResponse = z.infer<typeof DimensionsResponseSchema>;

// Type narrowing helpers for handler methods (35 action types)
// Dimension actions
export type DimensionsInsertRowsInput = SheetsDimensionsInput & {
  action: 'insert_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
};
export type DimensionsInsertColumnsInput = SheetsDimensionsInput & {
  action: 'insert_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
};
export type DimensionsDeleteRowsInput = SheetsDimensionsInput & {
  action: 'delete_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsDeleteColumnsInput = SheetsDimensionsInput & {
  action: 'delete_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsMoveRowsInput = SheetsDimensionsInput & {
  action: 'move_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
  destinationIndex: number;
};
export type DimensionsMoveColumnsInput = SheetsDimensionsInput & {
  action: 'move_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
  destinationIndex: number;
};
export type DimensionsResizeRowsInput = SheetsDimensionsInput & {
  action: 'resize_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
  pixelSize: number;
};
export type DimensionsResizeColumnsInput = SheetsDimensionsInput & {
  action: 'resize_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
  pixelSize: number;
};
export type DimensionsAutoResizeInput = SheetsDimensionsInput & {
  action: 'auto_resize';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
  dimension: 'ROWS' | 'COLUMNS';
};
export type DimensionsHideRowsInput = SheetsDimensionsInput & {
  action: 'hide_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsHideColumnsInput = SheetsDimensionsInput & {
  action: 'hide_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsShowRowsInput = SheetsDimensionsInput & {
  action: 'show_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsShowColumnsInput = SheetsDimensionsInput & {
  action: 'show_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsFreezeRowsInput = SheetsDimensionsInput & {
  action: 'freeze_rows';
  spreadsheetId: string;
  sheetId: number;
  frozenRowCount: number;
};
export type DimensionsFreezeColumnsInput = SheetsDimensionsInput & {
  action: 'freeze_columns';
  spreadsheetId: string;
  sheetId: number;
  frozenColumnCount: number;
};
export type DimensionsGroupRowsInput = SheetsDimensionsInput & {
  action: 'group_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsGroupColumnsInput = SheetsDimensionsInput & {
  action: 'group_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsUngroupRowsInput = SheetsDimensionsInput & {
  action: 'ungroup_rows';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsUngroupColumnsInput = SheetsDimensionsInput & {
  action: 'ungroup_columns';
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;
  endIndex: number;
};
export type DimensionsAppendRowsInput = SheetsDimensionsInput & {
  action: 'append_rows';
  spreadsheetId: string;
  sheetId: number;
  count: number;
};
export type DimensionsAppendColumnsInput = SheetsDimensionsInput & {
  action: 'append_columns';
  spreadsheetId: string;
  sheetId: number;
  count: number;
};

// Filter and Sort type helpers (merged from filter-sort.ts)
export type DimensionsFilterSetBasicFilterInput = SheetsDimensionsInput & {
  action: 'filter_set_basic_filter';
  spreadsheetId: string;
  sheetId: number;
};
export type DimensionsFilterClearBasicFilterInput = SheetsDimensionsInput & {
  action: 'filter_clear_basic_filter';
  spreadsheetId: string;
  sheetId: number;
};
export type DimensionsFilterGetBasicFilterInput = SheetsDimensionsInput & {
  action: 'filter_get_basic_filter';
  spreadsheetId: string;
  sheetId: number;
};
export type DimensionsFilterUpdateFilterCriteriaInput = SheetsDimensionsInput & {
  action: 'filter_update_filter_criteria';
  spreadsheetId: string;
  sheetId: number;
  columnIndex: number;
  criteria: Record<number, z.infer<typeof FilterCriteriaSchema>>;
};
export type DimensionsFilterSortRangeInput = SheetsDimensionsInput & {
  action: 'filter_sort_range';
  spreadsheetId: string;
  range: z.infer<typeof RangeInputSchema>;
  sortSpecs: Array<z.infer<typeof SortSpecSchema>>;
};
export type DimensionsFilterCreateFilterViewInput = SheetsDimensionsInput & {
  action: 'filter_create_filter_view';
  spreadsheetId: string;
  sheetId: number;
  title: string;
};
export type DimensionsFilterUpdateFilterViewInput = SheetsDimensionsInput & {
  action: 'filter_update_filter_view';
  spreadsheetId: string;
  filterViewId: number;
};
export type DimensionsFilterDeleteFilterViewInput = SheetsDimensionsInput & {
  action: 'filter_delete_filter_view';
  spreadsheetId: string;
  filterViewId: number;
};
export type DimensionsFilterListFilterViewsInput = SheetsDimensionsInput & {
  action: 'filter_list_filter_views';
  spreadsheetId: string;
};
export type DimensionsFilterGetFilterViewInput = SheetsDimensionsInput & {
  action: 'filter_get_filter_view';
  spreadsheetId: string;
  filterViewId: number;
};
export type DimensionsFilterCreateSlicerInput = SheetsDimensionsInput & {
  action: 'filter_create_slicer';
  spreadsheetId: string;
  sheetId: number;
  dataRange: z.infer<typeof RangeInputSchema>;
  filterColumn: number;
  position: z.infer<typeof SlicerPositionSchema>;
};
export type DimensionsFilterUpdateSlicerInput = SheetsDimensionsInput & {
  action: 'filter_update_slicer';
  spreadsheetId: string;
  slicerId: number;
};
export type DimensionsFilterDeleteSlicerInput = SheetsDimensionsInput & {
  action: 'filter_delete_slicer';
  spreadsheetId: string;
  slicerId: number;
};
export type DimensionsFilterListSlicersInput = SheetsDimensionsInput & {
  action: 'filter_list_slicers';
  spreadsheetId: string;
};
