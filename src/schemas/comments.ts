/**
 * Tool 12: sheets_comments
 * Comment operations (Drive API)
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

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
      }),
    )
    .optional(),
});

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsCommentsInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "add",
        "update",
        "delete",
        "list",
        "get",
        "resolve",
        "reopen",
        "add_reply",
        "update_reply",
        "delete_reply",
      ])
      .describe("The operation to perform on comments"),

    // Common field - spreadsheetId (required for all actions)
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),

    // Fields for ADD action
    content: z
      .string()
      .optional()
      .describe(
        "Comment or reply content (required for: add, update, add_reply, update_reply)",
      ),
    anchor: z
      .string()
      .optional()
      .describe("Cell or range reference where comment is anchored (add only)"),

    // Fields for UPDATE, DELETE, GET, RESOLVE, REOPEN, and reply operations
    commentId: z
      .string()
      .optional()
      .describe(
        "Comment ID to operate on (required for: update, delete, get, resolve, reopen, add_reply, update_reply, delete_reply)",
      ),

    // Fields for UPDATE_REPLY and DELETE_REPLY actions
    replyId: z
      .string()
      .optional()
      .describe(
        "Reply ID to operate on (required for: update_reply, delete_reply)",
      ),

    // Fields for LIST action
    includeDeleted: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include deleted comments in list (list only)"),
    startIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Starting index for pagination (list only)"),
    maxResults: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Maximum number of comments to return (list only)"),

    // Safety options for destructive operations
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options like dryRun (update, delete, update_reply, delete_reply)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "add":
          return !!data.spreadsheetId && !!data.content;
        case "update":
          return !!data.spreadsheetId && !!data.commentId && !!data.content;
        case "delete":
        case "get":
        case "resolve":
        case "reopen":
          return !!data.spreadsheetId && !!data.commentId;
        case "list":
          return !!data.spreadsheetId;
        case "add_reply":
          return !!data.spreadsheetId && !!data.commentId && !!data.content;
        case "update_reply":
          return (
            !!data.spreadsheetId &&
            !!data.commentId &&
            !!data.replyId &&
            !!data.content
          );
        case "delete_reply":
          return !!data.spreadsheetId && !!data.commentId && !!data.replyId;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

const CommentsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    comment: CommentSchema.optional(),
    comments: z.array(CommentSchema).optional(),
    replyId: z.string().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsCommentsOutputSchema = z.object({
  response: CommentsResponseSchema,
});

export const SHEETS_COMMENTS_ANNOTATIONS: ToolAnnotations = {
  title: "Comments",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsCommentsInput = z.infer<typeof SheetsCommentsInputSchema>;
export type SheetsCommentsOutput = z.infer<typeof SheetsCommentsOutputSchema>;

export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type CommentsAddInput = SheetsCommentsInput & {
  action: "add";
  spreadsheetId: string;
  content: string;
};
export type CommentsUpdateInput = SheetsCommentsInput & {
  action: "update";
  spreadsheetId: string;
  commentId: string;
  content: string;
};
export type CommentsDeleteInput = SheetsCommentsInput & {
  action: "delete";
  spreadsheetId: string;
  commentId: string;
};
export type CommentsListInput = SheetsCommentsInput & {
  action: "list";
  spreadsheetId: string;
};
export type CommentsGetInput = SheetsCommentsInput & {
  action: "get";
  spreadsheetId: string;
  commentId: string;
};
export type CommentsResolveInput = SheetsCommentsInput & {
  action: "resolve";
  spreadsheetId: string;
  commentId: string;
};
export type CommentsReopenInput = SheetsCommentsInput & {
  action: "reopen";
  spreadsheetId: string;
  commentId: string;
};
export type CommentsAddReplyInput = SheetsCommentsInput & {
  action: "add_reply";
  spreadsheetId: string;
  commentId: string;
  content: string;
};
export type CommentsUpdateReplyInput = SheetsCommentsInput & {
  action: "update_reply";
  spreadsheetId: string;
  commentId: string;
  replyId: string;
  content: string;
};
export type CommentsDeleteReplyInput = SheetsCommentsInput & {
  action: "delete_reply";
  spreadsheetId: string;
  commentId: string;
  replyId: string;
};
