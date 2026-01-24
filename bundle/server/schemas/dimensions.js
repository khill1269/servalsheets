/**
 * Tool 6: sheets_dimensions
 * Row and column operations, filtering, and sorting
 */
import { z } from 'zod';
import { SpreadsheetIdSchema, SheetIdSchema, DimensionSchema, RangeInputSchema, GridRangeSchema, SortOrderSchema, ConditionSchema, ColorSchema, ErrorDetailSchema, SafetyOptionsSchema, MutationSummarySchema, ResponseMetaSchema, } from './shared.js';
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
        .describe('Response detail level: minimal (summary only, ~40% less tokens), standard (balanced), detailed (full metadata)'),
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
    columnIndex: z.coerce.number().int().min(0),
    sortOrder: SortOrderSchema.optional().default('ASCENDING'),
    foregroundColor: ColorSchema.optional(),
    backgroundColor: ColorSchema.optional(),
});
const SlicerPositionSchema = z.object({
    anchorCell: z.string(),
    offsetX: z.coerce.number().min(0, 'Offset X must be non-negative').optional().default(0),
    offsetY: z.coerce.number().min(0, 'Offset Y must be non-negative').optional().default(0),
    width: z.coerce.number().positive('Width must be positive').optional().default(200),
    height: z.coerce.number().positive('Height must be positive').optional().default(150),
});
// ============================================================================
// Dimension Action Schemas (21 actions)
// ============================================================================
const InsertRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('insert_rows').describe('Insert rows at a specific index'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to insert'),
    count: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .default(1)
        .describe('Number of rows to insert'),
    inheritFromBefore: z
        .boolean()
        .optional()
        .describe('Inherit formatting from row before (false = inherit from after)'),
});
const InsertColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('insert_columns').describe('Insert columns at a specific index'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to insert'),
    count: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .default(1)
        .describe('Number of columns to insert'),
    inheritFromBefore: z
        .boolean()
        .optional()
        .describe('Inherit formatting from column before (false = inherit from after)'),
});
const DeleteRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('delete_rows').describe('Delete rows from a specific range'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to delete'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
    allowMissing: z
        .boolean()
        .optional()
        .describe("If true, don't error when rows don't exist, makes delete idempotent"),
});
const DeleteColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('delete_columns').describe('Delete columns from a specific range'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to delete'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
    allowMissing: z
        .boolean()
        .optional()
        .describe("If true, don't error when columns don't exist, makes delete idempotent"),
});
const MoveRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('move_rows').describe('Move rows to a different location'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to move'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
    destinationIndex: z.coerce
        .number()
        .int()
        .min(0)
        .describe('Zero-based index where rows should be moved'),
});
const MoveColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('move_columns').describe('Move columns to a different location'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to move'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
    destinationIndex: z
        .number()
        .int()
        .min(0)
        .describe('Zero-based index where columns should be moved'),
});
const ResizeRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('resize_rows').describe('Resize rows to a specific height'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to resize'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
    pixelSize: z
        .number()
        .positive()
        .max(10000, 'Pixel size exceeds 10000 pixel limit')
        .describe('Height in pixels, must be positive'),
});
const ResizeColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('resize_columns').describe('Resize columns to a specific width'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to resize'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
    pixelSize: z
        .number()
        .positive()
        .max(10000, 'Pixel size exceeds 10000 pixel limit')
        .describe('Width in pixels, must be positive'),
});
const AutoResizeActionSchema = CommonFieldsSchema.extend({
    action: z.literal('auto_resize').describe('Auto-resize rows or columns to fit content'),
    startIndex: z.coerce
        .number()
        .int()
        .min(0)
        .describe('Zero-based index of first row/column to resize'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last row/column, exclusive'),
    dimension: DimensionSchema.describe('Which dimension to resize: ROWS or COLUMNS'),
});
const HideRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('hide_rows').describe('Hide rows'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to hide'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
});
const HideColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('hide_columns').describe('Hide columns'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to hide'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
});
const ShowRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('show_rows').describe('Show hidden rows'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to show'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
});
const ShowColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('show_columns').describe('Show hidden columns'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to show'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
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
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to group'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
    depth: z.coerce
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .default(1)
        .describe('Nesting depth level, 1-8'),
});
const GroupColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('group_columns').describe('Group columns for collapsing'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first column to group'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
    depth: z.coerce
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .default(1)
        .describe('Nesting depth level, 1-8'),
});
const UngroupRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('ungroup_rows').describe('Ungroup rows'),
    startIndex: z.coerce.number().int().min(0).describe('Zero-based index of first row to ungroup'),
    endIndex: z.coerce.number().int().min(1).describe('Zero-based index after last row, exclusive'),
});
const UngroupColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('ungroup_columns').describe('Ungroup columns'),
    startIndex: z.coerce
        .number()
        .int()
        .min(0)
        .describe('Zero-based index of first column to ungroup'),
    endIndex: z.coerce
        .number()
        .int()
        .min(1)
        .describe('Zero-based index after last column, exclusive'),
});
const AppendRowsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('append_rows').describe('Append rows to the end of the sheet'),
    count: z.coerce.number().int().positive().describe('Number of rows to append'),
});
const AppendColumnsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('append_columns').describe('Append columns to the end of the sheet'),
    count: z.coerce.number().int().positive().describe('Number of columns to append'),
});
// ============================================================================
// Filter and Sort Action Schemas (14 actions)
// ============================================================================
const SetBasicFilterActionSchema = CommonFieldsSchema.extend({
    action: z.literal('set_basic_filter').describe('Set basic filter on a sheet'),
    range: RangeInputSchema.optional().describe('Range to filter (optional, defaults to sheet)'),
    criteria: z
        .record(z.coerce.number(), FilterCriteriaSchema)
        .optional()
        .describe('Filter criteria by column index'),
});
const ClearBasicFilterActionSchema = CommonFieldsSchema.extend({
    action: z.literal('clear_basic_filter').describe('Clear basic filter from a sheet'),
});
const GetBasicFilterActionSchema = CommonFieldsSchema.extend({
    action: z.literal('get_basic_filter').describe('Get basic filter from a sheet'),
});
const FilterUpdateFilterCriteriaActionSchema = CommonFieldsSchema.extend({
    action: z
        .literal('filter_update_filter_criteria')
        .describe('Update filter criteria for a column'),
    columnIndex: z.coerce.number().int().min(0).describe('Column index for filter criteria'),
    criteria: z.record(z.coerce.number(), FilterCriteriaSchema).describe('Filter criteria to apply'),
});
const SortRangeActionSchema = z.object({
    action: z.literal('sort_range').describe('Sort a range'),
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
// ============================================================================
// Range Utility Actions (4 new operations - Google API coverage completion)
// ============================================================================
const TrimWhitespaceActionSchema = z.object({
    action: z.literal('trim_whitespace').describe('Trim leading and trailing whitespace from cells'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    range: RangeInputSchema.describe('Range whose cells to trim whitespace'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const RandomizeRangeActionSchema = z.object({
    action: z.literal('randomize_range').describe('Randomize the order of rows in a range'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    range: RangeInputSchema.describe('Range to randomize row order'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const TextToColumnsDelimiterTypeSchema = z
    .enum(['DETECT', 'COMMA', 'SEMICOLON', 'PERIOD', 'SPACE', 'CUSTOM'])
    .describe('The type of delimiter to use');
const TextToColumnsActionSchema = z.object({
    action: z.literal('text_to_columns').describe('Split text in a column into multiple columns'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    source: RangeInputSchema.describe('Source range - must span exactly one column'),
    delimiterType: TextToColumnsDelimiterTypeSchema.optional()
        .default('DETECT')
        .describe('Type of delimiter (DETECT, COMMA, SEMICOLON, PERIOD, SPACE, CUSTOM)'),
    delimiter: z
        .string()
        .max(10)
        .optional()
        .describe('Custom delimiter string (only used when delimiterType is CUSTOM)'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const AutoFillActionSchema = z.object({
    action: z.literal('auto_fill').describe('Auto-fill data based on detected patterns'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    range: RangeInputSchema.optional().describe('Range to auto-fill (auto-detects source data within range)'),
    sourceRange: RangeInputSchema.optional().describe('Explicit source range (for sourceAndDestination mode)'),
    fillLength: z
        .number()
        .int()
        .optional()
        .describe('Number of rows/columns to fill. Positive = expand after source, negative = expand before'),
    dimension: DimensionSchema.optional()
        .default('ROWS')
        .describe('Direction to fill (ROWS or COLUMNS)'),
    useAlternateSeries: z
        .boolean()
        .optional()
        .describe('Use alternate series pattern (e.g., 1,3,5 instead of 1,2,3)'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const CreateFilterViewActionSchema = CommonFieldsSchema.extend({
    action: z.literal('create_filter_view').describe('Create a filter view'),
    title: z.string().describe('Title for the filter view'),
    range: RangeInputSchema.optional().describe('Range for the filter view'),
    criteria: z
        .record(z.coerce.number(), FilterCriteriaSchema)
        .optional()
        .describe('Filter criteria by column index'),
    sortSpecs: z.array(SortSpecSchema).optional().describe('Sort specifications'),
});
const UpdateFilterViewActionSchema = z.object({
    action: z.literal('update_filter_view').describe('Update a filter view'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    filterViewId: z.coerce.number().int().describe('Filter view ID'),
    title: z.string().optional().describe('New title for the filter view'),
    criteria: z
        .record(z.coerce.number(), FilterCriteriaSchema)
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
const DeleteFilterViewActionSchema = z.object({
    action: z.literal('delete_filter_view').describe('Delete a filter view'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    filterViewId: z.coerce.number().int().describe('Filter view ID'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const ListFilterViewsActionSchema = z.object({
    action: z.literal('list_filter_views').describe('List all filter views'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID to filter results'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
});
const GetFilterViewActionSchema = z.object({
    action: z.literal('get_filter_view').describe('Get a filter view'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    filterViewId: z.coerce.number().int().describe('Filter view ID'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
});
const CreateSlicerActionSchema = CommonFieldsSchema.extend({
    action: z.literal('create_slicer').describe('Create a slicer'),
    title: z.string().optional().describe('Title for the slicer'),
    dataRange: RangeInputSchema.describe('Data range for the slicer'),
    filterColumn: z.coerce.number().int().min(0).describe('Filter column index'),
    position: SlicerPositionSchema.describe('Slicer position'),
});
const UpdateSlicerActionSchema = z.object({
    action: z.literal('update_slicer').describe('Update a slicer'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    slicerId: z.coerce.number().int().describe('Slicer ID'),
    title: z.string().optional().describe('New title for the slicer'),
    filterColumn: z.coerce.number().int().min(0).optional().describe('Filter column index'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const DeleteSlicerActionSchema = z.object({
    action: z.literal('delete_slicer').describe('Delete a slicer'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID for context'),
    slicerId: z.coerce.number().int().describe('Slicer ID'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
    safety: SafetyOptionsSchema.optional().describe('Safety options'),
});
const ListSlicersActionSchema = z.object({
    action: z.literal('list_slicers').describe('List all slicers'),
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
export const SheetsDimensionsInputSchema = z.object({
    request: z.discriminatedUnion('action', [
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
        // Filter and sort actions (14) - v2.0: removed redundant filter_ prefix
        SetBasicFilterActionSchema,
        ClearBasicFilterActionSchema,
        GetBasicFilterActionSchema,
        FilterUpdateFilterCriteriaActionSchema,
        // Note: Keeping prefix - internal implementation detail
        SortRangeActionSchema,
        // Range utility actions (4) - Google API coverage completion
        TrimWhitespaceActionSchema,
        RandomizeRangeActionSchema,
        TextToColumnsActionSchema,
        AutoFillActionSchema,
        // Filter view and slicer actions
        CreateFilterViewActionSchema,
        UpdateFilterViewActionSchema,
        DeleteFilterViewActionSchema,
        ListFilterViewsActionSchema,
        GetFilterViewActionSchema,
        CreateSlicerActionSchema,
        UpdateSlicerActionSchema,
        DeleteSlicerActionSchema,
        ListSlicersActionSchema,
    ]),
});
const DimensionsResponseSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        action: z.string(),
        // Dimension response fields
        rowsAffected: z.coerce.number().int().optional(),
        columnsAffected: z.coerce.number().int().optional(),
        newSize: z
            .object({
            rowCount: z.coerce.number().int(),
            columnCount: z.coerce.number().int(),
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
            .array(z.object({
            filterViewId: z.coerce.number().int(),
            title: z.string(),
            range: GridRangeSchema,
        }))
            .optional(),
        filterViewId: z.coerce.number().int().optional(),
        slicers: z
            .array(z.object({
            slicerId: z.coerce.number().int(),
            sheetId: z.coerce.number().int(),
            title: z.string().optional(),
        }))
            .optional(),
        slicerId: z.coerce.number().int().optional(),
        // Range utility response fields
        cellsChanged: z
            .number()
            .int()
            .optional()
            .describe('Number of cells modified (for trim_whitespace)'),
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
export const SHEETS_DIMENSIONS_ANNOTATIONS = {
    title: 'Rows, Columns, Filters & Sort',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
};
//# sourceMappingURL=dimensions.js.map