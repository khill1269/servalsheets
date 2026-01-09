/**
 * Tool 9: sheets_pivot
 * Pivot table operations
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  GridRangeSchema,
  SummarizeFunctionSchema,
  SortOrderSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const PivotGroupSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  sortOrder: SortOrderSchema.optional(),
  showTotals: z.boolean().optional().default(true),
  groupRule: z
    .object({
      dateTimeRule: z
        .object({
          type: z.enum([
            "SECOND",
            "MINUTE",
            "HOUR",
            "DAY_OF_WEEK",
            "DAY_OF_YEAR",
            "DAY_OF_MONTH",
            "WEEK_OF_YEAR",
            "MONTH",
            "QUARTER",
            "YEAR",
            "YEAR_MONTH",
            "YEAR_QUARTER",
            "YEAR_MONTH_DAY",
          ]),
        })
        .optional(),
      manualRule: z
        .object({
          groups: z.array(
            z.object({
              groupName: z.string(),
              items: z.array(z.string()),
            }),
          ),
        })
        .optional(),
      histogramRule: z
        .object({
          interval: z.number().positive(),
          start: z.number().optional(),
          end: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

const PivotValueSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  summarizeFunction: SummarizeFunctionSchema,
  name: z.string().optional(),
  calculatedDisplayType: z
    .enum([
      "PERCENT_OF_ROW_TOTAL",
      "PERCENT_OF_COLUMN_TOTAL",
      "PERCENT_OF_GRAND_TOTAL",
    ])
    .optional(),
});

const PivotFilterSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  filterCriteria: z.object({
    visibleValues: z.array(z.string()).optional(),
    condition: z
      .object({
        type: z.string(),
        values: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsPivotInputSchema = z.discriminatedUnion("action", [
  // CREATE
  BaseSchema.extend({
    action: z.literal("create").describe("Create a new pivot table"),
    sourceRange: RangeInputSchema.describe("Source data range for the pivot table (A1 notation or semantic)"),
    destinationSheetId: SheetIdSchema.optional().describe("Sheet ID for pivot table destination (omit = new sheet)"),
    destinationCell: z.string().optional().describe("Top-left cell for pivot table (e.g., 'A1', default: A1)"),
    rows: z.array(PivotGroupSchema).optional().describe("Row groupings for the pivot table"),
    columns: z.array(PivotGroupSchema).optional().describe("Column groupings for the pivot table"),
    values: z.array(PivotValueSchema).describe("Value aggregations (at least one required)"),
    filters: z.array(PivotFilterSchema).optional().describe("Filter criteria for the pivot table"),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal("update").describe("Update an existing pivot table configuration"),
    sheetId: SheetIdSchema.describe("Sheet ID containing the pivot table"),
    rows: z.array(PivotGroupSchema).optional().describe("New row groupings (omit to keep current)"),
    columns: z.array(PivotGroupSchema).optional().describe("New column groupings (omit to keep current)"),
    values: z.array(PivotValueSchema).optional().describe("New value aggregations (omit to keep current)"),
    filters: z.array(PivotFilterSchema).optional().describe("New filter criteria (omit to keep current)"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // DELETE
  BaseSchema.extend({
    action: z.literal("delete").describe("Delete a pivot table"),
    sheetId: SheetIdSchema.describe("Sheet ID containing the pivot table to delete"),
    safety: SafetyOptionsSchema.optional().describe("Safety options (dryRun, createSnapshot, etc.)"),
  }),

  // LIST
  BaseSchema.extend({
    action: z.literal("list").describe("List all pivot tables in the spreadsheet"),
  }),

  // GET
  BaseSchema.extend({
    action: z.literal("get").describe("Get detailed information about a specific pivot table"),
    sheetId: SheetIdSchema.describe("Sheet ID containing the pivot table"),
  }),

  // REFRESH
  BaseSchema.extend({
    action: z.literal("refresh").describe("Refresh a pivot table (re-calculate values from source data)"),
    sheetId: SheetIdSchema.describe("Sheet ID containing the pivot table to refresh"),
  }),

  // Note: add_calculated_field and remove_calculated_field actions are not supported
  // by Google Sheets API v4. These must be done through the Sheets UI or Apps Script.
]);

const PivotResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    pivotTable: z
      .object({
        sheetId: z.number().int(),
        sourceRange: GridRangeSchema,
        rowGroups: z.number().int(),
        columnGroups: z.number().int(),
        values: z.number().int(),
      })
      .optional(),
    pivotTables: z
      .array(
        z.object({
          sheetId: z.number().int(),
          title: z.string(),
        }),
      )
      .optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsPivotOutputSchema = z.object({
  response: PivotResponseSchema,
});

export const SHEETS_PIVOT_ANNOTATIONS: ToolAnnotations = {
  title: "Pivot Tables",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsPivotInput = z.infer<typeof SheetsPivotInputSchema>;
export type SheetsPivotOutput = z.infer<typeof SheetsPivotOutputSchema>;
export type PivotResponse = z.infer<typeof PivotResponseSchema>;
