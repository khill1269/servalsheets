import { describe, expect, it, vi } from 'vitest';

import {
  initializeStdioRuntime,
  prepareStdioRuntime,
} from '../../../packages/mcp-stdio/src/initialize-stdio-runtime.js';

describe('@serval/mcp-stdio initializeStdioRuntime', () => {
  it('prepares capabilities before connect and defers only background bootstrap work', async () => {
    const state = {
      googleClient: null as { id: string } | null,
      authHandler: null as { mode: string } | null,
      context: null as { tenant: string } | null,
      handlers: null as { count: number } | null,
    };

    const createOptionalGoogleClient = vi.fn(async () => ({ id: 'google-client' }));
    const initializeGoogleRuntime = vi.fn(async () => ({
      context: { tenant: 'tenant-1' },
      handlers: { count: 25 },
    }));
    const registerResources = vi.fn(async () => {});
    const startHealthMonitor = vi.fn(async () => {});

    const preparedRuntime = await prepareStdioRuntime(
      {
        getGoogleClient: () => state.googleClient,
        setGoogleClient: (value) => {
          state.googleClient = value;
        },
        setAuthHandler: (value) => {
          state.authHandler = value;
        },
        setContext: (value) => {
          state.context = value;
        },
        setHandlers: (value) => {
          state.handlers = value;
        },
        invalidateCachedHandlerMap: vi.fn(),
      },
      {
        ensureToolIntegrityVerified: vi.fn(async () => {}),
        prepareRuntimePreflight: vi.fn(() => ({
          envConfig: { DATA_DIR: '/tmp/data', ENABLE_PYTHON_COMPUTE: true },
          costTrackingEnabled: true,
        })),
        createAuthHandler: vi.fn((options?: { googleClient?: { id: string } }) =>
          options?.googleClient ? { mode: 'google' } : { mode: 'local' }
        ),
        createOptionalGoogleClient,
        initializeGoogleRuntime,
        afterGoogleRuntimeInitialized: vi.fn(),
        preloadPythonCompute: vi.fn(),
        initializeBuiltinConnectors: vi.fn(),
        configureConnectorSheetWriter: vi.fn(),
        initializeBilling: vi.fn(),
        registerTools: vi.fn(),
        registerCompletions: vi.fn(),
        registerResources,
        shouldDeferResourceDiscovery: vi.fn(() => false),
        onResourceDiscoveryDeferred: vi.fn(),
        markResourcesRegistered: vi.fn(),
        registerPrompts: vi.fn(),
        registerTaskCancelHandler: vi.fn(),
        registerLogging: vi.fn(),
        startCacheCleanupTask: vi.fn(),
        startHeapWatchdog: vi.fn(),
        startHealthMonitor,
      }
    );

    expect(state.googleClient).toEqual({ id: 'google-client' });
    expect(state.authHandler).toEqual({ mode: 'google' });
    expect(state.context).toEqual({ tenant: 'tenant-1' });
    expect(state.handlers).toEqual({ count: 25 });
    expect(createOptionalGoogleClient).toHaveBeenCalledOnce();
    expect(initializeGoogleRuntime).toHaveBeenCalledOnce();
    expect(registerResources).toHaveBeenCalledOnce();
    expect(startHealthMonitor).not.toHaveBeenCalled();

    await preparedRuntime.finalizePostConnect();

    expect(startHealthMonitor).toHaveBeenCalledOnce();
  });

  it('initializes the local runtime and defers resource discovery when configured', async () => {
    const state = {
      googleClient: null as { id: string } | null,
      authHandler: null as { mode: string } | null,
      context: null as { tenant: string } | null,
      handlers: null as { count: number } | null,
      resourcesRegistered: false,
    };

    await initializeStdioRuntime(
      {
        getGoogleClient: () => state.googleClient,
        setGoogleClient: (value) => {
          state.googleClient = value;
        },
        setAuthHandler: (value) => {
          state.authHandler = value;
        },
        setContext: (value) => {
          state.context = value;
        },
        setHandlers: (value) => {
          state.handlers = value;
        },
        invalidateCachedHandlerMap: vi.fn(),
      },
      {
        ensureToolIntegrityVerified: vi.fn(async () => {}),
        prepareRuntimePreflight: vi.fn(() => ({
          envConfig: { DATA_DIR: '/tmp/data', ENABLE_PYTHON_COMPUTE: true },
          costTrackingEnabled: true,
        })),
        createAuthHandler: vi.fn((options?: { googleClient?: { id: string } }) =>
          options?.googleClient ? { mode: 'google' } : { mode: 'local' }
        ),
        createOptionalGoogleClient: vi.fn(async () => ({ id: 'google-client' })),
        initializeGoogleRuntime: vi.fn(async () => ({
          context: { tenant: 'tenant-1' },
          handlers: { count: 25 },
        })),
        afterGoogleRuntimeInitialized: vi.fn(),
        preloadPythonCompute: vi.fn(),
        initializeBuiltinConnectors: vi.fn(),
        configureConnectorSheetWriter: vi.fn(),
        initializeBilling: vi.fn(),
        registerTools: vi.fn(),
        registerCompletions: vi.fn(),
        registerResources: vi.fn(async () => {}),
        shouldDeferResourceDiscovery: vi.fn(() => true),
        onResourceDiscoveryDeferred: vi.fn(),
        markResourcesRegistered: vi.fn(() => {
          state.resourcesRegistered = true;
        }),
        registerPrompts: vi.fn(),
        registerTaskCancelHandler: vi.fn(),
        registerLogging: vi.fn(),
        startCacheCleanupTask: vi.fn(),
        startHeapWatchdog: vi.fn(),
        startHealthMonitor: vi.fn(async () => {}),
      }
    );

    expect(state.googleClient).toEqual({ id: 'google-client' });
    expect(state.authHandler).toEqual({ mode: 'google' });
    expect(state.context).toEqual({ tenant: 'tenant-1' });
    expect(state.handlers).toEqual({ count: 25 });
    expect(state.resourcesRegistered).toBe(false);
  });

  it('registers resources immediately when discovery is not deferred', async () => {
    const markResourcesRegistered = vi.fn();
    const registerResources = vi.fn(async () => {});

    await initializeStdioRuntime(
      {
        getGoogleClient: () => null,
        setGoogleClient: vi.fn(),
        setAuthHandler: vi.fn(),
        setContext: vi.fn(),
        setHandlers: vi.fn(),
        invalidateCachedHandlerMap: vi.fn(),
      },
      {
        ensureToolIntegrityVerified: vi.fn(async () => {}),
        prepareRuntimePreflight: () => ({
          envConfig: { DATA_DIR: '/tmp/data' },
          costTrackingEnabled: false,
        }),
        createAuthHandler: vi.fn(() => ({ mode: 'local' })),
        createOptionalGoogleClient: vi.fn(async () => null),
        initializeGoogleRuntime: vi.fn(async () => ({
          context: { tenant: 'unused' },
          handlers: { count: 0 },
        })),
        initializeBuiltinConnectors: vi.fn(),
        configureConnectorSheetWriter: vi.fn(),
        initializeBilling: vi.fn(),
        registerTools: vi.fn(),
        registerCompletions: vi.fn(),
        registerResources,
        shouldDeferResourceDiscovery: () => false,
        onResourceDiscoveryDeferred: vi.fn(),
        markResourcesRegistered,
        registerPrompts: vi.fn(),
        registerTaskCancelHandler: vi.fn(),
        registerLogging: vi.fn(),
        startCacheCleanupTask: vi.fn(),
        startHeapWatchdog: vi.fn(),
        startHealthMonitor: vi.fn(async () => {}),
      }
    );

    expect(registerResources).toHaveBeenCalledOnce();
    expect(markResourcesRegistered).toHaveBeenCalledOnce();
  });
});
