/**
 * Tool 5: sheets_format
 * Cell formatting operations (includes conditional formatting, data validation, and sparklines)
 * Format (10) + Batch (1) + Sparklines (3) + Rules (8) = 22 actions
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

// LLM-friendly border schema: accepts boolean (true = SOLID border) or object { style, color }
const LLMBorderSchema = z.preprocess((val) => {
  // Convert true to { style: "SOLID" } and false to undefined
  if (val === true) return { style: 'SOLID' };
  if (val === false || val === null) return undefined;
  // Also handle string style directly: "SOLID" -> { style: "SOLID" }
  if (typeof val === 'string') return { style: val };
  return val;
}, BorderSchema.optional());

const SetBordersActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_borders').describe('Set cell borders'),
  range: RangeInputSchema.describe('Range to format'),
  top: LLMBorderSchema.describe('Top border: true for SOLID, or { style: "SOLID", color: {...} }'),
  bottom: LLMBorderSchema.describe(
    'Bottom border: true for SOLID, or { style: "SOLID", color: {...} }'
  ),
  left: LLMBorderSchema.describe(
    'Left border: true for SOLID, or { style: "SOLID", color: {...} }'
  ),
  right: LLMBorderSchema.describe(
    'Right border: true for SOLID, or { style: "SOLID", color: {...} }'
  ),
  innerHorizontal: LLMBorderSchema.describe('Inner horizontal borders (between rows)'),
  innerVertical: LLMBorderSchema.describe('Inner vertical borders (between columns)'),
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
      (val) => {
        if (typeof val !== 'string') return val;
        const lower = val.toLowerCase();
        // Normalize common aliases
        const aliases: Record<string, string> = {
          header: 'header_row',
          headers: 'header_row',
          header_style: 'header_row',
          alternating: 'alternating_rows',
          zebra: 'alternating_rows',
          zebra_stripes: 'alternating_rows',
          total: 'total_row',
          totals: 'total_row',
          footer: 'total_row',
          money: 'currency',
          dollars: 'currency',
          percent: 'percentage',
          pct: 'percentage',
          positive: 'highlight_positive',
          green: 'highlight_positive',
          negative: 'highlight_negative',
          red: 'highlight_negative',
        };
        return aliases[lower] ?? lower;
      },
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
      'Preset name: header_row (also: header, headers), alternating_rows (also: zebra, alternating), currency, percentage, date, highlight_positive, highlight_negative. Case-insensitive with common aliases supported.'
    ),
});

const AutoFitActionSchema = CommonFieldsSchema.extend({
  action: z.literal('auto_fit').describe('Auto-fit column width or row height to content'),
  range: RangeInputSchema.optional().describe('Range to auto-fit (omit if using sheetId to fit entire sheet)'),
  sheetId: SheetIdSchema.optional().describe('Sheet ID to auto-fit entire sheet (alternative to range)'),
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
}).refine(
  (data) => data.range || data.sheetId,
  { message: 'Either range or sheetId must be provided' }
);

// ===== SPARKLINE ACTION SCHEMAS (3 actions) =====

const SparklineAddActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('sparkline_add')
    .describe('Add a sparkline visualization to a cell using the SPARKLINE formula'),
  targetCell: z
    .string()
    .regex(/^(?:(?:'[^']+'|[A-Za-z0-9_ ]+)!)?[A-Z]{1,3}\d+$/, 'Invalid cell reference (expected A1 format, optionally with sheet like Sheet1!A1)')
    .describe('Target cell for sparkline (A1 notation or sheet-qualified like Sheet1!A1, single cell only)'),
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
    .regex(/^(?:(?:'[^']+'|[A-Za-z0-9_ ]+)!)?[A-Z]{1,3}\d+$/, 'Invalid cell reference (expected A1 format, optionally with sheet like Sheet1!A1)')
    .describe('Cell to get sparkline from (A1 notation or sheet-qualified like Sheet1!A1)'),
});

const SparklineClearActionSchema = CommonFieldsSchema.extend({
  action: z.literal('sparkline_clear').describe('Remove sparkline from a cell'),
  cell: z
    .string()
    .regex(/^(?:(?:'[^']+'|[A-Za-z0-9_ ]+)!)?[A-Z]{1,3}\d+$/, 'Invalid cell reference (expected A1 format, optionally with sheet like Sheet1!A1)')
    .describe('Cell to clear sparkline from (A1 notation or sheet-qualified like Sheet1!A1)'),
});

// ===== RULES ACTION SCHEMAS (8 actions) =====

const RuleAddConditionalFormatActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('rule_add_conditional_format')
    .describe('Add a conditional formatting rule to a sheet'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID where rule will be applied'),
  range: RangeInputSchema.describe('Range for the conditional format rule'),
  rule: ConditionalFormatRuleSchema.describe(
    `Conditional format rule object. Two types:
1. BOOLEAN RULE: { type: "boolean", condition: { type: "TEXT_CONTAINS", values: [{ userEnteredValue: "error" }] }, format: { backgroundColor: { red: 1, green: 0.5, blue: 0.5 }, textFormat: { bold: true } } }
   Other condition types: NUMBER_GREATER, NUMBER_LESS, NUMBER_BETWEEN, TEXT_IS_EMAIL, TEXT_IS_URL, DATE_BEFORE, BLANK, CUSTOM_FORMULA
2. GRADIENT RULE: { type: "gradient", minpoint: { type: "MIN", color: { red: 0, green: 1, blue: 0 } }, midpoint: { type: "PERCENT", value: "50", color: { red: 1, green: 1, blue: 0 } }, maxpoint: { type: "MAX", color: { red: 1, green: 0, blue: 0 } } }
   Minpoint/maxpoint types: MIN, MAX, NUMBER, PERCENT, PERCENTILE`
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
  action: z
    .literal('set_data_validation')
    .describe(
      'Add data validation to a range. Example: { "action": "set_data_validation", "range": "A1:A10", "condition": { "type": "ONE_OF_LIST", "values": ["Yes", "No", "Maybe"] } }'
    ),
  range: RangeInputSchema.describe('Range to apply validation to'),
  condition: ConditionSchema.describe(
    'Validation condition. Required: type (condition type), values (array of strings). Types: ONE_OF_LIST (dropdown), NUMBER_BETWEEN/NUMBER_GREATER/NUMBER_LESS (numeric), TEXT_CONTAINS/TEXT_IS_EMAIL/TEXT_IS_URL (text), DATE_BEFORE/DATE_AFTER (date), BLANK/NOT_BLANK (empty check), CUSTOM_FORMULA. Example: { "type": "ONE_OF_LIST", "values": ["Yes", "No"] }'
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
  action: z.literal('list_data_validations').describe('List data validations on a sheet or range'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to list validations from'),
  range: RangeInputSchema.optional().describe(
    'Optional range to limit validation scan (e.g., "A1:Z100"). REQUIRED for sheets >10K cells to prevent timeout. If omitted, scans entire sheet (may timeout on large sheets).'
  ),
});

const AddConditionalFormatRuleActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('add_conditional_format_rule')
    .describe('Add a preset conditional formatting rule'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID where rule will be applied'),
  range: RangeInputSchema.describe('Range for the preset rule'),
  rulePreset: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          // Normalize common variations - support many LLM naming patterns
          const normalized = val.toLowerCase().replace(/[\s-]/g, '_');
          const aliases: Record<string, string> = {
            // Duplicates
            duplicates: 'highlight_duplicates',
            duplicate: 'highlight_duplicates',
            find_duplicates: 'highlight_duplicates',
            show_duplicates: 'highlight_duplicates',
            // Blanks
            blanks: 'highlight_blanks',
            blank: 'highlight_blanks',
            empty: 'highlight_blanks',
            empty_cells: 'highlight_blanks',
            highlight_empty: 'highlight_blanks',
            // Errors
            errors: 'highlight_errors',
            error: 'highlight_errors',
            error_cells: 'highlight_errors',
            show_errors: 'highlight_errors',
            // Color scales
            green_red: 'color_scale_green_red',
            red_green: 'color_scale_green_red',
            green_to_red: 'color_scale_green_red',
            red_to_green: 'color_scale_green_red',
            heat_map: 'color_scale_green_red',
            heatmap: 'color_scale_green_red',
            blue_red: 'color_scale_blue_red',
            red_blue: 'color_scale_blue_red',
            blue_to_red: 'color_scale_blue_red',
            // Data bars (any color variation maps to data_bars)
            data_bar: 'data_bars',
            databars: 'data_bars',
            bar: 'data_bars',
            bars: 'data_bars',
            progress_bar: 'data_bars',
            data_bar_blue: 'data_bars',
            data_bar_green: 'data_bars',
            data_bar_red: 'data_bars',
            data_bars_blue: 'data_bars',
            data_bars_green: 'data_bars',
            data_bars_red: 'data_bars',
            blue_bars: 'data_bars',
            green_bars: 'data_bars',
            red_bars: 'data_bars',
            // Top/Bottom percentiles
            top_10: 'top_10_percent',
            top10: 'top_10_percent',
            top_ten: 'top_10_percent',
            top_values: 'top_10_percent',
            highest: 'top_10_percent',
            bottom_10: 'bottom_10_percent',
            bottom10: 'bottom_10_percent',
            bottom_ten: 'bottom_10_percent',
            bottom_values: 'bottom_10_percent',
            lowest: 'bottom_10_percent',
            // Above/Below average
            above_avg: 'above_average',
            above_mean: 'above_average',
            above: 'above_average',
            greater_than_average: 'above_average',
            positive: 'above_average',
            positive_numbers: 'above_average',
            highlight_positive: 'above_average',
            below_avg: 'below_average',
            below_mean: 'below_average',
            below: 'below_average',
            less_than_average: 'below_average',
            negative: 'below_average',
            negative_numbers: 'below_average',
            highlight_negative: 'below_average',
          };
          return aliases[normalized] || normalized;
        }
        return val;
      },
      z.enum([
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
    )
    .describe(
      'Preset rule type. Accepts many aliases: duplicates, blanks, errors, green_red/heatmap, blue_red, data_bars/bars, top_10/highest, bottom_10/lowest, above_avg/positive, below_avg/negative'
    ),
});

// ============================================================================
// BATCH FORMAT SCHEMA (1 new action)
// ============================================================================

/**
 * Individual operation within a batch_format call.
 * Each operation specifies a type, range, and type-specific parameters.
 * All operations are combined into a single Google Sheets batchUpdate API call.
 */
const BatchFormatOperationSchema = z
  .object({
    type: z
      .enum([
        'background',
        'text_format',
        'number_format',
        'alignment',
        'borders',
        'format',
        'preset',
      ])
      .describe(
        'Operation type: background (set color), text_format (bold/italic/font), number_format (currency/percentage), alignment (left/center/right), borders (cell borders), format (full CellFormat), preset (header_row/alternating_rows/etc.)'
      ),
    range: RangeInputSchema.describe('Range to apply this format operation to (A1 notation)'),
    // Type-specific fields (all optional, validated by handler based on type)
    color: ColorSchema.optional().describe('Background color (for type: "background")'),
    textFormat: TextFormatSchema.optional().describe(
      'Text format spec (for type: "text_format")'
    ),
    numberFormat: NumberFormatSchema.optional().describe(
      'Number format spec (for type: "number_format")'
    ),
    horizontal: HorizontalAlignSchema.optional().describe(
      'Horizontal alignment (for type: "alignment")'
    ),
    vertical: VerticalAlignSchema.optional().describe(
      'Vertical alignment (for type: "alignment")'
    ),
    wrapStrategy: WrapStrategySchema.optional().describe(
      'Wrap strategy (for type: "alignment")'
    ),
    top: LLMBorderSchema.describe('Top border (for type: "borders")'),
    bottom: LLMBorderSchema.describe('Bottom border (for type: "borders")'),
    left: LLMBorderSchema.describe('Left border (for type: "borders")'),
    right: LLMBorderSchema.describe('Right border (for type: "borders")'),
    innerHorizontal: LLMBorderSchema.describe(
      'Inner horizontal borders (for type: "borders")'
    ),
    innerVertical: LLMBorderSchema.describe('Inner vertical borders (for type: "borders")'),
    format: CellFormatSchema.optional().describe(
      'Full cell format specification (for type: "format")'
    ),
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
      .describe('Preset name (for type: "preset")'),
  })
  .describe('Single format operation within a batch');

const BatchFormatActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('batch_format')
    .describe(
      'Apply multiple format operations in a single API call. 80-95% faster than individual calls. Use this when applying 2+ format changes.'
    ),
  operations: z
    .array(BatchFormatOperationSchema)
    .min(1)
    .max(100)
    .describe(
      'Array of format operations to apply in one batch. Each operation specifies a type, range, and type-specific parameters. All are sent as a single Google Sheets API call.'
    ),
});

// Preprocess to normalize common LLM input variations for format actions
const normalizeFormatRequest = (val: unknown): unknown => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;
  const action = obj['action'] as string;

  // Normalize flattened validation params for set_data_validation
  // LLMs often send: { validationType: "ONE_OF_LIST", values: [...] }
  // Schema expects: { condition: { type: "ONE_OF_LIST", values: [...] } }
  if (action === 'set_data_validation') {
    let condition = obj['condition'] as Record<string, unknown> | undefined;

    // Handle rule: { condition: {...} } wrapper pattern (Google API format)
    // LLMs sometimes copy the Google API structure: { rule: { condition: {...} } }
    const rule = obj['rule'] as Record<string, unknown> | undefined;
    if (!condition && rule?.['condition']) {
      condition = rule['condition'] as Record<string, unknown>;
    }

    // Normalize values array: convert [{ userEnteredValue: "..." }] to ["..."]
    if (condition?.['values'] && Array.isArray(condition['values'])) {
      const values = condition['values'] as unknown[];
      const normalizedValues = values.map((v) => {
        if (typeof v === 'object' && v !== null && 'userEnteredValue' in v) {
          return (v as { userEnteredValue: string }).userEnteredValue;
        }
        return v;
      });
      condition = { ...condition, values: normalizedValues };
    }

    if (condition) {
      const { rule: _r, ...rest } = obj;
      return { ...rest, condition };
    }

    // Also handle flattened format: { validationType: "ONE_OF_LIST", values: [...] }
    const validationType = obj['validationType'] as string | undefined;
    const values = obj['values'] as unknown[] | undefined;

    if (validationType || values) {
      const newCondition: Record<string, unknown> = {};
      if (validationType) newCondition['type'] = validationType;
      if (values) newCondition['values'] = values;

      // Return new object with condition, removing flattened fields
      const { validationType: _vt, values: _v, ...rest } = obj;
      return { ...rest, condition: newCondition };
    }
  }

  // Handle rulePreset: "custom" - convert to rule_add_conditional_format with proper rule structure
  // Claude often sends: { action: "add_conditional_format_rule", rulePreset: "custom", customFormula: "=...", backgroundColor: {...} }
  // or: { action: "add_conditional_format_rule", rulePreset: "custom", customRule: { type, formula, format } }
  // or: { action: "add_conditional_format_rule", rulePreset: "custom", condition: {...}, format: {...} }
  if (action === 'add_conditional_format_rule' && obj['rulePreset'] === 'custom') {
    const customFormula = obj['customFormula'] as string | undefined;
    const customRule = obj['customRule'] as Record<string, unknown> | undefined;
    const condition = obj['condition'] as Record<string, unknown> | undefined;
    const format = obj['format'] as Record<string, unknown> | undefined;
    const backgroundColor = obj['backgroundColor'] as Record<string, unknown> | undefined;

    // Build the rule structure
    let rule: Record<string, unknown> | undefined;

    if (customFormula) {
      // Pattern: { customFormula: "=...", backgroundColor: {...} }
      rule = {
        type: 'boolean',
        condition: {
          type: 'CUSTOM_FORMULA',
          values: [{ userEnteredValue: customFormula }],
        },
        format: backgroundColor ? { backgroundColor } : format || {},
      };
    } else if (customRule) {
      // Pattern: { customRule: { type: "CUSTOM_FORMULA", formula: "=...", format: {...} } }
      const formula = customRule['formula'] as string | undefined;
      const ruleFormat = customRule['format'] as Record<string, unknown> | undefined;
      rule = {
        type: 'boolean',
        condition: {
          type: customRule['type'] || 'CUSTOM_FORMULA',
          values: formula ? [{ userEnteredValue: formula }] : [],
        },
        format: ruleFormat || {},
      };
    } else if (condition) {
      // Pattern: { condition: { type: "NUMBER_GREATER", values: [...] }, format: {...} }
      rule = {
        type: 'boolean',
        condition,
        format: format || {},
      };
    }

    if (rule) {
      // Convert to rule_add_conditional_format action
      const {
        rulePreset: _rp,
        customFormula: _cf,
        customRule: _cr,
        condition: _c,
        format: _f,
        backgroundColor: _bg,
        ...rest
      } = obj;
      return {
        ...rest,
        action: 'rule_add_conditional_format',
        rule,
      };
    }
  }

  return val;
};

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
  request: z.preprocess(
    normalizeFormatRequest,
    z.discriminatedUnion('action', [
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
      // Batch format (1)
      BatchFormatActionSchema,
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
    ])
  ),
});

const FormatResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Format response fields
    cellsFormatted: z.coerce.number().int().optional(),
    // Batch format response fields
    operationsApplied: z.coerce.number().int().optional().describe('Number of operations applied (for batch_format)'),
    apiCallsSaved: z.coerce.number().int().optional().describe('Number of API calls saved by batching'),
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
