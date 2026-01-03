/**
 * ServalSheets - Comments Handler
 *
 * Handles sheets_comments tool (Drive comments)
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsCommentsInput, SheetsCommentsOutput } from '../schemas/comments.js';

type CommentsSuccess = Extract<SheetsCommentsOutput, { success: true }>;

export class CommentsHandler extends BaseHandler<SheetsCommentsInput, SheetsCommentsOutput> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super('sheets_comments', context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsCommentsInput): Promise<SheetsCommentsOutput> {
    if (!this.driveApi) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available',
        retryable: false,
        suggestedFix: 'Initialize Drive API client with drive.file scope.',
      });
    }

    try {
      switch (input.action) {
        case 'add':
          return await this.handleAdd(input);
        case 'update':
          return await this.handleUpdate(input);
        case 'delete':
          return await this.handleDelete(input);
        case 'list':
          return await this.handleList(input);
        case 'get':
          return await this.handleGet(input);
        case 'resolve':
          return await this.handleResolve(input);
        case 'reopen':
          return await this.handleReopen(input);
        case 'add_reply':
          return await this.handleAddReply(input);
        case 'update_reply':
          return await this.handleUpdateReply(input);
        case 'delete_reply':
          return await this.handleDeleteReply(input);
        default:
          return this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(input as { action: string }).action}`,
            retryable: false,
          });
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  protected createIntents(input: SheetsCommentsInput): Intent[] {
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleAdd(
    input: Extract<SheetsCommentsInput, { action: 'add' }>
  ): Promise<SheetsCommentsOutput> {
    const response = await this.driveApi!.comments.create({
      fileId: input.spreadsheetId,
      requestBody: {
        content: input.content,
        anchor: input.anchor,
      },
      fields: 'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });

    return this.success('add', { comment: this.mapComment(response.data) });
  }

  private async handleUpdate(
    input: Extract<SheetsCommentsInput, { action: 'update' }>
  ): Promise<SheetsCommentsOutput> {
    if (input.safety?.dryRun) {
      return this.success('update', {}, undefined, true);
    }

    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { content: input.content },
      fields: 'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });

    return this.success('update', { comment: this.mapComment(response.data) });
  }

  private async handleDelete(
    input: Extract<SheetsCommentsInput, { action: 'delete' }>
  ): Promise<SheetsCommentsOutput> {
    if (input.safety?.dryRun) {
      return this.success('delete', {}, undefined, true);
    }

    await this.driveApi!.comments.delete({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
    });

    return this.success('delete', {});
  }

  private async handleList(
    input: Extract<SheetsCommentsInput, { action: 'list' }>
  ): Promise<SheetsCommentsOutput> {
    const response = await this.driveApi!.comments.list({
      fileId: input.spreadsheetId,
      includeDeleted: input.includeDeleted ?? false,
      pageToken: input.startIndex ? String(input.startIndex) : undefined,
      pageSize: input.maxResults ?? 100,
      fields: 'comments(id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor,replies(id,content,createdTime,author/displayName)))',
    });

    const comments = (response.data.comments ?? []).map(this.mapComment);
    return this.success('list', { comments });
  }

  private async handleGet(
    input: Extract<SheetsCommentsInput, { action: 'get' }>
  ): Promise<SheetsCommentsOutput> {
    const response = await this.driveApi!.comments.get({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      fields: 'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor,replies(id,content,createdTime,author/displayName)',
    });

    return this.success('get', { comment: this.mapComment(response.data) });
  }

  private async handleResolve(
    input: Extract<SheetsCommentsInput, { action: 'resolve' }>
  ): Promise<SheetsCommentsOutput> {
    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { resolved: true },
      fields: 'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });
    return this.success('resolve', { comment: this.mapComment(response.data) });
  }

  private async handleReopen(
    input: Extract<SheetsCommentsInput, { action: 'reopen' }>
  ): Promise<SheetsCommentsOutput> {
    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { resolved: false },
      fields: 'id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor',
    });
    return this.success('reopen', { comment: this.mapComment(response.data) });
  }

  private async handleAddReply(
    input: Extract<SheetsCommentsInput, { action: 'add_reply' }>
  ): Promise<SheetsCommentsOutput> {
    const response = await this.driveApi!.replies.create({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { content: input.content },
      fields: 'id',
    });

    return this.success('add_reply', { replyId: response.data.id ?? '' });
  }

  private async handleUpdateReply(
    input: Extract<SheetsCommentsInput, { action: 'update_reply' }>
  ): Promise<SheetsCommentsOutput> {
    if (input.safety?.dryRun) {
      return this.success('update_reply', {}, undefined, true);
    }

    await this.driveApi!.replies.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      replyId: input.replyId,
      requestBody: { content: input.content },
    });

    return this.success('update_reply', { replyId: input.replyId });
  }

  private async handleDeleteReply(
    input: Extract<SheetsCommentsInput, { action: 'delete_reply' }>
  ): Promise<SheetsCommentsOutput> {
    if (input.safety?.dryRun) {
      return this.success('delete_reply', {}, undefined, true);
    }

    await this.driveApi!.replies.delete({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      replyId: input.replyId,
    });

    return this.success('delete_reply', {});
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapComment = (c: drive_v3.Schema$Comment | undefined): NonNullable<CommentsSuccess['comment']> => ({
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
    replies: (c?.replies ?? []).map(r => ({
      id: r.id ?? '',
      content: r.content ?? '',
      author: { displayName: r.author?.displayName ?? '' },
      createdTime: r.createdTime ?? '',
    })),
  });
}
