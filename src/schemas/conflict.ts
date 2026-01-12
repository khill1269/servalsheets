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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsConflictInputSchema = z
  .object({
    action: z
      .enum(["detect", "resolve"])
      .describe("The conflict operation to perform"),
    // detect fields
    spreadsheetId: z
      .string()
      .min(1)
      .optional()
      .describe("Spreadsheet ID to check for conflicts (required for: detect)"),
    range: z.string().optional().describe("Range to check (A1 notation)"),
    since: z
      .number()
      .optional()
      .describe("Timestamp to check conflicts since (ms)"),
    // resolve fields
    conflictId: z
      .string()
      .min(1)
      .optional()
      .describe("Conflict ID to resolve (required for: resolve)"),
    strategy: z
      .enum(["keep_local", "keep_remote", "merge", "manual"])
      .optional()
      .describe("Resolution strategy (required for: resolve)"),
    mergedValue: z
      .unknown()
      .optional()
      .describe("Merged value for manual strategy"),
  })
  .refine(
    (data) => {
      switch (data.action) {
        case "detect":
          if (!data.spreadsheetId) {
            return false;
          }
          return true;
        case "resolve":
          if (!data.conflictId || !data.strategy) {
            return false;
          }
          return true;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for handler methods
export type ConflictDetectInput = SheetsConflictInput & {
  action: "detect";
  spreadsheetId: string;
};
export type ConflictResolveInput = SheetsConflictInput & {
  action: "resolve";
  conflictId: string;
  strategy: "keep_local" | "keep_remote" | "merge" | "manual";
};
