/**
 * Tool 10: sheets_filter_sort
 * Filtering and sorting operations
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
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

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

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

const FilterSortActionSchema = z.discriminatedUnion('action', [
  // SET_BASIC_FILTER
  BaseSchema.extend({
    action: z.literal('set_basic_filter'),
    sheetId: SheetIdSchema,
    range: RangeInputSchema.optional(),
    criteria: z.record(z.number(), FilterCriteriaSchema).optional(),
  }),

  // CLEAR_BASIC_FILTER
  BaseSchema.extend({
    action: z.literal('clear_basic_filter'),
    sheetId: SheetIdSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // GET_BASIC_FILTER
  BaseSchema.extend({
    action: z.literal('get_basic_filter'),
    sheetId: SheetIdSchema,
  }),

  // UPDATE_FILTER_CRITERIA
  BaseSchema.extend({
    action: z.literal('update_filter_criteria'),
    sheetId: SheetIdSchema,
    columnIndex: z.number().int().min(0),
    criteria: FilterCriteriaSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // SORT_RANGE
  BaseSchema.extend({
    action: z.literal('sort_range'),
    range: RangeInputSchema,
    sortSpecs: z.array(SortSpecSchema).min(1),
    safety: SafetyOptionsSchema.optional(),
  }),

  // CREATE_FILTER_VIEW
  BaseSchema.extend({
    action: z.literal('create_filter_view'),
    sheetId: SheetIdSchema,
    title: z.string(),
    range: RangeInputSchema.optional(),
    criteria: z.record(z.number(), FilterCriteriaSchema).optional(),
    sortSpecs: z.array(SortSpecSchema).optional(),
  }),

  // UPDATE_FILTER_VIEW
  BaseSchema.extend({
    action: z.literal('update_filter_view'),
    filterViewId: z.number().int(),
    title: z.string().optional(),
    criteria: z.record(z.number(), FilterCriteriaSchema).optional(),
    sortSpecs: z.array(SortSpecSchema).optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_FILTER_VIEW
  BaseSchema.extend({
    action: z.literal('delete_filter_view'),
    filterViewId: z.number().int(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_FILTER_VIEWS
  BaseSchema.extend({
    action: z.literal('list_filter_views'),
    sheetId: SheetIdSchema.optional(),
  }),

  // GET_FILTER_VIEW
  BaseSchema.extend({
    action: z.literal('get_filter_view'),
    filterViewId: z.number().int(),
  }),

  // CREATE_SLICER
  BaseSchema.extend({
    action: z.literal('create_slicer'),
    sheetId: SheetIdSchema,
    dataRange: RangeInputSchema,
    filterColumn: z.number().int().min(0),
    position: z.object({
      anchorCell: z.string(),
      offsetX: z.number().optional().default(0),
      offsetY: z.number().optional().default(0),
      width: z.number().optional().default(200),
      height: z.number().optional().default(150),
    }),
    title: z.string().optional(),
  }),

  // UPDATE_SLICER
  BaseSchema.extend({
    action: z.literal('update_slicer'),
    slicerId: z.number().int(),
    filterColumn: z.number().int().min(0).optional(),
    title: z.string().optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_SLICER
  BaseSchema.extend({
    action: z.literal('delete_slicer'),
    slicerId: z.number().int(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_SLICERS
  BaseSchema.extend({
    action: z.literal('list_slicers'),
    sheetId: SheetIdSchema.optional(),
  }),
]);

export const SheetsFilterSortInputSchema = z.object({
  request: FilterSortActionSchema,
});

const FilterSortResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    filter: z.object({
      range: GridRangeSchema,
      criteria: z.record(z.string(), z.unknown()),
    }).optional(),
    filterViews: z.array(z.object({
      filterViewId: z.number().int(),
      title: z.string(),
      range: GridRangeSchema,
    })).optional(),
    filterViewId: z.number().int().optional(),
    slicers: z.array(z.object({
      slicerId: z.number().int(),
      sheetId: z.number().int(),
      title: z.string().optional(),
    })).optional(),
    slicerId: z.number().int().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsFilterSortOutputSchema = z.object({
  response: FilterSortResponseSchema,
});

export const SHEETS_FILTER_SORT_ANNOTATIONS: ToolAnnotations = {
  title: 'Filter & Sort',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsFilterSortInput = z.infer<typeof SheetsFilterSortInputSchema>;
export type SheetsFilterSortOutput = z.infer<typeof SheetsFilterSortOutputSchema>;
export type FilterSortAction = z.infer<typeof FilterSortActionSchema>;
export type FilterSortResponse = z.infer<typeof FilterSortResponseSchema>;
