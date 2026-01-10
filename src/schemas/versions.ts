/**
 * Tool 13: sheets_versions
 * Version control and revision history
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const RevisionSchema = z.object({
  id: z.string(),
  modifiedTime: z.string(),
  lastModifyingUser: z
    .object({
      displayName: z.string(),
      emailAddress: z.string().optional(),
    })
    .optional(),
  size: z.string().optional(),
  keepForever: z.boolean().optional(),
});

const SnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  spreadsheetId: z.string(),
  copyId: z.string().optional(),
  size: z.number().int().optional(),
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsVersionsInputSchema = z.discriminatedUnion("action", [
  // LIST_REVISIONS
  BaseSchema.extend({
    action: z.literal("list_revisions"),
    pageSize: z.number().int().positive().optional().default(100),
    pageToken: z.string().optional(),
  }),

  // GET_REVISION
  BaseSchema.extend({
    action: z.literal("get_revision"),
    revisionId: z.string(),
  }),

  // RESTORE_REVISION
  BaseSchema.extend({
    action: z.literal("restore_revision"),
    revisionId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // KEEP_REVISION
  BaseSchema.extend({
    action: z.literal("keep_revision"),
    revisionId: z.string(),
    keepForever: z.boolean(),
  }),

  // CREATE_SNAPSHOT
  BaseSchema.extend({
    action: z.literal("create_snapshot"),
    name: z.string().optional(),
    description: z.string().optional(),
    destinationFolderId: z.string().optional(),
  }),

  // LIST_SNAPSHOTS
  BaseSchema.extend({
    action: z.literal("list_snapshots"),
  }),

  // RESTORE_SNAPSHOT
  BaseSchema.extend({
    action: z.literal("restore_snapshot"),
    snapshotId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_SNAPSHOT
  BaseSchema.extend({
    action: z.literal("delete_snapshot"),
    snapshotId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // COMPARE
  BaseSchema.extend({
    action: z.literal("compare"),
    revisionId1: z.string().optional(),
    revisionId2: z.string().optional(),
    sheetId: SheetIdSchema.optional(),
  }),

  // EXPORT_VERSION
  BaseSchema.extend({
    action: z.literal("export_version"),
    revisionId: z.string().optional(),
    format: z.enum(["xlsx", "csv", "pdf", "ods"]).optional().default("xlsx"),
  }),
]);

const VersionsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    revision: RevisionSchema.optional(),
    revisions: z.array(RevisionSchema).optional(),
    nextPageToken: z.string().optional(),
    snapshot: SnapshotSchema.optional(),
    snapshots: z.array(SnapshotSchema).optional(),
    comparison: z
      .object({
        sheetsAdded: z.array(z.string()).optional(),
        sheetsRemoved: z.array(z.string()).optional(),
        sheetsModified: z.array(z.string()).optional(),
        cellChanges: z.number().int().optional(),
      })
      .optional(),
    exportUrl: z.string().optional(),
    exportData: z.string().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsVersionsOutputSchema = z.object({
  response: VersionsResponseSchema,
});

export const SHEETS_VERSIONS_ANNOTATIONS: ToolAnnotations = {
  title: "Version Control",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsVersionsInput = z.infer<typeof SheetsVersionsInputSchema>;
export type SheetsVersionsOutput = z.infer<typeof SheetsVersionsOutputSchema>;

export type VersionsResponse = z.infer<typeof VersionsResponseSchema>;
