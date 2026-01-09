/**
 * ServalSheets - Comments Handler Tests
 *
 * Tests for Drive API comment operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsHandler } from '../../src/handlers/comments.js';
import { SheetsCommentsOutputSchema } from '../../src/schemas/comments.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { drive_v3 } from 'googleapis';

// Mock Drive API
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

// Mock handler context
const createMockContext = (): HandlerContext => ({
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
    executeAll: vi.fn(),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({
      a1Notation: 'Sheet1!A1:B2',
      sheetId: 0,
      sheetName: 'Sheet1',
    }),
  } as any,
});

describe('CommentsHandler', () => {
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;
  let handler: CommentsHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new CommentsHandler(mockContext, mockDriveApi as any);
  });

  describe('add action', () => {
    it('should add comment to spreadsheet', async () => {
      const mockComment: drive_v3.Schema$Comment = {
        id: 'comment-123',
        content: 'This is a test comment',
        author: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T00:00:00Z',
        resolved: false,
        anchor: 'Sheet1!A1',
      };

      mockDriveApi.comments.create.mockResolvedValue({ data: mockComment });

      const result = await handler.handle({
        action: 'add',
        spreadsheetId: 'test-sheet-id',
        content: 'This is a test comment',
        anchor: 'Sheet1!A1',
      });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'add');
        expect(result.response.comment).toBeDefined();
        expect(result.response.comment?.id).toBe('comment-123');
        expect(result.response.comment?.content).toBe('This is a test comment');
      }
      expect(mockDriveApi.comments.create).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        requestBody: {
          content: 'This is a test comment',
          anchor: 'Sheet1!A1',
        },
        fields: expect.any(String),
      });

      const parseResult = SheetsCommentsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should add comment without anchor', async () => {
      const mockComment: drive_v3.Schema$Comment = {
        id: 'comment-124',
        content: 'General comment',
        author: {
          displayName: 'Test User',
        },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T00:00:00Z',
        resolved: false,
      };

      mockDriveApi.comments.create.mockResolvedValue({ data: mockComment });

      const result = await handler.handle({
        action: 'add',
        spreadsheetId: 'test-sheet-id',
        content: 'General comment',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.comment?.content).toBe('General comment');
      }
    });
  });

  describe('update action', () => {
    it('should update existing comment', async () => {
      const mockComment: drive_v3.Schema$Comment = {
        id: 'comment-123',
        content: 'Updated comment content',
        author: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T01:00:00Z',
        resolved: false,
      };

      mockDriveApi.comments.update.mockResolvedValue({ data: mockComment });

      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        content: 'Updated comment content',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'update');
        expect(result.response.comment?.content).toBe('Updated comment content');
        expect(result.response.comment?.modifiedTime).toBe('2024-01-01T01:00:00Z');
      }
      expect(mockDriveApi.comments.update).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        requestBody: { content: 'Updated comment content' },
        fields: expect.any(String),
      });
    });

    it('should respect dryRun safety option', async () => {
      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        content: 'Updated content',
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.dryRun).toBe(true);
      }
      expect(mockDriveApi.comments.update).not.toHaveBeenCalled();
    });
  });

  describe('delete action', () => {
    it('should delete comment', async () => {
      mockDriveApi.comments.delete.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'delete',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'delete');
      }
      expect(mockDriveApi.comments.delete).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
      });
    });

    it('should respect dryRun for destructive operation', async () => {
      const result = await handler.handle({
        action: 'delete',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.dryRun).toBe(true);
      }
      expect(mockDriveApi.comments.delete).not.toHaveBeenCalled();
    });
  });

  describe('list action', () => {
    it('should list all comments', async () => {
      const mockComments: drive_v3.Schema$Comment[] = [
        {
          id: 'comment-1',
          content: 'First comment',
          author: { displayName: 'User 1' },
          createdTime: '2024-01-01T00:00:00Z',
          modifiedTime: '2024-01-01T00:00:00Z',
          resolved: false,
        },
        {
          id: 'comment-2',
          content: 'Second comment',
          author: { displayName: 'User 2' },
          createdTime: '2024-01-02T00:00:00Z',
          modifiedTime: '2024-01-02T00:00:00Z',
          resolved: true,
        },
      ];

      mockDriveApi.comments.list.mockResolvedValue({ data: { comments: mockComments } });

      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'test-sheet-id',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'list');
        expect(result.response.comments).toHaveLength(2);
        expect(result.response.comments?.[0].id).toBe('comment-1');
        expect(result.response.comments?.[1].id).toBe('comment-2');
      }
      expect(mockDriveApi.comments.list).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        includeDeleted: false,
        pageToken: undefined,
        pageSize: 100,
        fields: expect.any(String),
      });
    });

    it('should list comments with pagination', async () => {
      mockDriveApi.comments.list.mockResolvedValue({ data: { comments: [] } });

      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'test-sheet-id',
        startIndex: 10,
        maxResults: 50,
      });

      expect(result.response.success).toBe(true);
      expect(mockDriveApi.comments.list).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        includeDeleted: false,
        pageToken: '10',
        pageSize: 50,
        fields: expect.any(String),
      });
    });

    it('should include deleted comments when requested', async () => {
      mockDriveApi.comments.list.mockResolvedValue({ data: { comments: [] } });

      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'test-sheet-id',
        includeDeleted: true,
      });

      expect(result.response.success).toBe(true);
      expect(mockDriveApi.comments.list).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        includeDeleted: true,
        pageToken: undefined,
        pageSize: 100,
        fields: expect.any(String),
      });
    });
  });

  describe('get action', () => {
    it('should get single comment with replies', async () => {
      const mockComment: drive_v3.Schema$Comment = {
        id: 'comment-123',
        content: 'Main comment',
        author: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T00:00:00Z',
        resolved: false,
        anchor: 'Sheet1!A1',
        replies: [
          {
            id: 'reply-1',
            content: 'First reply',
            author: { displayName: 'Reply User' },
            createdTime: '2024-01-01T01:00:00Z',
          },
        ],
      };

      mockDriveApi.comments.get.mockResolvedValue({ data: mockComment });

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'get');
        expect(result.response.comment?.id).toBe('comment-123');
        expect(result.response.comment?.replies).toHaveLength(1);
        expect(result.response.comment?.replies?.[0].content).toBe('First reply');
      }
      expect(mockDriveApi.comments.get).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        fields: expect.any(String),
      });
    });
  });

  describe('resolve action', () => {
    it('should resolve comment', async () => {
      const mockComment: drive_v3.Schema$Comment = {
        id: 'comment-123',
        content: 'Resolved comment',
        author: { displayName: 'Test User' },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T02:00:00Z',
        resolved: true,
      };

      mockDriveApi.comments.update.mockResolvedValue({ data: mockComment });

      const result = await handler.handle({
        action: 'resolve',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'resolve');
        expect(result.response.comment?.resolved).toBe(true);
      }
      expect(mockDriveApi.comments.update).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        requestBody: { resolved: true },
        fields: expect.any(String),
      });
    });
  });

  describe('reopen action', () => {
    it('should reopen resolved comment', async () => {
      const mockComment: drive_v3.Schema$Comment = {
        id: 'comment-123',
        content: 'Reopened comment',
        author: { displayName: 'Test User' },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T03:00:00Z',
        resolved: false,
      };

      mockDriveApi.comments.update.mockResolvedValue({ data: mockComment });

      const result = await handler.handle({
        action: 'reopen',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'reopen');
        expect(result.response.comment?.resolved).toBe(false);
      }
      expect(mockDriveApi.comments.update).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        requestBody: { resolved: false },
        fields: expect.any(String),
      });
    });
  });

  describe('add_reply action', () => {
    it('should add reply to comment', async () => {
      const mockReply = {
        id: 'reply-456',
        content: 'This is a reply',
      };

      mockDriveApi.replies.create.mockResolvedValue({ data: mockReply });

      const result = await handler.handle({
        action: 'add_reply',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        content: 'This is a reply',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'add_reply');
        expect(result.response.replyId).toBe('reply-456');
      }
      expect(mockDriveApi.replies.create).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        requestBody: { content: 'This is a reply' },
        fields: 'id',
      });
    });
  });

  describe('update_reply action', () => {
    it('should update reply', async () => {
      mockDriveApi.replies.update.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update_reply',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        replyId: 'reply-456',
        content: 'Updated reply content',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'update_reply');
        expect(result.response.replyId).toBe('reply-456');
      }
      expect(mockDriveApi.replies.update).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        replyId: 'reply-456',
        requestBody: { content: 'Updated reply content' },
      });
    });

    it('should respect dryRun for reply update', async () => {
      const result = await handler.handle({
        action: 'update_reply',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        replyId: 'reply-456',
        content: 'Updated reply',
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.dryRun).toBe(true);
      }
      expect(mockDriveApi.replies.update).not.toHaveBeenCalled();
    });
  });

  describe('delete_reply action', () => {
    it('should delete reply', async () => {
      mockDriveApi.replies.delete.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'delete_reply',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        replyId: 'reply-456',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response).toHaveProperty('action', 'delete_reply');
      }
      expect(mockDriveApi.replies.delete).toHaveBeenCalledWith({
        fileId: 'test-sheet-id',
        commentId: 'comment-123',
        replyId: 'reply-456',
      });
    });

    it('should respect dryRun for reply deletion', async () => {
      const result = await handler.handle({
        action: 'delete_reply',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
        replyId: 'reply-456',
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.dryRun).toBe(true);
      }
      expect(mockDriveApi.replies.delete).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing Drive API', async () => {
      const handlerWithoutDrive = new CommentsHandler(mockContext);

      const result = await handlerWithoutDrive.handle({
        action: 'add',
        spreadsheetId: 'test-sheet-id',
        content: 'Test comment',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toContain('Drive API not available');
      }
    });

    it('should handle API errors', async () => {
      mockDriveApi.comments.create.mockRejectedValue(
        new Error('API Error: 403 Permission denied')
      );

      const result = await handler.handle({
        action: 'add',
        spreadsheetId: 'test-sheet-id',
        content: 'Test comment',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBeDefined();
      }
    });

    it('should handle comment not found', async () => {
      mockDriveApi.comments.get.mockRejectedValue(
        new Error('Comment not found')
      );

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-sheet-id',
        commentId: 'non-existent',
      });

      expect(result.response.success).toBe(false);
    });

    it('should validate schema compliance for errors', async () => {
      mockDriveApi.comments.delete.mockRejectedValue(new Error('Test error'));

      const result = await handler.handle({
        action: 'delete',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-123',
      });

      const parseResult = SheetsCommentsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('comment mapping', () => {
    it('should handle missing optional fields', async () => {
      const minimalComment: drive_v3.Schema$Comment = {
        id: 'comment-minimal',
        content: 'Minimal comment',
        createdTime: '2024-01-01T00:00:00Z',
      };

      mockDriveApi.comments.create.mockResolvedValue({ data: minimalComment });

      const result = await handler.handle({
        action: 'add',
        spreadsheetId: 'test-sheet-id',
        content: 'Minimal comment',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.comment?.id).toBe('comment-minimal');
        expect(result.response.comment?.author.displayName).toBe('');
        expect(result.response.comment?.resolved).toBe(false);
      }
    });

    it('should map replies correctly', async () => {
      const commentWithReplies: drive_v3.Schema$Comment = {
        id: 'comment-with-replies',
        content: 'Original comment',
        author: { displayName: 'Original Author' },
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-01T00:00:00Z',
        resolved: false,
        replies: [
          {
            id: 'reply-1',
            content: 'Reply 1',
            author: { displayName: 'Reply Author 1' },
            createdTime: '2024-01-01T01:00:00Z',
          },
          {
            id: 'reply-2',
            content: 'Reply 2',
            author: { displayName: 'Reply Author 2' },
            createdTime: '2024-01-01T02:00:00Z',
          },
        ],
      };

      mockDriveApi.comments.get.mockResolvedValue({ data: commentWithReplies });

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-sheet-id',
        commentId: 'comment-with-replies',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.comment?.replies).toHaveLength(2);
        expect(result.response.comment?.replies?.[0].id).toBe('reply-1');
        expect(result.response.comment?.replies?.[1].id).toBe('reply-2');
      }
    });
  });
});
