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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsDimensionsInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        // Dimension operations (21 actions)
        'insert_rows',
        'insert_columns',
        'delete_rows',
        'delete_columns',
        'move_rows',
        'move_columns',
        'resize_rows',
        'resize_columns',
        'auto_resize',
        'hide_rows',
        'hide_columns',
        'show_rows',
        'show_columns',
        'freeze_rows',
        'freeze_columns',
        'group_rows',
        'group_columns',
        'ungroup_rows',
        'ungroup_columns',
        'append_rows',
        'append_columns',
        // Filter and sort operations (14 actions)
        'filter_set_basic_filter',
        'filter_clear_basic_filter',
        'filter_get_basic_filter',
        'filter_update_filter_criteria',
        'filter_sort_range',
        'filter_create_filter_view',
        'filter_update_filter_view',
        'filter_delete_filter_view',
        'filter_list_filter_views',
        'filter_get_filter_view',
        'filter_create_slicer',
        'filter_update_slicer',
        'filter_delete_slicer',
        'filter_list_slicers',
      ])
      .describe('The dimension, filter, or sort operation to perform'),

    // Common fields (required for most actions)
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      'Spreadsheet ID from URL (required for all actions)'
    ),
    sheetId: SheetIdSchema.optional().describe('Sheet ID (required for all actions)'),

    // Safety options (for destructive operations)
    safety: SafetyOptionsSchema.optional().describe(
      'Safety options for destructive operations (delete_rows, delete_columns, move_rows, move_columns)'
    ),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
      ),

    // Index fields (used by most actions)
    startIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Zero-based index of first row/column (required for: insert_rows, insert_columns, delete_rows, delete_columns, move_rows, move_columns, resize_rows, resize_columns, auto_resize, hide_rows, hide_columns, show_rows, show_columns, group_rows, group_columns, ungroup_rows, ungroup_columns)'
      ),
    endIndex: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        'Zero-based index after last row/column, exclusive (required for: delete_rows, delete_columns, move_rows, move_columns, resize_rows, resize_columns, auto_resize, hide_rows, hide_columns, show_rows, show_columns, group_rows, group_columns, ungroup_rows, ungroup_columns)'
      ),

    // Count field (for insert and append operations)
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Number of rows/columns to insert or append (optional for: insert_rows, insert_columns with default 1; required for: append_rows, append_columns)'
      ),

    // Formatting inheritance (for insert operations)
    inheritFromBefore: z
      .boolean()
      .optional()
      .describe(
        'Inherit formatting from row/column before (false = inherit from after) (optional for: insert_rows, insert_columns)'
      ),

    // Destination index (for move operations)
    destinationIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Zero-based index where rows/columns should be moved to (required for: move_rows, move_columns)'
      ),

    // Pixel size (for resize operations)
    pixelSize: z
      .number()
      .positive()
      .max(10000, 'Pixel size exceeds 10000 pixel limit')
      .optional()
      .describe(
        'Height/width in pixels, must be positive (required for: resize_rows, resize_columns, max 10000)'
      ),

    // Dimension (for auto_resize)
    dimension: DimensionSchema.optional().describe(
      'Which dimension to resize: ROWS or COLUMNS (required for: auto_resize)'
    ),

    // Frozen count (for freeze operations)
    frozenRowCount: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Number of rows to freeze from the top, 0 = unfreeze all (required for: freeze_rows)'
      ),
    frozenColumnCount: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Number of columns to freeze from the left, 0 = unfreeze all (required for: freeze_columns)'
      ),

    // Depth (for group operations)
    depth: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('Nesting depth level, 1-8 (optional for: group_rows, group_columns, default: 1)'),

    // Allow missing (for delete operations)
    allowMissing: z
      .boolean()
      .optional()
      .describe(
        "If true, don't error when rows/columns don't exist, makes delete idempotent (optional for: delete_rows, delete_columns)"
      ),

    // Filter and Sort Fields (merged from filter-sort.ts)
    range: RangeInputSchema.optional().describe(
      'Range to operate on (required for: filter_sort_range, optional for: filter_set_basic_filter, filter_create_filter_view)'
    ),
    criteria: z
      .record(z.number(), FilterCriteriaSchema)
      .optional()
      .describe(
        'Filter criteria by column index (optional for: filter_set_basic_filter, filter_create_filter_view, filter_update_filter_view)'
      ),
    columnIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Column index for filter criteria (required for: filter_update_filter_criteria)'),
    sortSpecs: z
      .array(SortSpecSchema)
      .optional()
      .describe(
        'Sort specifications (required for: filter_sort_range, optional for: filter_create_filter_view, filter_update_filter_view)'
      ),
    title: z
      .string()
      .optional()
      .describe(
        'Title (required for: filter_create_filter_view, optional for: filter_update_filter_view, filter_create_slicer, filter_update_slicer)'
      ),
    filterViewId: z
      .number()
      .int()
      .optional()
      .describe(
        'Filter view ID (required for: filter_update_filter_view, filter_delete_filter_view, filter_get_filter_view)'
      ),
    slicerId: z
      .number()
      .int()
      .optional()
      .describe('Slicer ID (required for: filter_update_slicer, filter_delete_slicer)'),
    dataRange: RangeInputSchema.optional().describe(
      'Data range for slicer (required for: filter_create_slicer)'
    ),
    filterColumn: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Filter column index (required for: filter_create_slicer, optional for: filter_update_slicer)'
      ),
    position: z
      .object({
        anchorCell: z.string(),
        offsetX: z.number().min(0, 'Offset X must be non-negative').optional().default(0),
        offsetY: z.number().min(0, 'Offset Y must be non-negative').optional().default(0),
        width: z.number().positive('Width must be positive').optional().default(200),
        height: z.number().positive('Height must be positive').optional().default(150),
      })
      .optional()
      .describe('Slicer position (required for: filter_create_slicer)'),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      // Note: Filter actions only require spreadsheetId (not sheetId for some)
      switch (data.action) {
        // Dimension operations (require spreadsheetId and sheetId)
        case 'insert_rows':
        case 'insert_columns':
          return (
            !!data.spreadsheetId && data.sheetId !== undefined && data.startIndex !== undefined
          );

        case 'delete_rows':
        case 'delete_columns':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.startIndex !== undefined &&
            data.endIndex !== undefined
          );

        case 'move_rows':
        case 'move_columns':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.startIndex !== undefined &&
            data.endIndex !== undefined &&
            data.destinationIndex !== undefined
          );

        case 'resize_rows':
        case 'resize_columns':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.startIndex !== undefined &&
            data.endIndex !== undefined &&
            data.pixelSize !== undefined
          );

        case 'auto_resize':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.startIndex !== undefined &&
            data.endIndex !== undefined &&
            !!data.dimension
          );

        case 'hide_rows':
        case 'hide_columns':
        case 'show_rows':
        case 'show_columns':
        case 'group_rows':
        case 'group_columns':
        case 'ungroup_rows':
        case 'ungroup_columns':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.startIndex !== undefined &&
            data.endIndex !== undefined
          );

        case 'freeze_rows':
          return (
            !!data.spreadsheetId && data.sheetId !== undefined && data.frozenRowCount !== undefined
          );

        case 'freeze_columns':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.frozenColumnCount !== undefined
          );

        case 'append_rows':
        case 'append_columns':
          return !!data.spreadsheetId && data.sheetId !== undefined && data.count !== undefined;

        // Filter and sort operations (merged from filter-sort.ts)
        case 'filter_set_basic_filter':
          return !!data.spreadsheetId && data.sheetId !== undefined;

        case 'filter_clear_basic_filter':
          return !!data.spreadsheetId && data.sheetId !== undefined;

        case 'filter_get_basic_filter':
          return !!data.spreadsheetId && data.sheetId !== undefined;

        case 'filter_update_filter_criteria':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.columnIndex !== undefined &&
            !!data.criteria
          );

        case 'filter_sort_range':
          return (
            !!data.spreadsheetId && !!data.range && !!data.sortSpecs && data.sortSpecs.length > 0
          );

        case 'filter_create_filter_view':
          return !!data.spreadsheetId && data.sheetId !== undefined && !!data.title;

        case 'filter_update_filter_view':
          return !!data.spreadsheetId && data.filterViewId !== undefined;

        case 'filter_delete_filter_view':
          return !!data.spreadsheetId && data.filterViewId !== undefined;

        case 'filter_list_filter_views':
          return !!data.spreadsheetId;

        case 'filter_get_filter_view':
          return !!data.spreadsheetId && data.filterViewId !== undefined;

        case 'filter_create_slicer':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            !!data.dataRange &&
            data.filterColumn !== undefined &&
            !!data.position
          );

        case 'filter_update_slicer':
          return !!data.spreadsheetId && data.slicerId !== undefined;

        case 'filter_delete_slicer':
          return !!data.spreadsheetId && data.slicerId !== undefined;

        case 'filter_list_slicers':
          return !!data.spreadsheetId;

        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
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
  position: {
    anchorCell: string;
    offsetX?: number;
    offsetY?: number;
    width?: number;
    height?: number;
  };
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
