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

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsImpactInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("analyze").describe("Analyze the impact of a proposed operation"),
    spreadsheetId: z.string().min(1).describe("Spreadsheet ID"),
    operation: z
      .object({
        type: z
          .string()
          .describe('Operation type (e.g., "values_write", "sheet_delete")'),
        tool: z.string().describe('Tool name (e.g., "sheets_values")'),
        action: z.string().describe('Action name (e.g., "write", "clear")'),
        params: z.record(z.unknown()).describe("Operation parameters"),
      })
      .describe("Operation to analyze"),
  }),
]);

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
