/**
 * Tool 5: sheets_format
 * Cell formatting operations
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  RangeInputSchema,
  CellFormatSchema,
  ColorSchema,
  TextFormatSchema,
  NumberFormatSchema,
  BorderSchema,
  BorderStyleSchema,
  HorizontalAlignSchema,
  VerticalAlignSchema,
  WrapStrategySchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const FormatActionSchema = z.discriminatedUnion('action', [
  // SET_FORMAT
  BaseSchema.extend({
    action: z.literal('set_format'),
    range: RangeInputSchema,
    format: CellFormatSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // SET_BACKGROUND
  BaseSchema.extend({
    action: z.literal('set_background'),
    range: RangeInputSchema,
    color: ColorSchema,
  }),

  // SET_TEXT_FORMAT
  BaseSchema.extend({
    action: z.literal('set_text_format'),
    range: RangeInputSchema,
    textFormat: TextFormatSchema,
  }),

  // SET_NUMBER_FORMAT
  BaseSchema.extend({
    action: z.literal('set_number_format'),
    range: RangeInputSchema,
    numberFormat: NumberFormatSchema,
  }),

  // SET_ALIGNMENT
  BaseSchema.extend({
    action: z.literal('set_alignment'),
    range: RangeInputSchema,
    horizontal: HorizontalAlignSchema.optional(),
    vertical: VerticalAlignSchema.optional(),
    wrapStrategy: WrapStrategySchema.optional(),
  }),

  // SET_BORDERS
  BaseSchema.extend({
    action: z.literal('set_borders'),
    range: RangeInputSchema,
    top: BorderSchema.optional(),
    bottom: BorderSchema.optional(),
    left: BorderSchema.optional(),
    right: BorderSchema.optional(),
    innerHorizontal: BorderSchema.optional(),
    innerVertical: BorderSchema.optional(),
  }),

  // CLEAR_FORMAT
  BaseSchema.extend({
    action: z.literal('clear_format'),
    range: RangeInputSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // APPLY_PRESET
  BaseSchema.extend({
    action: z.literal('apply_preset'),
    range: RangeInputSchema,
    preset: z.enum([
      'header_row',
      'alternating_rows',
      'total_row',
      'currency',
      'percentage',
      'date',
      'highlight_positive',
      'highlight_negative',
    ]),
  }),

  // AUTO_FIT
  BaseSchema.extend({
    action: z.literal('auto_fit'),
    range: RangeInputSchema,
    dimension: z.enum(['ROWS', 'COLUMNS', 'BOTH']).optional().default('BOTH'),
  }),
]);

export const SheetsFormatInputSchema = z.object({
  request: FormatActionSchema,
});

const FormatResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    cellsFormatted: z.number().int().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsFormatOutputSchema = z.object({
  response: FormatResponseSchema,
});

export const SHEETS_FORMAT_ANNOTATIONS: ToolAnnotations = {
  title: 'Cell Formatting',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export type SheetsFormatInput = z.infer<typeof SheetsFormatInputSchema>;
export type SheetsFormatOutput = z.infer<typeof SheetsFormatOutputSchema>;
export type FormatAction = z.infer<typeof FormatActionSchema>;
export type FormatResponse = z.infer<typeof FormatResponseSchema>;
