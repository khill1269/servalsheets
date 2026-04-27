/**
 * ServalSheets - Category 6 Collaboration Tests (Simulation)
 *
 * Tests for sharing, comments, approvals, and snapshots
 * Note: These are integration tests verifying action dispatch, not full E2E tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollaborateHandler } from '../../src/handlers/collaborate.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4, drive_v3 } from 'googleapis';

const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-sheet-id',
        properties: { title: 'Test Sheet' },
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
      },
    }),
    batchUpdate: vi.fn().mockResolvedValue({ data: { replies: [] } }),
    developerMetadata: {
      search: vi.fn().mockResolvedValue({ data: { matchedDeveloperMetadata: [] } }),
      get: vi.fn().mockResolvedValue({ data: {} }),
    },
  },
});

const createMockDriveApi = () => ({
  files: {
    get: vi.fn().mockResolvedValue({ data: { id: 'test-sheet-id', name: 'Test Sheet' } }),
    copy: vi.fn().mockResolvedValue({ data: { id: 'snapshot-id' } }),
    list: vi.fn().mockResolvedValue({ data: { files: [], nextPageToken: undefined } }),
    delete: vi.fn().mockResolvedValue({}),
    export: vi.fn().mockResolvedValue({ data: Buffer.from('export-data') }),
  },
  permissions: {
    list: vi.fn().mockResolvedValue({ data: { permissions: [] } }),
    get: vi.fn().mockResolvedValue({ data: { id: 'perm-1', type: 'user', role: 'reader' } }),
    create: vi.fn().mockResolvedValue({ data: { id: 'perm-new' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'perm-2' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
  comments: {
    create: vi.fn().mockResolvedValue({ data: { id: 'comment-1', content: 'Test comment', createdTime: '', modifiedTime: '', resolved: false } }),
    list: vi.fn().mockResolvedValue({ data: { comments: [] } }),
    get: vi.fn().mockResolvedValue({ data: { id: 'comment-1', content: 'Test comment', createdTime: '', modifiedTime: '', resolved: false } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'comment-1', content: 'Updated', createdTime: '', modifiedTime: '', resolved: false } }),
    delete: vi.fn().mockResolvedValue({}),
  },
  replies: {
    create: vi.fn().mockResolvedValue({ data: { id: 'reply-1' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'reply-1' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
  revisions: {
    list: vi.fn().mockResolvedValue({ data: { revisions: [{ id: 'rev-1' }, { id: 'rev-2' }] } }),
    get: vi.fn().mockResolvedValue({ data: { id: 'rev-1', modifiedTime: '2024-01-01T00:00:00Z' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'rev-1', keepForever: true } }),
  },
  about: {
    get: vi.fn().mockResolvedValue({ data: { user: { emailAddress: 'approver@example.com' } } }),
  },
});

const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {} as any,
  rangeResolver: { resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B2' }) } as any,
  auth: { scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'] } as any,
  samplingServer: undefined,
  // Elicitation server needed by destructive operations requiring confirmation (share_remove, version_delete_snapshot)
  elicitationServer: {
    getClientCapabilities: vi.fn().mockReturnValue({ elicitation: { form: true } }),
    elicitInput: vi.fn().mockResolvedValue({ action: 'accept', content: { confirm: true } }),
    request: vi.fn().mockResolvedValue({ confirmed: true, reason: '' }),
  } as any,
  snapshotService: {
    create: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
    restore: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue({ snapshots: [] }),
    delete: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
  } as any,
  sessionContext: {} as any,
  confirmDestructiveAction: vi.fn().mockResolvedValue(undefined),
  createSnapshotIfNeeded: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
  sendProgress: vi.fn(),
  cachedApi: {} as any,
});

describe('Category 6: Collaboration Operations', () => {
  let handler: CollaborateHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSheetsApi = createMockSheetsApi();
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new CollaborateHandler(
      mockContext,
      mockDriveApi as unknown as drive_v3.Drive,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('6.1 share_add dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'share_add',
        spreadsheetId: 'test-sheet-id',
        type: 'user',
        role: 'writer',
        emailAddress: 'user@example.com',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.2 share_list dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'share_list', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.3 share_get dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'share_get', spreadsheetId: 'test-sheet-id', permissionId: 'perm-1' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.4 share_update dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'share_update',
        spreadsheetId: 'test-sheet-id',
        permissionId: 'perm-1',
        role: 'reader',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.5 share_remove dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'share_remove', spreadsheetId: 'test-sheet-id', permissionId: 'perm-1' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.6 share_set_link dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'share_set_link', spreadsheetId: 'test-sheet-id', enabled: true },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.7 share_get_link dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'share_get_link', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.8 comment_add dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ addComment: { comment: { commentId: 'c1' } } }] },
    });
    const result = await handler.handle({
      request: { action: 'comment_add', spreadsheetId: 'test-sheet-id', content: 'Test comment' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.9 comment_list dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'comment_list', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.10 approval_create dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'approval_create',
        spreadsheetId: 'test-sheet-id',
        description: 'Budget Review',
        approvers: ['approver@example.com'],
        requiredApprovals: 1,
        range: 'Sheet1!A1:C10',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.11 approval_approve dispatches', async () => {
    // Seed approval metadata so the lookup succeeds; email matches driveApi.about.get mock
    const approvalMetadata = {
      approvalId: 'apr-1',
      status: 'pending',
      approvers: ['approver@example.com'],
      approvedBy: [],
      requiredApprovals: 1,
      createdAt: new Date().toISOString(),
      requester: { displayName: 'Creator', emailAddress: undefined },
      range: 'Sheet1!A1:C10',
      spreadsheetId: 'test-sheet-id',
    };
    mockSheetsApi.spreadsheets.developerMetadata.search.mockResolvedValue({
      data: {
        matchedDeveloperMetadata: [
          {
            developerMetadata: {
              metadataId: 1,
              metadataKey: 'servalsheets_approval_apr-1',
              metadataValue: JSON.stringify(approvalMetadata),
            },
          },
        ],
      },
    });
    const result = await handler.handle({
      request: { action: 'approval_approve', spreadsheetId: 'test-sheet-id', approvalId: 'apr-1' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.12 undo dispatches', async () => {
    // undo/redo belong to sheets_history tool, not sheets_collaborate — expect dispatch failure
    const result = await handler.handle({
      request: { action: 'undo', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(false);
  });

  it('6.13 redo dispatches', async () => {
    // undo/redo belong to sheets_history tool, not sheets_collaborate — expect dispatch failure
    const result = await handler.handle({
      request: { action: 'redo', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(false);
  });

  it('6.14 version_create_snapshot dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'version_create_snapshot',
        spreadsheetId: 'test-sheet-id',
        name: 'Backup',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.15 version_list_snapshots dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'version_list_snapshots', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.16 version_restore_snapshot dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'version_restore_snapshot',
        spreadsheetId: 'test-sheet-id',
        snapshotId: 'snap-123',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.17 version_delete_snapshot dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'version_delete_snapshot',
        spreadsheetId: 'test-sheet-id',
        snapshotId: 'snap-123',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('6.18 diff_revisions dispatches', async () => {
    // diff_revisions belongs to sheets_history tool, not sheets_collaborate — expect dispatch failure
    const result = await handler.handle({
      request: {
        action: 'diff_revisions',
        spreadsheetId: 'test-sheet-id',
        revisionId1: 'rev-1',
        revisionId2: 'rev-2',
      },
    });
    expect(result.response.success).toBe(false);
  });
});
