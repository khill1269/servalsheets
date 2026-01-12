/**
 * Tool 10: sheets_filter_sort
 * Filtering and sorting operations
 */

import { z } from "zod";
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
} from "./shared.js";

const _BaseSchema = z.object({
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
  sortOrder: SortOrderSchema.optional().default("ASCENDING"),
  foregroundColor: ColorSchema.optional(),
  backgroundColor: ColorSchema.optional(),
});

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsFilterSortInputSchema = z
  .object({
    // Common fields
    spreadsheetId: SpreadsheetIdSchema,
    action: z
      .enum([
        "set_basic_filter",
        "clear_basic_filter",
        "get_basic_filter",
        "update_filter_criteria",
        "sort_range",
        "create_filter_view",
        "update_filter_view",
        "delete_filter_view",
        "list_filter_views",
        "get_filter_view",
        "create_slicer",
        "update_slicer",
        "delete_slicer",
        "list_slicers",
      ])
      .describe("The filter/sort operation to perform"),

    // Fields for various actions (all optional, validated in refine)
    sheetId: SheetIdSchema.optional().describe(
      "Sheet ID (required for: set_basic_filter, clear_basic_filter, get_basic_filter, update_filter_criteria, create_filter_view, create_slicer, list_filter_views, list_slicers)",
    ),
    range: RangeInputSchema.optional().describe(
      "Range to operate on (required for: sort_range, optional for: set_basic_filter, create_filter_view)",
    ),
    criteria: z
      .record(z.number(), FilterCriteriaSchema)
      .optional()
      .describe(
        "Filter criteria by column index (optional for: set_basic_filter, create_filter_view, update_filter_view)",
      ),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (optional for: clear_basic_filter, update_filter_criteria, sort_range, update_filter_view, delete_filter_view, update_slicer, delete_slicer)",
    ),
    columnIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Column index for filter criteria (required for: update_filter_criteria)",
      ),
    sortSpecs: z
      .array(SortSpecSchema)
      .optional()
      .describe(
        "Sort specifications (required for: sort_range, optional for: create_filter_view, update_filter_view)",
      ),
    title: z
      .string()
      .optional()
      .describe(
        "Title (required for: create_filter_view, optional for: update_filter_view, create_slicer, update_slicer)",
      ),
    filterViewId: z
      .number()
      .int()
      .optional()
      .describe(
        "Filter view ID (required for: update_filter_view, delete_filter_view, get_filter_view)",
      ),
    slicerId: z
      .number()
      .int()
      .optional()
      .describe("Slicer ID (required for: update_slicer, delete_slicer)"),
    dataRange: RangeInputSchema.optional().describe(
      "Data range for slicer (required for: create_slicer)",
    ),
    filterColumn: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Filter column index (required for: create_slicer, optional for: update_slicer)",
      ),
    position: z
      .object({
        anchorCell: z.string(),
        offsetX: z.number().optional().default(0),
        offsetY: z.number().optional().default(0),
        width: z.number().optional().default(200),
        height: z.number().optional().default(150),
      })
      .optional()
      .describe("Slicer position (required for: create_slicer)"),
  })
  .refine(
    (data) => {
      // Validate required fields per action
      // Note: Use !== undefined instead of !! for numeric fields since 0 is valid
      switch (data.action) {
        case "set_basic_filter":
          return data.sheetId !== undefined;
        case "clear_basic_filter":
          return data.sheetId !== undefined;
        case "get_basic_filter":
          return data.sheetId !== undefined;
        case "update_filter_criteria":
          return (
            data.sheetId !== undefined &&
            data.columnIndex !== undefined &&
            !!data.criteria
          );
        case "sort_range":
          return !!data.range && !!data.sortSpecs && data.sortSpecs.length > 0;
        case "create_filter_view":
          return data.sheetId !== undefined && !!data.title;
        case "update_filter_view":
          return data.filterViewId !== undefined;
        case "delete_filter_view":
          return data.filterViewId !== undefined;
        case "list_filter_views":
          return true; // No required fields
        case "get_filter_view":
          return data.filterViewId !== undefined;
        case "create_slicer":
          return (
            data.sheetId !== undefined &&
            !!data.dataRange &&
            data.filterColumn !== undefined &&
            !!data.position
          );
        case "update_slicer":
          return data.slicerId !== undefined;
        case "delete_slicer":
          return data.slicerId !== undefined;
        case "list_slicers":
          return true; // No required fields
        default:
          return false;
      }
    },
    {
      message:
        "Missing required fields for the specified action. Check field descriptions for requirements.",
    },
  );

const FilterSortResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
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
        }),
      )
      .optional(),
    filterViewId: z.number().int().optional(),
    slicers: z
      .array(
        z.object({
          slicerId: z.number().int(),
          sheetId: z.number().int(),
          title: z.string().optional(),
        }),
      )
      .optional(),
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
  title: "Filter & Sort",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsFilterSortInput = z.infer<typeof SheetsFilterSortInputSchema>;
export type SheetsFilterSortOutput = z.infer<
  typeof SheetsFilterSortOutputSchema
>;

export type FilterSortResponse = z.infer<typeof FilterSortResponseSchema>;

// Type narrowing helpers for handler methods
export type SetBasicFilterInput = SheetsFilterSortInput & {
  action: "set_basic_filter";
  sheetId: number;
};
export type ClearBasicFilterInput = SheetsFilterSortInput & {
  action: "clear_basic_filter";
  sheetId: number;
};
export type GetBasicFilterInput = SheetsFilterSortInput & {
  action: "get_basic_filter";
  sheetId: number;
};
export type UpdateFilterCriteriaInput = SheetsFilterSortInput & {
  action: "update_filter_criteria";
  sheetId: number;
  columnIndex: number;
  criteria: Record<number, z.infer<typeof FilterCriteriaSchema>>;
};
export type SortRangeInput = SheetsFilterSortInput & {
  action: "sort_range";
  range: z.infer<typeof RangeInputSchema>;
  sortSpecs: Array<z.infer<typeof SortSpecSchema>>;
};
export type CreateFilterViewInput = SheetsFilterSortInput & {
  action: "create_filter_view";
  sheetId: number;
  title: string;
};
export type UpdateFilterViewInput = SheetsFilterSortInput & {
  action: "update_filter_view";
  filterViewId: number;
};
export type DeleteFilterViewInput = SheetsFilterSortInput & {
  action: "delete_filter_view";
  filterViewId: number;
};
export type ListFilterViewsInput = SheetsFilterSortInput & {
  action: "list_filter_views";
};
export type GetFilterViewInput = SheetsFilterSortInput & {
  action: "get_filter_view";
  filterViewId: number;
};
export type CreateSlicerInput = SheetsFilterSortInput & {
  action: "create_slicer";
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
export type UpdateSlicerInput = SheetsFilterSortInput & {
  action: "update_slicer";
  slicerId: number;
};
export type DeleteSlicerInput = SheetsFilterSortInput & {
  action: "delete_slicer";
  slicerId: number;
};
export type ListSlicersInput = SheetsFilterSortInput & {
  action: "list_slicers";
};
