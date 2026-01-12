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

const _BaseSchema = z.object({
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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsVersionsInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "list_revisions",
        "get_revision",
        "restore_revision",
        "keep_revision",
        "create_snapshot",
        "list_snapshots",
        "restore_snapshot",
        "delete_snapshot",
        "compare",
        "export_version",
      ])
      .describe("The operation to perform on the version/revision/snapshot"),

    // Required for most actions
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions except when snapshotId is sufficient)",
    ),

    // Fields for LIST_REVISIONS action
    pageSize: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Number of revisions to return per page (list_revisions only)"),
    pageToken: z
      .string()
      .optional()
      .describe("Token for pagination (list_revisions only)"),

    // Fields for GET_REVISION, RESTORE_REVISION, KEEP_REVISION actions
    revisionId: z
      .string()
      .optional()
      .describe(
        "Revision ID (required for: get_revision, restore_revision, keep_revision; optional for: compare, export_version)",
      ),

    // Fields for KEEP_REVISION action
    keepForever: z
      .boolean()
      .optional()
      .describe(
        "Whether to keep revision forever (required for: keep_revision)",
      ),

    // Fields for CREATE_SNAPSHOT action
    name: z
      .string()
      .optional()
      .describe("Name for the snapshot (create_snapshot only)"),
    description: z
      .string()
      .optional()
      .describe("Description for the snapshot (create_snapshot only)"),
    destinationFolderId: z
      .string()
      .optional()
      .describe("Google Drive folder ID for snapshot (create_snapshot only)"),

    // Fields for RESTORE_SNAPSHOT, DELETE_SNAPSHOT actions
    snapshotId: z
      .string()
      .optional()
      .describe(
        "Snapshot ID (required for: restore_snapshot, delete_snapshot)",
      ),

    // Fields for COMPARE action
    revisionId1: z
      .string()
      .optional()
      .describe("First revision ID to compare (compare only)"),
    revisionId2: z
      .string()
      .optional()
      .describe("Second revision ID to compare (compare only)"),
    sheetId: SheetIdSchema.optional().describe(
      "Specific sheet to compare (compare only)",
    ),

    // Fields for EXPORT_VERSION action
    format: z
      .enum(["xlsx", "csv", "pdf", "ods"])
      .optional()
      .default("xlsx")
      .describe("Export format (export_version only)"),

    // Safety options for destructive actions
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options including dryRun (restore_revision, restore_snapshot, delete_snapshot only)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "list_revisions":
          return !!data.spreadsheetId;
        case "get_revision":
          return !!data.spreadsheetId && !!data.revisionId;
        case "restore_revision":
          return !!data.spreadsheetId && !!data.revisionId;
        case "keep_revision":
          return (
            !!data.spreadsheetId &&
            !!data.revisionId &&
            data.keepForever !== undefined
          );
        case "create_snapshot":
          return !!data.spreadsheetId;
        case "list_snapshots":
          return !!data.spreadsheetId;
        case "restore_snapshot":
          return !!data.spreadsheetId && !!data.snapshotId;
        case "delete_snapshot":
          return !!data.spreadsheetId && !!data.snapshotId;
        case "compare":
          return !!data.spreadsheetId;
        case "export_version":
          return !!data.spreadsheetId;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type VersionsListRevisionsInput = SheetsVersionsInput & {
  action: "list_revisions";
  spreadsheetId: string;
};
export type VersionsGetRevisionInput = SheetsVersionsInput & {
  action: "get_revision";
  spreadsheetId: string;
  revisionId: string;
};
export type VersionsRestoreRevisionInput = SheetsVersionsInput & {
  action: "restore_revision";
  spreadsheetId: string;
  revisionId: string;
};
export type VersionsKeepRevisionInput = SheetsVersionsInput & {
  action: "keep_revision";
  spreadsheetId: string;
  revisionId: string;
  keepForever: boolean;
};
export type VersionsCreateSnapshotInput = SheetsVersionsInput & {
  action: "create_snapshot";
  spreadsheetId: string;
};
export type VersionsListSnapshotsInput = SheetsVersionsInput & {
  action: "list_snapshots";
  spreadsheetId: string;
};
export type VersionsRestoreSnapshotInput = SheetsVersionsInput & {
  action: "restore_snapshot";
  spreadsheetId: string;
  snapshotId: string;
};
export type VersionsDeleteSnapshotInput = SheetsVersionsInput & {
  action: "delete_snapshot";
  spreadsheetId: string;
  snapshotId: string;
};
export type VersionsCompareInput = SheetsVersionsInput & {
  action: "compare";
  spreadsheetId: string;
};
export type VersionsExportVersionInput = SheetsVersionsInput & {
  action: "export_version";
  spreadsheetId: string;
};
