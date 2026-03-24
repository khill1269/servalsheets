/**
 * ServalSheets - Collaborate Handler
 *
 * Consolidated collaboration operations: sharing, comments, version control, and approvals
 * Merges: sharing.ts (8 actions) + comments.ts (10 actions) + versions.ts (11 actions) + approvals (7 actions) + access_proposals (2 actions) + labels (3 actions) = 41 actions
 * MCP Protocol: 2025-11-25
 *
 * Action implementations decomposed into collaborate-actions/ submodules.
 */

import { ErrorCodes } from './error-codes.js';
import type { drive_v3, sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsCollaborateInput,
  SheetsCollaborateOutput,
  CollaborateResponse,
  CollaborateRequest,
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
  CollaborateVersionSnapshotStatusInput,
  CollaborateApprovalCreateInput,
  CollaborateApprovalApproveInput,
  CollaborateApprovalRejectInput,
  CollaborateApprovalGetStatusInput,
  CollaborateApprovalListPendingInput,
  CollaborateApprovalDelegateInput,
  CollaborateApprovalCancelInput,
  CollaborateListAccessProposalsInput,
  CollaborateResolveAccessProposalInput,
  CollaborateLabelListInput,
  CollaborateLabelApplyInput,
  CollaborateLabelRemoveInput,
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';
import {
  ScopeValidator,
  ScopeCategory,
  IncrementalScopeRequiredError,
} from '../security/incremental-scope.js';
import type { CollaborateHandlerAccess } from './collaborate-actions/internal.js';
import {
  handleShareAddAction,
  handleShareUpdateAction,
  handleShareRemoveAction,
  handleShareListAction,
  handleShareGetAction,
  handleShareTransferOwnershipAction,
  handleShareSetLinkAction,
  handleShareGetLinkAction,
} from './collaborate-actions/sharing.js';
import {
  handleCommentAddAction,
  handleCommentUpdateAction,
  handleCommentDeleteAction,
  handleCommentListAction,
  handleCommentGetAction,
  handleCommentResolveAction,
  handleCommentReopenAction,
  handleCommentAddReplyAction,
  handleCommentUpdateReplyAction,
  handleCommentDeleteReplyAction,
} from './collaborate-actions/comments.js';
import {
  handleVersionListRevisionsAction,
  handleVersionGetRevisionAction,
  handleVersionRestoreRevisionAction,
  handleVersionKeepRevisionAction,
  handleVersionCreateSnapshotAction,
  handleVersionSnapshotStatusAction,
  handleVersionListSnapshotsAction,
  handleVersionRestoreSnapshotAction,
  handleVersionDeleteSnapshotAction,
  handleVersionCompareAction,
  handleVersionExportAction,
} from './collaborate-actions/versions.js';
import {
  handleApprovalCreateAction,
  handleApprovalApproveAction,
  handleApprovalRejectAction,
  handleApprovalGetStatusAction,
  handleApprovalListPendingAction,
  handleApprovalDelegateAction,
  handleApprovalCancelAction,
} from './collaborate-actions/approvals.js';
import {
  handleListAccessProposalsAction,
  handleResolveAccessProposalAction,
  handleLabelListAction,
  handleLabelApplyAction,
  handleLabelRemoveAction,
} from './collaborate-actions/access-labels.js';

type CollaborateSuccess = Extract<CollaborateResponse, { success: true }>;

export class CollaborateHandler extends BaseHandler<
  SheetsCollaborateInput,
  SheetsCollaborateOutput
> {
  private driveApi: drive_v3.Drive | undefined;
  private sheetsApi: sheets_v4.Sheets | undefined;

  constructor(
    context: HandlerContext,
    driveApi?: drive_v3.Drive,
    sheetsApi?: sheets_v4.Sheets
  ) {
    super('sheets_collaborate', context);
    this.driveApi = driveApi;
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsCollaborateInput): Promise<SheetsCollaborateOutput> {
    // 1. Unwrap request from wrapper
    const rawReq = unwrapRequest<SheetsCollaborateInput['request']>(input);
    this.trackSpreadsheetId(rawReq.spreadsheetId);

    // 2. Validate Drive API availability
    if (!this.driveApi) {
      return {
        response: this.error({
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Drive API not available - required for collaboration operations',
          details: {
            action: rawReq.action,
            spreadsheetId: rawReq.spreadsheetId,
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

    // 3. Check scope sufficiency for sharing operations
    if (rawReq.action.startsWith('share_')) {
      const validator = new ScopeValidator({
        scopes: this.context.auth?.scopes ?? [],
      });

      const operation = `sheets_collaborate.${rawReq.action}`;

      if (!validator.hasRequiredScopes(operation)) {
        const requirements = validator.getOperationRequirements(operation);
        const authUrl = validator.generateIncrementalAuthUrl(
          requirements?.missing ?? ['https://www.googleapis.com/auth/drive']
        );

        return {
          response: this.error({
            code: ErrorCodes.PERMISSION_DENIED,
            message:
              requirements?.description ?? 'Sharing operations require additional Drive access',
            category: 'auth',
            severity: 'high',
            retryable: false,
            retryStrategy: 'manual',
            suggestedFix:
              'Grant additional permissions via the authorization URL to complete this operation',
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
    }

    // 4. Infer missing parameters from context
    const inferredReq = this.inferRequestParameters(rawReq) as CollaborateRequest;

    // 5. Validate scopes for the operation
    const operation = `sheets_collaborate.${inferredReq.action}`;
    const validator = new ScopeValidator({
      scopes: this.context.auth?.scopes ?? [],
    });

    try {
      validator.validateOperation(operation);
    } catch (error) {
      if (error instanceof IncrementalScopeRequiredError) {
        return {
          response: this.error({
            code: ErrorCodes.INCREMENTAL_SCOPE_REQUIRED,
            message: error.message,
            category: 'auth',
            retryable: true,
            retryStrategy: 'reauthorize',
            details: {
              operation: error.operation,
              requiredScopes: error.requiredScopes,
              currentScopes: error.currentScopes,
              missingScopes: error.missingScopes,
              authorizationUrl: error.authorizationUrl,
            },
          }),
        };
      }
      throw error;
    }

    // 6. Audit log: Elevated scope operation for sharing
    if (inferredReq.action.startsWith('share_')) {
      logger.info('Elevated scope operation', {
        operation: `collaborate:${rawReq.action}`,
        resourceId: rawReq.spreadsheetId,
        scopes: this.context.auth?.scopes,
        category: 'audit',
      });
    }

    try {
      // 7. Build handler access object for submodule delegation
      const ha = this.buildHandlerAccess();

      // 8. Dispatch to action handler
      const req = inferredReq as CollaborateRequest;
      let response: CollaborateResponse;

      switch (req.action) {
        // ========== SHARING ACTIONS ==========
        case 'share_add':
          response = await handleShareAddAction(req as CollaborateShareAddInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'share_update':
          response = await handleShareUpdateAction(req as CollaborateShareUpdateInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'share_remove':
          response = await handleShareRemoveAction(req as CollaborateShareRemoveInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'share_list':
          response = await handleShareListAction(req as CollaborateShareListInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'share_get':
          response = await handleShareGetAction(req as CollaborateShareGetInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'share_transfer_ownership':
          response = await handleShareTransferOwnershipAction(
            req as CollaborateShareTransferOwnershipInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              mapPermission: ha.mapPermission,
              success: ha.success,
              error: ha.error,
            }
          );
          break;
        case 'share_set_link':
          response = await handleShareSetLinkAction(req as CollaborateShareSetLinkInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'share_get_link':
          response = await handleShareGetLinkAction(req as CollaborateShareGetLinkInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapPermission: ha.mapPermission,
            success: ha.success,
            error: ha.error,
          });
          break;

        // ========== COMMENT ACTIONS ==========
        case 'comment_add':
          response = await handleCommentAddAction(req as CollaborateCommentAddInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_update':
          response = await handleCommentUpdateAction(req as CollaborateCommentUpdateInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_delete':
          response = await handleCommentDeleteAction(req as CollaborateCommentDeleteInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_list':
          response = await handleCommentListAction(req as CollaborateCommentListInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_get':
          response = await handleCommentGetAction(req as CollaborateCommentGetInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_resolve':
          response = await handleCommentResolveAction(req as CollaborateCommentResolveInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_reopen':
          response = await handleCommentReopenAction(req as CollaborateCommentReopenInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_add_reply':
          response = await handleCommentAddReplyAction(req as CollaborateCommentAddReplyInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            mapComment: ha.mapComment,
            success: ha.success,
            error: ha.error,
          });
          break;
        case 'comment_update_reply':
          response = await handleCommentUpdateReplyAction(
            req as CollaborateCommentUpdateReplyInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              mapComment: ha.mapComment,
              success: ha.success,
              error: ha.error,
            }
          );
          break;
        case 'comment_delete_reply':
          response = await handleCommentDeleteReplyAction(
            req as CollaborateCommentDeleteReplyInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              mapComment: ha.mapComment,
              success: ha.success,
              error: ha.error,
            }
          );
          break;

        // ========== VERSION ACTIONS ==========
        case 'version_list_revisions':
          response = await handleVersionListRevisionsAction(
            req as CollaborateVersionListRevisionsInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_get_revision':
          response = await handleVersionGetRevisionAction(
            req as CollaborateVersionGetRevisionInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_restore_revision':
          response = await handleVersionRestoreRevisionAction(
            req as CollaborateVersionRestoreRevisionInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_keep_revision':
          response = await handleVersionKeepRevisionAction(
            req as CollaborateVersionKeepRevisionInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_create_snapshot':
          response = await handleVersionCreateSnapshotAction(
            req as CollaborateVersionCreateSnapshotInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_snapshot_status':
          response = await handleVersionSnapshotStatusAction(
            req as CollaborateVersionSnapshotStatusInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_list_snapshots':
          response = await handleVersionListSnapshotsAction(
            req as CollaborateVersionListSnapshotsInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_restore_snapshot':
          response = await handleVersionRestoreSnapshotAction(
            req as CollaborateVersionRestoreSnapshotInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_delete_snapshot':
          response = await handleVersionDeleteSnapshotAction(
            req as CollaborateVersionDeleteSnapshotInput,
            {
              driveApi: ha.driveApi,
              context: ha.context,
              checkOperationScopes: ha.checkOperationScopes,
              success: ha.success,
              error: ha.error,
              mapError: ha.mapError,
            }
          );
          break;
        case 'version_compare':
          response = await handleVersionCompareAction(req as CollaborateVersionCompareInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            checkOperationScopes: ha.checkOperationScopes,
            success: ha.success,
            error: ha.error,
            mapError: ha.mapError,
          });
          break;
        case 'version_export':
          response = await handleVersionExportAction(req as CollaborateVersionExportInput, {
            driveApi: ha.driveApi,
            context: ha.context,
            checkOperationScopes: ha.checkOperationScopes,
            success: ha.success,
            error: ha.error,
            mapError: ha.mapError,
          });
          break;

        // ========== APPROVAL ACTIONS ==========
        case 'approval_create':
          response = await handleApprovalCreateAction(req as CollaborateApprovalCreateInput, {
            driveApi: ha.driveApi,
            sheetsApi: ha.sheetsApi,
            context: ha.context,
            mapError: ha.mapError,
            error: ha.error,
          });
          break;
        case 'approval_approve':
          response = await handleApprovalApproveAction(req as CollaborateApprovalApproveInput, {
            driveApi: ha.driveApi,
            sheetsApi: ha.sheetsApi,
            context: ha.context,
            mapError: ha.mapError,
            error: ha.error,
          });
          break;
        case 'approval_reject':
          response = await handleApprovalRejectAction(req as CollaborateApprovalRejectInput, {
            driveApi: ha.driveApi,
            sheetsApi: ha.sheetsApi,
            context: ha.context,
            mapError: ha.mapError,
            error: ha.error,
          });
          break;
        case 'approval_get_status':
          response = await handleApprovalGetStatusAction(req as CollaborateApprovalGetStatusInput, {
            driveApi: ha.driveApi,
            sheetsApi: ha.sheetsApi,
            context: ha.context,
            mapError: ha.mapError,
            error: ha.error,
          });
          break;
        case 'approval_list_pending':
          response = await handleApprovalListPendingAction(
            req as CollaborateApprovalListPendingInput,
            {
              driveApi: ha.driveApi,
              sheetsApi: ha.sheetsApi,
              context: ha.context,
              mapError: ha.mapError,
              error: ha.error,
            }
          );
          break;
        case 'approval_delegate':
          response = await handleApprovalDelegateAction(req as CollaborateApprovalDelegateInput, {
            driveApi: ha.driveApi,
            sheetsApi: ha.sheetsApi,
            context: ha.context,
            mapError: ha.mapError,
            error: ha.error,
          });
          break;
        case 'approval_cancel':
          response = await handleApprovalCancelAction(req as CollaborateApprovalCancelInput, {
            driveApi: ha.driveApi,
            sheetsApi: ha.sheetsApi,
            context: ha.context,
            mapError: ha.mapError,
            error: ha.error,
          });
          break;

        // ========== ACCESS PROPOSAL & LABEL ACTIONS ==========
        case 'list_access_proposals':
          response = await handleListAccessProposalsAction(
            req as CollaborateListAccessProposalsInput,
            {
              driveApi: ha.driveApi,
              success: ha.success,
            }
          );
          break;
        case 'resolve_access_proposal':
          response = await handleResolveAccessProposalAction(
            req as CollaborateResolveAccessProposalInput,
            {
              driveApi: ha.driveApi,
              success: ha.success,
            }
          );
          break;
        case 'label_list':
          response = await handleLabelListAction(req as CollaborateLabelListInput, {
            driveApi: ha.driveApi,
            success: ha.success,
          });
          break;
        case 'label_apply':
          response = await handleLabelApplyAction(req as CollaborateLabelApplyInput, {
            driveApi: ha.driveApi,
            success: ha.success,
          });
          break;
        case 'label_remove':
          response = await handleLabelRemoveAction(req as CollaborateLabelRemoveInput, {
            driveApi: ha.driveApi,
            success: ha.success,
          });
          break;

        default: {
          const _exhaustiveCheck: never = req.action;
          response = this.error({
            code: ErrorCodes.INVALID_PARAMS,
            message: `Unknown action: ${String(_exhaustiveCheck)}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
      }

      // 9. Apply verbosity filtering (LLM optimization)
      const verbosity = inferredReq.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(
        response,
        verbosity
      ) as CollaborateResponse;

      // 10. Return wrapped response
      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsCollaborateInput): Intent[] {
    return [];
  }

  /**
   * Build the handler access object that submodule functions use instead of `this`.
   */
  private buildHandlerAccess(): CollaborateHandlerAccess {
    return {
      driveApi: this.driveApi!,
      sheetsApi: this.sheetsApi,
      context: this.context,
      mapPermission: (p) => this._mapPermission(p),
      mapComment: (c) => this._mapComment(c),
      checkOperationScopes: (operation) => this._checkOperationScopes(operation),
      success: (action, data, mutation, dryRun) => this.success(action, data, mutation, dryRun),
      error: (e) => this.error(e),
      mapError: (err) => this.mapError(err),
    };
  }

  /**
   * Map Drive API Permission to collaborate response format
   */
  private _mapPermission = (
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

  /**
   * Map Drive API Comment to collaborate response format
   */
  private _mapComment = (
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

  /**
   * Check if operation has required scopes, throw if not
   */
  private _checkOperationScopes(operation: string): void {
    const validator = new ScopeValidator({
      scopes: this.context.auth?.scopes ?? [],
    });

    try {
      validator.validateOperation(operation);
    } catch (error) {
      if (error instanceof IncrementalScopeRequiredError) {
        throw error;
      }
      throw error;
    }
  }
}
