import { describe, expect, it, vi } from 'vitest';

import { shutdownStdioServer } from '../../../packages/mcp-stdio/src/shutdown-stdio-server.js';

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

describe('@serval/mcp-stdio shutdownStdioServer', () => {
  it('is idempotent when already shut down', async () => {
    const logger = createLogger();
    await shutdownStdioServer(
      {
        getIsShutdown: () => true,
        setIsShutdown: vi.fn(),
        requestQueue: {
          size: 0,
          pending: 0,
          onIdle: async () => undefined,
          clear: vi.fn(),
        },
        getContext: () => null,
        getGoogleClient: () => null,
        clearGoogleClient: vi.fn(),
        clearAuthHandler: vi.fn(),
        clearHandlers: vi.fn(),
        clearContext: vi.fn(),
        clearCachedHandlerMap: vi.fn(),
      },
      {
        stopCacheCleanupTask: vi.fn(),
        stopHealthMonitor: vi.fn(async () => undefined),
        cleanupAllResources: vi.fn(async () => ({ total: 0, successful: 0, failed: 0 })),
        getBatchingSystem: vi.fn(async () => null),
        getPrefetchingSystem: vi.fn(async () => null),
        disposeConnectorManager: vi.fn(async () => undefined),
        taskStore: { dispose: vi.fn() },
        disposeTemporaryResourceStore: vi.fn(),
        teardownResourceNotifications: vi.fn(),
        log: logger,
      }
    );

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('cleans resources and clears references on normal shutdown', async () => {
    const logger = createLogger();
    const backendDispose = vi.fn(async () => undefined);
    const destroyGoogle = vi.fn();
    const requestMergerDestroy = vi.fn();
    const schedulerDispose = vi.fn();
    const batchingDestroy = vi.fn();
    const prefetchDestroy = vi.fn();

    const state = {
      getIsShutdown: vi.fn(() => false),
      setIsShutdown: vi.fn(),
      requestQueue: {
        size: 0,
        pending: 0,
        onIdle: async () => undefined,
        clear: vi.fn(),
      },
      getContext: vi.fn(() => ({
        rangeResolver: { clearCache: vi.fn() },
        backend: { dispose: backendDispose },
        requestMerger: { destroy: requestMergerDestroy },
        scheduler: { dispose: schedulerDispose },
      })),
      getGoogleClient: vi.fn(() => ({ destroy: destroyGoogle })),
      clearGoogleClient: vi.fn(),
      clearAuthHandler: vi.fn(),
      clearHandlers: vi.fn(),
      clearContext: vi.fn(),
      clearCachedHandlerMap: vi.fn(),
    };

    await shutdownStdioServer(state, {
      stopCacheCleanupTask: vi.fn(),
      stopHealthMonitor: vi.fn(async () => undefined),
      cleanupAllResources: vi.fn(async () => ({ total: 3, successful: 3, failed: 0 })),
      getBatchingSystem: vi.fn(async () => ({ destroy: batchingDestroy })),
      getPrefetchingSystem: vi.fn(async () => ({ destroy: prefetchDestroy })),
      disposeConnectorManager: vi.fn(async () => undefined),
      taskStore: { dispose: vi.fn() },
      disposeTemporaryResourceStore: vi.fn(),
      teardownResourceNotifications: vi.fn(),
      log: logger,
    });

    expect(state.setIsShutdown).toHaveBeenCalledWith(true);
    expect(backendDispose).toHaveBeenCalledOnce();
    expect(destroyGoogle).toHaveBeenCalledOnce();
    expect(requestMergerDestroy).toHaveBeenCalledOnce();
    expect(schedulerDispose).toHaveBeenCalledOnce();
    expect(batchingDestroy).toHaveBeenCalledOnce();
    expect(prefetchDestroy).toHaveBeenCalledOnce();
    expect(state.clearGoogleClient).toHaveBeenCalledOnce();
    expect(state.clearAuthHandler).toHaveBeenCalledOnce();
    expect(state.clearHandlers).toHaveBeenCalledOnce();
    expect(state.clearContext).toHaveBeenCalledOnce();
    expect(state.clearCachedHandlerMap).toHaveBeenCalledOnce();
  });

  it('clears queued requests if drain times out', async () => {
    const logger = createLogger();
    const originalSetTimeout = globalThis.setTimeout;
    vi.stubGlobal('setTimeout', ((fn: (...args: unknown[]) => void) => {
      fn();
      return 0;
    }) as typeof setTimeout);

    try {
      const clear = vi.fn();

      await shutdownStdioServer(
        {
          getIsShutdown: () => false,
          setIsShutdown: vi.fn(),
          requestQueue: {
            size: 2,
            pending: 1,
            onIdle: () => new Promise<void>(() => {}),
            clear,
          },
          getContext: () => null,
          getGoogleClient: () => null,
          clearGoogleClient: vi.fn(),
          clearAuthHandler: vi.fn(),
          clearHandlers: vi.fn(),
          clearContext: vi.fn(),
          clearCachedHandlerMap: vi.fn(),
        },
        {
          stopCacheCleanupTask: vi.fn(),
          stopHealthMonitor: vi.fn(async () => undefined),
          cleanupAllResources: vi.fn(async () => ({ total: 0, successful: 0, failed: 0 })),
          getBatchingSystem: vi.fn(async () => null),
          getPrefetchingSystem: vi.fn(async () => null),
          disposeConnectorManager: vi.fn(async () => undefined),
          taskStore: { dispose: vi.fn() },
          disposeTemporaryResourceStore: vi.fn(),
          teardownResourceNotifications: vi.fn(),
          log: logger,
        }
      );

      expect(clear).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        'Request queue drain timed out — cleared orphaned waiting requests',
        expect.any(Object)
      );
    } finally {
      vi.stubGlobal('setTimeout', originalSetTimeout);
    }
  });
});
