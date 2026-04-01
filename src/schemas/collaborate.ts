/**
 * Tool: sheets_collaborate
 * Consolidated collaboration operations: sharing, comments, version control, and approvals
 * Merges: sharing.ts (8 actions) + comments.ts (10 actions) + versions.ts (11 actions) + approvals (7 actions) = 41 actions
 */

import { z } from '../lib/schema.js';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  PermissionRoleSchema,
  PermissionTypeSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

// ========== SHARED SCHEMAS ==========

const PermissionSchema = z.object({
  id: z.string(),
  type: PermissionTypeSchema,
  role: PermissionRoleSchema,
  emailAddress: z.string().email('Invalid email address format').optional(),
  domain: z.string().optional(),
  displayName: z.string().optional(),
  expirationTime: z.string().optional(),
});

const CommentSchema = z.object({
  id: z.string(),
  content: z.string(),
  author: z.object({
    displayName: z.string(),
    emailAddress: z.string().optional(),
  }),
  createdTime: z.string(),
  modifiedTime: z.string(),
  resolved: z.boolean(),
  anchor: z.string().optional(),
  replies: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        author: z.object({
          displayName: z.string(),
        }),
        createdTime: z.string(),
      })
    )
    .optional(),
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
  size: z.coerce.number().int().optional(),
});

const ApprovalSchema = z.object({
  approvalId: z.string(),
  spreadsheetId: z.string(),
  range: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  requester: z.object({
    displayName: z.string(),
    emailAddress: z.string().optional(),
  }),
  approvers: z.array(z.string()),
  approvedBy: z.array(z.string()),
  requiredApprovals: z.number().int(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  message: z.string().optional(),
});

// Per-action schemas for the 41 collaborate actions

const CommonFieldsSchema = z.object({
  safety: SafetyOptionsSchema.optional().describe(
    'Safety options like dryRun (applies to all destructive operations)'
  ),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
});

// ========== SHARING ACTIONS (8) ==========

const ShareAddSchema = CommonFieldsSchema.extend({
  action: z
    .literal('share_add')
    .describe('Share the spreadsheet with a user, group, domain, or anyone'),
  spreadsheetId: SpreadsheetIdSchema,
  type: PermissionTypeSchema.describe('Permission type: user, group, domain, or anyone'),
  role: PermissionRoleSchema.describe('Permission role: owner, writer, commenter, or reader'),
  emailAddress: z
    .string()
    .email()
    .optional()
    .describe('Email address (required when type is user or group)'),
  domain: z
    .string()
    .optional()
    .describe('Domain to share with (required when type is domain, e.g. "example.com")'),
  sendNotification: z
    .boolean()
    .optional()
    .default(true)
    .describe('Send email notification to user'),
  emailMessage: z.string().optional().describe('Custom message in notification email'),
  expirationTime: z.string().optional().describe('ISO 8601 expiration time'),
}).superRefine((data, ctx) => {
  if ((data.type === 'user' || data.type === 'group') && !data.emailAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['emailAddress'],
      message: `emailAddress is required when type is '${data.type}'`,
    });
  }
  if (data.type === 'domain') {
    if (!data.domain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domain'],
        message: "domain is required when type is 'domain' (e.g. 'example.com')",
      });
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(data.domain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domain'],
        message: 'domain must be a valid domain name (e.g. "example.com", "corp.example.org")',
      });
    }
  }
});

const ShareUpdateSchema = CommonFieldsSchema.extend({
  action: z.literal('share_update').describe('Update an existing permission'),
  spreadsheetId: SpreadsheetIdSchema,
  permissionId: z.string().describe('Permission ID to update'),
  role: PermissionRoleSchema.describe('New permission role'),
  expirationTime: z.string().optional().describe('ISO 8601 expiration time'),
});

const ShareRemoveSchema = CommonFieldsSchema.extend({
  action: z.literal('share_remove').describe('Remove a permission from the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
  permissionId: z.string().describe('Permission ID to remove'),
});

const ShareListSchema = CommonFieldsSchema.extend({
  action: z.literal('share_list').describe('List all permissions for the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
});

const ShareGetSchema = CommonFieldsSchema.extend({
  action: z.literal('share_get').describe('Get a specific permission'),
  spreadsheetId: SpreadsheetIdSchema,
  permissionId: z.string().describe('Permission ID to retrieve'),
});

const ShareTransferOwnershipSchema = CommonFieldsSchema.extend({
  action: z
    .literal('share_transfer_ownership')
    .describe('Transfer ownership of the spreadsheet to another user'),
  spreadsheetId: SpreadsheetIdSchema,
  newOwnerEmail: z.string().email().describe('Email of the new owner'),
});

const ShareSetLinkSchema = CommonFieldsSchema.extend({
  action: z.literal('share_set_link').describe('Configure link sharing settings'),
  spreadsheetId: SpreadsheetIdSchema,
  enabled: z.boolean().describe('Enable (true) or disable (false) link sharing'),
  role: PermissionRoleSchema.optional().describe('Role for link-based access'),
  allowFileDiscovery: z
    .boolean()
    .optional()
    .describe('Whether the file can be found via search (only for type "anyone" or "domain")'),
});

const ShareGetLinkSchema = CommonFieldsSchema.extend({
  action: z.literal('share_get_link').describe('Get the current link sharing settings'),
  spreadsheetId: SpreadsheetIdSchema,
});

// ========== COMMENT ACTIONS (10) ==========

const CommentAddSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_add').describe('Add a new comment to the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
  content: z.string().describe('Comment text'),
  anchor: z
    .string()
    .optional()
    .describe('Cell or range reference where comment is anchored (e.g. "A1")'),
});

const CommentUpdateSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_update').describe('Update an existing comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID to update'),
  content: z.string().describe('New comment text'),
});

const CommentDeleteSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_delete').describe('Delete a comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID to delete'),
});

const CommentListSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_list').describe('List all comments on the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
  includeDeleted: z.boolean().optional().default(false).describe('Include deleted comments'),
  commentPageToken: z
    .string()
    .optional()
    .describe('Opaque page token from previous comment_list response nextPageToken'),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Maximum number of comments to return'),
});

const CommentGetSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_get').describe('Get a specific comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID to retrieve'),
});

const CommentResolveSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_resolve').describe('Mark a comment as resolved'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID to resolve'),
});

const CommentReopenSchema = CommonFieldsSchema.extend({
  action: z.literal('comment_reopen').describe('Reopen a resolved comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID to reopen'),
});

const CommentAddReplySchema = CommonFieldsSchema.extend({
  action: z.literal('comment_add_reply').describe('Add a reply to an existing comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID to reply to'),
  content: z.string().describe('Reply text'),
});

const CommentUpdateReplySchema = CommonFieldsSchema.extend({
  action: z.literal('comment_update_reply').describe('Update a reply on a comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID containing the reply'),
  replyId: z.string().describe('Reply ID to update'),
  content: z.string().describe('New reply text'),
});

const CommentDeleteReplySchema = CommonFieldsSchema.extend({
  action: z.literal('comment_delete_reply').describe('Delete a reply from a comment'),
  spreadsheetId: SpreadsheetIdSchema,
  commentId: z.string().describe('Comment ID containing the reply'),
  replyId: z.string().describe('Reply ID to delete'),
});

// ========== VERSION ACTIONS (11) ==========

const VersionListRevisionsSchema = CommonFieldsSchema.extend({
  action: z.literal('version_list_revisions').describe('List revision history of the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
  pageSize: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Number of revisions per page'),
  pageToken: z.string().optional().describe('Token for pagination'),
  afterRevisionId: z
    .string()
    .optional()
    .describe('Cursor: return revisions after this revision ID'),
});

const VersionGetRevisionSchema = CommonFieldsSchema.extend({
  action: z.literal('version_get_revision').describe('Get metadata for a specific revision'),
  spreadsheetId: SpreadsheetIdSchema,
  revisionId: z.string().describe('Revision ID to retrieve'),
});

const VersionRestoreRevisionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('version_restore_revision')
    .describe('Restore the spreadsheet to a previous revision'),
  spreadsheetId: SpreadsheetIdSchema,
  revisionId: z.string().describe('Revision ID to restore to'),
});

const VersionKeepRevisionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('version_keep_revision')
    .describe('Mark a revision to keep forever or unmark it'),
  spreadsheetId: SpreadsheetIdSchema,
  revisionId: z.string().describe('Revision ID to update'),
  keepForever: z
    .boolean()
    .describe('Whether to keep this revision forever (true) or allow automatic cleanup (false)'),
});

const VersionCreateSnapshotSchema = CommonFieldsSchema.extend({
  action: z
    .literal('version_create_snapshot')
    .describe('Create a named snapshot (copy) of the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
  name: z.string().optional().describe('Name for the snapshot'),
  description: z.string().optional().describe('Description for the snapshot'),
  destinationFolderId: z.string().optional().describe('Google Drive folder ID for snapshot'),
});

const VersionSnapshotStatusSchema = CommonFieldsSchema.extend({
  action: z
    .literal('version_snapshot_status')
    .describe('Check the status of a snapshot creation task'),
  spreadsheetId: SpreadsheetIdSchema,
  taskId: z.string().describe('Snapshot task ID from version_create_snapshot'),
});

const VersionListSnapshotsSchema = CommonFieldsSchema.extend({
  action: z.literal('version_list_snapshots').describe('List all snapshots for the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
});

const VersionRestoreSnapshotSchema = CommonFieldsSchema.extend({
  action: z.literal('version_restore_snapshot').describe('Restore the spreadsheet from a snapshot'),
  spreadsheetId: SpreadsheetIdSchema,
  snapshotId: z.string().describe('Snapshot ID to restore from'),
});

const VersionDeleteSnapshotSchema = CommonFieldsSchema.extend({
  action: z.literal('version_delete_snapshot').describe('Delete a snapshot'),
  spreadsheetId: SpreadsheetIdSchema,
  snapshotId: z.string().describe('Snapshot ID to delete'),
});

const VersionCompareSchema = CommonFieldsSchema.extend({
  action: z.literal('version_compare').describe('Compare two revisions and show differences'),
  spreadsheetId: SpreadsheetIdSchema,
  revisionId1: z.string().optional().describe('First revision ID (defaults to previous revision)'),
  revisionId2: z.string().optional().describe('Second revision ID (defaults to current)'),
  sheetId: SheetIdSchema.optional().describe('Specific sheet to compare'),
});

const VersionExportSchema = CommonFieldsSchema.extend({
  action: z.literal('version_export').describe('Export a revision as a file'),
  spreadsheetId: SpreadsheetIdSchema,
  revisionId: z.string().optional().describe('Revision ID to export (defaults to latest)'),
  format: z
    .enum(['xlsx', 'csv', 'pdf', 'ods'])
    .optional()
    .default('xlsx')
    .describe('Export format'),
});

// ========== APPROVAL ACTIONS (7) ==========

const ApprovalCreateSchema = CommonFieldsSchema.extend({
  action: z.literal('approval_create').describe('Create an approval workflow for a range'),
  spreadsheetId: SpreadsheetIdSchema,
  range: z.string().describe('Cell or range reference to protect (e.g. "Sheet1!A1:Z100")'),
  approvers: z.array(z.string().email()).min(1).describe('List of approver email addresses'),
  requiredApprovals: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe('Number of approvals required'),
  message: z.string().optional().describe('Message for the approval request'),
  expirationDays: z.number().int().positive().optional().describe('Days until approval expires'),
});

const ApprovalApproveSchema = CommonFieldsSchema.extend({
  action: z.literal('approval_approve').describe('Approve a pending approval request'),
  spreadsheetId: SpreadsheetIdSchema,
  approvalId: z.string().describe('Approval ID to approve'),
});

const ApprovalRejectSchema = CommonFieldsSchema.extend({
  action: z.literal('approval_reject').describe('Reject a pending approval request'),
  spreadsheetId: SpreadsheetIdSchema,
  approvalId: z.string().describe('Approval ID to reject'),
});

const ApprovalGetStatusSchema = CommonFieldsSchema.extend({
  action: z.literal('approval_get_status').describe('Get the current status of an approval'),
  spreadsheetId: SpreadsheetIdSchema,
  approvalId: z.string().describe('Approval ID to check'),
});

const ApprovalListPendingSchema = CommonFieldsSchema.extend({
  action: z
    .literal('approval_list_pending')
    .describe('List all pending approvals for the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
});

const ApprovalDelegateSchema = CommonFieldsSchema.extend({
  action: z.literal('approval_delegate').describe('Delegate an approval to another user'),
  spreadsheetId: SpreadsheetIdSchema,
  approvalId: z.string().describe('Approval ID to delegate'),
  delegateTo: z.string().email().describe('Email address to delegate approval to'),
});

const ApprovalCancelSchema = CommonFieldsSchema.extend({
  action: z.literal('approval_cancel').describe('Cancel a pending approval'),
  spreadsheetId: SpreadsheetIdSchema,
  approvalId: z.string().describe('Approval ID to cancel'),
});

// ========== ACCESS PROPOSAL ACTIONS (2) ==========

const ListAccessProposalsSchema = CommonFieldsSchema.extend({
  action: z
    .literal('list_access_proposals')
    .describe('List pending access proposals for the spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema,
  pageToken: z.string().optional().describe('Token for pagination'),
  pageSize: z.number().int().positive().optional().describe('Number of proposals per page'),
});

const ResolveAccessProposalSchema = CommonFieldsSchema.extend({
  action: z.literal('resolve_access_proposal').describe('Approve or deny an access proposal'),
  spreadsheetId: SpreadsheetIdSchema,
  proposalId: z.string().describe('The proposal ID from list_access_proposals'),
  decision: z.enum(['APPROVE', 'DENY']).describe('The resolution decision'),
  role: z.enum(['reader', 'commenter', 'writer']).optional().describe('Role to grant if approving'),
  sendNotification: z.boolean().optional().describe('Send notification to requester'),
});

// ========== DRIVE LABEL ACTIONS (3) ==========

const LabelListSchema = CommonFieldsSchema.extend({
  action: z.literal('label_list').describe('List Drive Labels applied to the file'),
  spreadsheetId: SpreadsheetIdSchema.optional().describe(
    'Spreadsheet ID (use fileId or spreadsheetId)'
  ),
  fileId: z.string().optional().describe('Drive file ID (alternative to spreadsheetId)'),
  includeLabels: z.array(z.string()).optional().describe('Filter to specific label IDs in results'),
}).superRefine((data, ctx) => {
  if (!data.fileId && !data.spreadsheetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fileId'],
      message: 'Either fileId or spreadsheetId is required for label_list',
    });
  }
});

const LabelApplySchema = CommonFieldsSchema.extend({
  action: z.literal('label_apply').describe('Apply a Drive Label to the file'),
  spreadsheetId: SpreadsheetIdSchema.optional().describe(
    'Spreadsheet ID (use fileId or spreadsheetId)'
  ),
  fileId: z.string().optional().describe('Drive file ID (alternative to spreadsheetId)'),
  labelId: z.string().describe('The Drive Label ID to apply'),
  labelFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Label field values to set when applying the label'),
}).superRefine((data, ctx) => {
  if (!data.fileId && !data.spreadsheetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fileId'],
      message: 'Either fileId or spreadsheetId is required for label_apply',
    });
  }
});

const LabelRemoveSchema = CommonFieldsSchema.extend({
  action: z.literal('label_remove').describe('Remove a Drive Label from the file'),
  spreadsheetId: SpreadsheetIdSchema.optional().describe(
    'Spreadsheet ID (use fileId or spreadsheetId)'
  ),
  fileId: z.string().optional().describe('Drive file ID (alternative to spreadsheetId)'),
  labelId: z.string().describe('The Drive Label ID to remove'),
}).superRefine((data, ctx) => {
  if (!data.fileId && !data.spreadsheetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fileId'],
      message: 'Either fileId or spreadsheetId is required for label_remove',
    });
  }
});

// ========== INPUT SCHEMA ==========

const CollaborateActionUnionSchema = z.discriminatedUnion('action', [
  ShareAddSchema,
  ShareUpdateSchema,
  ShareRemoveSchema,
  ShareListSchema,
  ShareGetSchema,
  ShareTransferOwnershipSchema,
  ShareSetLinkSchema,
  ShareGetLinkSchema,
  CommentAddSchema,
  CommentUpdateSchema,
  CommentDeleteSchema,
  CommentListSchema,
  CommentGetSchema,
  CommentResolveSchema,
  CommentReopenSchema,
  CommentAddReplySchema,
  CommentUpdateReplySchema,
  CommentDeleteReplySchema,
  VersionListRevisionsSchema,
  VersionGetRevisionSchema,
  VersionRestoreRevisionSchema,
  VersionKeepRevisionSchema,
  VersionCreateSnapshotSchema,
  VersionSnapshotStatusSchema,
  VersionListSnapshotsSchema,
  VersionRestoreSnapshotSchema,
  VersionDeleteSnapshotSchema,
  VersionCompareSchema,
  VersionExportSchema,
  ApprovalCreateSchema,
  ApprovalApproveSchema,
  ApprovalRejectSchema,
  ApprovalGetStatusSchema,
  ApprovalListPendingSchema,
  ApprovalDelegateSchema,
  ApprovalCancelSchema,
  ListAccessProposalsSchema,
  ResolveAccessProposalSchema,
  LabelListSchema,
  LabelApplySchema,
  LabelRemoveSchema,
]);

export const SheetsCollaborateInputSchema = z.object({
  request: CollaborateActionUnionSchema,
});

// ========== OUTPUT SCHEMA ==========

const CollaborateResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Sharing response fields
    permission: PermissionSchema.optional(),
    permissions: z.array(PermissionSchema).optional(),
    sharingLink: z.string().optional(),
    // Comment response fields
    comment: CommentSchema.optional(),
    comments: z.array(CommentSchema).optional(),
    replyId: z.string().optional(),
    // Version response fields
    revision: RevisionSchema.optional(),
    revisions: z.array(RevisionSchema).optional(),
    nextPageToken: z.string().optional(),
    snapshot: SnapshotSchema.optional(),
    snapshots: z.array(SnapshotSchema).optional(),
    taskId: z.string().optional(),
    taskStatus: z.enum(['working', 'completed', 'failed']).optional(),
    taskStatusMessage: z.string().optional(),
    taskCreatedAt: z.string().optional(),
    taskUpdatedAt: z.string().optional(),
    pollAfterMs: z.coerce.number().int().optional(),
    taskError: ErrorDetailSchema.optional(),
    comparison: z
      .object({
        sheetsAdded: z.array(z.string()).optional(),
        sheetsRemoved: z.array(z.string()).optional(),
        sheetsModified: z.array(z.string()).optional(),
        cellChanges: z.coerce.number().int().optional(),
      })
      .optional(),
    exportUrl: z.string().optional(),
    exportData: z.string().optional(),
    // Approval response fields
    approval: ApprovalSchema.optional(),
    approvals: z.array(ApprovalSchema).optional(),
    // Drive Label response fields
    labels: z.array(z.record(z.string(), z.unknown())).optional(),
    labelId: z.string().optional(),
    fileId: z.string().optional(),
    // Common response fields
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsCollaborateOutputSchema = z.object({
  response: CollaborateResponseSchema,
});

// ========== ANNOTATIONS ==========

export const SHEETS_COLLABORATE_ANNOTATIONS: ToolAnnotations = {
  title: 'Collaboration',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

// ========== TYPE EXPORTS ==========

export type SheetsCollaborateInput = z.infer<typeof SheetsCollaborateInputSchema>;
export type SheetsCollaborateOutput = z.infer<typeof SheetsCollaborateOutputSchema>;
export type CollaborateResponse = z.infer<typeof CollaborateResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type CollaborateRequest = z.infer<typeof CollaborateActionUnionSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;

// Per-action types (direct infer from schemas)
export type CollaborateShareAddInput = z.infer<typeof ShareAddSchema>;
export type CollaborateShareUpdateInput = z.infer<typeof ShareUpdateSchema>;
export type CollaborateShareRemoveInput = z.infer<typeof ShareRemoveSchema>;
export type CollaborateShareListInput = z.infer<typeof ShareListSchema>;
export type CollaborateShareGetInput = z.infer<typeof ShareGetSchema>;
export type CollaborateShareTransferOwnershipInput = z.infer<typeof ShareTransferOwnershipSchema>;
export type CollaborateShareSetLinkInput = z.infer<typeof ShareSetLinkSchema>;
export type CollaborateShareGetLinkInput = z.infer<typeof ShareGetLinkSchema>;

export type CollaborateCommentAddInput = z.infer<typeof CommentAddSchema>;
export type CollaborateCommentUpdateInput = z.infer<typeof CommentUpdateSchema>;
export type CollaborateCommentDeleteInput = z.infer<typeof CommentDeleteSchema>;
export type CollaborateCommentListInput = z.infer<typeof CommentListSchema>;
export type CollaborateCommentGetInput = z.infer<typeof CommentGetSchema>;
export type CollaborateCommentResolveInput = z.infer<typeof CommentResolveSchema>;
export type CollaborateCommentReopenInput = z.infer<typeof CommentReopenSchema>;
export type CollaborateCommentAddReplyInput = z.infer<typeof CommentAddReplySchema>;
export type CollaborateCommentUpdateReplyInput = z.infer<typeof CommentUpdateReplySchema>;
export type CollaborateCommentDeleteReplyInput = z.infer<typeof CommentDeleteReplySchema>;

export type CollaborateVersionListRevisionsInput = z.infer<typeof VersionListRevisionsSchema>;
export type CollaborateVersionGetRevisionInput = z.infer<typeof VersionGetRevisionSchema>;
export type CollaborateVersionRestoreRevisionInput = z.infer<typeof VersionRestoreRevisionSchema>;
export type CollaborateVersionKeepRevisionInput = z.infer<typeof VersionKeepRevisionSchema>;
export type CollaborateVersionCreateSnapshotInput = z.infer<typeof VersionCreateSnapshotSchema>;
export type CollaborateVersionSnapshotStatusInput = z.infer<typeof VersionSnapshotStatusSchema>;
export type CollaborateVersionListSnapshotsInput = z.infer<typeof VersionListSnapshotsSchema>;
export type CollaborateVersionRestoreSnapshotInput = z.infer<typeof VersionRestoreSnapshotSchema>;
export type CollaborateVersionDeleteSnapshotInput = z.infer<typeof VersionDeleteSnapshotSchema>;
export type CollaborateVersionCompareInput = z.infer<typeof VersionCompareSchema>;
export type CollaborateVersionExportInput = z.infer<typeof VersionExportSchema>;

export type CollaborateApprovalCreateInput = z.infer<typeof ApprovalCreateSchema>;
export type CollaborateApprovalApproveInput = z.infer<typeof ApprovalApproveSchema>;
export type CollaborateApprovalRejectInput = z.infer<typeof ApprovalRejectSchema>;
export type CollaborateApprovalGetStatusInput = z.infer<typeof ApprovalGetStatusSchema>;
export type CollaborateApprovalListPendingInput = z.infer<typeof ApprovalListPendingSchema>;
export type CollaborateApprovalDelegateInput = z.infer<typeof ApprovalDelegateSchema>;
export type CollaborateApprovalCancelInput = z.infer<typeof ApprovalCancelSchema>;

export type CollaborateListAccessProposalsInput = z.infer<typeof ListAccessProposalsSchema>;
export type CollaborateResolveAccessProposalInput = z.infer<typeof ResolveAccessProposalSchema>;

export type CollaborateLabelListInput = z.infer<typeof LabelListSchema>;
export type CollaborateLabelApplyInput = z.infer<typeof LabelApplySchema>;
export type CollaborateLabelRemoveInput = z.infer<typeof LabelRemoveSchema>;
