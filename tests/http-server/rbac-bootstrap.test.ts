import { describe, expect, it, vi } from 'vitest';
import { createHttpRbacInitializer } from '../../src/http-server/rbac-bootstrap.js';

describe('http rbac bootstrap helper', () => {
  it('is a no-op when RBAC is disabled', async () => {
    const initializeRbacManager = vi.fn(async () => undefined);
    const initializeBillingIntegration = vi.fn();
    const buildBillingBootstrapConfig = vi.fn(() => ({ billing: true }));

    const initializeRbac = createHttpRbacInitializer({
      envConfig: { ENABLE_RBAC: false },
      initializeRbacManager,
      initializeBillingIntegration,
      buildBillingBootstrapConfig,
    });

    await initializeRbac();

    expect(initializeRbacManager).not.toHaveBeenCalled();
    expect(buildBillingBootstrapConfig).not.toHaveBeenCalled();
    expect(initializeBillingIntegration).not.toHaveBeenCalled();
  });

  it('initializes RBAC and billing when enabled', async () => {
    const initializeRbacManager = vi.fn(async () => undefined);
    const initializeBillingIntegration = vi.fn();
    const buildBillingBootstrapConfig = vi.fn(() => ({ billing: true }));
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    const envConfig = { ENABLE_RBAC: true };
    const initializeRbac = createHttpRbacInitializer({
      envConfig,
      initializeRbacManager,
      initializeBillingIntegration,
      buildBillingBootstrapConfig,
      log: log as never,
    });

    await initializeRbac();

    expect(initializeRbacManager).toHaveBeenCalledOnce();
    expect(buildBillingBootstrapConfig).toHaveBeenCalledWith(envConfig);
    expect(initializeBillingIntegration).toHaveBeenCalledWith({ billing: true });
    expect(log.info).toHaveBeenCalledWith('RBAC manager initialized');
  });

  it('logs and rethrows RBAC initialization failures', async () => {
    const error = new Error('rbac failed');
    const initializeRbac = createHttpRbacInitializer({
      envConfig: { ENABLE_RBAC: true },
      initializeRbacManager: vi.fn(async () => {
        throw error;
      }),
      initializeBillingIntegration: vi.fn(),
      buildBillingBootstrapConfig: vi.fn(() => ({ billing: true })),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
      } as never,
    });

    await expect(initializeRbac()).rejects.toThrow(error);
  });
});
