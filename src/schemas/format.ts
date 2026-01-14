/**
 * Tool 5: sheets_format
 * Cell formatting operations (includes conditional formatting and data validation)
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  CellFormatSchema,
  ColorSchema,
  TextFormatSchema,
  NumberFormatSchema,
  BorderSchema,
  BorderStyleSchema as _BorderStyleSchema,
  HorizontalAlignSchema,
  VerticalAlignSchema,
  WrapStrategySchema,
  GridRangeSchema,
  ConditionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

// Rules-related schema definitions
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
  midpoint: z
    .object({
      type: z.enum(['NUMBER', 'PERCENT', 'PERCENTILE']),
      value: z.string(),
      color: ColorSchema,
    })
    .optional(),
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

// INPUT SCHEMA: Flattened z.object() pattern with action-specific validation
// This exposes all fields at top level for proper MCP client UX
export const SheetsFormatInputSchema = z
  .object({
    // Action discriminator (18 actions: 10 format + 8 rules)
    action: z
      .enum([
        // Format actions (10)
        'set_format',
        'suggest_format',
        'set_background',
        'set_text_format',
        'set_number_format',
        'set_alignment',
        'set_borders',
        'clear_format',
        'apply_preset',
        'auto_fit',
        // Rules actions (8, prefixed with rule_)
        'rule_add_conditional_format',
        'rule_update_conditional_format',
        'rule_delete_conditional_format',
        'rule_list_conditional_formats',
        'rule_add_data_validation',
        'rule_clear_data_validation',
        'rule_list_data_validations',
        'rule_add_preset_rule',
      ])
      .describe('Formatting or rules action to perform'),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema,
    range: RangeInputSchema.optional().describe('Range to format (A1 notation or semantic)'),

    // suggest_format fields
    maxSuggestions: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe(
        'Number of format suggestions to return (optional for: suggest_format, default: 3)'
      ),

    // set_format fields
    format: CellFormatSchema.optional().describe(
      'Complete cell format specification (background, text, borders, etc.)'
    ),

    // set_background fields
    color: ColorSchema.optional().describe('Background color (RGB)'),

    // set_text_format fields
    textFormat: TextFormatSchema.optional().describe(
      'Text format specification (font family, size, bold, italic, color, etc.)'
    ),

    // set_number_format fields
    numberFormat: NumberFormatSchema.optional().describe(
      'Number format specification (type, pattern, currency symbol, etc.)'
    ),

    // set_alignment fields
    horizontal: HorizontalAlignSchema.optional().describe(
      'Horizontal alignment (LEFT, CENTER, RIGHT)'
    ),
    vertical: VerticalAlignSchema.optional().describe('Vertical alignment (TOP, MIDDLE, BOTTOM)'),
    wrapStrategy: WrapStrategySchema.optional().describe(
      'Text wrap strategy (OVERFLOW_CELL, LEGACY_WRAP, CLIP, WRAP)'
    ),

    // set_borders fields
    top: BorderSchema.optional().describe('Top border style and color'),
    bottom: BorderSchema.optional().describe('Bottom border style and color'),
    left: BorderSchema.optional().describe('Left border style and color'),
    right: BorderSchema.optional().describe('Right border style and color'),
    innerHorizontal: BorderSchema.optional().describe('Inner horizontal borders (between rows)'),
    innerVertical: BorderSchema.optional().describe('Inner vertical borders (between columns)'),

    // apply_preset fields
    preset: z
      .enum([
        'header_row',
        'alternating_rows',
        'total_row',
        'currency',
        'percentage',
        'date',
        'highlight_positive',
        'highlight_negative',
      ])
      .optional()
      .describe('Preset name (header_row, alternating_rows, currency, percentage, etc.)'),

    // auto_fit fields
    dimension: z
      .enum(['ROWS', 'COLUMNS', 'BOTH'])
      .optional()
      .describe('Dimension to auto-fit (ROWS, COLUMNS, or BOTH)'),

    // Rules: sheetId field (required for most rule actions)
    sheetId: SheetIdSchema.optional().describe(
      'Numeric sheet ID where rule will be applied (required for: rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats, rule_list_data_validations, rule_add_preset_rule)'
    ),

    // Rules: conditional format fields
    rule: ConditionalFormatRuleSchema.optional().describe(
      'Conditional format rule (boolean condition or gradient) (required for: rule_add_conditional_format; optional for: rule_update_conditional_format)'
    ),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Position to insert rule (0 = first, omit = append to end) (rule_add_conditional_format only)'
      ),
    ruleIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Zero-based index of the rule to update/delete (required for: rule_update_conditional_format, rule_delete_conditional_format)'
      ),
    newIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'New position for the rule (omit to keep current position) (rule_update_conditional_format only)'
      ),

    // Rules: data validation fields
    condition: ConditionSchema.optional().describe(
      'Validation condition (e.g., ONE_OF_LIST, NUMBER_BETWEEN, DATE_AFTER, etc.) (required for: rule_add_data_validation)'
    ),
    inputMessage: z
      .string()
      .optional()
      .describe('Help text shown when cell is selected (rule_add_data_validation only)'),
    strict: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'If true, reject invalid input; if false, show warning (default: true) (rule_add_data_validation only)'
      ),
    showDropdown: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Show dropdown for list validations (default: true) (rule_add_data_validation only)'
      ),

    // Rules: preset rules field
    rulePreset: z
      .enum([
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
      ])
      .optional()
      .describe(
        'Preset rule type (highlight_duplicates, color scales, data bars, percentile-based, etc.) (required for: rule_add_preset_rule)'
      ),

    // Safety fields (for set_format, clear_format, and destructive rule actions)
    safety: SafetyOptionsSchema.optional().describe(
      'Safety options (dryRun, createSnapshot, etc.)'
    ),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (essential info only, ~50% less tokens), standard (balanced), detailed (full metadata)'
      ),
  })
  .refine(
    (data) => {
      switch (data.action) {
        // Format actions
        case 'set_format':
          return !!data.range && !!data.format;
        case 'suggest_format':
          return !!data.range;
        case 'set_background':
          return !!data.range && !!data.color;
        case 'set_text_format':
          return !!data.range && !!data.textFormat;
        case 'set_number_format':
          return !!data.range && !!data.numberFormat;
        case 'set_alignment':
          return !!data.range;
        case 'set_borders':
          return !!data.range;
        case 'clear_format':
          return !!data.range;
        case 'apply_preset':
          return !!data.range && !!data.preset;
        case 'auto_fit':
          return !!data.range;
        // Rules actions
        case 'rule_add_conditional_format':
          return data.sheetId !== undefined && !!data.range && !!data.rule;
        case 'rule_update_conditional_format':
          return data.sheetId !== undefined && data.ruleIndex !== undefined;
        case 'rule_delete_conditional_format':
          return data.sheetId !== undefined && data.ruleIndex !== undefined;
        case 'rule_list_conditional_formats':
          return data.sheetId !== undefined;
        case 'rule_add_data_validation':
          return !!data.range && !!data.condition;
        case 'rule_clear_data_validation':
          return !!data.range;
        case 'rule_list_data_validations':
          return data.sheetId !== undefined;
        case 'rule_add_preset_rule':
          return data.sheetId !== undefined && !!data.range && !!data.rulePreset;
        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

const FormatResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Format response fields
    cellsFormatted: z.number().int().optional(),
    suggestions: z
      .array(
        z.object({
          title: z.string(),
          explanation: z.string(),
          confidence: z.number().min(0).max(100),
          reasoning: z.string(),
          formatOptions: z.object({
            backgroundColor: ColorSchema.optional(),
            textFormat: TextFormatSchema.optional(),
            numberFormat: NumberFormatSchema.optional(),
            borders: z.boolean().optional(),
            alignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
          }),
        })
      )
      .optional()
      .describe('Format suggestions (for suggest_format action)'),
    // Rules response fields
    ruleIndex: z.number().int().optional().describe('Index of added/updated rule'),
    rules: z
      .array(
        z.object({
          index: z.number().int(),
          ranges: z.array(GridRangeSchema),
          type: z.string(),
        })
      )
      .optional()
      .describe('List of conditional format rules'),
    validations: z
      .array(
        z.object({
          range: GridRangeSchema,
          condition: ConditionSchema,
        })
      )
      .optional()
      .describe('List of data validation rules'),
    rulePreview: z
      .object({
        affectedRanges: z.array(GridRangeSchema).describe('Ranges that would be affected'),
        affectedCells: z.number().int().describe('Total number of cells affected'),
        existingRules: z
          .number()
          .int()
          .optional()
          .describe('Number of existing rules on these ranges'),
        conflicts: z
          .array(
            z.object({
              range: GridRangeSchema,
              existingRuleIndex: z.number().int(),
              conflictType: z.enum(['overlap', 'priority', 'condition_conflict']),
            })
          )
          .optional()
          .describe('Potential conflicts with existing rules'),
      })
      .optional()
      .describe('Preview of rule application (when dryRun=true)'),
    // Common response fields
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
  title: 'Cell Formatting & Rules',
  readOnlyHint: false,
  destructiveHint: true, // Now includes rule deletion actions
  idempotentHint: true,
  openWorldHint: true,
};

export type SheetsFormatInput = z.infer<typeof SheetsFormatInputSchema>;
export type SheetsFormatOutput = z.infer<typeof SheetsFormatOutputSchema>;
export type FormatResponse = z.infer<typeof FormatResponseSchema>;

// Type narrowing helpers for each action
export function isSetFormatAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'set_format';
  range: NonNullable<SheetsFormatInput['range']>;
  format: NonNullable<SheetsFormatInput['format']>;
} {
  return input.action === 'set_format';
}

export function isSetBackgroundAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'set_background';
  range: NonNullable<SheetsFormatInput['range']>;
  color: NonNullable<SheetsFormatInput['color']>;
} {
  return input.action === 'set_background';
}

export function isSetTextFormatAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'set_text_format';
  range: NonNullable<SheetsFormatInput['range']>;
  textFormat: NonNullable<SheetsFormatInput['textFormat']>;
} {
  return input.action === 'set_text_format';
}

export function isSetNumberFormatAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'set_number_format';
  range: NonNullable<SheetsFormatInput['range']>;
  numberFormat: NonNullable<SheetsFormatInput['numberFormat']>;
} {
  return input.action === 'set_number_format';
}

export function isSetAlignmentAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'set_alignment';
  range: NonNullable<SheetsFormatInput['range']>;
} {
  return input.action === 'set_alignment';
}

export function isSetBordersAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'set_borders';
  range: NonNullable<SheetsFormatInput['range']>;
} {
  return input.action === 'set_borders';
}

export function isClearFormatAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'clear_format';
  range: NonNullable<SheetsFormatInput['range']>;
} {
  return input.action === 'clear_format';
}

export function isApplyPresetAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'apply_preset';
  range: NonNullable<SheetsFormatInput['range']>;
  preset: NonNullable<SheetsFormatInput['preset']>;
} {
  return input.action === 'apply_preset';
}

export function isAutoFitAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'auto_fit';
  range: NonNullable<SheetsFormatInput['range']>;
} {
  return input.action === 'auto_fit';
}

export function isSuggestFormatAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'suggest_format';
  range: NonNullable<SheetsFormatInput['range']>;
} {
  return input.action === 'suggest_format';
}

// Type narrowing helpers for rules actions
export function isRuleAddConditionalFormatAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_add_conditional_format';
  sheetId: NonNullable<SheetsFormatInput['sheetId']>;
  range: NonNullable<SheetsFormatInput['range']>;
  rule: NonNullable<SheetsFormatInput['rule']>;
} {
  return input.action === 'rule_add_conditional_format';
}

export function isRuleUpdateConditionalFormatAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_update_conditional_format';
  sheetId: NonNullable<SheetsFormatInput['sheetId']>;
  ruleIndex: NonNullable<SheetsFormatInput['ruleIndex']>;
} {
  return input.action === 'rule_update_conditional_format';
}

export function isRuleDeleteConditionalFormatAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_delete_conditional_format';
  sheetId: NonNullable<SheetsFormatInput['sheetId']>;
  ruleIndex: NonNullable<SheetsFormatInput['ruleIndex']>;
} {
  return input.action === 'rule_delete_conditional_format';
}

export function isRuleListConditionalFormatsAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_list_conditional_formats';
  sheetId: NonNullable<SheetsFormatInput['sheetId']>;
} {
  return input.action === 'rule_list_conditional_formats';
}

export function isRuleAddDataValidationAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_add_data_validation';
  range: NonNullable<SheetsFormatInput['range']>;
  condition: NonNullable<SheetsFormatInput['condition']>;
} {
  return input.action === 'rule_add_data_validation';
}

export function isRuleClearDataValidationAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_clear_data_validation';
  range: NonNullable<SheetsFormatInput['range']>;
} {
  return input.action === 'rule_clear_data_validation';
}

export function isRuleListDataValidationsAction(
  input: SheetsFormatInput
): input is SheetsFormatInput & {
  action: 'rule_list_data_validations';
  sheetId: NonNullable<SheetsFormatInput['sheetId']>;
} {
  return input.action === 'rule_list_data_validations';
}

export function isRuleAddPresetRuleAction(input: SheetsFormatInput): input is SheetsFormatInput & {
  action: 'rule_add_preset_rule';
  sheetId: NonNullable<SheetsFormatInput['sheetId']>;
  range: NonNullable<SheetsFormatInput['range']>;
  rulePreset: NonNullable<SheetsFormatInput['rulePreset']>;
} {
  return input.action === 'rule_add_preset_rule';
}
