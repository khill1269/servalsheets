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
import type { SheetsCollaborateInput, SheetsCollaborateOutput } from '../schemas/index.js';
export declare class CollaborateHandler extends BaseHandler<SheetsCollaborateInput, SheetsCollaborateOutput> {
    private driveApi;
    constructor(context: HandlerContext, driveApi?: drive_v3.Drive);
    handle(input: SheetsCollaborateInput): Promise<SheetsCollaborateOutput>;
    protected createIntents(_input: SheetsCollaborateInput): Intent[];
    private handleShareAdd;
    private handleShareUpdate;
    private handleShareRemove;
    private handleShareList;
    private handleShareGet;
    private handleShareTransferOwnership;
    private handleShareSetLink;
    private handleShareGetLink;
    private handleCommentAdd;
    private handleCommentUpdate;
    private handleCommentDelete;
    private handleCommentList;
    private handleCommentGet;
    private handleCommentResolve;
    private handleCommentReopen;
    private handleCommentAddReply;
    private handleCommentUpdateReply;
    private handleCommentDeleteReply;
    private handleVersionListRevisions;
    private handleVersionGetRevision;
    private handleVersionRestoreRevision;
    private handleVersionKeepRevision;
    private handleVersionCreateSnapshot;
    private handleVersionListSnapshots;
    private handleVersionRestoreSnapshot;
    private handleVersionDeleteSnapshot;
    private handleVersionCompare;
    private handleVersionExport;
    private mapPermission;
    private mapComment;
    private mapRevision;
    /**
     * Return error for unavailable features
     *
     * Currently unavailable:
     * - version_restore_revision: Requires complex restore operation
     * - version_compare: Requires complex diff algorithm for revision comparison
     *   Implementation would need semantic diff of spreadsheet state
     */
    private featureUnavailable;
}
//# sourceMappingURL=collaborate.d.ts.map