/**
 * ServalSheets v4 - Comments Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsHandler } from '../../src/handlers/comments.js';
import { SheetsCommentsOutputSchema } from '../../src/schemas/comments.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { drive_v3 } from 'googleapis';

const createMockDriveApi = () => ({
  comments: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  },
  replies: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {} as any,
});

describe('CommentsHandler', () => {
  let handler: CommentsHandler;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new CommentsHandler(
      mockContext,
      mockDriveApi as unknown as drive_v3.Drive
    );
  });

  it('adds a comment', async () => {
    mockDriveApi.comments.create.mockResolvedValue({
      data: { id: 'c1', content: 'Hi', createdTime: 'now', modifiedTime: 'now', author: { displayName: 'User' }, resolved: false },
    });

    const result = await handler.handle({
      request: {
        action: 'add',
        spreadsheetId: 'sheet-id',
        content: 'Hi',
      },
    });

    const parsed = SheetsCommentsOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.comment?.id).toBe('c1');
    }
  });

  it('deletes a reply with dryRun', async () => {
    const result = await handler.handle({
      request: {
        action: 'delete_reply',
        spreadsheetId: 'sheet-id',
        commentId: 'c1',
        replyId: 'r1',
        safety: { dryRun: true },
      },
    });

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.dryRun).toBe(true);
    }
    expect(mockDriveApi.replies.delete).not.toHaveBeenCalled();
  });
});
