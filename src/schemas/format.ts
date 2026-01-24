/**
 * Tool 5: sheets_format
 * Cell formatting operations (includes conditional formatting, data validation, and sparklines)
 * Format (10) + Sparklines (3) + Rules (8) = 21 actions
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

// ============================================================================
// SPARKLINE SCHEMAS (3 new actions)
// ============================================================================

// Sparkline chart type
const SparklineTypeSchema = z
  .preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(['LINE', 'BAR', 'COLUMN'])
  )
  .describe('Sparkline chart type (case-insensitive)');

// Sparkline configuration options
const SparklineConfigSchema = z
  .object({
    type: SparklineTypeSchema.default('LINE').describe('Sparkline chart type (LINE, BAR, COLUMN)'),
    color: ColorSchema.optional().describe('Line/bar color'),
    negativeColor: ColorSchema.optional().describe('Color for negative values'),
    axisColor: ColorSchema.optional().describe('Horizontal axis line color'),
    firstColor: ColorSchema.optional().describe('First data point highlight color'),
    lastColor: ColorSchema.optional().describe('Last data point highlight color'),
    highColor: ColorSchema.optional().describe('Highest value highlight color'),
    lowColor: ColorSchema.optional().describe('Lowest value highlight color'),
    lineWidth: z.coerce
      .number()
      .min(0.5)
      .max(4)
      .optional()
      .default(1)
      .describe('Line width in pixels (LINE type only, 0.5-4)'),
    minValue: z.coerce.number().optional().describe('Custom minimum Y-axis value'),
    maxValue: z.coerce.number().optional().describe('Custom maximum Y-axis value'),
    showAxis: z.boolean().optional().default(false).describe('Show horizontal axis line'),
    rtl: z.boolean().optional().default(false).describe('Right-to-left rendering direction'),
  })
  .describe('Sparkline visualization configuration');

// ============================================================================
// INPUT SCHEMA (21 actions)
// ============================================================================

const CommonFieldsSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~50% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
});

// ===== FORMAT ACTION SCHEMAS (10 actions) =====

const SetFormatActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_format').describe('Apply complete cell format'),
  range: RangeInputSchema.describe('Range to format (A1 notation or semantic)'),
  format: CellFormatSchema.describe(
    'Complete cell format specification (background, text, borders, etc.)'
  ),
});

const SuggestFormatActionSchema = CommonFieldsSchema.extend({
  action: z.literal('suggest_format').describe('Get AI-powered format suggestions'),
  range: RangeInputSchema.describe('Range to analyze for format suggestions'),
  maxSuggestions: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .default(3)
    .describe('Number of format suggestions to return (default: 3)'),
});

const SetBackgroundActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_background').describe('Set background color'),
  range: RangeInputSchema.describe('Range to format'),
  color: ColorSchema.describe('Background color (RGB)'),
});

const SetTextFormatActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_text_format').describe('Set text formatting'),
  range: RangeInputSchema.describe('Range to format'),
  textFormat: TextFormatSchema.describe(
    'Text format specification (font family, size, bold, italic, color, etc.)'
  ),
});

const SetNumberFormatActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_number_format').describe('Set number formatting'),
  range: RangeInputSchema.describe('Range to format'),
  numberFormat: NumberFormatSchema.describe(
    'Number format specification (type, pattern, currency symbol, etc.)'
  ),
});

const SetAlignmentActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_alignment').describe('Set cell alignment'),
  range: RangeInputSchema.describe('Range to format'),
  horizontal: HorizontalAlignSchema.optional().describe(
    'Horizontal alignment (LEFT, CENTER, RIGHT)'
  ),
  vertical: VerticalAlignSchema.optional().describe('Vertical alignment (TOP, MIDDLE, BOTTOM)'),
  wrapStrategy: WrapStrategySchema.optional().describe(
    'Text wrap strategy (OVERFLOW_CELL, LEGACY_WRAP, CLIP, WRAP)'
  ),
});

const SetBordersActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_borders').describe('Set cell borders'),
  range: RangeInputSchema.describe('Range to format'),
  top: BorderSchema.optional().describe('Top border style and color'),
  bottom: BorderSchema.optional().describe('Bottom border style and color'),
  left: BorderSchema.optional().describe('Left border style and color'),
  right: BorderSchema.optional().describe('Right border style and color'),
  innerHorizontal: BorderSchema.optional().describe('Inner horizontal borders (between rows)'),
  innerVertical: BorderSchema.optional().describe('Inner vertical borders (between columns)'),
});

const ClearFormatActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear_format').describe('Clear all formatting from cells'),
  range: RangeInputSchema.describe('Range to clear formatting from'),
});

const ApplyPresetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('apply_preset').describe('Apply a preset format style'),
  range: RangeInputSchema.describe('Range to apply preset to'),
  preset: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toLowerCase() : val),
      z.enum([
        'header_row',
        'alternating_rows',
        'total_row',
        'currency',
        'percentage',
        'date',
        'highlight_positive',
        'highlight_negative',
      ])
    )
    .describe(
      'Preset name: header_row, alternating_rows, currency, percentage, etc. Case-insensitive.'
    ),
});

const AutoFitActionSchema = CommonFieldsSchema.extend({
  action: z.literal('auto_fit').describe('Auto-fit column width or row height to content'),
  range: RangeInputSchema.describe('Range to auto-fit'),
  dimension: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['ROWS', 'COLUMNS', 'BOTH'])
    )
    .optional()
    .default('COLUMNS')
    .describe(
      'Dimension to auto-fit: ROWS, COLUMNS, or BOTH (default: COLUMNS). Case-insensitive.'
    ),
});

// ===== SPARKLINE ACTION SCHEMAS (3 actions) =====

const SparklineAddActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('sparkline_add')
    .describe('Add a sparkline visualization to a cell using the SPARKLINE formula'),
  targetCell: z
    .string()
    .regex(/^[A-Z]{1,3}\d+$/, 'Invalid cell reference (expected A1 format, single cell only)')
    .describe('Target cell for sparkline (A1 notation, single cell only)'),
  dataRange: RangeInputSchema.describe(
    'Data range for sparkline (should be 1D - single row or column)'
  ),
  config: SparklineConfigSchema.optional().describe('Sparkline configuration options'),
});

const SparklineGetActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('sparkline_get')
    .describe('Get sparkline formula and configuration from a cell'),
  cell: z
    .string()
    .regex(/^[A-Z]{1,3}\d+$/, 'Invalid cell reference (expected A1 format)')
    .describe('Cell to get sparkline from (A1 notation)'),
});

const SparklineClearActionSchema = CommonFieldsSchema.extend({
  action: z.literal('sparkline_clear').describe('Remove sparkline from a cell'),
  cell: z
    .string()
    .regex(/^[A-Z]{1,3}\d+$/, 'Invalid cell reference (expected A1 format)')
    .describe('Cell to clear sparkline from (A1 notation)'),
});

// ===== RULES ACTION SCHEMAS (8 actions) =====

const RuleAddConditionalFormatActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('rule_add_conditional_format')
    .describe('Add a conditional formatting rule to a sheet'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID where rule will be applied'),
  range: RangeInputSchema.describe('Range for the conditional format rule'),
  rule: ConditionalFormatRuleSchema.describe(
    'Conditional format rule (boolean condition or gradient)'
  ),
  index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Position to insert rule (0 = first, omit = append to end)'),
});

const RuleUpdateConditionalFormatActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('rule_update_conditional_format')
    .describe('Update a conditional formatting rule'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID containing the rule'),
  ruleIndex: z.coerce.number().int().min(0).describe('Zero-based index of the rule to update'),
  range: RangeInputSchema.optional().describe('New range for the rule'),
  rule: ConditionalFormatRuleSchema.optional().describe('New rule definition'),
  newIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('New position for the rule (omit to keep current position)'),
});

const RuleDeleteConditionalFormatActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('rule_delete_conditional_format')
    .describe('Delete a conditional formatting rule'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID containing the rule'),
  ruleIndex: z.coerce.number().int().min(0).describe('Zero-based index of the rule to delete'),
});

const RuleListConditionalFormatsActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('rule_list_conditional_formats')
    .describe('List all conditional formatting rules on a sheet'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to list rules from'),
});

const SetDataValidationActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_data_validation').describe('Add data validation to a range'),
  range: RangeInputSchema.describe('Range to apply validation to'),
  condition: ConditionSchema.describe(
    'Validation condition (e.g., ONE_OF_LIST, NUMBER_BETWEEN, DATE_AFTER, etc.)'
  ),
  inputMessage: z
    .string()
    .max(500, 'Input message exceeds Google Sheets limit of 500 characters')
    .optional()
    .describe('Help text shown when cell is selected (max 500 chars)'),
  strict: z
    .boolean()
    .optional()
    .default(true)
    .describe('If true, reject invalid input; if false, show warning (default: true)'),
  showDropdown: z
    .boolean()
    .optional()
    .default(true)
    .describe('Show dropdown for list validations (default: true)'),
});

const ClearDataValidationActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear_data_validation').describe('Clear data validation from a range'),
  range: RangeInputSchema.describe('Range to clear validation from'),
});

const ListDataValidationsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_data_validations').describe('List all data validations on a sheet'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to list validations from'),
});

const AddConditionalFormatRuleActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('add_conditional_format_rule')
    .describe('Add a preset conditional formatting rule'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID where rule will be applied'),
  range: RangeInputSchema.describe('Range for the preset rule'),
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
    .describe(
      'Preset rule type (highlight_duplicates, color scales, data bars, percentile-based, etc.)'
    ),
});

/**
 * All format operation inputs (cell formatting and rules)
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsFormatInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    // Format actions (10)
    SetFormatActionSchema,
    SuggestFormatActionSchema,
    SetBackgroundActionSchema,
    SetTextFormatActionSchema,
    SetNumberFormatActionSchema,
    SetAlignmentActionSchema,
    SetBordersActionSchema,
    ClearFormatActionSchema,
    ApplyPresetActionSchema,
    AutoFitActionSchema,
    // Sparkline actions (3)
    SparklineAddActionSchema,
    SparklineGetActionSchema,
    SparklineClearActionSchema,
    // Rules actions (8)
    RuleAddConditionalFormatActionSchema,
    RuleUpdateConditionalFormatActionSchema,
    RuleDeleteConditionalFormatActionSchema,
    RuleListConditionalFormatsActionSchema,
    SetDataValidationActionSchema,
    ClearDataValidationActionSchema,
    ListDataValidationsActionSchema,
    AddConditionalFormatRuleActionSchema,
  ]),
});

const FormatResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Format response fields
    cellsFormatted: z.coerce.number().int().optional(),
    suggestions: z
      .array(
        z.object({
          title: z.string(),
          explanation: z.string(),
          confidence: z.coerce.number().min(0).max(100),
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
    // Sparkline response fields
    cell: z.string().optional().describe('Target cell for sparkline operation'),
    formula: z.string().optional().describe('SPARKLINE formula (for sparkline_get/sparkline_add)'),
    // Rules response fields
    ruleIndex: z.coerce.number().int().optional().describe('Index of added/updated rule'),
    rules: z
      .array(
        z.object({
          index: z.coerce.number().int(),
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
        affectedCells: z.coerce.number().int().describe('Total number of cells affected'),
        existingRules: z
          .number()
          .int()
          .optional()
          .describe('Number of existing rules on these ranges'),
        conflicts: z
          .array(
            z.object({
              range: GridRangeSchema,
              existingRuleIndex: z.coerce.number().int(),
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
    snapshotId: z.string().optional().describe('Snapshot ID for rollback (if created)'),
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
/** The unwrapped request type (the discriminated union of actions) */
export type FormatRequest = SheetsFormatInput['request'];

// Note: Type narrowing helpers are not needed with discriminated unions.
// TypeScript automatically narrows types in switch statements based on the action field.
