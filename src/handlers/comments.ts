/**
 * ServalSheets - Comments Handler
 *
 * Handles sheets_comments tool (Drive comments)
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsCommentsInput,
  SheetsCommentsOutput,
  CommentsResponse,
  CommentsAddInput,
  CommentsUpdateInput,
  CommentsDeleteInput,
  CommentsListInput,
  CommentsGetInput,
  CommentsResolveInput,
  CommentsReopenInput,
  CommentsAddReplyInput,
  CommentsUpdateReplyInput,
  CommentsDeleteReplyInput,
} from "../schemas/index.js";

type CommentsSuccess = Extract<CommentsResponse, { success: true }>;

export class CommentsHandler extends BaseHandler<
  SheetsCommentsInput,
  SheetsCommentsOutput
> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super("sheets_comments", context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsCommentsInput): Promise<SheetsCommentsOutput> {
    // Track spreadsheet ID for better error messages
    this.trackSpreadsheetId(input.spreadsheetId);

    if (!this.driveApi) {
      return {
        response: this.error({
          code: "INTERNAL_ERROR",
          message: "Drive API not available - required for comment operations",
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
    ) as SheetsCommentsInput;

    try {
      const req = inferredRequest;
      let response: CommentsResponse;
      switch (req.action) {
        case "add":
          response = await this.handleAdd(req);
          break;
        case "update":
          response = await this.handleUpdate(req);
          break;
        case "delete":
          response = await this.handleDelete(req);
          break;
        case "list":
          response = await this.handleList(req);
          break;
        case "get":
          response = await this.handleGet(req);
          break;
        case "resolve":
          response = await this.handleResolve(req);
          break;
        case "reopen":
          response = await this.handleReopen(req);
          break;
        case "add_reply":
          response = await this.handleAddReply(req);
          break;
        case "update_reply":
          response = await this.handleUpdateReply(req);
          break;
        case "delete_reply":
          response = await this.handleDeleteReply(req);
          break;
        default:
          response = this.error({
            code: "INVALID_PARAMS",
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }
      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsCommentsInput): Intent[] {
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleAdd(
    input: CommentsAddInput,
  ): Promise<CommentsResponse> {
    const response = await this.driveApi!.comments.create({
      fileId: input.spreadsheetId,
      requestBody: {
        content: input.content,
        anchor: input.anchor,
      },
      fields:
        "id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor",
    });

    return this.success("add", { comment: this.mapComment(response.data) });
  }

  private async handleUpdate(
    input: CommentsUpdateInput,
  ): Promise<CommentsResponse> {
    if (input.safety?.dryRun) {
      return this.success("update", {}, undefined, true);
    }

    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { content: input.content },
      fields:
        "id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor",
    });

    return this.success("update", { comment: this.mapComment(response.data) });
  }

  private async handleDelete(
    input: CommentsDeleteInput,
  ): Promise<CommentsResponse> {
    if (input.safety?.dryRun) {
      return this.success("delete", {}, undefined, true);
    }

    await this.driveApi!.comments.delete({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
    });

    return this.success("delete", {});
  }

  private async handleList(
    input: CommentsListInput,
  ): Promise<CommentsResponse> {
    const response = await this.driveApi!.comments.list({
      fileId: input.spreadsheetId,
      includeDeleted: input.includeDeleted ?? false,
      pageToken: input.startIndex ? String(input.startIndex) : undefined,
      pageSize: input.maxResults ?? 100,
      fields:
        "comments(id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor,replies(id,content,createdTime,author/displayName)))",
    });

    const comments = (response.data.comments ?? []).map(this.mapComment);
    return this.success("list", { comments });
  }

  private async handleGet(
    input: CommentsGetInput,
  ): Promise<CommentsResponse> {
    const response = await this.driveApi!.comments.get({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      fields:
        "id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor,replies(id,content,createdTime,author/displayName)",
    });

    return this.success("get", { comment: this.mapComment(response.data) });
  }

  private async handleResolve(
    input: CommentsResolveInput,
  ): Promise<CommentsResponse> {
    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { resolved: true },
      fields:
        "id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor",
    });
    return this.success("resolve", { comment: this.mapComment(response.data) });
  }

  private async handleReopen(
    input: CommentsReopenInput,
  ): Promise<CommentsResponse> {
    const response = await this.driveApi!.comments.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { resolved: false },
      fields:
        "id,content,createdTime,modifiedTime,author/displayName,author/emailAddress,resolved,anchor",
    });
    return this.success("reopen", { comment: this.mapComment(response.data) });
  }

  private async handleAddReply(
    input: CommentsAddReplyInput,
  ): Promise<CommentsResponse> {
    const response = await this.driveApi!.replies.create({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      requestBody: { content: input.content },
      fields: "id",
    });

    return this.success("add_reply", { replyId: response.data.id ?? "" });
  }

  private async handleUpdateReply(
    input: CommentsUpdateReplyInput,
  ): Promise<CommentsResponse> {
    if (input.safety?.dryRun) {
      return this.success("update_reply", {}, undefined, true);
    }

    await this.driveApi!.replies.update({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      replyId: input.replyId,
      requestBody: { content: input.content },
    });

    return this.success("update_reply", { replyId: input.replyId });
  }

  private async handleDeleteReply(
    input: CommentsDeleteReplyInput,
  ): Promise<CommentsResponse> {
    if (input.safety?.dryRun) {
      return this.success("delete_reply", {}, undefined, true);
    }

    await this.driveApi!.replies.delete({
      fileId: input.spreadsheetId,
      commentId: input.commentId,
      replyId: input.replyId,
    });

    return this.success("delete_reply", {});
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapComment = (
    c: drive_v3.Schema$Comment | undefined,
  ): NonNullable<CommentsSuccess["comment"]> => ({
    id: c?.id ?? "",
    content: c?.content ?? "",
    author: {
      displayName: c?.author?.displayName ?? "",
      emailAddress: c?.author?.emailAddress ?? undefined,
    },
    createdTime: c?.createdTime ?? "",
    modifiedTime: c?.modifiedTime ?? "",
    resolved: c?.resolved ?? false,
    anchor: c?.anchor ?? undefined,
    replies: (c?.replies ?? []).map((r) => ({
      id: r.id ?? "",
      content: r.content ?? "",
      author: { displayName: r.author?.displayName ?? "" },
      createdTime: r.createdTime ?? "",
    })),
  });
}
