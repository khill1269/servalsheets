import {
  createStdioRuntimeDependencies,
} from './create-stdio-runtime-dependencies.js';
import type { InitializeStdioRuntimeDependencies } from './initialize-stdio-runtime.js';

interface StdioRuntimeDependenciesLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface StdioLoggingBridgeInput<TLoggingLevel = unknown, TRateLimitState = unknown> {
  readonly loggingBridgeInstalled: boolean;
  readonly setLoggingBridgeInstalled: (value: boolean) => void;
  readonly requestedMcpLogLevel: TLoggingLevel | null;
  readonly setRequestedMcpLogLevel: (level: TLoggingLevel) => void;
  readonly forwardingMcpLog: boolean;
  readonly setForwardingMcpLog: (value: boolean) => void;
  readonly rateLimitState: TRateLimitState;
}

export interface StdioRuntimeScheduledJob {
  readonly action: {
    readonly tool: string;
    readonly actionName: string;
    readonly params: Record<string, unknown>;
  };
}

export interface StdioRuntimeProgressEvent {
  readonly current: number;
  readonly total?: number;
  readonly message?: string;
}

export interface BuildStdioRuntimeDependenciesInput<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
  TTaskStore = unknown,
  TMcpServer = unknown,
  TGoogleApiOptions = unknown,
  TLoggingLevel = unknown,
  TRateLimitState = unknown,
> {
  readonly ensureToolIntegrityVerified: () => Promise<void>;
  readonly googleApiOptions?: TGoogleApiOptions;
  readonly taskStore: TTaskStore;
  readonly mcpServer: TMcpServer;
  readonly taskAbortControllers: Map<string, AbortController>;
  readonly taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  readonly healthMonitor: { start: () => Promise<void> };
  readonly logging: StdioLoggingBridgeInput<TLoggingLevel, TRateLimitState>;
  readonly markResourcesRegistered: () => void;
  readonly registerTools: () => void;
  readonly registerResources: () => Promise<void>;
  readonly handleToolCall: (
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  readonly prepareRuntimePreflight: () => {
    envConfig: TEnvConfig;
    costTrackingEnabled: boolean;
  };
  readonly createAuthHandler: (options?: { googleClient?: TGoogleClient }) => TAuthHandler;
  readonly createOptionalGoogleClient: (options: {
    googleApiOptions?: TGoogleApiOptions;
    transport?: string;
    nodeEnv?: string;
    allowDegradedExplicitly: boolean;
  }) => Promise<TGoogleClient | null>;
  readonly transport?: string;
  readonly nodeEnv?: string;
  readonly allowDegradedExplicitly: boolean;
  readonly initializeGoogleRuntime: (input: {
    googleClient: TGoogleClient;
    envConfig: TEnvConfig;
    costTrackingEnabled: boolean;
    taskStore: TTaskStore;
    mcpServer: TMcpServer;
    dispatchScheduledJob: (job: StdioRuntimeScheduledJob) => Promise<unknown>;
    onProgress: (event: StdioRuntimeProgressEvent) => void;
    requestDeduplicator?: unknown;
  }) => Promise<{
    context: TContext;
    handlers: THandlers;
  }>;
  readonly requestDeduplicator?: unknown;
  readonly onProgress: (event: StdioRuntimeProgressEvent) => void;
  readonly afterGoogleRuntimeInitialized?: (input: {
    context: TContext;
    envConfig: TEnvConfig;
    log: StdioRuntimeDependenciesLogger;
  }) => void;
  readonly preloadPythonCompute?: (
    envConfig: TEnvConfig,
    log: StdioRuntimeDependenciesLogger
  ) => void;
  readonly initializeBuiltinConnectors: () => void;
  readonly configureConnectorSheetWriter: (
    googleClient: TGoogleClient | null,
    log: StdioRuntimeDependenciesLogger
  ) => void;
  readonly initializeBilling: (envConfig: TEnvConfig) => void;
  readonly registerCompletions: (log: StdioRuntimeDependenciesLogger) => void;
  readonly shouldDeferResourceDiscovery: () => boolean | Promise<boolean>;
  readonly onResourceDiscoveryDeferred?: (log: StdioRuntimeDependenciesLogger) => void;
  readonly registerPrompts: (server: TMcpServer) => void;
  readonly registerTaskCancelHandler: (input: {
    taskStore: TTaskStore;
    taskAbortControllers: Map<string, AbortController>;
    taskWatchdogTimers: Map<string, NodeJS.Timeout>;
    log: StdioRuntimeDependenciesLogger;
  }) => void;
  readonly registerLogging: (input: {
    logging: StdioLoggingBridgeInput<TLoggingLevel, TRateLimitState>;
    server: TMcpServer;
    log: StdioRuntimeDependenciesLogger;
  }) => void;
  readonly startCacheCleanupTask: () => void;
  readonly startHeapWatchdog: () => void;
  readonly onHealthMonitorStarted?: (log: StdioRuntimeDependenciesLogger) => void;
  readonly log: StdioRuntimeDependenciesLogger;
}

export type StdioRuntimeDependenciesResult<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
> = InitializeStdioRuntimeDependencies<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers
>;

export function buildStdioRuntimeDependencies<
  TEnvConfig,
  TGoogleClient,
  TAuthHandler,
  TContext,
  THandlers,
  TTaskStore = unknown,
  TMcpServer = unknown,
  TGoogleApiOptions = unknown,
  TLoggingLevel = unknown,
  TRateLimitState = unknown,
>(
  input: BuildStdioRuntimeDependenciesInput<
    TEnvConfig,
    TGoogleClient,
    TAuthHandler,
    TContext,
    THandlers,
    TTaskStore,
    TMcpServer,
    TGoogleApiOptions,
    TLoggingLevel,
    TRateLimitState
  >
): StdioRuntimeDependenciesResult<TEnvConfig, TGoogleClient, TAuthHandler, TContext, THandlers> {
  const log = input.log;

  return createStdioRuntimeDependencies<
    TEnvConfig,
    TGoogleClient,
    TAuthHandler,
    TContext,
    THandlers
  >({
    ensureToolIntegrityVerified: input.ensureToolIntegrityVerified,
    prepareRuntimePreflight: input.prepareRuntimePreflight,
    createAuthHandler: input.createAuthHandler,
    createOptionalGoogleClient: () =>
      input.createOptionalGoogleClient({
        googleApiOptions: input.googleApiOptions,
        transport: input.transport,
        nodeEnv: input.nodeEnv,
        allowDegradedExplicitly: input.allowDegradedExplicitly,
      }),
    initializeGoogleRuntime: ({ googleClient, envConfig, costTrackingEnabled }) =>
      input.initializeGoogleRuntime({
        googleClient,
        envConfig,
        costTrackingEnabled,
        taskStore: input.taskStore,
        mcpServer: input.mcpServer,
        dispatchScheduledJob: async (job) =>
          input.handleToolCall(job.action.tool, {
            request: {
              action: job.action.actionName,
              ...job.action.params,
            },
          }),
        onProgress: input.onProgress,
        requestDeduplicator: input.requestDeduplicator,
      }),
    afterGoogleRuntimeInitialized: input.afterGoogleRuntimeInitialized
      ? ({ context, envConfig }) =>
          input.afterGoogleRuntimeInitialized?.({
            context,
            envConfig,
            log,
          })
      : undefined,
    preloadPythonCompute: input.preloadPythonCompute
      ? (envConfig) => input.preloadPythonCompute?.(envConfig, log)
      : undefined,
    initializeBuiltinConnectors: input.initializeBuiltinConnectors,
    configureConnectorSheetWriter: (googleClient) =>
      input.configureConnectorSheetWriter(googleClient, log),
    initializeBilling: input.initializeBilling,
    registerTools: input.registerTools,
    registerCompletions: () => input.registerCompletions(log),
    registerResources: input.registerResources,
    shouldDeferResourceDiscovery: input.shouldDeferResourceDiscovery,
    onResourceDiscoveryDeferred: () => input.onResourceDiscoveryDeferred?.(log),
    markResourcesRegistered: input.markResourcesRegistered,
    registerPrompts: () => input.registerPrompts(input.mcpServer),
    registerTaskCancelHandler: () =>
      input.registerTaskCancelHandler({
        taskStore: input.taskStore,
        taskAbortControllers: input.taskAbortControllers,
        taskWatchdogTimers: input.taskWatchdogTimers,
        log,
      }),
    registerLogging: () =>
      input.registerLogging({
        logging: input.logging,
        server: input.mcpServer,
        log,
      }),
    startCacheCleanupTask: input.startCacheCleanupTask,
    startHeapWatchdog: input.startHeapWatchdog,
    startHealthMonitor: () => input.healthMonitor.start(),
    onHealthMonitorStarted: input.onHealthMonitorStarted
      ? () => input.onHealthMonitorStarted?.(log)
      : undefined,
  });
}
