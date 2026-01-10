/**
 * Tool 7: sheets_rules
 * Conditional formatting and data validation rules
 */

import { z } from "zod";
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
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const BooleanRuleSchema = z.object({
  type: z.literal("boolean"),
  condition: ConditionSchema,
  format: z.object({
    backgroundColor: ColorSchema.optional(),
    textFormat: TextFormatSchema.optional(),
  }),
});

const GradientRuleSchema = z.object({
  type: z.literal("gradient"),
  minpoint: z.object({
    type: z.enum(["MIN", "MAX", "NUMBER", "PERCENT", "PERCENTILE"]),
    value: z.string().optional(),
    color: ColorSchema,
  }),
  midpoint: z
    .object({
      type: z.enum(["NUMBER", "PERCENT", "PERCENTILE"]),
      value: z.string(),
      color: ColorSchema,
    })
    .optional(),
  maxpoint: z.object({
    type: z.enum(["MIN", "MAX", "NUMBER", "PERCENT", "PERCENTILE"]),
    value: z.string().optional(),
    color: ColorSchema,
  }),
});

const ConditionalFormatRuleSchema = z.discriminatedUnion("type", [
  BooleanRuleSchema,
  GradientRuleSchema,
]);

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsRulesInputSchema = z.discriminatedUnion("action", [
  // ADD_CONDITIONAL_FORMAT
  BaseSchema.extend({
    action: z
      .literal("add_conditional_format")
      .describe("Add a conditional formatting rule to cells"),
    sheetId: SheetIdSchema.describe(
      "Numeric sheet ID where rule will be applied",
    ),
    range: RangeInputSchema.describe(
      "Range to apply the conditional format (A1 notation or semantic)",
    ),
    rule: ConditionalFormatRuleSchema.describe(
      "Conditional format rule (boolean condition or gradient)",
    ),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Position to insert rule (0 = first, omit = append to end)"),
  }),

  // UPDATE_CONDITIONAL_FORMAT
  BaseSchema.extend({
    action: z
      .literal("update_conditional_format")
      .describe("Update an existing conditional formatting rule"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID containing the rule"),
    ruleIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of the rule to update"),
    rule: ConditionalFormatRuleSchema.optional().describe(
      "New rule definition (omit to keep existing rule)",
    ),
    newIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("New position for the rule (omit to keep current position)"),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // DELETE_CONDITIONAL_FORMAT
  BaseSchema.extend({
    action: z
      .literal("delete_conditional_format")
      .describe("Delete a conditional formatting rule"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID containing the rule"),
    ruleIndex: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of the rule to delete"),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // LIST_CONDITIONAL_FORMATS
  BaseSchema.extend({
    action: z
      .literal("list_conditional_formats")
      .describe("List all conditional formatting rules in a sheet"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID to query"),
  }),

  // ADD_DATA_VALIDATION
  BaseSchema.extend({
    action: z
      .literal("add_data_validation")
      .describe("Add data validation rules to a range"),
    range: RangeInputSchema.describe(
      "Range to apply validation (A1 notation or semantic)",
    ),
    condition: ConditionSchema.describe(
      "Validation condition (e.g., ONE_OF_LIST, NUMBER_BETWEEN, DATE_AFTER, etc.)",
    ),
    inputMessage: z
      .string()
      .optional()
      .describe("Help text shown when cell is selected"),
    strict: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "If true, reject invalid input; if false, show warning (default: true)",
      ),
    showDropdown: z
      .boolean()
      .optional()
      .default(true)
      .describe("Show dropdown for list validations (default: true)"),
  }),

  // CLEAR_DATA_VALIDATION
  BaseSchema.extend({
    action: z
      .literal("clear_data_validation")
      .describe("Remove data validation rules from a range"),
    range: RangeInputSchema.describe("Range to clear validation from"),
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.)",
    ),
  }),

  // LIST_DATA_VALIDATIONS
  BaseSchema.extend({
    action: z
      .literal("list_data_validations")
      .describe("List all data validation rules in a sheet"),
    sheetId: SheetIdSchema.describe("Numeric sheet ID to query"),
  }),

  // ADD_PRESET_RULE
  BaseSchema.extend({
    action: z
      .literal("add_preset_rule")
      .describe("Add a predefined conditional formatting rule"),
    sheetId: SheetIdSchema.describe(
      "Numeric sheet ID where rule will be applied",
    ),
    range: RangeInputSchema.describe("Range to apply the preset rule"),
    preset: z
      .enum([
        "highlight_duplicates",
        "highlight_blanks",
        "highlight_errors",
        "color_scale_green_red",
        "color_scale_blue_red",
        "data_bars",
        "top_10_percent",
        "bottom_10_percent",
        "above_average",
        "below_average",
      ])
      .describe(
        "Preset rule type (highlight_duplicates, color scales, data bars, percentile-based, etc.)",
      ),
  }),
]);

const RulesResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    ruleIndex: z.number().int().optional(),
    rules: z
      .array(
        z.object({
          index: z.number().int(),
          ranges: z.array(GridRangeSchema),
          type: z.string(),
        }),
      )
      .optional(),
    validations: z
      .array(
        z.object({
          range: GridRangeSchema,
          condition: ConditionSchema,
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

export const SheetsRulesOutputSchema = z.object({
  response: RulesResponseSchema,
});

export const SHEETS_RULES_ANNOTATIONS: ToolAnnotations = {
  title: "Rules & Validation",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsRulesInput = z.infer<typeof SheetsRulesInputSchema>;
export type SheetsRulesOutput = z.infer<typeof SheetsRulesOutputSchema>;
export type RulesResponse = z.infer<typeof RulesResponseSchema>;
