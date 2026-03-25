/**
 * ServalSheets - MCP Server
 *
 * Main server class that registers all tools and resources
 * MCP Protocol: 2025-11-25
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type CallToolResult, type LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { TOOL_COUNT, ACTION_COUNT } from './schemas/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
  version: string;
};
const PACKAGE_VERSION = packageJson.version;

import type PQueue from 'p-queue';
import { TaskStoreAdapter } from './core/index.js';

import { GoogleApiClient } from './services/index.js';
import type { GoogleApiClientOptions } from './services/google-api.js';
// Removed: initWorkflowEngine (Claude orchestrates natively via MCP)
// Removed: initPlanningAgent, initInsightsService (replaced by MCP-native Elicitation/Sampling)
import { type HandlerContext, type Handlers } from './handlers/index.js';
import { AuthHandler } from './handlers/auth.js';
import { logger as baseLogger } from './utils/logger.js';
import { type TaskStatusUpdater } from './utils/request-context.js';
import { buildToolResponse } from './mcp/registration/tool-handlers.js';
import { teardownResourceNotifications } from './resources/notifications.js';
import { cacheManager } from './utils/cache-manager.js';
import { type HealthMonitor } from './server/index.js';
import { cleanupAllResources } from './utils/resource-cleanup.js';
import { disposeTemporaryResourceStore } from './resources/temporary-storage.js';
import { getEnv } from './config/env.js';
import { verifyToolIntegrity } from './security/tool-hash-registry.js';
import { connectorManager } from './connectors/connector-manager.js';
import { createMcpLogRateLimitState } from './server/logging-bridge-utils.js';
import { prepareServerBootstrap } from './server/bootstrap.js';
import { createAsyncOnce } from './server/async-once.js';
import { createStdioServer } from './server/create-stdio-server.js';
import {
  buildServerStdioInfrastructure,
  type ServerStdioInfrastructure,
} from './server/build-server-stdio-infrastructure.js';
import {
  buildServerStdioShutdownArgs,
  buildServerStdioStartOptions,
} from './server/build-server-stdio-lifecycle.js';
import {
  initializeStdioRuntime,
  type InitializeStdioRuntimeDependencies,
  type InitializeStdioRuntimeState,
} from './server/initialize-stdio-runtime.js';
import { createStdioTaskHandler } from './server/create-stdio-task-handler.js';
import { createStdioRuntimeState } from './server/create-stdio-runtime-state.js';
import { buildServerStdioRuntimeDependencies } from './server/build-server-stdio-runtime-dependencies.js';
import { buildServerStdioToolRuntime } from './server/build-server-stdio-tool-runtime.js';
import { shutdownStdioServer } from './server/shutdown-stdio-server.js';
import { startStdioRuntime } from './server/start-stdio-runtime.js';

export interface ServalSheetsServerOptions {
  name?: string;
  version?: string;
  googleApiOptions?: GoogleApiClientOptions;
  taskStore?: TaskStoreAdapter;
}

/**
 * ServalSheets MCP Server
 */
export class ServalSheetsServer {
  private _server: McpServer;
  private toolRuntime!: ReturnType<typeof buildServerStdioToolRuntime>;
  private googleClient: GoogleApiClient | null = null;
  private authHandler: AuthHandler | null = null;
  private options: ServalSheetsServerOptions;
  private isShutdown = false;
  private handlers: Handlers | null = null;
  private context: HandlerContext | null = null;
  private requestQueue: PQueue;
  private taskStore: TaskStoreAdapter;
  private taskAbortControllers = new Map<string, AbortController>();
  private taskWatchdogTimers = new Map<string, NodeJS.Timeout>();
  private healthMonitor: HealthMonitor;
  private connectionHealthCheck: ServerStdioInfrastructure['connectionHealthCheck'];
  private requestedMcpLogLevel: LoggingLevel | null = null;
  private loggingBridgeInstalled = false;
  private forwardingMcpLog = false;
  private mcpLogRateLimitState = createMcpLogRateLimitState();
  private ensureToolIntegrityVerified = createAsyncOnce(async () => {
    await verifyToolIntegrity();
  });

  // Cached handler map (rebuilt only when handlers change)
  private cachedHandlerMap: Record<
    string,
    (args: unknown, extra?: unknown) => Promise<unknown>
  > | null = null;

  // Resource lazy loading state
  private resourcesRegistered = false;
  private resourceRegistrationPromise: Promise<void> | null = null;
  private resourceRegistrationFailed = false;

  constructor(options: ServalSheetsServerOptions = {}) {
    this.options = options;

    const infrastructure = buildServerStdioInfrastructure({
      options,
      packageVersion: PACKAGE_VERSION,
      log: baseLogger,
    });
    this._server = infrastructure.server;
    this.taskStore = infrastructure.taskStore;
    this.requestQueue = infrastructure.requestQueue;
    this.connectionHealthCheck = infrastructure.connectionHealthCheck;
    this.healthMonitor = infrastructure.healthMonitor;

    this.toolRuntime = buildServerStdioToolRuntime({
      server: this._server,
      requestQueue: this.requestQueue,
      connectionHealthCheck: this.connectionHealthCheck,
      taskStore: this.taskStore,
      taskAbortControllers: this.taskAbortControllers,
      taskWatchdogTimers: this.taskWatchdogTimers,
      getIsShutdown: () => this.isShutdown,
      getContext: () => this.context,
      getHandlers: () => this.handlers,
      getGoogleClient: () => this.googleClient,
      getAuthHandler: () => this.authHandler,
      setAuthHandler: (value) => {
        this.authHandler = value;
      },
      getCachedHandlerMap: () => this.cachedHandlerMap,
      setCachedHandlerMap: (value) => {
        this.cachedHandlerMap = value;
      },
      getResourcesRegistered: () => this.resourcesRegistered,
      setResourcesRegistered: (value) => {
        this.resourcesRegistered = value;
      },
      getResourceRegistrationPromise: () => this.resourceRegistrationPromise,
      setResourceRegistrationPromise: (value) => {
        this.resourceRegistrationPromise = value;
      },
      getResourceRegistrationFailed: () => this.resourceRegistrationFailed,
      setResourceRegistrationFailed: (value) => {
        this.resourceRegistrationFailed = value;
      },
      log: baseLogger,
    });

    void this.createToolTaskHandler;
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    await initializeStdioRuntime(this.createRuntimeState(), this.createRuntimeDependencies());
  }

  private createRuntimeState(): InitializeStdioRuntimeState<
    GoogleApiClient,
    AuthHandler,
    HandlerContext,
    Handlers
  > {
    return createStdioRuntimeState({
      getGoogleClient: () => this.googleClient,
      setGoogleClient: (value: GoogleApiClient | null) => {
        this.googleClient = value;
      },
      setAuthHandler: (value: AuthHandler | null) => {
        this.authHandler = value;
      },
      setContext: (value: HandlerContext | null) => {
        this.context = value;
      },
      setHandlers: (value: Handlers | null) => {
        this.handlers = value;
      },
      clearCachedHandlerMap: () => {
        this.cachedHandlerMap = null;
      },
    });
  }

  private createRuntimeDependencies(): InitializeStdioRuntimeDependencies<
    ReturnType<typeof getEnv>,
    GoogleApiClient,
    AuthHandler,
    HandlerContext,
    Handlers
  > {
    return buildServerStdioRuntimeDependencies({
      ensureToolIntegrityVerified: () => this.ensureToolIntegrityVerified.run(),
      googleApiOptions: this.options.googleApiOptions,
      taskStore: this.taskStore,
      mcpServer: this._server,
      taskAbortControllers: this.taskAbortControllers,
      taskWatchdogTimers: this.taskWatchdogTimers,
      healthMonitor: this.healthMonitor,
      logging: {
        loggingBridgeInstalled: this.loggingBridgeInstalled,
        setLoggingBridgeInstalled: (value) => {
          this.loggingBridgeInstalled = value;
        },
        requestedMcpLogLevel: this.requestedMcpLogLevel,
        setRequestedMcpLogLevel: (level) => {
          this.requestedMcpLogLevel = level;
        },
        forwardingMcpLog: this.forwardingMcpLog,
        setForwardingMcpLog: (value) => {
          this.forwardingMcpLog = value;
        },
        rateLimitState: this.mcpLogRateLimitState,
      },
      markResourcesRegistered: () => {
        this.resourcesRegistered = true;
      },
      registerTools: () => {
        this.toolRuntime.registerTools();
      },
      registerResources: () => this.toolRuntime.registerResources(),
      handleToolCall: (toolName, args) => this.toolRuntime.handleToolCall(toolName, args),
      log: baseLogger,
    });
  }

  private createToolTaskHandler(toolName: string): ToolTaskHandler<AnySchema> {
    return createStdioTaskHandler(toolName, {
      createTaskStoreNotConfiguredError: (missingToolName) =>
        new Error(`[${missingToolName}] Task store not configured`),
      taskStoreForCancellation: this.taskStore,
      taskAbortControllers: this.taskAbortControllers,
      taskWatchdogTimers: this.taskWatchdogTimers,
      taskWatchdogMs: getEnv().TASK_WATCHDOG_MS,
      runTool: (args, extra) =>
        this.handleToolCall(toolName, args, {
          sendNotification: extra?.sendNotification,
          progressToken: extra?.progressToken,
          abortSignal: extra?.abortSignal,
          taskId: extra?.taskId,
          taskStore: extra?.taskStore as TaskStatusUpdater | undefined,
        }),
      buildCancelledTaskResult: (message) =>
        buildToolResponse({
          response: {
            success: false,
            error: {
              code: 'TASK_CANCELLED',
              message,
              retryable: false,
            },
          },
        }),
      buildInternalErrorResult: (error) =>
        buildToolResponse({
          response: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : String(error),
              retryable: false,
            },
          },
        }),
      log: baseLogger,
    });
  }

  private handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    extra?: {
      sendNotification?: (
        notification: import('@modelcontextprotocol/sdk/types.js').ServerNotification
      ) => Promise<void>;
      taskId?: string;
      taskStore?: TaskStatusUpdater;
      progressToken?: string | number;
      abortSignal?: AbortSignal;
      headers?: Record<string, string | string[] | undefined>;
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
      sendRequest?: unknown;
      elicit?: unknown;
      sample?: unknown;
    }
  ): Promise<CallToolResult> {
    return this.toolRuntime.handleToolCall(toolName, args, extra);
  }

  private registerResources(): Promise<void> {
    return this.toolRuntime.registerResources();
  }

  private ensureResourcesRegistered(): Promise<void> {
    if (!this.resourcesRegistered) {
      return this.registerResources().then(() => {
        this.resourcesRegistered = true;
      });
    }

    return Promise.resolve();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    const { state, dependencies } = buildServerStdioShutdownArgs({
      isShutdown: this.isShutdown,
      setIsShutdown: (value) => {
        this.isShutdown = value;
      },
      requestQueue: this.requestQueue,
      getContext: () => this.context,
      getGoogleClient: () => this.googleClient,
      clearGoogleClient: () => {
        this.googleClient = null;
      },
      clearAuthHandler: () => {
        this.authHandler = null;
      },
      clearHandlers: () => {
        this.handlers = null;
      },
      clearContext: () => {
        this.context = null;
      },
      clearCachedHandlerMap: () => {
        this.cachedHandlerMap = null;
      },
      stopCacheCleanupTask: () => {
        cacheManager.stopCleanupTask();
      },
      stopHealthMonitor: () => this.healthMonitor.stop(),
      cleanupAllResources,
      getBatchingSystem: async () => {
        const { getBatchingSystem } = await import('./services/batching-system.js');
        return getBatchingSystem();
      },
      getPrefetchingSystem: async () => {
        const { getPrefetchingSystem } = await import('./services/prefetching-system.js');
        return getPrefetchingSystem();
      },
      disposeConnectorManager: () => connectorManager.dispose(),
      taskStore: this.taskStore,
      disposeTemporaryResourceStore,
      teardownResourceNotifications: () => {
        teardownResourceNotifications(this._server);
      },
      log: baseLogger,
    });

    await shutdownStdioServer(state, dependencies);
  }

  /**
   * Get underlying MCP server instance (for testing and advanced usage)
   */
  get server(): McpServer {
    return this._server;
  }

  /**
   * Start the server with signal handling
   */
  async start(): Promise<void> {
    await startStdioRuntime(
      buildServerStdioStartOptions({
        verifyToolIntegrity: () => this.ensureToolIntegrityVerified.run(),
        initialize: () => this.initialize(),
        shutdown: () => this.shutdown(),
        getResourcesRegistered: () => this.resourcesRegistered,
        getResourceRegistrationFailed: () => this.resourceRegistrationFailed,
        server: this._server,
        ensureResourcesRegistered: () => this.ensureResourcesRegistered(),
        isShutdown: () => this.isShutdown,
        log: baseLogger,
      })
    );
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; tools: number; actions: number } {
    return {
      name: this.options.name ?? 'servalsheets',
      version: this.options.version ?? PACKAGE_VERSION,
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
    };
  }

  /**
   * Check if server is healthy
   */
  isHealthy(): boolean {
    return !this.isShutdown && this.googleClient !== null;
  }
}

/**
 * Create and start a ServalSheets server
 *
 * Automatically selects RedisTaskStore if REDIS_URL is set, otherwise InMemoryTaskStore.
 * For production deployments with multiple instances, set REDIS_URL for shared task state.
 */
export async function createServalSheetsServer(
  options: ServalSheetsServerOptions = {}
): Promise<ServalSheetsServer> {
  return createStdioServer(options, {
    prepareBootstrap: prepareServerBootstrap,
    createServer: (serverOptions) => new ServalSheetsServer(serverOptions),
    startServer: (server) => server.start(),
  });
}
