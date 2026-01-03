/**
 * Tool 7: sheets_rules
 * Conditional formatting and data validation rules
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  GridRangeSchema,
  ConditionSchema,
  ColorSchema,
  TextFormatSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const BooleanRuleSchema = z.object({
  type: z.literal('boolean'),
  condition: ConditionSchema,
  format: z.object({
    backgroundColor: ColorSchema.optional(),
    textFormat: TextFormatSchema.optional(),
  }),
});

const GradientRuleSchema = z.object({
  type: z.literal('gradient'),
  minpoint: z.object({
    type: z.enum(['MIN', 'MAX', 'NUMBER', 'PERCENT', 'PERCENTILE']),
    value: z.string().optional(),
    color: ColorSchema,
  }),
  midpoint: z.object({
    type: z.enum(['NUMBER', 'PERCENT', 'PERCENTILE']),
    value: z.string(),
    color: ColorSchema,
  }).optional(),
  maxpoint: z.object({
    type: z.enum(['MIN', 'MAX', 'NUMBER', 'PERCENT', 'PERCENTILE']),
    value: z.string().optional(),
    color: ColorSchema,
  }),
});

const ConditionalFormatRuleSchema = z.discriminatedUnion('type', [
  BooleanRuleSchema,
  GradientRuleSchema,
]);

export const SheetsRulesInputSchema = z.discriminatedUnion('action', [
  // ADD_CONDITIONAL_FORMAT
  BaseSchema.extend({
    action: z.literal('add_conditional_format'),
    sheetId: SheetIdSchema,
    range: RangeInputSchema,
    rule: ConditionalFormatRuleSchema,
    index: z.number().int().min(0).optional(),
  }),

  // UPDATE_CONDITIONAL_FORMAT
  BaseSchema.extend({
    action: z.literal('update_conditional_format'),
    sheetId: SheetIdSchema,
    ruleIndex: z.number().int().min(0),
    rule: ConditionalFormatRuleSchema.optional(),
    newIndex: z.number().int().min(0).optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_CONDITIONAL_FORMAT
  BaseSchema.extend({
    action: z.literal('delete_conditional_format'),
    sheetId: SheetIdSchema,
    ruleIndex: z.number().int().min(0),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_CONDITIONAL_FORMATS
  BaseSchema.extend({
    action: z.literal('list_conditional_formats'),
    sheetId: SheetIdSchema,
  }),

  // ADD_DATA_VALIDATION
  BaseSchema.extend({
    action: z.literal('add_data_validation'),
    range: RangeInputSchema,
    condition: ConditionSchema,
    inputMessage: z.string().optional(),
    strict: z.boolean().optional().default(true),
    showDropdown: z.boolean().optional().default(true),
  }),

  // CLEAR_DATA_VALIDATION
  BaseSchema.extend({
    action: z.literal('clear_data_validation'),
    range: RangeInputSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_DATA_VALIDATIONS
  BaseSchema.extend({
    action: z.literal('list_data_validations'),
    sheetId: SheetIdSchema,
  }),

  // ADD_PRESET_RULE
  BaseSchema.extend({
    action: z.literal('add_preset_rule'),
    sheetId: SheetIdSchema,
    range: RangeInputSchema,
    preset: z.enum([
      'highlight_duplicates',
      'highlight_blanks',
      'highlight_errors',
      'color_scale_green_red',
      'color_scale_blue_red',
      'data_bars',
      'top_10_percent',
      'bottom_10_percent',
      'above_average',
      'below_average',
    ]),
  }),
]);

export const SheetsRulesOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    ruleIndex: z.number().int().optional(),
    rules: z.array(z.object({
      index: z.number().int(),
      ranges: z.array(GridRangeSchema),
      type: z.string(),
    })).optional(),
    validations: z.array(z.object({
      range: GridRangeSchema,
      condition: ConditionSchema,
    })).optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SHEETS_RULES_ANNOTATIONS: ToolAnnotations = {
  title: 'Rules & Validation',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsRulesInput = z.infer<typeof SheetsRulesInputSchema>;
export type SheetsRulesOutput = z.infer<typeof SheetsRulesOutputSchema>;
