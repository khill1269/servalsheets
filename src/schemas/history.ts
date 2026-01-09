/**
 * Tool: sheets_history
 * Operation history tracking for debugging and undo foundation.
 */

import { z } from "zod";
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsHistoryInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    spreadsheetId: z.string().optional().describe("Filter by spreadsheet ID"),
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Number of operations to return (default: 10)"),
    failuresOnly: z
      .boolean()
      .optional()
      .describe("Show only failed operations (default: false)"),
  }),
  z.object({
    action: z.literal("get"),
    operationId: z.string().min(1).describe("Operation ID to retrieve"),
  }),
  z.object({
    action: z.literal("stats"),
  }),
  z.object({
    action: z.literal("undo"),
    spreadsheetId: z
      .string()
      .min(1)
      .describe("Spreadsheet ID to undo last operation on"),
  }),
  z.object({
    action: z.literal("redo"),
    spreadsheetId: z
      .string()
      .min(1)
      .describe("Spreadsheet ID to redo previously undone operation on"),
  }),
  z.object({
    action: z.literal("revert_to"),
    operationId: z
      .string()
      .min(1)
      .describe(
        "Operation ID to revert to (restores state before this operation)",
      ),
  }),
  z.object({
    action: z.literal("clear"),
    spreadsheetId: z
      .string()
      .optional()
      .describe("Clear history for specific spreadsheet (or all if omitted)"),
  }),
]);


const HistoryResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // list response
    operations: z
      .array(
        z.object({
          id: z.string(),
          tool: z.string(),
          action: z.string(),
          spreadsheetId: z.string().optional(),
          range: z.string().optional(),
          success: z.boolean(),
          duration: z.number(),
          timestamp: z.number(),
          error: z.string().optional(),
          snapshotId: z.string().optional(),
        }),
      )
      .optional(),
    // get response
    operation: z
      .object({
        id: z.string(),
        tool: z.string(),
        action: z.string(),
        params: z.record(z.unknown()),
        result: z.unknown().optional(),
        spreadsheetId: z.string().optional(),
        range: z.string().optional(),
        success: z.boolean(),
        duration: z.number(),
        timestamp: z.number(),
        error: z.string().optional(),
        snapshotId: z.string().optional(),
      })
      .optional(),
    // stats response
    stats: z
      .object({
        totalOperations: z.number(),
        successfulOperations: z.number(),
        failedOperations: z.number(),
        successRate: z.number(),
        avgDuration: z.number(),
        operationsByTool: z.record(z.number()),
        recentFailures: z.number(),
      })
      .optional(),
    // undo/redo/revert response
    restoredSpreadsheetId: z
      .string()
      .optional()
      .describe("ID of restored spreadsheet (for undo/redo/revert)"),
    operationRestored: z
      .object({
        id: z.string(),
        tool: z.string(),
        action: z.string(),
        timestamp: z.number(),
      })
      .optional()
      .describe("Details of operation that was undone/redone"),
    // clear response
    operationsCleared: z
      .number()
      .optional()
      .describe("Number of operations cleared"),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsHistoryOutputSchema = z.object({
  response: HistoryResponseSchema,
});

export const SHEETS_HISTORY_ANNOTATIONS: ToolAnnotations = {
  title: "Operation History & Undo",
  readOnlyHint: false, // undo/redo are write operations
  destructiveHint: false,
  idempotentHint: false, // undo/redo change state
  openWorldHint: false,
};

export type SheetsHistoryInput = z.infer<typeof SheetsHistoryInputSchema>;
export type SheetsHistoryOutput = z.infer<typeof SheetsHistoryOutputSchema>;

export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;
