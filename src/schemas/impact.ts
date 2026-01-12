/**
 * Tool: sheets_impact
 * Pre-execution impact analysis for operations with dependency tracking.
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
export const SheetsImpactInputSchema = z
  .object({
    action: z
      .enum(["analyze"])
      .describe("The impact analysis operation to perform"),
    spreadsheetId: z
      .string()
      .min(1)
      .optional()
      .describe("Spreadsheet ID (required for: analyze)"),
    operation: z
      .object({
        type: z
          .string()
          .describe('Operation type (e.g., "values_write", "sheet_delete")'),
        tool: z.string().describe('Tool name (e.g., "sheets_values")'),
        action: z.string().describe('Action name (e.g., "write", "clear")'),
        params: z
          .record(z.string(), z.unknown())
          .describe("Operation parameters"),
      })
      .optional()
      .describe("Operation to analyze (required for: analyze)"),
  })
  .refine(
    (data) => {
      if (data.action === "analyze") {
        return !!data.spreadsheetId && !!data.operation;
      }
      return true;
    },
    {
      message: "spreadsheetId and operation are required for analyze action",
    },
  );

const ImpactResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    impact: z.object({
      severity: z.enum(["low", "medium", "high", "critical"]),
      scope: z.object({
        rows: z.number(),
        columns: z.number(),
        cells: z.number(),
        sheets: z.array(z.string()),
      }),
      affectedResources: z.object({
        formulas: z.array(z.string()),
        charts: z.array(z.string()),
        pivotTables: z.array(z.string()),
        validationRules: z.array(z.string()),
        namedRanges: z.array(z.string()),
        protectedRanges: z.array(z.string()),
      }),
      estimatedExecutionTime: z.number(),
      warnings: z.array(
        z.object({
          severity: z.enum(["low", "medium", "high", "critical"]),
          message: z.string(),
          affectedResources: z.array(z.string()).optional(),
        }),
      ),
      recommendations: z.array(
        z.object({
          action: z.string(),
          reason: z.string(),
          priority: z.enum(["low", "medium", "high"]),
        }),
      ),
      canProceed: z.boolean(),
      requiresConfirmation: z.boolean(),
    }),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsImpactOutputSchema = z.object({
  response: ImpactResponseSchema,
});

export const SHEETS_IMPACT_ANNOTATIONS: ToolAnnotations = {
  title: "Impact Analysis",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsImpactInput = z.infer<typeof SheetsImpactInputSchema>;
export type SheetsImpactOutput = z.infer<typeof SheetsImpactOutputSchema>;
export type ImpactResponse = z.infer<typeof ImpactResponseSchema>;

// Type narrowing helpers for handler methods
export type ImpactAnalyzeInput = SheetsImpactInput & {
  action: "analyze";
  spreadsheetId: string;
  operation: {
    type: string;
    tool: string;
    action: string;
    params: Record<string, unknown>;
  };
};
