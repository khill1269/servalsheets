/**
 * Tool: sheets_validation
 * Data validation engine with 11 built-in validators and custom rule support.
 */

import { z } from "zod";
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsValidationInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("validate").describe("Validate a value against built-in or custom rules"),
    value: z.unknown().describe("Value to validate"),
    rules: z
      .array(z.string())
      .optional()
      .describe("Validation rule IDs to apply (all rules if omitted)"),
    context: z
      .record(z.unknown())
      .optional()
      .describe("Validation context (spreadsheetId, sheetName, range, etc.)"),
    stopOnFirstError: z
      .boolean()
      .optional()
      .describe("Stop validation on first error (default: false)"),
  }),
]);

const ValidationResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    valid: z.boolean(),
    errorCount: z.number(),
    warningCount: z.number(),
    infoCount: z.number(),
    totalChecks: z.number(),
    passedChecks: z.number(),
    errors: z
      .array(
        z.object({
          ruleId: z.string(),
          ruleName: z.string(),
          severity: z.enum(["error", "warning", "info"]),
          message: z.string(),
          actualValue: z.unknown().optional(),
          expectedValue: z.unknown().optional(),
          path: z.string().optional(),
        }),
      )
      .optional(),
    warnings: z
      .array(
        z.object({
          ruleId: z.string(),
          ruleName: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
    duration: z.number(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsValidationOutputSchema = z.object({
  response: ValidationResponseSchema,
});

export const SHEETS_VALIDATION_ANNOTATIONS: ToolAnnotations = {
  title: "Data Validation",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsValidationInput = z.infer<typeof SheetsValidationInputSchema>;
export type SheetsValidationOutput = z.infer<
  typeof SheetsValidationOutputSchema
>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;
