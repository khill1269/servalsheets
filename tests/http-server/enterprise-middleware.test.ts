import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerHttpEnterpriseMiddleware } from '../../src/http-server/enterprise-middleware.js';

describe('http enterprise middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers nothing when enterprise features are disabled', () => {
    const use = vi.fn();

    registerHttpEnterpriseMiddleware(
      {
        use,
      } as never,
      {
        enableTenantIsolation: false,
        enableRbac: false,
      }
    );

    expect(use).not.toHaveBeenCalled();
  });

  it('lazy-loads tenant isolation once and preserves tenant-then-spreadsheet ordering', async () => {
    const use = vi.fn();
    const order: string[] = [];
    const tenantIsolationHandler = vi.fn((_: unknown, __: unknown, next: (error?: unknown) => void) => {
      order.push('tenant');
      next();
    });
    const spreadsheetAccessHandler = vi.fn((_: unknown, __: unknown, next: (error?: unknown) => void) => {
      order.push('spreadsheet');
      next();
    });
    const importTenantIsolationModule = vi.fn(async () => ({
      tenantIsolationMiddleware: vi.fn(() => tenantIsolationHandler),
      validateSpreadsheetAccess: vi.fn(() => spreadsheetAccessHandler),
    }));
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpEnterpriseMiddleware(
      {
        use,
      } as never,
      {
        enableTenantIsolation: true,
        importTenantIsolationModule,
        log: log as never,
      }
    );

    const middleware = use.mock.calls[0]?.[0];
    expect(typeof middleware).toBe('function');

    const next = vi.fn();
    await middleware({} as never, {} as never, next);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(1);
    });

    await middleware({} as never, {} as never, next);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(2);
    });

    expect(importTenantIsolationModule).toHaveBeenCalledTimes(1);
    expect(tenantIsolationHandler).toHaveBeenCalledTimes(2);
    expect(spreadsheetAccessHandler).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['tenant', 'spreadsheet', 'tenant', 'spreadsheet']);
    expect(log.info).toHaveBeenCalledWith('HTTP Server: Tenant isolation middleware enabled');
  });

  it('propagates tenant middleware errors and skips spreadsheet validation', async () => {
    const use = vi.fn();
    const tenantIsolationHandler = vi.fn((_: unknown, __: unknown, next: (error?: unknown) => void) => {
      next(new Error('tenant failed'));
    });
    const spreadsheetAccessHandler = vi.fn();

    registerHttpEnterpriseMiddleware(
      {
        use,
      } as never,
      {
        enableTenantIsolation: true,
        importTenantIsolationModule: async () => ({
          tenantIsolationMiddleware: () => tenantIsolationHandler as never,
          validateSpreadsheetAccess: () => spreadsheetAccessHandler as never,
        }),
      }
    );

    const next = vi.fn();
    const middleware = use.mock.calls[0]?.[0];
    await middleware({} as never, {} as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
    expect(spreadsheetAccessHandler).not.toHaveBeenCalled();
  });

  it('lazy-loads RBAC once and reuses the handler across requests', async () => {
    const use = vi.fn();
    const rbacHandler = vi.fn((_: unknown, __: unknown, next: (error?: unknown) => void) => next());
    const rbacMiddlewareFactory = vi.fn(() => rbacHandler);
    const importRbacMiddlewareModule = vi.fn(async () => ({
      rbacMiddleware: rbacMiddlewareFactory,
    }));
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpEnterpriseMiddleware(
      {
        use,
      } as never,
      {
        enableRbac: true,
        importRbacMiddlewareModule,
        log: log as never,
      }
    );

    const middleware = use.mock.calls[0]?.[0];
    const next = vi.fn();
    await middleware({} as never, {} as never, next);
    await middleware({} as never, {} as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(2);
    });
    expect(importRbacMiddlewareModule).toHaveBeenCalledTimes(1);
    expect(rbacMiddlewareFactory).toHaveBeenCalledTimes(1);
    expect(rbacHandler).toHaveBeenCalledTimes(2);
    expect(log.info).toHaveBeenCalledWith('HTTP Server: RBAC middleware enabled');
  });
});
