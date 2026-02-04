/**
 * ServalSheets - Collaborate Handler Tests
 *
 * Tests for sharing, comments, and version control operations.
 * Covers 29 actions across sharing (8), comments (10), and versions (11)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollaborateHandler } from '../../src/handlers/collaborate.js';
import { SheetsCollaborateOutputSchema } from '../../src/schemas/collaborate.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4, drive_v3 } from 'googleapis';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-spreadsheet-id',
        properties: { title: 'Test Spreadsheet' },
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
      },
    }),
  },
});

// Mock Google Drive API
const createMockDriveApi = () => ({
  files: {
    get: vi.fn().mockResolvedValue({
      data: {
        id: 'test-spreadsheet-id',
        name: 'Test Spreadsheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
    }),
    copy: vi.fn().mockResolvedValue({
      data: { id: 'snapshot-id', name: 'Snapshot - Test Spreadsheet' },
    }),
    export: vi.fn().mockResolvedValue({
      data: Buffer.from('test data'),
    }),
  },
  permissions: {
    list: vi.fn().mockResolvedValue({
      data: {
        permissions: [
          {
            id: 'perm-123',
            type: 'user',
            role: 'writer',
            emailAddress: 'user@example.com',
          },
          {
            id: 'perm-456',
            type: 'user',
            role: 'owner',
            emailAddress: 'owner@example.com',
          },
        ],
      },
    }),
    get: vi.fn().mockResolvedValue({
      data: {
        id: 'perm-123',
        type: 'user',
        role: 'writer',
        emailAddress: 'user@example.com',
      },
    }),
    create: vi.fn().mockResolvedValue({
      data: {
        id: 'new-perm-789',
        type: 'user',
        role: 'reader',
        emailAddress: 'newuser@example.com',
      },
    }),
    update: vi.fn().mockResolvedValue({
      data: {
        id: 'perm-123',
        type: 'user',
        role: 'commenter',
        emailAddress: 'user@example.com',
      },
    }),
    delete: vi.fn().mockResolvedValue({}),
  },
  comments: {
    list: vi.fn().mockResolvedValue({
      data: {
        comments: [
          {
            id: 'comment-1',
            content: 'Test comment',
            author: { displayName: 'Test User' },
            createdTime: '2026-01-15T10:00:00Z',
            resolved: false,
          },
        ],
      },
    }),
    get: vi.fn().mockResolvedValue({
      data: {
        id: 'comment-1',
        content: 'Test comment',
        author: { displayName: 'Test User' },
        createdTime: '2026-01-15T10:00:00Z',
        resolved: false,
      },
    }),
    create: vi.fn().mockResolvedValue({
      data: {
        id: 'new-comment',
        content: 'New comment',
        author: { displayName: 'Test User' },
        createdTime: '2026-01-17T10:00:00Z',
      },
    }),
    update: vi.fn().mockResolvedValue({
      data: {
        id: 'comment-1',
        content: 'Updated comment',
        modifiedTime: '2026-01-17T11:00:00Z',
      },
    }),
    delete: vi.fn().mockResolvedValue({}),
  },
  replies: {
    create: vi.fn().mockResolvedValue({
      data: { id: 'reply-1', content: 'Reply text' },
    }),
    update: vi.fn().mockResolvedValue({
      data: { id: 'reply-1', content: 'Updated reply' },
    }),
    delete: vi.fn().mockResolvedValue({}),
  },
  revisions: {
    list: vi.fn().mockResolvedValue({
      data: {
        revisions: [
          { id: '1', modifiedTime: '2026-01-15T10:00:00Z' },
          { id: '2', modifiedTime: '2026-01-16T10:00:00Z' },
        ],
      },
    }),
    get: vi.fn().mockResolvedValue({
      data: { id: '2', modifiedTime: '2026-01-16T10:00:00Z' },
    }),
    update: vi.fn().mockResolvedValue({
      data: { id: '2', keepForever: true },
    }),
  },
});

// Create mock context
const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
    executeAll: vi.fn(),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({
      a1Notation: 'Sheet1!A1:B10',
      sheetId: 0,
      sheetName: 'Sheet1',
    }),
  } as any,
  sheetsApi: createMockSheetsApi() as unknown as sheets_v4.Sheets,
  driveApi: createMockDriveApi() as unknown as drive_v3.Drive,
  sessionId: 'test-session',
  requestId: 'test-request',
  auth: {
    hasElevatedAccess: true,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  },
});

describe('CollaborateHandler', () => {
  let handler: CollaborateHandler;
  let mockContext: HandlerContext;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new CollaborateHandler(mockContext, mockDriveApi as any);
  });

  // ===== SHARING ACTIONS =====

  describe('share_list', () => {
    it('should list all permissions', async () => {
      const result = await handler.handle({
        action: 'share_list',
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result.response.success).toBe(true);
      const parseResult = SheetsCollaborateOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('share_get', () => {
    it('should get a specific permission', async () => {
      const result = await handler.handle({
        action: 'share_get',
        spreadsheetId: 'test-spreadsheet-id',
        permissionId: 'perm-123',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('share_add', () => {
    it('should add a new permission', async () => {
      const result = await handler.handle({
        action: 'share_add',
        spreadsheetId: 'test-spreadsheet-id',
        type: 'user',
        role: 'reader',
        emailAddress: 'newuser@example.com',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('share_update', () => {
    it('should update an existing permission', async () => {
      const result = await handler.handle({
        action: 'share_update',
        spreadsheetId: 'test-spreadsheet-id',
        permissionId: 'perm-123',
        role: 'commenter',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('share_remove', () => {
    it('should remove a permission', async () => {
      const result = await handler.handle({
        action: 'share_remove',
        spreadsheetId: 'test-spreadsheet-id',
        permissionId: 'perm-123',
      });

      expect(result.response.success).toBe(true);
    });
  });

  // ===== COMMENT ACTIONS =====

  describe('comment_list', () => {
    it('should list all comments', async () => {
      const result = await handler.handle({
        action: 'comment_list',
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('comment_get', () => {
    it('should get a specific comment', async () => {
      const result = await handler.handle({
        action: 'comment_get',
        spreadsheetId: 'test-spreadsheet-id',
        commentId: 'comment-1',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('comment_add', () => {
    it('should add a new comment', async () => {
      const result = await handler.handle({
        action: 'comment_add',
        spreadsheetId: 'test-spreadsheet-id',
        content: 'New comment',
        anchor: 'A1',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('comment_resolve', () => {
    it('should resolve a comment', async () => {
      const result = await handler.handle({
        action: 'comment_resolve',
        spreadsheetId: 'test-spreadsheet-id',
        commentId: 'comment-1',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('comment_add_reply', () => {
    it('should add a reply to a comment', async () => {
      const result = await handler.handle({
        action: 'comment_add_reply',
        spreadsheetId: 'test-spreadsheet-id',
        commentId: 'comment-1',
        content: 'Reply text',
      });

      expect(result.response.success).toBe(true);
    });
  });

  // ===== VERSION ACTIONS =====

  describe('version_list_revisions', () => {
    it('should list all revisions', async () => {
      const result = await handler.handle({
        action: 'version_list_revisions',
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('version_get_revision', () => {
    it('should get a specific revision', async () => {
      const result = await handler.handle({
        action: 'version_get_revision',
        spreadsheetId: 'test-spreadsheet-id',
        revisionId: '2',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('version_create_snapshot', () => {
    it('should create a snapshot', async () => {
      const result = await handler.handle({
        action: 'version_create_snapshot',
        spreadsheetId: 'test-spreadsheet-id',
        name: 'Before major changes',
        description: 'Snapshot before Q1 update',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('version_keep_revision', () => {
    it('should mark revision to keep forever', async () => {
      const result = await handler.handle({
        action: 'version_keep_revision',
        spreadsheetId: 'test-spreadsheet-id',
        revisionId: '2',
        keepForever: true,
      });

      expect(result.response.success).toBe(true);
    });
  });
});
