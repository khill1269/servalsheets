import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock getRbacManager before importing the middleware
vi.mock('../../src/services/rbac-manager.js', () => ({
  getRbacManager: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/utils/error-factory.js', () => ({
  createPermissionError: vi.fn(({ operation, resourceId }) => ({
    code: 'PERMISSION_ERROR',
    message: `Permission denied for ${operation}`,
    details: { operation, resourceId },
    resolution: 'Contact an administrator',
  })),
}));

import { getRbacManager } from '../../src/services/rbac-manager.js';
import {
  rbacMiddleware,
  hasRole,
  requireAdmin,
} from '../../src/middleware/rbac-middleware.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/mcp',
    headers: {},
    body: null,
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function makeMcpToolCallBody(
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  return {
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
}

function mockRbacManager(overrides: {
  checkPermission?: ReturnType<typeof vi.fn>;
  getUserRoles?: ReturnType<typeof vi.fn>;
}) {
  const manager = {
    checkPermission:
      overrides.checkPermission ??
      vi.fn().mockResolvedValue({
        allowed: true,
        permission: 'allow',
        reason: 'Default allow',
        matchedRules: [],
      }),
    getUserRoles: overrides.getUserRoles ?? vi.fn().mockResolvedValue(['viewer']),
  };
  vi.mocked(getRbacManager).mockReturnValue(manager as ReturnType<typeof getRbacManager>);
  return manager;
}

describe('rbacMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('disabled mode', () => {
    it('calls next() without any permission check when enabled is false', async () => {
      const middleware = rbacMiddleware({ enabled: false });
      const req = createMockReq({
        body: makeMcpToolCallBody('sheets_data', { action: 'write', spreadsheetId: 'abc' }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(getRbacManager).not.toHaveBeenCalled();
    });
  });

  describe('skip paths', () => {
    const skipCases = [
      '/health/live',
      '/metrics',
      '/.well-known/openid-configuration',
      '/oauth/token',
      '/auth/callback',
    ];

    it.each(skipCases)('passes through without permission check for path %s', async (path) => {
      mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({ path });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(getRbacManager).not.toHaveBeenCalled();
    });
  });

  describe('user ID extraction', () => {
    it('passes through when no user ID can be extracted', async () => {
      mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: {},
        body: makeMcpToolCallBody('sheets_data', { action: 'read' }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(getRbacManager).not.toHaveBeenCalled();
    });

    it('extracts user ID from OAuth user sub', async () => {
      const manager = mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: {},
        body: makeMcpToolCallBody('sheets_data', { action: 'read' }),
      }) as Request & { user?: { sub: string } };
      req.user = { sub: 'user-oauth-123' };
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(manager.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-oauth-123' })
      );
    });

    it('extracts user ID from Bearer token header', async () => {
      const manager = mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer my-api-key' },
        body: makeMcpToolCallBody('sheets_data', { action: 'read' }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(manager.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'my-api-key' })
      );
    });
  });

  describe('non-tool-call requests', () => {
    it('passes through requests that are not MCP tools/call', async () => {
      mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: { method: 'tools/list', params: {} },
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(getRbacManager).not.toHaveBeenCalled();
    });
  });

  describe('permission denied', () => {
    it('returns 403 JSON when permission is denied', async () => {
      mockRbacManager({
        checkPermission: vi.fn().mockResolvedValue({
          allowed: false,
          permission: 'deny',
          reason: 'Tool access not permitted',
          matchedRules: [],
        }),
      });
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: makeMcpToolCallBody('sheets_data', { action: 'write', spreadsheetId: 'sheet-1' }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'PERMISSION_ERROR' }),
        })
      );
    });

    it('calls custom onPermissionDenied handler when provided', async () => {
      mockRbacManager({
        checkPermission: vi.fn().mockResolvedValue({
          allowed: false,
          permission: 'deny',
          reason: 'Denied',
          matchedRules: [],
        }),
      });
      const onPermissionDenied = vi.fn();
      const middleware = rbacMiddleware({ onPermissionDenied });
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: makeMcpToolCallBody('sheets_data', { action: 'read' }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(onPermissionDenied).toHaveBeenCalledWith(req, res, 'Denied');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('permission granted', () => {
    it('populates req.rbac and calls next() on success', async () => {
      mockRbacManager({
        checkPermission: vi.fn().mockResolvedValue({
          allowed: true,
          permission: 'allow',
          reason: 'Role allows',
          matchedRules: [{ ruleType: 'tool', ruleName: 'sheets_data', permission: 'allow' }],
        }),
      });
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: makeMcpToolCallBody('sheets_data', {
          action: 'write',
          spreadsheetId: 'sheet-123',
          range: 'A1:B10',
        }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      const reqWithRbac = req as Request & { rbac?: Record<string, unknown> };
      expect(reqWithRbac.rbac).toMatchObject({
        userId: 'key',
        toolName: 'sheets_data',
        actionName: 'write',
        resourceId: 'sheet-123',
      });
    });
  });

  describe('fail-secure on error', () => {
    it('returns 403 when rbacManager.checkPermission throws', async () => {
      mockRbacManager({
        checkPermission: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: makeMcpToolCallBody('sheets_data', { action: 'read' }),
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('argument extraction', () => {
    it('extracts action from args.action (flat form)', async () => {
      const manager = mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: makeMcpToolCallBody('sheets_data', { action: 'append' }),
      });
      await middleware(req, createMockRes(), createMockNext());

      expect(manager.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ actionName: 'append' })
      );
    });

    it('extracts action from args.request.action (wrapped form)', async () => {
      const manager = mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: {
          method: 'tools/call',
          params: {
            name: 'sheets_data',
            arguments: { request: { action: 'clear', spreadsheetId: 'sheet-x' } },
          },
        },
      });
      await middleware(req, createMockRes(), createMockNext());

      expect(manager.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ actionName: 'clear', resourceId: 'sheet-x' })
      );
    });

    it('extracts spreadsheetId from args.spreadsheetId (flat form)', async () => {
      const manager = mockRbacManager({});
      const middleware = rbacMiddleware();
      const req = createMockReq({
        path: '/mcp',
        headers: { authorization: 'Bearer key' },
        body: makeMcpToolCallBody('sheets_core', {
          action: 'get',
          spreadsheetId: 'flat-sheet-id',
        }),
      });
      await middleware(req, createMockRes(), createMockNext());

      expect(manager.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: 'flat-sheet-id' })
      );
    });
  });
});

describe('hasRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when user has the specified role', async () => {
    mockRbacManager({ getUserRoles: vi.fn().mockResolvedValue(['viewer', 'editor']) });
    expect(await hasRole('user-1', 'editor')).toBe(true);
  });

  it('returns false when user does not have the specified role', async () => {
    mockRbacManager({ getUserRoles: vi.fn().mockResolvedValue(['viewer']) });
    expect(await hasRole('user-1', 'admin')).toBe(false);
  });

  it('returns false when getUserRoles throws', async () => {
    mockRbacManager({ getUserRoles: vi.fn().mockRejectedValue(new Error('failure')) });
    expect(await hasRole('user-1', 'admin')).toBe(false);
  });
});

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no user ID can be extracted', async () => {
    const middleware = requireAdmin();
    const req = createMockReq({ headers: {} });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not have admin role', async () => {
    mockRbacManager({ getUserRoles: vi.fn().mockResolvedValue(['viewer']) });
    const middleware = requireAdmin();
    const req = createMockReq({ headers: { authorization: 'Bearer key' } });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user has admin role', async () => {
    mockRbacManager({ getUserRoles: vi.fn().mockResolvedValue(['admin', 'viewer']) });
    const middleware = requireAdmin();
    const req = createMockReq({ headers: { authorization: 'Bearer key' } });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
