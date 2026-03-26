import type { InitializeStdioRuntimeDependencies } from './initialize-stdio-runtime.js';

export interface CreateStdioRuntimeDependenciesInput<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
> extends Omit<
    InitializeStdioRuntimeDependencies<TEnvConfig, TGoogleClient, TAuthHandler, TContext, THandlers>,
    'onResourceDiscoveryDeferred' | 'startHealthMonitor'
  > {
  readonly onResourceDiscoveryDeferred?: () => void;
  readonly startHealthMonitor: () => Promise<void>;
  readonly onHealthMonitorStarted?: () => void;
}

export function createStdioRuntimeDependencies<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
>(
  input: CreateStdioRuntimeDependenciesInput<
    TEnvConfig,
    TGoogleClient,
    TAuthHandler,
    TContext,
    THandlers
  >
): InitializeStdioRuntimeDependencies<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers
> {
  return {
    ensureToolIntegrityVerified: input.ensureToolIntegrityVerified,
    prepareRuntimePreflight: input.prepareRuntimePreflight,
    createAuthHandler: input.createAuthHandler,
    createOptionalGoogleClient: input.createOptionalGoogleClient,
    initializeGoogleRuntime: input.initializeGoogleRuntime,
    afterGoogleRuntimeInitialized: input.afterGoogleRuntimeInitialized,
    preloadPythonCompute: input.preloadPythonCompute,
    initializeBuiltinConnectors: input.initializeBuiltinConnectors,
    configureConnectorSheetWriter: input.configureConnectorSheetWriter,
    initializeBilling: input.initializeBilling,
    registerTools: input.registerTools,
    registerCompletions: input.registerCompletions,
    registerResources: input.registerResources,
    shouldDeferResourceDiscovery: input.shouldDeferResourceDiscovery,
    onResourceDiscoveryDeferred: input.onResourceDiscoveryDeferred ?? (() => {}),
    markResourcesRegistered: input.markResourcesRegistered,
    registerPrompts: input.registerPrompts,
    registerTaskCancelHandler: input.registerTaskCancelHandler,
    registerLogging: input.registerLogging,
    startCacheCleanupTask: input.startCacheCleanupTask,
    startHeapWatchdog: input.startHeapWatchdog,
    startHealthMonitor: async () => {
      await input.startHealthMonitor();
      input.onHealthMonitorStarted?.();
    },
  };
}
