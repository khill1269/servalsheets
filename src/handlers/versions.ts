/**
 * ServalSheets - Versions Handler
 *
 * Handles sheets_versions tool (Drive revisions/snapshots)
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsVersionsInput,
  SheetsVersionsOutput,
  VersionsAction,
  VersionsResponse,
} from '../schemas/index.js';
import type { CreateTaskResult } from '@modelcontextprotocol/sdk/types.js';
import { getRequestLogger } from '../utils/request-context.js';

type VersionsSuccess = Extract<VersionsResponse, { success: true }>;

export class VersionsHandler extends BaseHandler<SheetsVersionsInput, SheetsVersionsOutput> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super('sheets_versions', context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsVersionsInput): Promise<SheetsVersionsOutput> {
    if (!this.driveApi) {
      return {
        response: this.error({
          code: 'INTERNAL_ERROR',
          message: 'Drive API not available - required for version operations',
          details: {
            action: input.request.action,
            spreadsheetId: input.request.spreadsheetId,
            requiredScope: 'https://www.googleapis.com/auth/drive.file',
          },
          retryable: false,
          resolution: 'Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.',
          resolutionSteps: [
            '1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup',
            '2. Ensure drive.file scope is included in OAuth scopes',
            '3. Re-authenticate if using OAuth',
          ],
        }),
      };
    }

    const { request } = input;

    try {
      const response = await this.executeAction(request);
      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsVersionsInput): Intent[] {
    return [];
  }


  /**
   * Execute action and return response (extracted for task/non-task paths)
   */
  private async executeAction(request: VersionsAction): Promise<VersionsResponse> {
    switch (request.action) {
      case 'list_revisions':
        return await this.handleListRevisions(request);
      case 'get_revision':
        return await this.handleGetRevision(request);
      case 'restore_revision':
        return await this.handleRestoreRevision(request);
      case 'keep_revision':
        return await this.handleKeepRevision(request);
      case 'create_snapshot':
        return await this.handleCreateSnapshot(request);
      case 'list_snapshots':
        return await this.handleListSnapshots(request);
      case 'restore_snapshot':
        return await this.handleRestoreSnapshot(request);
      case 'delete_snapshot':
        return await this.handleDeleteSnapshot(request);
      case 'compare':
        return this.featureUnavailable('compare');
      case 'export_version':
        return await this.handleExportVersion(request);
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleListRevisions(
    input: Extract<VersionsAction, { action: 'list_revisions' }>
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.revisions.list({
      fileId: input.spreadsheetId,
      pageSize: input.pageSize ?? 100,
      pageToken: input.pageToken,
      fields: 'revisions(id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever),nextPageToken',
    });

    const revisions = (response.data.revisions ?? []).map(this.mapRevision);
    return this.success('list_revisions', {
      revisions,
      nextPageToken: response.data.nextPageToken ?? undefined,
    });
  }

  private async handleGetRevision(
    input: Extract<VersionsAction, { action: 'get_revision' }>
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.revisions.get({
      fileId: input.spreadsheetId,
      revisionId: input.revisionId,
      fields: 'id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever',
    });

    return this.success('get_revision', { revision: this.mapRevision(response.data) });
  }

  private async handleRestoreRevision(
    input: Extract<VersionsAction, { action: 'restore_revision' }>
  ): Promise<VersionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('restore_revision', {}, undefined, true);
    }

    // Sheets API doesn't support direct revision restore; suggest snapshot copy.
    return this.featureUnavailable('restore_revision');
  }

  private async handleKeepRevision(
    input: Extract<VersionsAction, { action: 'keep_revision' }>
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.revisions.update({
      fileId: input.spreadsheetId,
      revisionId: input.revisionId,
      requestBody: { keepForever: input.keepForever },
      fields: 'id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever',
    });

    return this.success('keep_revision', { revision: this.mapRevision(response.data) });
  }

  private async handleCreateSnapshot(
    input: Extract<VersionsAction, { action: 'create_snapshot' }>
  ): Promise<VersionsResponse> {
    const name = input.name ?? `Snapshot - ${new Date().toISOString()}`;
    const response = await this.driveApi!.files.copy({
      fileId: input.spreadsheetId,
      requestBody: {
        name,
        parents: input.destinationFolderId ? [input.destinationFolderId] : undefined,
        description: input.description,
      },
      fields: 'id,name,createdTime,size',
      supportsAllDrives: true,
    });

    return this.success('create_snapshot', {
      snapshot: {
        id: response.data.id ?? '',
        name: response.data.name ?? name,
        createdAt: response.data.createdTime ?? new Date().toISOString(),
        spreadsheetId: input.spreadsheetId,
        copyId: response.data.id ?? '',
        size: response.data.size ? Number(response.data.size) : undefined,
      },
    });
  }

  private async handleListSnapshots(
    input: Extract<VersionsAction, { action: 'list_snapshots' }>
  ): Promise<VersionsResponse> {
    const response = await this.driveApi!.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Snapshot' and trashed=false",
      spaces: 'drive',
      fields: 'files(id,name,createdTime,size),nextPageToken',
      pageSize: 50,
    });

    const snapshots = (response.data.files ?? []).map(f => ({
      id: f.id ?? '',
      name: f.name ?? '',
      createdAt: f.createdTime ?? '',
      spreadsheetId: input.spreadsheetId,
      copyId: f.id ?? '',
      size: f.size ? Number(f.size) : undefined,
    }));

    return this.success('list_snapshots', { snapshots, nextPageToken: response.data.nextPageToken ?? undefined });
  }

  private async handleRestoreSnapshot(
    input: Extract<VersionsAction, { action: 'restore_snapshot' }>
  ): Promise<VersionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('restore_snapshot', {}, undefined, true);
    }

    // Copy the snapshot file to a new spreadsheet as a restored version
    const original = await this.driveApi!.files.get({
      fileId: input.spreadsheetId,
      fields: 'name',
      supportsAllDrives: true,
    });

    const response = await this.driveApi!.files.copy({
      fileId: input.snapshotId,
      supportsAllDrives: true,
      requestBody: {
        name: `${original.data.name ?? 'Restored Spreadsheet'} (restored from snapshot)`,
      },
      fields: 'id,name,createdTime,size',
    });

    return this.success('restore_snapshot', {
      snapshot: response.data.id ? {
        id: input.snapshotId,
        name: response.data.name ?? '',
        createdAt: response.data.createdTime ?? '',
        spreadsheetId: input.spreadsheetId,
        copyId: response.data.id,
        size: response.data.size ? Number(response.data.size) : undefined,
      } : undefined,
    });
  }

  private async handleDeleteSnapshot(
    input: Extract<VersionsAction, { action: 'delete_snapshot' }>
  ): Promise<VersionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_snapshot', {}, undefined, true);
    }

    await this.driveApi!.files.delete({
      fileId: input.snapshotId,
      supportsAllDrives: true,
    });

    return this.success('delete_snapshot', {});
  }

  private async handleExportVersion(
    input: Extract<VersionsAction, { action: 'export_version' }>
  ): Promise<VersionsResponse> {
    const format = input.format ?? 'xlsx';
    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      pdf: 'application/pdf',
      ods: 'application/x-vnd.oasis.opendocument.spreadsheet',
    };
    const mimeType = mimeMap[format] ?? mimeMap['xlsx'];

    try {
      const response = await this.driveApi!.files.export(
        {
          fileId: input.spreadsheetId,
          mimeType,
        },
        { responseType: 'arraybuffer' }
      );

      const buffer = Buffer.from(response.data as ArrayBuffer);
      const exportData = buffer.toString('base64');

      return this.success('export_version', {
        exportData,
      });
    } catch (err) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to export spreadsheet: ${(err as Error)?.message ?? 'unknown error'}`,
        details: {
          spreadsheetId: input.spreadsheetId,
          format: input.format,
          errorType: (err as Error)?.name,
        },
        retryable: true,
        retryStrategy: 'exponential_backoff',
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and Google Drive API status.',
      });
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapRevision = (rev: drive_v3.Schema$Revision | undefined): NonNullable<VersionsSuccess['revision']> => ({
    id: rev?.id ?? '',
    modifiedTime: rev?.modifiedTime ?? '',
    lastModifyingUser: rev?.lastModifyingUser ? {
      displayName: rev.lastModifyingUser.displayName ?? '',
      emailAddress: rev.lastModifyingUser.emailAddress ?? undefined,
    } : undefined,
    size: rev?.size ?? undefined,
    keepForever: rev?.keepForever ?? false,
  });

  private featureUnavailable(action: VersionsAction['action']): VersionsResponse {
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: `${action} is not implemented in this server build`,
      retryable: false,
      suggestedFix: 'Perform this action via Google Drive UI or extend the handler.',
    });
  }
}
