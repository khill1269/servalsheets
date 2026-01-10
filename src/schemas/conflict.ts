/**
 * Tool: sheets_conflict
 * Conflict detection and resolution for concurrent modifications.
 */

import { z } from "zod";
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsConflictInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z
      .literal("detect")
      .describe("Detect conflicts in spreadsheet or range"),
    spreadsheetId: z
      .string()
      .min(1)
      .describe("Spreadsheet ID to check for conflicts"),
    range: z.string().optional().describe("Range to check (A1 notation)"),
    since: z
      .number()
      .optional()
      .describe("Timestamp to check conflicts since (ms)"),
  }),
  z.object({
    action: z.literal("resolve").describe("Resolve a detected conflict"),
    conflictId: z.string().min(1).describe("Conflict ID to resolve"),
    strategy: z
      .enum(["keep_local", "keep_remote", "merge", "manual"])
      .describe("Resolution strategy"),
    mergedValue: z
      .unknown()
      .optional()
      .describe("Merged value for manual strategy"),
  }),
]);

const ConflictResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // detect response
    conflicts: z
      .array(
        z.object({
          id: z.string(),
          spreadsheetId: z.string(),
          range: z.string(),
          localVersion: z.number(),
          remoteVersion: z.number(),
          localValue: z.unknown(),
          remoteValue: z.unknown(),
          conflictType: z.enum([
            "concurrent_write",
            "version_mismatch",
            "data_race",
          ]),
          severity: z.enum(["low", "medium", "high", "critical"]),
          detectedAt: z.number(),
          suggestedStrategy: z.enum([
            "keep_local",
            "keep_remote",
            "merge",
            "manual",
          ]),
        }),
      )
      .optional(),
    // resolve response
    conflictId: z.string().optional(),
    resolved: z.boolean().optional(),
    resolution: z
      .object({
        strategy: z.string(),
        finalValue: z.unknown(),
        version: z.number(),
      })
      .optional(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsConflictOutputSchema = z.object({
  response: ConflictResponseSchema,
});

export const SHEETS_CONFLICT_ANNOTATIONS: ToolAnnotations = {
  title: "Conflict Detection",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsConflictInput = z.infer<typeof SheetsConflictInputSchema>;
export type SheetsConflictOutput = z.infer<typeof SheetsConflictOutputSchema>;
export type ConflictResponse = z.infer<typeof ConflictResponseSchema>;
