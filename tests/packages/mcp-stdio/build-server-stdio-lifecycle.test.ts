import { describe, expect, it, vi } from 'vitest';

import {
  buildServerStdioShutdownArgs,
  buildServerStdioStartOptions,
} from '../../../packages/mcp-stdio/src/build-server-stdio-lifecycle.js';

describe('@serval/mcp-stdio buildServerStdioLifecycle', () => {
  it('builds shutdown args with the provided mutable state and dependencies', () => {
    const requestQueue = {
      size: 1,
      pending: 2,
      onIdle: vi.fn(async () => undefined),
      clear: vi.fn(),
    };
    const cleanupAllResources = vi.fn(async () => ({ total: 1, successful: 1, failed: 0 }));

    const result = buildServerStdioShutdownArgs({
      isShutdown: false,
      setIsShutdown: vi.fn(),
      requestQueue,
      getContext: vi.fn(() => null),
      getGoogleClient: vi.fn(() => null),
      clearGoogleClient: vi.fn(),
      clearAuthHandler: vi.fn(),
      clearHandlers: vi.fn(),
      clearContext: vi.fn(),
      clearCachedHandlerMap: vi.fn(),
      stopCacheCleanupTask: vi.fn(),
      stopHealthMonitor: vi.fn(async () => undefined),
      cleanupAllResources,
      getBatchingSystem: vi.fn(async () => null),
      getPrefetchingSystem: vi.fn(async () => null),
      disposeConnectorManager: vi.fn(async () => undefined),
      taskStore: { dispose: vi.fn() },
      disposeTemporaryResourceStore: vi.fn(),
      teardownResourceNotifications: vi.fn(),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    expect(result.state.requestQueue).toBe(requestQueue);
    expect(result.dependencies.cleanupAllResources).toBe(cleanupAllResources);
  });

  it('builds start options from explicit runtime dependencies', () => {
    const options = buildServerStdioStartOptions({
      initTelemetry: vi.fn(async () => undefined),
      validateEnv: vi.fn(),
      verifyToolIntegrity: vi.fn(async () => undefined),
      initializeForConnect: vi.fn(async () => undefined),
      initializeAfterConnect: vi.fn(async () => undefined),
      shutdown: vi.fn(async () => undefined),
      getProcessBreadcrumbs: () => ({ phase: 'start' }),
      isShutdown: () => false,
      server: { kind: 'server' },
      toolCount: 25,
      actionCount: 407,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    expect(options.toolCount).toBe(25);
    expect(options.actionCount).toBe(407);
    expect(options.getProcessBreadcrumbs()).toMatchObject({ phase: 'start' });
  });
});
