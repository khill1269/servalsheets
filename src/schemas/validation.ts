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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsValidationInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum(["validate"])
      .describe("The validation operation to perform"),

    // Fields for VALIDATE action
    value: z
      .unknown()
      .optional()
      .describe("Value to validate (required for: validate)"),
    rules: z
      .array(z.string())
      .optional()
      .describe(
        "Validation rule IDs to apply - all rules if omitted (validate only)",
      ),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Validation context: spreadsheetId, sheetName, range, etc. (validate only)",
      ),
    stopOnFirstError: z
      .boolean()
      .optional()
      .describe(
        "Stop validation on first error, default: false (validate only)",
      ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "validate":
          return data.value !== undefined;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type ValidationValidateInput = SheetsValidationInput & {
  action: "validate";
  value: unknown;
};
