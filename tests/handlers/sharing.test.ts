/**
 * ServalSheets v4 - Sharing Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharingHandler } from '../../src/handlers/sharing.js';
import { SheetsSharingOutputSchema } from '../../src/schemas/sharing.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { drive_v3 } from 'googleapis';

const createMockDriveApi = () => ({
  permissions: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  },
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {} as any,
  auth: {
    hasElevatedAccess: true,
    scopes: ['https://www.googleapis.com/auth/drive'],
  },
});

describe('SharingHandler', () => {
  let handler: SharingHandler;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new SharingHandler(
      mockContext,
      mockDriveApi as unknown as drive_v3.Drive
    );
  });

  it('shares with a user', async () => {
    mockDriveApi.permissions.create.mockResolvedValue({
      data: { id: 'perm-1', type: 'user', role: 'writer', emailAddress: 'a@example.com' },
    });

    const result = await handler.handle({
        action: 'share',
        spreadsheetId: 'sheet-id',
        type: 'user',
        role: 'writer',
        emailAddress: 'a@example.com',
    });

    const parsed = SheetsSharingOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.permission?.id).toBe('perm-1');
    }
  });

  it('supports dryRun for remove_permission', async () => {
    const result = await handler.handle({
        action: 'remove_permission',
        spreadsheetId: 'sheet-id',
        permissionId: 'perm-2',
        safety: { dryRun: true },
    });

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.dryRun).toBe(true);
    }
    expect(mockDriveApi.permissions.delete).not.toHaveBeenCalled();
  });
});
