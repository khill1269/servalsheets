/**
 * ServalSheets v4 - Versions Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionsHandler } from '../../src/handlers/versions.js';
import { SheetsVersionsOutputSchema } from '../../src/schemas/versions.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { drive_v3 } from 'googleapis';

const createMockDriveApi = () => ({
  revisions: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
  files: {
    copy: vi.fn(),
    export: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  },
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {} as any,
});

describe('VersionsHandler', () => {
  let handler: VersionsHandler;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new VersionsHandler(
      mockContext,
      mockDriveApi as unknown as drive_v3.Drive
    );
  });

  it('lists revisions', async () => {
    mockDriveApi.revisions.list.mockResolvedValue({
      data: { revisions: [{ id: '1', modifiedTime: 'now', lastModifyingUser: { displayName: 'User' } }] },
    });

    const result = await handler.handle({
      request: {
        action: 'list_revisions',
        spreadsheetId: 'sheet-id',
      },
    });

    const parsed = SheetsVersionsOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.revisions?.[0].id).toBe('1');
    }
  });

  it('restores from snapshot', async () => {
    mockDriveApi.files.copy.mockResolvedValue({
      data: { id: 'copy-id', name: 'Restored', createdTime: 'now' },
    });
    mockDriveApi.files.get.mockResolvedValue({ data: { name: 'Original' } });

    const result = await handler.handle({
      request: {
        action: 'restore_snapshot',
        spreadsheetId: 'sheet-id',
        snapshotId: 'snap',
      },
    } as any);

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.snapshot?.copyId).toBe('copy-id');
    }
  });

  it('lists snapshots', async () => {
    mockDriveApi.files.list.mockResolvedValue({
      data: { files: [{ id: 'snap1', name: 'Snapshot - 1', createdTime: 'now', size: '123' }] },
    });

    const result = await handler.handle({
      request: {
        action: 'list_snapshots',
        spreadsheetId: 'sheet-id',
      },
    } as any);

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.snapshots?.[0].id).toBe('snap1');
    }
  });

  it('exports version data', async () => {
    mockDriveApi.files.export.mockResolvedValue({
      data: Buffer.from('file-bytes'),
    });

    const result = await handler.handle({
      request: {
        action: 'export_version',
        spreadsheetId: 'sheet-id',
        format: 'pdf',
      },
    } as any);

    const parsed = SheetsVersionsOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.exportData).toBeDefined();
    }
  });

  it('deletes snapshot with dryRun', async () => {
    const result = await handler.handle({
      request: {
        action: 'delete_snapshot',
        spreadsheetId: 'sheet-id',
        snapshotId: 'snap1',
        safety: { dryRun: true },
      },
    } as any);

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.dryRun).toBe(true);
    }
    expect(mockDriveApi.files.delete).not.toHaveBeenCalled();
  });
});
