export interface StdioShutdownLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export interface StdioShutdownQueueLike {
  readonly size: number;
  readonly pending: number;
  onIdle(): Promise<void>;
  clear(): void;
}

export interface StdioShutdownRangeResolverLike {
  clearCache(): void;
}

export interface StdioShutdownBackendLike {
  dispose(): Promise<void>;
}

export interface StdioShutdownRequestMergerLike {
  destroy(): void;
}

export interface StdioShutdownSchedulerLike {
  dispose(): void;
}

export interface StdioShutdownContextLike {
  rangeResolver?: StdioShutdownRangeResolverLike;
  backend?: StdioShutdownBackendLike;
  requestMerger?: StdioShutdownRequestMergerLike;
  scheduler?: StdioShutdownSchedulerLike;
}

export interface StdioShutdownGoogleClientLike {
  destroy(): void;
}

export interface StdioShutdownTaskStoreLike {
  dispose(): void;
}

export interface StdioShutdownState<TContext, TGoogleClient> {
  readonly getIsShutdown: () => boolean;
  readonly setIsShutdown: (value: boolean) => void;
  readonly requestQueue: StdioShutdownQueueLike;
  readonly getContext: () => TContext | null;
  readonly getGoogleClient: () => TGoogleClient | null;
  readonly clearGoogleClient: () => void;
  readonly clearAuthHandler: () => void;
  readonly clearHandlers: () => void;
  readonly clearContext: () => void;
  readonly clearCachedHandlerMap: () => void;
}

export interface StdioShutdownDependencies<TContext, TGoogleClient> {
  readonly stopCacheCleanupTask: () => void;
  readonly stopHealthMonitor: () => Promise<void>;
  readonly cleanupAllResources: () => Promise<{
    total: number;
    successful: number;
    failed: number;
    errors?: unknown;
  }>;
  readonly getBatchingSystem: () => Promise<{ destroy(): void } | null | undefined>;
  readonly getPrefetchingSystem: () => Promise<{ destroy(): void } | null | undefined>;
  readonly disposeConnectorManager: () => Promise<void>;
  readonly taskStore: StdioShutdownTaskStoreLike;
  readonly disposeTemporaryResourceStore: () => void;
  readonly teardownResourceNotifications: () => void;
  readonly log: StdioShutdownLogger;
}

async function awaitWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutFactory: () => Error
): Promise<T> {
  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(timeoutFactory()), timeoutMs);
    }),
  ]);
}

export async function shutdownStdioServer<
  TContext extends StdioShutdownContextLike,
  TGoogleClient extends StdioShutdownGoogleClientLike,
>(
  state: StdioShutdownState<TContext, TGoogleClient>,
  dependencies: StdioShutdownDependencies<TContext, TGoogleClient>
): Promise<void> {
  if (state.getIsShutdown()) {
    return;
  }
  state.setIsShutdown(true);

  dependencies.log.info('ServalSheets: Shutting down...');

  const pendingAtShutdown = state.requestQueue.size;
  dependencies.log.info('Waiting for request queue to drain', {
    queueSize: pendingAtShutdown,
    pendingCount: state.requestQueue.pending,
  });

  let timedOut = false;
  await Promise.race([
    state.requestQueue.onIdle(),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, 10000)
    ),
  ]);

  if (timedOut && state.requestQueue.size > 0) {
    const orphaned = state.requestQueue.size;
    state.requestQueue.clear();
    dependencies.log.warn('Request queue drain timed out — cleared orphaned waiting requests', {
      orphaned,
      stillRunning: state.requestQueue.pending,
    });
  } else {
    dependencies.log.info('Request queue drained');
  }

  const context = state.getContext();
  context?.rangeResolver?.clearCache();

  dependencies.stopCacheCleanupTask();

  await awaitWithTimeout(
    dependencies.stopHealthMonitor(),
    5000,
    () => new Error('Health monitor stop timed out after 5s')
  ).catch((err: Error) => {
    dependencies.log.warn('Health monitor stop did not complete cleanly', {
      error: err.message,
    });
  });
  dependencies.log.info('Health monitoring stopped');

  const cleanupResult = await dependencies.cleanupAllResources();
  dependencies.log.info('Resource cleanup complete', {
    total: cleanupResult.total,
    successful: cleanupResult.successful,
    failed: cleanupResult.failed,
  });

  if (cleanupResult.failed > 0) {
    dependencies.log.warn('Some resources failed to clean up', {
      errors: cleanupResult.errors,
    });
  }

  try {
    if (context?.backend) {
      await context.backend.dispose();
      dependencies.log.debug('SpreadsheetBackend disposed');
    }

    const googleClient = state.getGoogleClient();
    if (googleClient) {
      googleClient.destroy();
      dependencies.log.debug('GoogleApiClient destroyed');
    }

    if (context?.requestMerger) {
      context.requestMerger.destroy();
      dependencies.log.debug('RequestMerger destroyed');
    }

    if (context?.scheduler) {
      context.scheduler.dispose();
      dependencies.log.debug('SchedulerService disposed');
    }

    const batchingSystem = await dependencies.getBatchingSystem();
    if (batchingSystem) {
      batchingSystem.destroy();
      dependencies.log.debug('BatchingSystem destroyed');
    }

    const prefetchingSystem = await dependencies.getPrefetchingSystem();
    if (prefetchingSystem) {
      prefetchingSystem.destroy();
      dependencies.log.debug('PrefetchingSystem destroyed');
    }
  } catch (error) {
    dependencies.log.warn('Error during service cleanup', { error });
  }

  await dependencies.disposeConnectorManager();
  dependencies.log.debug('ConnectorManager disposed');

  dependencies.taskStore.dispose();
  dependencies.disposeTemporaryResourceStore();
  dependencies.teardownResourceNotifications();

  state.clearGoogleClient();
  state.clearAuthHandler();
  state.clearHandlers();
  state.clearContext();
  state.clearCachedHandlerMap();

  dependencies.log.info('ServalSheets: Shutdown complete');
}
