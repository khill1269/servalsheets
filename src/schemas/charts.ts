/**
 * Tool 8: sheets_charts
 * Chart operations
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  ChartTypeSchema,
  LegendPositionSchema,
  ChartPositionSchema,
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

const ChartDataSchema = z.object({
  sourceRange: RangeInputSchema,
  series: z.array(z.object({
    column: z.number().int().min(0),
    color: ColorSchema.optional(),
  })).optional(),
  categories: z.number().int().min(0).optional(),
  aggregateType: z.enum(['AVERAGE', 'COUNT', 'COUNTA', 'COUNTUNIQUE', 'MAX', 'MEDIAN', 'MIN', 'STDEV', 'STDEVP', 'SUM', 'VAR', 'VARP']).optional(),
});

const ChartOptionsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  legendPosition: LegendPositionSchema.optional(),
  backgroundColor: ColorSchema.optional(),
  is3D: z.boolean().optional(),
  pieHole: z.number().min(0).max(1).optional(),
  stacked: z.boolean().optional(),
  lineSmooth: z.boolean().optional(),
  axisTitle: z.object({
    horizontal: z.string().optional(),
    vertical: z.string().optional(),
  }).optional(),
});

const ChartsActionSchema = z.discriminatedUnion('action', [
  // CREATE
  BaseSchema.extend({
    action: z.literal('create'),
    sheetId: SheetIdSchema,
    chartType: ChartTypeSchema,
    data: ChartDataSchema,
    position: ChartPositionSchema,
    options: ChartOptionsSchema.optional(),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal('update'),
    chartId: z.number().int(),
    chartType: ChartTypeSchema.optional(),
    data: ChartDataSchema.optional(),
    position: ChartPositionSchema.optional(),
    options: ChartOptionsSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE
  BaseSchema.extend({
    action: z.literal('delete'),
    chartId: z.number().int(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST
  BaseSchema.extend({
    action: z.literal('list'),
    sheetId: SheetIdSchema.optional(),
  }),

  // GET
  BaseSchema.extend({
    action: z.literal('get'),
    chartId: z.number().int(),
  }),

  // MOVE
  BaseSchema.extend({
    action: z.literal('move'),
    chartId: z.number().int(),
    position: ChartPositionSchema,
  }),

  // RESIZE
  BaseSchema.extend({
    action: z.literal('resize'),
    chartId: z.number().int(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),

  // UPDATE_DATA_RANGE
  BaseSchema.extend({
    action: z.literal('update_data_range'),
    chartId: z.number().int(),
    data: ChartDataSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // EXPORT
  BaseSchema.extend({
    action: z.literal('export'),
    chartId: z.number().int(),
    format: z.enum(['PNG', 'PDF']).optional().default('PNG'),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }),
]);

export const SheetsChartsInputSchema = z.object({
  request: ChartsActionSchema,
});

const ChartsResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    chartId: z.number().int().optional(),
    charts: z.array(z.object({
      chartId: z.number().int(),
      chartType: z.string(),
      sheetId: z.number().int(),
      title: z.string().optional(),
      position: ChartPositionSchema,
    })).optional(),
    exportUrl: z.string().optional(),
    exportData: z.string().optional(), // base64
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsChartsOutputSchema = z.object({
  response: ChartsResponseSchema,
});

export const SHEETS_CHARTS_ANNOTATIONS: ToolAnnotations = {
  title: 'Charts',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsChartsInput = z.infer<typeof SheetsChartsInputSchema>;
export type SheetsChartsOutput = z.infer<typeof SheetsChartsOutputSchema>;
export type ChartsAction = z.infer<typeof ChartsActionSchema>;
export type ChartsResponse = z.infer<typeof ChartsResponseSchema>;
