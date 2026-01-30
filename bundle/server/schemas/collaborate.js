/**
 * Tool: sheets_collaborate
 * Consolidated collaboration operations: sharing, comments, and version control
 * Merges: sharing.ts (8 actions) + comments.ts (10 actions) + versions.ts (10 actions) = 28 actions
 */
import { z } from 'zod';
import { SpreadsheetIdSchema, SheetIdSchema, PermissionRoleSchema, PermissionTypeSchema, ErrorDetailSchema, SafetyOptionsSchema, MutationSummarySchema, ResponseMetaSchema, } from './shared.js';
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
        .array(z.object({
        id: z.string(),
        content: z.string(),
        author: z.object({
            displayName: z.string(),
        }),
        createdTime: z.string(),
    }))
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
// ========== INPUT SCHEMA ==========
// Flattened union for MCP SDK compatibility (28 actions total)
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsCollaborateInputSchema = z.object({
    request: z
        .object({
        // Required action discriminator (28 actions)
        action: z
            .enum([
            // Sharing actions (8) - prefixed with 'share_'
            'share_add',
            'share_update',
            'share_remove',
            'share_list',
            'share_get',
            'share_transfer_ownership',
            'share_set_link',
            'share_get_link',
            // Comment actions (10) - prefixed with 'comment_'
            'comment_add',
            'comment_update',
            'comment_delete',
            'comment_list',
            'comment_get',
            'comment_resolve',
            'comment_reopen',
            'comment_add_reply',
            'comment_update_reply',
            'comment_delete_reply',
            // Version actions (10) - prefixed with 'version_'
            'version_list_revisions',
            'version_get_revision',
            'version_restore_revision',
            'version_keep_revision',
            'version_create_snapshot',
            'version_list_snapshots',
            'version_restore_snapshot',
            'version_delete_snapshot',
            'version_compare',
            'version_export',
        ])
            .describe('The collaboration operation to perform (sharing, comments, or version control)'),
        // Common field - spreadsheetId (required for all actions)
        spreadsheetId: SpreadsheetIdSchema.optional().describe('Spreadsheet ID from URL (required for all actions)'),
        // ========== SHARING FIELDS ==========
        // Fields for share_add action
        emailAddress: z
            .string()
            .email()
            .optional()
            .describe('Email address of user to share with (required for: share_add with type=user)'),
        domain: z
            .string()
            .optional()
            .describe('Domain to share with (required for: share_add with type=domain)'),
        type: PermissionTypeSchema.optional().describe('Permission type: user, group, domain, or anyone (required for: share_add)'),
        role: PermissionRoleSchema.optional().describe('Permission role: owner, writer, commenter, or reader (required for: share_add, share_update; optional for: share_set_link)'),
        sendNotification: z
            .boolean()
            .optional()
            .default(true)
            .describe('Send email notification to user (share_add only)'),
        emailMessage: z
            .string()
            .optional()
            .describe('Custom message in notification email (share_add only)'),
        expirationTime: z
            .string()
            .optional()
            .describe('ISO 8601 expiration time (share_add, share_update)'),
        // Fields for share_update, share_remove, share_get actions
        permissionId: z
            .string()
            .optional()
            .describe('Permission ID to update/remove/get (required for: share_update, share_remove, share_get)'),
        // Fields for share_transfer_ownership action
        newOwnerEmail: z
            .string()
            .email()
            .optional()
            .describe('Email of new owner (required for: share_transfer_ownership)'),
        // Fields for share_set_link action
        enabled: z
            .boolean()
            .optional()
            .describe('Enable or disable link sharing (required for: share_set_link)'),
        // ========== COMMENT FIELDS ==========
        // Fields for comment_add, comment_update, comment_add_reply, comment_update_reply actions
        content: z
            .string()
            .optional()
            .describe('Comment or reply content (required for: comment_add, comment_update, comment_add_reply, comment_update_reply)'),
        anchor: z
            .string()
            .optional()
            .describe('Cell or range reference where comment is anchored (comment_add only)'),
        // Fields for comment actions (update, delete, get, resolve, reopen, replies)
        commentId: z
            .string()
            .optional()
            .describe('Comment ID to operate on (required for: comment_update, comment_delete, comment_get, comment_resolve, comment_reopen, comment_add_reply, comment_update_reply, comment_delete_reply)'),
        // Fields for comment_update_reply and comment_delete_reply actions
        replyId: z
            .string()
            .optional()
            .describe('Reply ID to operate on (required for: comment_update_reply, comment_delete_reply)'),
        // Fields for comment_list action
        includeDeleted: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include deleted comments in list (comment_list only)'),
        startIndex: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe('Starting index for pagination (comment_list only)'),
        maxResults: z
            .number()
            .int()
            .positive()
            .optional()
            .default(100)
            .describe('Maximum number of comments to return (comment_list only)'),
        // ========== VERSION FIELDS ==========
        // Fields for version_list_revisions action
        pageSize: z
            .number()
            .int()
            .positive()
            .optional()
            .default(100)
            .describe('Number of revisions to return per page (version_list_revisions only)'),
        pageToken: z
            .string()
            .optional()
            .describe('Token for pagination (version_list_revisions only)'),
        // Fields for version_get_revision, version_restore_revision, version_keep_revision actions
        revisionId: z
            .string()
            .optional()
            .describe('Revision ID (required for: version_get_revision, version_restore_revision, version_keep_revision; optional for: version_compare, version_export)'),
        // Fields for version_keep_revision action
        keepForever: z
            .boolean()
            .optional()
            .describe('Whether to keep revision forever (required for: version_keep_revision)'),
        // Fields for version_create_snapshot action
        name: z.string().optional().describe('Name for the snapshot (version_create_snapshot only)'),
        description: z
            .string()
            .optional()
            .describe('Description for the snapshot (version_create_snapshot only)'),
        destinationFolderId: z
            .string()
            .optional()
            .describe('Google Drive folder ID for snapshot (version_create_snapshot only)'),
        // Fields for version_restore_snapshot, version_delete_snapshot actions
        snapshotId: z
            .string()
            .optional()
            .describe('Snapshot ID (required for: version_restore_snapshot, version_delete_snapshot)'),
        // Fields for version_compare action
        revisionId1: z
            .string()
            .optional()
            .describe('First revision ID to compare (version_compare only)'),
        revisionId2: z
            .string()
            .optional()
            .describe('Second revision ID to compare (version_compare only)'),
        sheetId: SheetIdSchema.optional().describe('Specific sheet to compare (version_compare only)'),
        // Fields for version_export action
        format: z
            .enum(['xlsx', 'csv', 'pdf', 'ods'])
            .optional()
            .default('xlsx')
            .describe('Export format (version_export only)'),
        // Safety options for all mutation operations
        safety: SafetyOptionsSchema.optional().describe('Safety options like dryRun (applies to all destructive operations)'),
        // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
        verbosity: z
            .enum(['minimal', 'standard', 'detailed'])
            .optional()
            .default('standard')
            .describe('Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'),
    })
        .refine((data) => {
        // Validate required fields based on action
        switch (data.action) {
            // Sharing actions
            case 'share_add':
                return !!data.spreadsheetId && !!data.type && !!data.role;
            case 'share_update':
                return !!data.spreadsheetId && !!data.permissionId && !!data.role;
            case 'share_remove':
                return !!data.spreadsheetId && !!data.permissionId;
            case 'share_list':
                return !!data.spreadsheetId;
            case 'share_get':
                return !!data.spreadsheetId && !!data.permissionId;
            case 'share_transfer_ownership':
                return !!data.spreadsheetId && !!data.newOwnerEmail;
            case 'share_set_link':
                return !!data.spreadsheetId && data.enabled !== undefined;
            case 'share_get_link':
                return !!data.spreadsheetId;
            // Comment actions
            case 'comment_add':
                return !!data.spreadsheetId && !!data.content;
            case 'comment_update':
                return !!data.spreadsheetId && !!data.commentId && !!data.content;
            case 'comment_delete':
            case 'comment_get':
            case 'comment_resolve':
            case 'comment_reopen':
                return !!data.spreadsheetId && !!data.commentId;
            case 'comment_list':
                return !!data.spreadsheetId;
            case 'comment_add_reply':
                return !!data.spreadsheetId && !!data.commentId && !!data.content;
            case 'comment_update_reply':
                return !!data.spreadsheetId && !!data.commentId && !!data.replyId && !!data.content;
            case 'comment_delete_reply':
                return !!data.spreadsheetId && !!data.commentId && !!data.replyId;
            // Version actions
            case 'version_list_revisions':
                return !!data.spreadsheetId;
            case 'version_get_revision':
                return !!data.spreadsheetId && !!data.revisionId;
            case 'version_restore_revision':
                return !!data.spreadsheetId && !!data.revisionId;
            case 'version_keep_revision':
                return !!data.spreadsheetId && !!data.revisionId && data.keepForever !== undefined;
            case 'version_create_snapshot':
                return !!data.spreadsheetId;
            case 'version_list_snapshots':
                return !!data.spreadsheetId;
            case 'version_restore_snapshot':
                return !!data.spreadsheetId && !!data.snapshotId;
            case 'version_delete_snapshot':
                return !!data.spreadsheetId && !!data.snapshotId;
            case 'version_compare':
                return !!data.spreadsheetId;
            case 'version_export':
                return !!data.spreadsheetId;
            default:
                return false;
        }
    }, {
        message: 'Missing required fields for the specified action',
    }),
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
export const SHEETS_COLLABORATE_ANNOTATIONS = {
    title: 'Collaboration',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
};
//# sourceMappingURL=collaborate.js.map