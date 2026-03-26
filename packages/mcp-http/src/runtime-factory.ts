export interface HttpMcpServerInstance<TMcpServer, TTaskStore> {
  readonly mcpServer: TMcpServer;
  readonly taskStore: TTaskStore;
  readonly disposeRuntime: () => void;
}

export interface HttpRuntimeFactoryLogger {
  warn(message: string, meta?: unknown): void;
}

export interface HttpLoggingSetLevelHandlerParams<
  TMcpServer,
  TSubscriber,
  TLog,
  TRateLimitState,
> {
  readonly server: TMcpServer;
  readonly subscriberId: string;
  readonly subscribers: Map<string, TSubscriber>;
  readonly installLoggingBridge: () => void;
  readonly createRateLimitState: () => TRateLimitState;
  readonly log: TLog;
}

export interface CreateHttpRuntimeFactoryOptions<
  TMcpServer,
  TRawServer,
  TTaskStore,
  TEnvConfig,
  TCapabilities,
  TSamplingServer,
  TCostTracker,
  TRequestDeduplicator,
  TGoogleClient,
  TContext,
  THandlers,
  TSubscriber,
  TBillingConfig,
  TRateLimitState,
  TIcons = unknown,
  TRequestId extends string | number = string | number,
  TBridge extends object = object,
> {
  readonly googleToken?: string;
  readonly googleRefreshToken?: string;
  readonly sessionId?: string;
  readonly subscribers: Map<string, TSubscriber>;
  readonly installLoggingBridge: () => void;
  readonly prepareRuntimePreflight: () => {
    envConfig: TEnvConfig;
    costTrackingEnabled: boolean;
  };
  readonly createTaskStore: () => Promise<TTaskStore>;
  readonly createServerCapabilities: () => TCapabilities;
  readonly createBaseMcpServer: (options: {
    serverInfo: {
      name: string;
      version: string;
      icons: TIcons;
    };
    capabilities: TCapabilities;
    instructions: string;
    taskStore: TTaskStore;
  }) => TMcpServer;
  readonly serverInfo: {
    name: string;
    version: string;
    icons: TIcons;
  };
  readonly instructions: string;
  readonly getRawServer: (server: TMcpServer) => TRawServer;
  readonly installInitializeCancellationGuard: (
    server: TMcpServer,
    options: { onIgnoredCancellation: (requestId: TRequestId) => void }
  ) => unknown;
  readonly getOrCreateSessionContextAsync: (sessionId: string) => Promise<unknown>;
  readonly createHandlerRuntimeBridge: (options: {
    server: TRawServer;
    createSamplingServer: (server: TRawServer) => TSamplingServer;
    costTrackingEnabled: boolean;
    getCostTracker: () => TCostTracker;
  }) => TBridge;
  readonly createTaskAwareSamplingServer: (server: TRawServer) => TSamplingServer;
  readonly getCostTracker: () => TCostTracker;
  readonly createTokenBackedInitializedGoogleHandlerBundle: (options: {
    accessToken: string;
    refreshToken?: string;
    onProgress: (event: {
      current: number;
      total?: number;
      message?: string;
    }) => void;
    requestDeduplicator: TRequestDeduplicator;
    extraContext: object;
  }) => Promise<{
    googleClient: TGoogleClient;
    context: TContext;
    handlers: THandlers;
  }>;
  readonly sendProgress: (current: number, total?: number, message?: string) => void;
  readonly requestDeduplicator: TRequestDeduplicator;
  readonly buildBillingBootstrapConfig: (envConfig: TEnvConfig) => TBillingConfig;
  readonly initializeBillingIntegration: (config: TBillingConfig) => unknown;
  readonly registerServalSheetsTools: (
    server: TMcpServer,
    handlers: THandlers | null,
    options: { googleClient: TGoogleClient | null }
  ) => Promise<{ dispose: () => void }>;
  readonly registerServerPrompts: (server: TMcpServer) => void;
  readonly registerServerResources: (options: {
    server: TMcpServer;
    googleClient: TGoogleClient | null;
    context: TContext | null;
    options: {
      deferKnowledgeResources: boolean;
      includeTimeTravelResources: boolean;
      toolsListSyncReason: string;
    };
  }) => Promise<void>;
  readonly createRandomUUID: () => string;
  readonly registerHttpLoggingSetLevelHandler: (
    params: HttpLoggingSetLevelHandlerParams<
      TMcpServer,
      TSubscriber,
      HttpRuntimeFactoryLogger,
      TRateLimitState
    >
  ) => void;
  readonly createRateLimitState: () => TRateLimitState;
  readonly teardownResourceNotifications: (server: TMcpServer) => void;
  readonly log: HttpRuntimeFactoryLogger;
}

export async function createHttpMcpServerInstance<
  TMcpServer,
  TRawServer,
  TTaskStore,
  TEnvConfig,
  TCapabilities,
  TSamplingServer,
  TCostTracker,
  TRequestDeduplicator,
  TGoogleClient,
  TContext,
  THandlers,
  TSubscriber,
  TBillingConfig,
  TRateLimitState,
  TIcons = unknown,
  TRequestId extends string | number = string | number,
  TBridge extends object = object,
>(
  options: CreateHttpRuntimeFactoryOptions<
    TMcpServer,
    TRawServer,
    TTaskStore,
    TEnvConfig,
    TCapabilities,
    TSamplingServer,
    TCostTracker,
    TRequestDeduplicator,
    TGoogleClient,
    TContext,
    THandlers,
    TSubscriber,
    TBillingConfig,
    TRateLimitState,
    TIcons
    ,
    TRequestId,
    TBridge
  >
): Promise<HttpMcpServerInstance<TMcpServer, TTaskStore>> {
  const {
    googleToken,
    googleRefreshToken,
    sessionId,
    subscribers,
    installLoggingBridge,
    prepareRuntimePreflight,
    createTaskStore,
    createServerCapabilities,
    createBaseMcpServer,
    serverInfo,
    instructions,
    getRawServer,
    installInitializeCancellationGuard,
    getOrCreateSessionContextAsync,
    createHandlerRuntimeBridge,
    createTaskAwareSamplingServer,
    getCostTracker,
    createTokenBackedInitializedGoogleHandlerBundle,
    sendProgress,
    requestDeduplicator,
    buildBillingBootstrapConfig,
    initializeBillingIntegration,
    registerServalSheetsTools,
    registerServerPrompts,
    registerServerResources,
    createRandomUUID,
    registerHttpLoggingSetLevelHandler,
    createRateLimitState,
    teardownResourceNotifications,
    log,
  } = options;

  const { envConfig, costTrackingEnabled } = prepareRuntimePreflight();
  const taskStore = await createTaskStore();

  const mcpServer = createBaseMcpServer({
    serverInfo,
    capabilities: createServerCapabilities(),
    instructions,
    taskStore,
  });

  installInitializeCancellationGuard(mcpServer, {
    onIgnoredCancellation: (requestId) => {
      log.warn('Ignoring cancellation for initialize request', {
        requestId,
        transport: 'http',
      });
    },
  });

  let handlers: THandlers | null = null;
  let googleClient: TGoogleClient | null = null;
  let context: TContext | null = null;

  if (googleToken) {
    const bridge = createHandlerRuntimeBridge({
      server: getRawServer(mcpServer),
      createSamplingServer: createTaskAwareSamplingServer,
      costTrackingEnabled,
      getCostTracker,
    });

    const googleRuntime = await createTokenBackedInitializedGoogleHandlerBundle({
      accessToken: googleToken,
      refreshToken: googleRefreshToken,
      onProgress: (event) => {
        void sendProgress(event.current, event.total, event.message);
      },
      requestDeduplicator,
      extraContext: {
        ...(sessionId ? { sessionContext: await getOrCreateSessionContextAsync(sessionId) } : {}),
        taskStore,
        ...bridge,
      },
    });

    googleClient = googleRuntime.googleClient;
    context = googleRuntime.context;
    handlers = googleRuntime.handlers;
  }

  initializeBillingIntegration(buildBillingBootstrapConfig(envConfig));

  const toolRegistration = await registerServalSheetsTools(mcpServer, handlers, {
    googleClient,
  });
  registerServerPrompts(mcpServer);
  await registerServerResources({
    server: mcpServer,
    googleClient,
    context,
    options: {
      deferKnowledgeResources: false,
      includeTimeTravelResources: false,
      toolsListSyncReason: 'http transport resources initialized',
    },
  });

  const loggingSubscriberId = sessionId ?? `http:${createRandomUUID()}`;
  registerHttpLoggingSetLevelHandler({
    server: mcpServer,
    subscriberId: loggingSubscriberId,
    subscribers,
    installLoggingBridge,
    createRateLimitState,
    log,
  });

  return {
    mcpServer,
    taskStore,
    disposeRuntime: () => {
      teardownResourceNotifications(mcpServer);
      subscribers.delete(loggingSubscriberId);
      toolRegistration.dispose();
    },
  };
}
