import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborateHandler } from '../../src/handlers/collaborate.js';
import { driveRateLimiter } from '../../src/utils/drive-rate-limiter.js';
import type { HandlerContext } from '../../src/handlers/base.js';

function createMockContext(): HandlerContext {
  return {
    googleClient: {} as any,
    batchCompiler: {
      compile: vi.fn(),
      execute: vi.fn(),
      executeAll: vi.fn(),
    } as any,
    rangeResolver: {
      resolve: vi.fn(),
    } as any,
    sheetsApi: {
      spreadsheets: {
        get: vi.fn(),
      },
    } as any,
    driveApi: {} as any,
    auth: {
      hasElevatedAccess: true,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    },
    sessionId: 'test-session',
    requestId: 'test-request',
  } as HandlerContext;
}

function createMockDriveApi() {
  return {
    permissions: {
      create: vi.fn().mockResolvedValue({
        data: {
          id: 'perm-123',
          type: 'user',
          role: 'reader',
          emailAddress: 'alice@example.com',
        },
      }),
      list: vi.fn().mockResolvedValue({
        data: {
          permissions: [
            {
              id: 'perm-123',
              type: 'user',
              role: 'reader',
              emailAddress: 'alice@example.com',
            },
          ],
        },
      }),
    },
  };
}

describe('CollaborateHandler rate limiter integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('acquires rate limiter for Drive permission writes', async () => {
    const acquireSpy = vi.spyOn(driveRateLimiter, 'acquire').mockResolvedValue();
    const handler = new CollaborateHandler(createMockContext(), createMockDriveApi() as any);

    const result = await handler.handle({
      action: 'share_add',
      spreadsheetId: 'spreadsheet-id',
      type: 'user',
      role: 'reader',
      emailAddress: 'alice@example.com',
    });

    expect(result.response.success).toBe(true);
    expect(acquireSpy).toHaveBeenCalledTimes(1);
  });

  it('does not acquire rate limiter for read-only sharing actions', async () => {
    const acquireSpy = vi.spyOn(driveRateLimiter, 'acquire').mockResolvedValue();
    const handler = new CollaborateHandler(createMockContext(), createMockDriveApi() as any);

    const result = await handler.handle({
      action: 'share_list',
      spreadsheetId: 'spreadsheet-id',
    });

    expect(result.response.success).toBe(true);
    expect(acquireSpy).not.toHaveBeenCalled();
  });

  it('returns error response when rate limiter throws', async () => {
    vi.spyOn(driveRateLimiter, 'acquire').mockRejectedValue(
      new Error('Rate limit exceeded')
    );
    const handler = new CollaborateHandler(createMockContext(), createMockDriveApi() as any);

    const result = await handler.handle({
      action: 'share_add',
      spreadsheetId: 'spreadsheet-id',
      type: 'user',
      role: 'reader',
      emailAddress: 'alice@example.com',
    });

    // Handler must catch and return error response, not crash
    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error).toBeDefined();
    }
  });

  it('returns error response when Drive API throws during share_add', async () => {
    vi.spyOn(driveRateLimiter, 'acquire').mockResolvedValue();
    const mockDriveApi = createMockDriveApi();
    mockDriveApi.permissions.create.mockRejectedValue(
      Object.assign(new Error('Drive API error'), { code: 403 })
    );
    const handler = new CollaborateHandler(createMockContext(), mockDriveApi as any);

    const result = await handler.handle({
      action: 'share_add',
      spreadsheetId: 'spreadsheet-id',
      type: 'user',
      role: 'reader',
      emailAddress: 'bob@example.com',
    });

    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error).toBeDefined();
    }
  });
});
