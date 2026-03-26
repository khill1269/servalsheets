export interface InitializeStdioRuntimeState<TGoogleClient, TAuthHandler, TContext, THandlers> {
  readonly getGoogleClient: () => TGoogleClient | null;
  readonly setGoogleClient: (value: TGoogleClient | null) => void;
  readonly setAuthHandler: (value: TAuthHandler | null) => void;
  readonly setContext: (value: TContext | null) => void;
  readonly setHandlers: (value: THandlers | null) => void;
  readonly invalidateCachedHandlerMap: () => void;
}

export interface InitializeStdioRuntimeDependencies<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
> {
  readonly ensureToolIntegrityVerified: () => Promise<void>;
  readonly prepareRuntimePreflight: () => {
    envConfig: TEnvConfig;
    costTrackingEnabled: boolean;
  };
  readonly createAuthHandler: (options?: { googleClient?: TGoogleClient }) => TAuthHandler;
  readonly createOptionalGoogleClient: () => Promise<TGoogleClient | null>;
  readonly initializeGoogleRuntime: (input: {
    googleClient: TGoogleClient;
    envConfig: TEnvConfig;
    costTrackingEnabled: boolean;
  }) => Promise<{
    context: TContext;
    handlers: THandlers;
  }>;
  readonly afterGoogleRuntimeInitialized?: (input: {
    context: TContext;
    envConfig: TEnvConfig;
  }) => void;
  readonly preloadPythonCompute?: (envConfig: TEnvConfig) => void;
  readonly initializeBuiltinConnectors: () => void;
  readonly configureConnectorSheetWriter: (googleClient: TGoogleClient | null) => void;
  readonly initializeBilling: (envConfig: TEnvConfig) => void;
  readonly registerTools: () => void;
  readonly registerCompletions: () => void;
  readonly registerResources: () => Promise<void>;
  readonly shouldDeferResourceDiscovery: () => boolean | Promise<boolean>;
  readonly onResourceDiscoveryDeferred: () => void;
  readonly markResourcesRegistered: () => void;
  readonly registerPrompts: () => void;
  readonly registerTaskCancelHandler: () => void;
  readonly registerLogging: () => void;
  readonly startCacheCleanupTask: () => void;
  readonly startHeapWatchdog: () => void;
  readonly startHealthMonitor: () => Promise<void>;
}

export async function initializeStdioRuntime<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
>(
  state: InitializeStdioRuntimeState<TGoogleClient, TAuthHandler, TContext, THandlers>,
  dependencies: InitializeStdioRuntimeDependencies<
    TEnvConfig,
    TGoogleClient,
    TAuthHandler,
    TContext,
    THandlers
  >
): Promise<void> {
  await dependencies.ensureToolIntegrityVerified();

  const { envConfig, costTrackingEnabled } = dependencies.prepareRuntimePreflight();

  state.setAuthHandler(dependencies.createAuthHandler());

  const googleClient = await dependencies.createOptionalGoogleClient();
  state.setGoogleClient(googleClient);

  if (googleClient) {
    state.setAuthHandler(dependencies.createAuthHandler({ googleClient }));

    const googleRuntime = await dependencies.initializeGoogleRuntime({
      googleClient,
      envConfig,
      costTrackingEnabled,
    });
    state.setContext(googleRuntime.context);
    state.setHandlers(googleRuntime.handlers);
    state.invalidateCachedHandlerMap();

    dependencies.afterGoogleRuntimeInitialized?.({
      context: googleRuntime.context,
      envConfig,
    });
    dependencies.preloadPythonCompute?.(envConfig);
  }

  dependencies.initializeBuiltinConnectors();
  dependencies.configureConnectorSheetWriter(state.getGoogleClient());
  dependencies.initializeBilling(envConfig);
  dependencies.registerTools();
  dependencies.registerCompletions();

  if (await dependencies.shouldDeferResourceDiscovery()) {
    dependencies.onResourceDiscoveryDeferred();
  } else {
    await dependencies.registerResources();
    dependencies.markResourcesRegistered();
  }

  dependencies.registerPrompts();
  dependencies.registerTaskCancelHandler();
  dependencies.registerLogging();
  dependencies.startCacheCleanupTask();
  dependencies.startHeapWatchdog();
  await dependencies.startHealthMonitor();
}
