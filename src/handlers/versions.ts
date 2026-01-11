/**
 * ServalSheets - Versions Handler
 *
 * Handles sheets_versions tool (Drive revisions/snapshots)
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsVersionsInput,
  SheetsVersionsOutput,
  VersionsResponse,
} from "../schemas/index.js";

type VersionsSuccess = Extract<VersionsResponse, { success: true }>;

export class VersionsHandler extends BaseHandler<
  SheetsVersionsInput,
  SheetsVersionsOutput
> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super("sheets_versions", context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsVersionsInput): Promise<SheetsVersionsOutput> {
    if (!this.driveApi) {
      return {
        response: this.error({
          code: "INTERNAL_ERROR",
          message: "Drive API not available - required for version operations",
          details: {
            action: input.action,
            spreadsheetId: input.spreadsheetId,
            requiredScope: "https://www.googleapis.com/auth/drive.file",
          },
          retryable: false,
          resolution:
            "Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.",
          resolutionSteps: [
            "1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup",
            "2. Ensure drive.file scope is included in OAuth scopes",
            "3. Re-authenticate if using OAuth",
          ],
        }),
      };
    }

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(
      input,
    ) as SheetsVersionsInput;

    try {
      const response = await this.executeAction(inferredRequest);
      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsVersionsInput): Intent[] {
    return [];
  }

  /**
   * Execute action and return response (extracted for task/non-task paths)
   */
  private async executeAction(
    request: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    switch (request.action) {
      case "list_revisions":
        return await this.handleListRevisions(request);
      case "get_revision":
        return await this.handleGetRevision(request);
      case "restore_revision":
        return await this.handleRestoreRevision(request);
      case "keep_revision":
        return await this.handleKeepRevision(request);
      case "create_snapshot":
        return await this.handleCreateSnapshot(request);
      case "list_snapshots":
        return await this.handleListSnapshots(request);
      case "restore_snapshot":
        return await this.handleRestoreSnapshot(request);
      case "delete_snapshot":
        return await this.handleDeleteSnapshot(request);
      case "compare":
        return await this.handleCompare(request);
      case "export_version":
        return await this.handleExportVersion(request);
      default:
        return this.error({
          code: "INVALID_PARAMS",
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleListRevisions(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.revisions.list({
      fileId: input.spreadsheetId!,
      pageSize: input.pageSize ?? 100,
      pageToken: input.pageToken,
      fields:
        "revisions(id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever),nextPageToken",
    });

    const revisions = (response.data.revisions ?? []).map(this.mapRevision);
    return this.success("list_revisions", {
      revisions,
      nextPageToken: response.data.nextPageToken ?? undefined,
    });
  }

  private async handleGetRevision(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.revisions.get({
      fileId: input.spreadsheetId!,
      revisionId: input.revisionId!,
      fields:
        "id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever",
    });

    return this.success("get_revision", {
      revision: this.mapRevision(response.data),
    });
  }

  private async handleRestoreRevision(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    if (input.safety?.dryRun) {
      return this.success("restore_revision", {}, undefined, true);
    }

    // Sheets API doesn't support direct revision restore; suggest snapshot copy.
    return this.featureUnavailable("restore_revision");
  }

  private async handleKeepRevision(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.revisions.update({
      fileId: input.spreadsheetId!,
      revisionId: input.revisionId!,
      requestBody: { keepForever: input.keepForever! },
      fields:
        "id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever",
    });

    return this.success("keep_revision", {
      revision: this.mapRevision(response.data),
    });
  }

  private async handleCreateSnapshot(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    const name = input.name ?? `Snapshot - ${new Date().toISOString()}`;
    const response = await this.driveApi!.files.copy({
      fileId: input.spreadsheetId!,
      requestBody: {
        name,
        parents: input.destinationFolderId
          ? [input.destinationFolderId]
          : undefined,
        description: input.description,
      },
      fields: "id,name,createdTime,size",
      supportsAllDrives: true,
    });

    return this.success("create_snapshot", {
      snapshot: {
        id: response.data.id ?? "",
        name: response.data.name ?? name,
        createdAt: response.data.createdTime ?? new Date().toISOString(),
        spreadsheetId: input.spreadsheetId!,
        copyId: response.data.id ?? "",
        size: response.data.size ? Number(response.data.size) : undefined,
      },
    });
  }

  private async handleListSnapshots(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Snapshot' and trashed=false",
      spaces: "drive",
      fields: "files(id,name,createdTime,size),nextPageToken",
      pageSize: 50,
    });

    const snapshots = (response.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "",
      createdAt: f.createdTime ?? "",
      spreadsheetId: input.spreadsheetId!,
      copyId: f.id ?? "",
      size: f.size ? Number(f.size) : undefined,
    }));

    return this.success("list_snapshots", {
      snapshots,
      nextPageToken: response.data.nextPageToken ?? undefined,
    });
  }

  private async handleRestoreSnapshot(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    if (input.safety?.dryRun) {
      return this.success("restore_snapshot", {}, undefined, true);
    }

    // Copy the snapshot file to a new spreadsheet as a restored version
    const original = await this.driveApi!.files.get({
      fileId: input.spreadsheetId!,
      fields: "name",
      supportsAllDrives: true,
    });

    const response = await this.driveApi!.files.copy({
      fileId: input.snapshotId!,
      supportsAllDrives: true,
      requestBody: {
        name: `${original.data.name ?? "Restored Spreadsheet"} (restored from snapshot)`,
      },
      fields: "id,name,createdTime,size",
    });

    return this.success("restore_snapshot", {
      snapshot: response.data.id
        ? {
            id: input.snapshotId!,
            name: response.data.name ?? "",
            createdAt: response.data.createdTime ?? "",
            spreadsheetId: input.spreadsheetId!,
            copyId: response.data.id,
            size: response.data.size ? Number(response.data.size) : undefined,
          }
        : undefined,
    });
  }

  private async handleDeleteSnapshot(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    if (input.safety?.dryRun) {
      return this.success("delete_snapshot", {}, undefined, true);
    }

    await this.driveApi!.files.delete({
      fileId: input.snapshotId!,
      supportsAllDrives: true,
    });

    return this.success("delete_snapshot", {});
  }

  private async handleExportVersion(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    const format = input.format ?? "xlsx";
    const mimeMap: Record<string, string> = {
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
      pdf: "application/pdf",
      ods: "application/vnd.oasis.opendocument.spreadsheet", // Fixed: removed 'x-' prefix
    };
    const mimeType = mimeMap[format] ?? mimeMap["xlsx"];

    // NOTE: Google Drive API doesn't support exporting specific revisions directly.
    // files.export only works on the current version. To export a specific revision,
    // you would need to: (1) restore the revision first, (2) export, then (3) restore back.
    // This is too disruptive, so we only support exporting the current version.
    if (input.revisionId && input.revisionId !== "head") {
      return this.error({
        code: "FEATURE_UNAVAILABLE",
        message:
          'Exporting specific revisions is not supported. Use revisionId="head" or omit it to export the current version.',
        details: {
          revisionId: input.revisionId,
          reason:
            "Google Drive API does not support exporting historical revisions without restoring them first",
        },
        retryable: false,
        suggestedFix:
          "To export a specific revision: (1) Use restore_revision to restore it, (2) Use export_version without revisionId, (3) Optionally restore back to current version.",
      });
    }

    try {
      const response = await this.driveApi!.files.export(
        {
          fileId: input.spreadsheetId!,
          mimeType,
        },
        { responseType: "arraybuffer" },
      );

      const buffer = Buffer.from(response.data as ArrayBuffer);
      const exportData = buffer.toString("base64");

      return this.success("export_version", {
        exportData,
      });
    } catch (err) {
      // Check for specific error codes
      const error = err as { code?: number; message?: string; name?: string };

      if (error.code === 404) {
        return this.error({
          code: "NOT_FOUND",
          message: `Spreadsheet not found: ${input.spreadsheetId!}`,
          details: {
            spreadsheetId: input.spreadsheetId!,
          },
          retryable: false,
          resolution:
            "Verify the spreadsheetId is correct and you have permission to access it.",
        });
      }

      return this.error({
        code: "INTERNAL_ERROR",
        message: `Failed to export spreadsheet: ${error?.message ?? "unknown error"}`,
        details: {
          spreadsheetId: input.spreadsheetId!,
          format: input.format,
          errorType: error?.name,
          errorCode: error?.code,
        },
        retryable: true,
        retryStrategy: "exponential_backoff",
        resolution:
          "Retry the operation. If error persists, check spreadsheet permissions and Google Drive API status.",
      });
    }
  }

  /**
   * Compare two revisions (basic implementation)
   * Returns metadata comparison - full content diff requires export
   */
  private async handleCompare(
    input: SheetsVersionsInput,
  ): Promise<VersionsResponse> {
    if (!this.driveApi) {
      return this.error({
        code: "INTERNAL_ERROR",
        message: "Drive API not available for version operations",
        retryable: false,
      });
    }

    try {
      // Fetch both revisions
      const [rev1Response, rev2Response] = await Promise.all([
        this.driveApi.revisions.get({
          fileId: input.spreadsheetId!,
          revisionId: input.revisionId1 ?? "head~1", // Default to previous revision
          fields: "id,modifiedTime,lastModifyingUser,size",
        }),
        this.driveApi.revisions.get({
          fileId: input.spreadsheetId!,
          revisionId: input.revisionId2 ?? "head", // Default to current
          fields: "id,modifiedTime,lastModifyingUser,size",
        }),
      ]);

      const rev1 = rev1Response.data;
      const rev2 = rev2Response.data;

      // Return basic metadata comparison
      // Note: Full semantic diff (sheets added/removed/modified) requires downloading and parsing both versions
      return this.success("compare", {
        revisions: [this.mapRevision(rev1), this.mapRevision(rev2)],
        comparison: {
          // Basic comparison - full semantic diff would require downloading both versions
          cellChanges: undefined, // Cannot determine without full content analysis
        },
      });
    } catch (error) {
      return this.mapError(error);
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapRevision = (
    rev: drive_v3.Schema$Revision | undefined,
  ): NonNullable<VersionsSuccess["revision"]> => ({
    id: rev?.id ?? "",
    modifiedTime: rev?.modifiedTime ?? "",
    lastModifyingUser: rev?.lastModifyingUser
      ? {
          displayName: rev.lastModifyingUser.displayName ?? "",
          emailAddress: rev.lastModifyingUser.emailAddress ?? undefined,
        }
      : undefined,
    size: rev?.size ?? undefined,
    keepForever: rev?.keepForever ?? false,
  });

  /**
   * Return error for unavailable features
   *
   * Currently unavailable:
   * - compare: Requires complex diff algorithm for revision comparison
   *   Implementation would need semantic diff of spreadsheet state
   */
  private featureUnavailable(
    action: SheetsVersionsInput["action"],
  ): VersionsResponse {
    return this.error({
      code: "FEATURE_UNAVAILABLE",
      message: `${action} is unavailable in this server build. This feature requires additional implementation work.`,
      details: {
        action,
        reason:
          action === "compare"
            ? "Revision comparison requires semantic diff algorithm for spreadsheet state"
            : "Feature unavailable",
      },
      retryable: false,
      suggestedFix:
        "Perform this action via Google Drive UI or extend the handler with custom implementation.",
    });
  }
}
