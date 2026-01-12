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

const _BaseSchema = z.object({
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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsRulesInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "add_conditional_format",
        "update_conditional_format",
        "delete_conditional_format",
        "list_conditional_formats",
        "add_data_validation",
        "clear_data_validation",
        "list_data_validations",
        "add_preset_rule",
      ])
      .describe("The operation to perform on rules and validations"),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),

    // Fields for conditional format actions
    sheetId: SheetIdSchema.optional().describe(
      "Numeric sheet ID where rule will be applied (required for: add_conditional_format, update_conditional_format, delete_conditional_format, list_conditional_formats, list_data_validations, add_preset_rule)",
    ),
    range: RangeInputSchema.optional().describe(
      "Range to apply the conditional format/validation (A1 notation or semantic) (required for: add_conditional_format, add_data_validation, clear_data_validation, add_preset_rule)",
    ),
    rule: ConditionalFormatRuleSchema.optional().describe(
      "Conditional format rule (boolean condition or gradient) (required for: add_conditional_format; optional for: update_conditional_format)",
    ),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Position to insert rule (0 = first, omit = append to end) (add_conditional_format only)",
      ),

    // Fields for update/delete conditional format
    ruleIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Zero-based index of the rule to update/delete (required for: update_conditional_format, delete_conditional_format)",
      ),
    newIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "New position for the rule (omit to keep current position) (update_conditional_format only)",
      ),

    // Fields for data validation
    condition: ConditionSchema.optional().describe(
      "Validation condition (e.g., ONE_OF_LIST, NUMBER_BETWEEN, DATE_AFTER, etc.) (required for: add_data_validation)",
    ),
    inputMessage: z
      .string()
      .optional()
      .describe(
        "Help text shown when cell is selected (add_data_validation only)",
      ),
    strict: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "If true, reject invalid input; if false, show warning (default: true) (add_data_validation only)",
      ),
    showDropdown: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Show dropdown for list validations (default: true) (add_data_validation only)",
      ),

    // Fields for preset rules
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
      .optional()
      .describe(
        "Preset rule type (highlight_duplicates, color scales, data bars, percentile-based, etc.) (required for: add_preset_rule)",
      ),

    // Safety options
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.) (optional for: update_conditional_format, delete_conditional_format, clear_data_validation)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "add_conditional_format":
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            !!data.range &&
            !!data.rule
          );
        case "update_conditional_format":
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.ruleIndex !== undefined
          );
        case "delete_conditional_format":
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            data.ruleIndex !== undefined
          );
        case "list_conditional_formats":
          return !!data.spreadsheetId && data.sheetId !== undefined;
        case "add_data_validation":
          return !!data.spreadsheetId && !!data.range && !!data.condition;
        case "clear_data_validation":
          return !!data.spreadsheetId && !!data.range;
        case "list_data_validations":
          return !!data.spreadsheetId && data.sheetId !== undefined;
        case "add_preset_rule":
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            !!data.range &&
            !!data.preset
          );
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type RulesAddConditionalFormatInput = SheetsRulesInput & {
  action: "add_conditional_format";
  spreadsheetId: string;
  sheetId: number;
  range: NonNullable<SheetsRulesInput["range"]>;
  rule: NonNullable<SheetsRulesInput["rule"]>;
};
export type RulesUpdateConditionalFormatInput = SheetsRulesInput & {
  action: "update_conditional_format";
  spreadsheetId: string;
  sheetId: number;
  ruleIndex: number;
};
export type RulesDeleteConditionalFormatInput = SheetsRulesInput & {
  action: "delete_conditional_format";
  spreadsheetId: string;
  sheetId: number;
  ruleIndex: number;
};
export type RulesListConditionalFormatsInput = SheetsRulesInput & {
  action: "list_conditional_formats";
  spreadsheetId: string;
  sheetId: number;
};
export type RulesAddDataValidationInput = SheetsRulesInput & {
  action: "add_data_validation";
  spreadsheetId: string;
  range: NonNullable<SheetsRulesInput["range"]>;
  condition: NonNullable<SheetsRulesInput["condition"]>;
};
export type RulesClearDataValidationInput = SheetsRulesInput & {
  action: "clear_data_validation";
  spreadsheetId: string;
  range: NonNullable<SheetsRulesInput["range"]>;
};
export type RulesListDataValidationsInput = SheetsRulesInput & {
  action: "list_data_validations";
  spreadsheetId: string;
  sheetId: number;
};
export type RulesAddPresetRuleInput = SheetsRulesInput & {
  action: "add_preset_rule";
  spreadsheetId: string;
  sheetId: number;
  range: NonNullable<SheetsRulesInput["range"]>;
  preset: NonNullable<SheetsRulesInput["preset"]>;
};
