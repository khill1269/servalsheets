/**
 * ServalSheets - Collaborate Handler
 *
 * Consolidated collaboration operations: sharing, comments, and version control
 * Merges: sharing.ts (8 actions) + comments.ts (10 actions) + versions.ts (10 actions) = 28 actions
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsCollaborateInput,
  SheetsCollaborateOutput,
  CollaborateResponse,
  CollaborateShareAddInput,
  CollaborateShareUpdateInput,
  CollaborateShareRemoveInput,
  CollaborateShareListInput,
  CollaborateShareGetInput,
  CollaborateShareTransferOwnershipInput,
  CollaborateShareSetLinkInput,
  CollaborateShareGetLinkInput,
  CollaborateCommentAddInput,
  CollaborateCommentUpdateInput,
  CollaborateCommentDeleteInput,
  CollaborateCommentListInput,
  CollaborateCommentGetInput,
  CollaborateCommentResolveInput,
  CollaborateCommentReopenInput,
  CollaborateCommentAddReplyInput,
  CollaborateCommentUpdateReplyInput,
  CollaborateCommentDeleteReplyInput,
  CollaborateVersionListRevisionsInput,
  CollaborateVersionGetRevisionInput,
  CollaborateVersionRestoreRevisionInput,
  CollaborateVersionKeepRevisionInput,
  CollaborateVersionCreateSnapshotInput,
  CollaborateVersionListSnapshotsInput,
  CollaborateVersionRestoreSnapshotInput,
  CollaborateVersionDeleteSnapshotInput,
  CollaborateVersionCompareInput,
  CollaborateVersionExportInput,
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';
import { ScopeValidator, ScopeCategory } from '../security/incremental-scope.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { createNotFoundError } from '../utils/error-factory.js';

type CollaborateSuccess = Extract<CollaborateResponse, { success: true }>;

export class CollaborateHandler extends BaseHandler<
  SheetsCollaborateInput,
  SheetsCollaborateOutput
> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super('sheets_collaborate', context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsCollaborateInput): Promise<SheetsCollaborateOutput> {
    // Track spreadsheet ID for better error messages
    this.trackSpreadsheetId(input.spreadsheetId);

    if (!this.driveApi) {
      return {
        response: this.error({
          code: 'INTERNAL_ERROR',
          message: 'Drive API not available - required for collaboration operations',
          details: {
            action: input.action,
            spreadsheetId: input.spreadsheetId,
            requiredScope: 'https://www.googleapis.com/auth/drive.file',
          },
          retryable: false,
          resolution:
            'Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.',
          resolutionSteps: [
            '1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup',
            '2. Ensure drive.file scope is included in OAuth scopes',
            '3. Re-authenticate if using OAuth',
          ],
        }),
      };
    }

    // Check for elevated access for sharing operations
    if (input.action.startsWith('share_') && !this.context.auth?.hasElevatedAccess) {
      // Use incremental scope consent system
      const validator = new ScopeValidator({
        scopes: this.context.auth?.scopes ?? [],
      });

      const operation = `sheets_collaborate.${input.action}`;
      const requirements = validator.getOperationRequirements(operation);

      // Generate authorization URL for incremental consent
      const authUrl = validator.generateIncrementalAuthUrl(
        requirements?.missing ?? ['https://www.googleapis.com/auth/drive']
      );

      // Return properly formatted error response
      return {
        response: this.error({
          code: 'PERMISSION_DENIED',
          message: requirements?.description ?? 'Sharing operations require full Drive access',
          category: 'auth',
          severity: 'high',
          retryable: false,
          retryStrategy: 'manual',
          details: {
            operation,
            requiredScopes: requirements?.required ?? ['https://www.googleapis.com/auth/drive'],
            currentScopes: this.context.auth?.scopes ?? [],
            missingScopes: requirements?.missing ?? ['https://www.googleapis.com/auth/drive'],
            authorizationUrl: authUrl,
            scopeCategory: requirements?.category ?? ScopeCategory.DRIVE_FULL,
          },
          resolution: 'Grant additional permissions to complete this operation.',
          resolutionSteps: [
            '1. Visit the authorization URL to approve required scopes',
            `2. Authorization URL: ${authUrl}`,
            '3. After approving, retry the operation',
          ],
        }),
      };
    }

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(input) as SheetsCollaborateInput;

    // Audit log: Elevated scope operation for sharing
    if (inferredRequest.action.startsWith('share_')) {
      const req = inferredRequest;
      logger.info('Elevated scope operation', {
        operation: `collaborate:${req.action}`,
        resourceId: req.spreadsheetId,
        scopes: this.context.auth?.scopes,
        category: 'audit',
      });
    }

    try {
      let response: CollaborateResponse;
      switch (inferredRequest.action) {
        // ========== SHARING ACTIONS ==========
        case 'share_add':
          response = await this.handleShareAdd(inferredRequest as CollaborateShareAddInput);
          break;
        case 'share_update':
          response = await this.handleShareUpdate(inferredRequest as CollaborateShareUpdateInput);
          break;
        case 'share_remove':
          response = await this.handleShareRemove(inferredRequest as CollaborateShareRemoveInput);
          break;
        case 'share_list':
          response = await this.handleShareList(inferredRequest as CollaborateShareListInput);
          break;
        case 'share_get':
          response = await this.handleShareGet(inferredRequest as CollaborateShareGetInput);
          break;
        case 'share_transfer_ownership':
          response = await this.handleShareTransferOwnership(
            inferredRequest as CollaborateShareTransferOwnershipInput
          );
          break;
        case 'share_set_link':
          response = await this.handleShareSetLink(inferredRequest as CollaborateShareSetLinkInput);
          break;
        case 'share_get_link':
          response = await this.handleShareGetLink(inferredRequest as CollaborateShareGetLinkInput);
          break;

        // ========== COMMENT ACTIONS ==========
        case 'comment_add':
          response = await this.handleCommentAdd(inferredRequest as CollaborateCommentAddInput);
          break;
        case 'comment_update':
          response = await this.handleCommentUpdate(
            inferredRequest as CollaborateCommentUpdateInput
          );
          break;
        case 'comment_delete':
          response = await this.handleCommentDelete(
            inferredRequest as CollaborateCommentDeleteInput
          );
          break;
        case 'comment_list':
          response = await this.handleCommentList(inferredRequest as CollaborateCommentListInput);
          break;
        case 'comment_get':
          response = await this.handleCommentGet(inferredRequest as CollaborateCommentGetInput);
          break;
        case 'comment_resolve':
          response = await this.handleCommentResolve(
            inferredRequest as CollaborateCommentResolveInput
          );
          break;
        case 'comment_reopen':
          response = await this.handleCommentReopen(
            inferredRequest as CollaborateCommentReopenInput
          );
          break;
        case 'comment_add_reply':
          response = await this.handleCommentAddReply(
            inferredRequest as CollaborateCommentAddReplyInput
          );
          break;
        case 'comment_update_reply':
          response = await this.handleCommentUpdateReply(
            inferredRequest as CollaborateCommentUpdateReplyInput
          );
          break;
        case 'comment_delete_reply':
          response = await this.handleCommentDeleteReply(
            inferredRequest as CollaborateCommentDeleteReplyInput
          );
          break;

        // ========== VERSION ACTIONS ==========
        case 'version_list_revisions':
          response = await this.handleVersionListRevisions(
            inferredRequest as CollaborateVersionListRevisionsInput
          );
          break;
        case 'version_get_revision':
          response = await this.handleVersionGetRevision(
            inferredRequest as CollaborateVersionGetRevisionInput
          );
          break;
        case 'version_restore_revision':
          response = await this.handleVersionRestoreRevision(
            inferredRequest as CollaborateVersionRestoreRevisionInput
          );
          break;
        case 'version_keep_revision':
          response = await this.handleVersionKeepRevision(
            inferredRequest as CollaborateVersionKeepRevisionInput
          );
          break;
        case 'version_create_snapshot':
          response = await this.handleVersionCreateSnapshot(
            inferredRequest as CollaborateVersionCreateSnapshotInput
          );
          break;
        case 'version_list_snapshots':
          response = await this.handleVersionListSnapshots(
            inferredRequest as CollaborateVersionListSnapshotsInput
          );
          break;
        case 'version_restore_snapshot':
          response = await this.handleVersionRestoreSnapshot(
            inferredRequest as CollaborateVersionRestoreSnapshotInput
          );
          break;
        case 'version_delete_snapshot':
          response = await this.handleVersionDeleteSnapshot(
            inferredRequest as CollaborateVersionDeleteSnapshotInput
          );
          break;
        case 'version_compare':
          response = await this.handleVersionCompare(
            inferredRequest as CollaborateVersionCompareInput
          );
          break;
        case 'version_export':
          response = await this.handleVersionExport(
            inferredRequest as CollaborateVersionExportInput
          );
          break;

        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(inferredRequest as { action: string }).action}`,
            retryable: false,
          });
      }

      // Apply verbosity filtering (LLM optimization) - uses base handler implementation
      const verbosity = inferredRequest.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(
        response,
        verbosity
      ) as CollaborateResponse;

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsCollaborateInput): Intent[] {
    return [];
  }

  // ============================================================
  // SHARING ACTIONS
  // ============================================================

  private async handleShareAdd(input: CollaborateShareAddInput): Promise<CollaborateResponse> {
    const requestBody: drive_v3.Schema$Permission = {
      type: input.type,
      role: input.role,
    };
    if (input.emailAddress) requestBody.emailAddress = input.emailAddress;
    if (input.domain) requestBody.domain = input.domain;
    if (input.expirationTime) requestBody.expirationTime = input.expirationTime;

    const response = await this.driveApi!.permissions.create({
      fileId: input.spreadsheetId!,
      sendNotificationEmail: input.sendNotification ?? true,
      emailMessage: input.emailMessage,
      requestBody,
      supportsAllDrives: true,
    });

    return this.success('share_add', {
      permission: this.mapPermission(response.data),
    });
  }

  private async handleShareUpdate(
    input: CollaborateShareUpdateInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('share_update', {}, undefined, true);
    }

    const response = await this.driveApi!.permissions.update({
      fileId: input.spreadsheetId!,
      permissionId: input.permissionId!,
      transferOwnership: input.role === 'owner',
      requestBody: {
        role: input.role,
        expirationTime: input.expirationTime,
      },
      supportsAllDrives: true,
    });

    return this.success('share_update', {
      permission: this.mapPermission(response.data),
    });
  }

  private async handleShareRemove(
    input: CollaborateShareRemoveInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('share_remove', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'share_remove',
        `Remove permission (ID: ${input.permissionId}) from spreadsheet ${input.spreadsheetId}. This will revoke access for the user. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
        });
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'share_remove',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.driveApi!.permissions.delete({
      fileId: input.spreadsheetId!,
      permissionId: input.permissionId!,
      supportsAllDrives: true,
    });

    return this.success('share_remove', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleShareList(input: CollaborateShareListInput): Promise<CollaborateResponse> {
    const response = await this.driveApi!.permissions.list({
      fileId: input.spreadsheetId!,
      supportsAllDrives: true,
      fields: 'permissions(id,type,role,emailAddress,domain,displayName,expirationTime)',
    });

    const permissions = (response.data.permissions ?? []).map(this.mapPermission);
    return this.success('share_list', { permissions });
  }

  private async handleShareGet(input: CollaborateShareGetInput): Promise<CollaborateResponse> {
    const response = await this.driveApi!.permissions.get({
      fileId: input.spreadsheetId!,
      permissionId: input.permissionId!,
      supportsAllDrives: true,
      fields: 'id,type,role,emailAddress,domain,displayName,expirationTime',
    });

    return this.success('share_get', {
      permission: this.mapPermission(response.data),
    });
  }

  private async handleShareTransferOwnership(
    input: CollaborateShareTransferOwnershipInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('share_transfer_ownership', {}, undefined, true);
    }

    const response = await this.driveApi!.permissions.create({
      fileId: input.spreadsheetId!,
      transferOwnership: true,
      sendNotificationEmail: true,
      requestBody: {
        type: 'user',
        role: 'owner',
        emailAddress: input.newOwnerEmail!,
      },
      supportsAllDrives: true,
    });

    return this.success('share_transfer_ownership', {
      permission: this.mapPermission(response.data),
    });
  }

  private async handleShareSetLink(
    input: CollaborateShareSetLinkInput
  ): Promise<CollaborateResponse> {
    if (!input.enabled) {
      // Disable: delete existing anyone permission if present
      const list = await this.driveApi!.permissions.list({
        fileId: input.spreadsheetId!,
        supportsAllDrives: true,
        fields: 'permissions(id,type)',
      });
      const anyone = (list.data.permissions ?? []).find((p) => p.type === 'anyone');
      if (anyone && !input.safety?.dryRun) {
        await this.driveApi!.permissions.delete({
          fileId: input.spreadsheetId!,
          permissionId: anyone.id!,
          supportsAllDrives: true,
        });
      }
      return this.success('share_set_link', {}, undefined, input.safety?.dryRun ?? false);
    }

    const response = await this.driveApi!.permissions.create({
      fileId: input.spreadsheetId!,
      supportsAllDrives: true,
      requestBody: {
        type: 'anyone',
        role: input.role ?? 'reader',
      },
    });

    return this.success('share_set_link', {
      permission: this.mapPermission(response.data),
    });
  }

  private async handleShareGetLink(
    input: CollaborateShareGetLinkInput
  ): Promise<CollaborateResponse> {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${input.spreadsheetId}`;
    const sharingLink = `${baseUrl}/edit?usp=sharing`;
    return this.success('share_get_link', { sharingLink });
  }

  // ============================================================
  // COMMENT ACTIONS
  // ============================================================

  private async handleCommentAdd(input: CollaborateCommentAddInput): Promise<CollaborateResponse> {
    const response = await this.driveApi!.comments.create({
      fileId: input.spreadsheetId!,
      requestBody: {
        content: input.content!,
        anchor: input.anchor,
      },
      fields:
        'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });

    return this.success('comment_add', { comment: this.mapComment(response.data) });
  }

  private async handleCommentUpdate(
    input: CollaborateCommentUpdateInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('comment_update', {}, undefined, true);
    }

    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      requestBody: { content: input.content! },
      fields:
        'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });

    return this.success('comment_update', { comment: this.mapComment(response.data) });
  }

  private async handleCommentDelete(
    input: CollaborateCommentDeleteInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('comment_delete', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'comment_delete',
        `Delete comment (ID: ${input.commentId}) from spreadsheet ${input.spreadsheetId}. This will permanently remove the comment and all its replies. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
        });
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'comment_delete',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.driveApi!.comments.delete({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
    });

    return this.success('comment_delete', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleCommentList(
    input: CollaborateCommentListInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.comments.list({
      fileId: input.spreadsheetId!,
      includeDeleted: input.includeDeleted ?? false,
      pageToken: input.startIndex ? String(input.startIndex) : undefined,
      pageSize: input.maxResults ?? 100,
      fields:
        'comments(id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor,replies(id,content,createdTime,author/displayName)))',
    });

    const comments = (response.data.comments ?? []).map(this.mapComment);
    return this.success('comment_list', { comments });
  }

  private async handleCommentGet(input: CollaborateCommentGetInput): Promise<CollaborateResponse> {
    const response = await this.driveApi!.comments.get({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      fields:
        'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor,replies(id,content,createdTime,author/displayName)',
    });

    return this.success('comment_get', { comment: this.mapComment(response.data) });
  }

  private async handleCommentResolve(
    input: CollaborateCommentResolveInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      requestBody: { resolved: true },
      fields:
        'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });
    return this.success('comment_resolve', { comment: this.mapComment(response.data) });
  }

  private async handleCommentReopen(
    input: CollaborateCommentReopenInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      requestBody: { resolved: false },
      fields:
        'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });
    return this.success('comment_reopen', { comment: this.mapComment(response.data) });
  }

  private async handleCommentAddReply(
    input: CollaborateCommentAddReplyInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.replies.create({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      requestBody: { content: input.content! },
      fields: 'id',
    });

    return this.success('comment_add_reply', { replyId: response.data.id ?? '' });
  }

  private async handleCommentUpdateReply(
    input: CollaborateCommentUpdateReplyInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('comment_update_reply', {}, undefined, true);
    }

    await this.driveApi!.replies.update({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      replyId: input.replyId!,
      requestBody: { content: input.content! },
    });

    return this.success('comment_update_reply', { replyId: input.replyId! });
  }

  private async handleCommentDeleteReply(
    input: CollaborateCommentDeleteReplyInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('comment_delete_reply', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'comment_delete_reply',
        `Delete reply (ID: ${input.replyId}) from comment ${input.commentId} in spreadsheet ${input.spreadsheetId}. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
        });
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'comment_delete_reply',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.driveApi!.replies.delete({
      fileId: input.spreadsheetId!,
      commentId: input.commentId!,
      replyId: input.replyId!,
    });

    return this.success('comment_delete_reply', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  // ============================================================
  // VERSION ACTIONS
  // ============================================================

  private async handleVersionListRevisions(
    input: CollaborateVersionListRevisionsInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.revisions.list({
      fileId: input.spreadsheetId!,
      pageSize: input.pageSize ?? 100,
      pageToken: input.pageToken,
      fields:
        'revisions(id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever),nextPageToken',
    });

    const revisions = (response.data.revisions ?? []).map(this.mapRevision);
    return this.success('version_list_revisions', {
      revisions,
      nextPageToken: response.data.nextPageToken ?? undefined,
    });
  }

  private async handleVersionGetRevision(
    input: CollaborateVersionGetRevisionInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.revisions.get({
      fileId: input.spreadsheetId!,
      revisionId: input.revisionId!,
      fields:
        'id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever',
    });

    return this.success('version_get_revision', {
      revision: this.mapRevision(response.data),
    });
  }

  private async handleVersionRestoreRevision(
    input: CollaborateVersionRestoreRevisionInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('version_restore_revision', {}, undefined, true);
    }

    // Sheets API doesn't support direct revision restore; suggest snapshot copy.
    return this.featureUnavailable('version_restore_revision');
  }

  private async handleVersionKeepRevision(
    input: CollaborateVersionKeepRevisionInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.revisions.update({
      fileId: input.spreadsheetId!,
      revisionId: input.revisionId!,
      requestBody: { keepForever: input.keepForever! },
      fields:
        'id,modifiedTime,lastModifyingUser/displayName,lastModifyingUser/emailAddress,size,keepForever',
    });

    return this.success('version_keep_revision', {
      revision: this.mapRevision(response.data),
    });
  }

  private async handleVersionCreateSnapshot(
    input: CollaborateVersionCreateSnapshotInput
  ): Promise<CollaborateResponse> {
    const name = input.name ?? `Snapshot - ${new Date().toISOString()}`;
    const response = await this.driveApi!.files.copy({
      fileId: input.spreadsheetId!,
      requestBody: {
        name,
        parents: input.destinationFolderId ? [input.destinationFolderId] : undefined,
        description: input.description,
      },
      fields: 'id,name,createdTime,size',
      supportsAllDrives: true,
    });

    return this.success('version_create_snapshot', {
      snapshot: {
        id: response.data.id ?? '',
        name: response.data.name ?? name,
        createdAt: response.data.createdTime ?? new Date().toISOString(),
        spreadsheetId: input.spreadsheetId!,
        copyId: response.data.id ?? '',
        size: response.data.size ? Number(response.data.size) : undefined,
      },
    });
  }

  private async handleVersionListSnapshots(
    input: CollaborateVersionListSnapshotsInput
  ): Promise<CollaborateResponse> {
    const response = await this.driveApi!.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Snapshot' and trashed=false",
      spaces: 'drive',
      fields: 'files(id,name,createdTime,size),nextPageToken',
      pageSize: 50,
    });

    const snapshots = (response.data.files ?? []).map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      createdAt: f.createdTime ?? '',
      spreadsheetId: input.spreadsheetId!,
      copyId: f.id ?? '',
      size: f.size ? Number(f.size) : undefined,
    }));

    return this.success('version_list_snapshots', {
      snapshots,
      nextPageToken: response.data.nextPageToken ?? undefined,
    });
  }

  private async handleVersionRestoreSnapshot(
    input: CollaborateVersionRestoreSnapshotInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('version_restore_snapshot', {}, undefined, true);
    }

    // Copy the snapshot file to a new spreadsheet as a restored version
    const original = await this.driveApi!.files.get({
      fileId: input.spreadsheetId!,
      fields: 'name',
      supportsAllDrives: true,
    });

    const response = await this.driveApi!.files.copy({
      fileId: input.snapshotId!,
      supportsAllDrives: true,
      requestBody: {
        name: `${original.data.name ?? 'Restored Spreadsheet'} (restored from snapshot)`,
      },
      fields: 'id,name,createdTime,size',
    });

    return this.success('version_restore_snapshot', {
      snapshot: response.data.id
        ? {
            id: input.snapshotId!,
            name: response.data.name ?? '',
            createdAt: response.data.createdTime ?? '',
            spreadsheetId: input.spreadsheetId!,
            copyId: response.data.id,
            size: response.data.size ? Number(response.data.size) : undefined,
          }
        : undefined,
    });
  }

  private async handleVersionDeleteSnapshot(
    input: CollaborateVersionDeleteSnapshotInput
  ): Promise<CollaborateResponse> {
    if (input.safety?.dryRun) {
      return this.success('version_delete_snapshot', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'version_delete_snapshot',
        `Delete Drive snapshot (ID: ${input.snapshotId}). This will permanently remove the snapshot file from Drive. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
        });
      }
    }

    // Create snapshot if requested (snapshot of snapshots - meta!)
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'version_delete_snapshot',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.driveApi!.files.delete({
      fileId: input.snapshotId!,
      supportsAllDrives: true,
    });

    return this.success('version_delete_snapshot', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleVersionCompare(
    input: CollaborateVersionCompareInput
  ): Promise<CollaborateResponse> {
    if (!this.driveApi) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available for version operations',
        retryable: false,
      });
    }

    try {
      // Fetch both revisions
      const [rev1Response, rev2Response] = await Promise.all([
        this.driveApi.revisions.get({
          fileId: input.spreadsheetId!,
          revisionId: input.revisionId1 ?? 'head~1', // Default to previous revision
          fields: 'id,modifiedTime,lastModifyingUser,size',
        }),
        this.driveApi.revisions.get({
          fileId: input.spreadsheetId!,
          revisionId: input.revisionId2 ?? 'head', // Default to current
          fields: 'id,modifiedTime,lastModifyingUser,size',
        }),
      ]);

      const rev1 = rev1Response.data;
      const rev2 = rev2Response.data;

      // Return basic metadata comparison
      // Note: Full semantic diff (sheets added/removed/modified) requires downloading and parsing both versions
      return this.success('version_compare', {
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

  private async handleVersionExport(
    input: CollaborateVersionExportInput
  ): Promise<CollaborateResponse> {
    const format = input.format ?? 'xlsx';
    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      pdf: 'application/pdf',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
    };
    const mimeType = mimeMap[format] ?? mimeMap['xlsx'];

    // NOTE: Google Drive API doesn't support exporting specific revisions directly.
    // files.export only works on the current version. To export a specific revision,
    // you would need to: (1) restore the revision first, (2) export, then (3) restore back.
    // This is too disruptive, so we only support exporting the current version.
    if (input.revisionId && input.revisionId !== 'head') {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message:
          'Exporting specific revisions is not supported. Use revisionId="head" or omit it to export the current version.',
        details: {
          revisionId: input.revisionId,
          reason:
            'Google Drive API does not support exporting historical revisions without restoring them first',
        },
        retryable: false,
        suggestedFix:
          'To export a specific revision: (1) Use restore_revision to restore it, (2) Use export_version without revisionId, (3) Optionally restore back to current version.',
      });
    }

    try {
      const response = await this.driveApi!.files.export(
        {
          fileId: input.spreadsheetId!,
          mimeType,
        },
        { responseType: 'arraybuffer' }
      );

      const buffer = Buffer.from(response.data as ArrayBuffer);
      const exportData = buffer.toString('base64');

      return this.success('version_export', {
        exportData,
      });
    } catch (err) {
      // Check for specific error codes
      const error = err as { code?: number; message?: string; name?: string };

      if (error.code === 404) {
        return this.error(
          createNotFoundError({
            resourceType: 'spreadsheet',
            resourceId: input.spreadsheetId!,
            searchSuggestion:
              'Verify the spreadsheet ID is correct and you have permission to access it',
          })
        );
      }

      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to export spreadsheet: ${error?.message ?? 'unknown error'}`,
        details: {
          spreadsheetId: input.spreadsheetId!,
          format: input.format,
          errorType: error?.name,
          errorCode: error?.code,
        },
        retryable: true,
        retryStrategy: 'exponential_backoff',
        resolution:
          'Retry the operation. If error persists, check spreadsheet permissions and Google Drive API status.',
      });
    }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private mapPermission = (
    p: drive_v3.Schema$Permission | undefined
  ): NonNullable<CollaborateSuccess['permission']> => ({
    id: p?.id ?? '',
    type: (p?.type as NonNullable<CollaborateSuccess['permission']>['type']) ?? 'user',
    role: (p?.role as NonNullable<CollaborateSuccess['permission']>['role']) ?? 'reader',
    emailAddress: p?.emailAddress ?? undefined,
    domain: p?.domain ?? undefined,
    displayName: p?.displayName ?? undefined,
    expirationTime: p?.expirationTime ?? undefined,
  });

  private mapComment = (
    c: drive_v3.Schema$Comment | undefined
  ): NonNullable<CollaborateSuccess['comment']> => ({
    id: c?.id ?? '',
    content: c?.content ?? '',
    author: {
      displayName: c?.author?.displayName ?? '',
      emailAddress: c?.author?.emailAddress ?? undefined,
    },
    createdTime: c?.createdTime ?? '',
    modifiedTime: c?.modifiedTime ?? '',
    resolved: c?.resolved ?? false,
    anchor: c?.anchor ?? undefined,
    replies: (c?.replies ?? []).map((r) => ({
      id: r.id ?? '',
      content: r.content ?? '',
      author: { displayName: r.author?.displayName ?? '' },
      createdTime: r.createdTime ?? '',
    })),
  });

  private mapRevision = (
    rev: drive_v3.Schema$Revision | undefined
  ): NonNullable<CollaborateSuccess['revision']> => ({
    id: rev?.id ?? '',
    modifiedTime: rev?.modifiedTime ?? '',
    lastModifyingUser: rev?.lastModifyingUser
      ? {
          displayName: rev.lastModifyingUser.displayName ?? '',
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
   * - version_restore_revision: Requires complex restore operation
   * - version_compare: Requires complex diff algorithm for revision comparison
   *   Implementation would need semantic diff of spreadsheet state
   */
  private featureUnavailable(action: SheetsCollaborateInput['action']): CollaborateResponse {
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: `${action} is unavailable in this server build. This feature requires additional implementation work.`,
      details: {
        action,
        reason:
          action === 'version_compare'
            ? 'Revision comparison requires semantic diff algorithm for spreadsheet state'
            : action === 'version_restore_revision'
              ? 'Revision restore requires complex operation not supported by Drive API'
              : 'Feature unavailable',
      },
      retryable: false,
      suggestedFix:
        'Perform this action via Google Drive UI or extend the handler with custom implementation.',
    });
  }
}
