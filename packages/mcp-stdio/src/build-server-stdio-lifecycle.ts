import type {
  StdioShutdownContextLike,
  StdioShutdownDependencies,
  StdioShutdownGoogleClientLike,
  StdioShutdownState,
} from './shutdown-stdio-server.js';

export interface BuildStdioLifecycleLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export interface BuildServerStdioShutdownArgsInput<
  TContext extends StdioShutdownContextLike,
  TGoogleClient extends StdioShutdownGoogleClientLike,
> {
  readonly isShutdown: boolean;
  readonly setIsShutdown: (value: boolean) => void;
  readonly requestQueue: StdioShutdownState<TContext, TGoogleClient>['requestQueue'];
  readonly getContext: () => TContext | null;
  readonly getGoogleClient: () => TGoogleClient | null;
  readonly clearGoogleClient: () => void;
  readonly clearAuthHandler: () => void;
  readonly clearHandlers: () => void;
  readonly clearContext: () => void;
  readonly clearCachedHandlerMap: () => void;
  readonly stopCacheCleanupTask: () => void;
  readonly stopHealthMonitor: () => Promise<void>;
  readonly cleanupAllResources: StdioShutdownDependencies<
    TContext,
    TGoogleClient
  >['cleanupAllResources'];
  readonly getBatchingSystem: StdioShutdownDependencies<TContext, TGoogleClient>['getBatchingSystem'];
  readonly getPrefetchingSystem: StdioShutdownDependencies<
    TContext,
    TGoogleClient
  >['getPrefetchingSystem'];
  readonly disposeConnectorManager: StdioShutdownDependencies<
    TContext,
    TGoogleClient
  >['disposeConnectorManager'];
  readonly taskStore: StdioShutdownDependencies<TContext, TGoogleClient>['taskStore'];
  readonly disposeTemporaryResourceStore: () => void;
  readonly teardownResourceNotifications: () => void;
  readonly log: BuildStdioLifecycleLogger;
}

export function buildServerStdioShutdownArgs<
  TContext extends StdioShutdownContextLike,
  TGoogleClient extends StdioShutdownGoogleClientLike,
>(input: BuildServerStdioShutdownArgsInput<TContext, TGoogleClient>): {
  state: StdioShutdownState<TContext, TGoogleClient>;
  dependencies: StdioShutdownDependencies<TContext, TGoogleClient>;
} {
  return {
    state: {
      getIsShutdown: () => input.isShutdown,
      setIsShutdown: input.setIsShutdown,
      requestQueue: input.requestQueue,
      getContext: input.getContext,
      getGoogleClient: input.getGoogleClient,
      clearGoogleClient: input.clearGoogleClient,
      clearAuthHandler: input.clearAuthHandler,
      clearHandlers: input.clearHandlers,
      clearContext: input.clearContext,
      clearCachedHandlerMap: input.clearCachedHandlerMap,
    },
    dependencies: {
      stopCacheCleanupTask: input.stopCacheCleanupTask,
      stopHealthMonitor: input.stopHealthMonitor,
      cleanupAllResources: input.cleanupAllResources,
      getBatchingSystem: input.getBatchingSystem,
      getPrefetchingSystem: input.getPrefetchingSystem,
      disposeConnectorManager: input.disposeConnectorManager,
      taskStore: input.taskStore,
      disposeTemporaryResourceStore: input.disposeTemporaryResourceStore,
      teardownResourceNotifications: input.teardownResourceNotifications,
      log: input.log,
    },
  };
}

export interface BuildServerStdioStartOptionsInput<TServer> {
  readonly initTelemetry: () => Promise<void>;
  readonly validateEnv: () => void;
  readonly verifyToolIntegrity: () => Promise<void>;
  readonly initialize: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
  readonly getProcessBreadcrumbs: () => Record<string, unknown>;
  readonly ensureResourcesRegistered: () => Promise<void>;
  readonly isShutdown: () => boolean;
  readonly server: TServer;
  readonly toolCount: number;
  readonly actionCount: number;
  readonly log: BuildStdioLifecycleLogger;
}

export function buildServerStdioStartOptions<TServer>(
  input: BuildServerStdioStartOptionsInput<TServer>
) {
  return {
    initTelemetry: input.initTelemetry,
    validateEnv: input.validateEnv,
    verifyToolIntegrity: input.verifyToolIntegrity,
    initialize: input.initialize,
    shutdown: input.shutdown,
    getProcessBreadcrumbs: input.getProcessBreadcrumbs,
    server: input.server,
    ensureResourcesRegistered: input.ensureResourcesRegistered,
    getIsShutdown: input.isShutdown,
    toolCount: input.toolCount,
    actionCount: input.actionCount,
    log: input.log,
  };
}
