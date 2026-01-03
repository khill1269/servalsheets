/**
 * Tool 9: sheets_pivot
 * Pivot table operations
 */

import { z } from 'zod';
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
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const PivotGroupSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  sortOrder: SortOrderSchema.optional(),
  showTotals: z.boolean().optional().default(true),
  groupRule: z.object({
    dateTimeRule: z.object({
      type: z.enum(['SECOND', 'MINUTE', 'HOUR', 'DAY_OF_WEEK', 'DAY_OF_YEAR', 'DAY_OF_MONTH', 'WEEK_OF_YEAR', 'MONTH', 'QUARTER', 'YEAR', 'YEAR_MONTH', 'YEAR_QUARTER', 'YEAR_MONTH_DAY']),
    }).optional(),
    manualRule: z.object({
      groups: z.array(z.object({
        groupName: z.string(),
        items: z.array(z.string()),
      })),
    }).optional(),
    histogramRule: z.object({
      interval: z.number().positive(),
      start: z.number().optional(),
      end: z.number().optional(),
    }).optional(),
  }).optional(),
});

const PivotValueSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  summarizeFunction: SummarizeFunctionSchema,
  name: z.string().optional(),
  calculatedDisplayType: z.enum(['PERCENT_OF_ROW_TOTAL', 'PERCENT_OF_COLUMN_TOTAL', 'PERCENT_OF_GRAND_TOTAL']).optional(),
});

const PivotFilterSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  filterCriteria: z.object({
    visibleValues: z.array(z.string()).optional(),
    condition: z.object({
      type: z.string(),
      values: z.array(z.string()).optional(),
    }).optional(),
  }),
});

export const SheetsPivotInputSchema = z.discriminatedUnion('action', [
  // CREATE
  BaseSchema.extend({
    action: z.literal('create'),
    sourceRange: RangeInputSchema,
    destinationSheetId: SheetIdSchema.optional(),
    destinationCell: z.string().optional(),
    rows: z.array(PivotGroupSchema).optional(),
    columns: z.array(PivotGroupSchema).optional(),
    values: z.array(PivotValueSchema),
    filters: z.array(PivotFilterSchema).optional(),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal('update'),
    sheetId: SheetIdSchema,
    rows: z.array(PivotGroupSchema).optional(),
    columns: z.array(PivotGroupSchema).optional(),
    values: z.array(PivotValueSchema).optional(),
    filters: z.array(PivotFilterSchema).optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE
  BaseSchema.extend({
    action: z.literal('delete'),
    sheetId: SheetIdSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST
  BaseSchema.extend({
    action: z.literal('list'),
  }),

  // GET
  BaseSchema.extend({
    action: z.literal('get'),
    sheetId: SheetIdSchema,
  }),

  // REFRESH
  BaseSchema.extend({
    action: z.literal('refresh'),
    sheetId: SheetIdSchema,
  }),

  // Note: add_calculated_field and remove_calculated_field actions are not supported
  // by Google Sheets API v4. These must be done through the Sheets UI or Apps Script.
]);

export const SheetsPivotOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    pivotTable: z.object({
      sheetId: z.number().int(),
      sourceRange: GridRangeSchema,
      rowGroups: z.number().int(),
      columnGroups: z.number().int(),
      values: z.number().int(),
    }).optional(),
    pivotTables: z.array(z.object({
      sheetId: z.number().int(),
      title: z.string(),
    })).optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SHEETS_PIVOT_ANNOTATIONS: ToolAnnotations = {
  title: 'Pivot Tables',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsPivotInput = z.infer<typeof SheetsPivotInputSchema>;
export type SheetsPivotOutput = z.infer<typeof SheetsPivotOutputSchema>;
