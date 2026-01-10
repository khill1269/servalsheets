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

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
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
      }),
    )
    .optional(),
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsCommentsInputSchema = z.discriminatedUnion("action", [
  // ADD
  BaseSchema.extend({
    action: z.literal("add"),
    content: z.string(),
    anchor: z.string().optional(),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal("update"),
    commentId: z.string(),
    content: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE
  BaseSchema.extend({
    action: z.literal("delete"),
    commentId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST
  BaseSchema.extend({
    action: z.literal("list"),
    includeDeleted: z.boolean().optional().default(false),
    startIndex: z.number().int().min(0).optional(),
    maxResults: z.number().int().positive().optional().default(100),
  }),

  // GET
  BaseSchema.extend({
    action: z.literal("get"),
    commentId: z.string(),
  }),

  // RESOLVE
  BaseSchema.extend({
    action: z.literal("resolve"),
    commentId: z.string(),
  }),

  // REOPEN
  BaseSchema.extend({
    action: z.literal("reopen"),
    commentId: z.string(),
  }),

  // ADD_REPLY
  BaseSchema.extend({
    action: z.literal("add_reply"),
    commentId: z.string(),
    content: z.string(),
  }),

  // UPDATE_REPLY
  BaseSchema.extend({
    action: z.literal("update_reply"),
    commentId: z.string(),
    replyId: z.string(),
    content: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_REPLY
  BaseSchema.extend({
    action: z.literal("delete_reply"),
    commentId: z.string(),
    replyId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),
]);

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
