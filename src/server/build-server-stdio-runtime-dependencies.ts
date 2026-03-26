import type { CallToolResult, LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStoreAdapter } from '../core/index.js';
import type { HandlerContext, HandlerMcpServer, Handlers } from '../handlers/index.js';
import type { GoogleApiClientOptions } from '../services/google-api.js';
import type { GoogleApiClient } from '../services/index.js';
import { initializeBillingIntegration } from '../services/billing-integration.js';
import type { AuthHandler } from '../handlers/auth.js';
import { logger as baseLogger } from '../utils/logger.js';
import { sendProgress } from '../utils/request-context.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import { getEnv } from '../config/env.js';
import { validateToolCatalogConfiguration } from '../mcp/tool-catalog.js';
import { quotaWarningsTotal } from '../observability/metrics.js';
import {
  initializeBuiltinConnectors,
  connectorManager,
  type SheetWriterFn,
} from '../connectors/connector-manager.js';
import { installServerLoggingBridge } from './logging-bridge.js';
import {
  ensureServerCompletionsRegistered,
  registerServerPrompts,
} from './resource-registration.js';
import {
  registerServerLoggingSetLevelHandler,
  registerServerTaskCancelHandler,
} from './control-plane-registration.js';
import { prepareRuntimePreflight } from './runtime-preflight.js';
import { buildBillingBootstrapConfig } from './billing-bootstrap-config.js';
import { createServerAuthHandler } from './auth-handler-factory.js';
import { initializeServerGoogleRuntime } from './google-runtime-bootstrap.js';
import {
  buildStdioRuntimeDependencies,
  type StdioLoggingBridgeInput,
  type StdioRuntimeDependenciesResult,
} from '../../packages/mcp-stdio/dist/build-stdio-runtime-dependencies.js';
import {
  registerStdioCompletions,
  registerStdioLogging,
  registerStdioPrompts,
  registerStdioTaskCancelHandler,
} from './register-stdio-capabilities.js';
import type { McpLogRateLimitState } from './logging-bridge-utils.js';
import { createOptionalGoogleClient } from '../startup/google-client-bootstrap.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import { cacheManager } from '../utils/cache-manager.js';
import { startHeapWatchdog } from '../utils/heap-watchdog.js';

interface LoggingBridgeInput {
  loggingBridgeInstalled: boolean;
  setLoggingBridgeInstalled: (value: boolean) => void;
  requestedMcpLogLevel: LoggingLevel | null;
  setRequestedMcpLogLevel: (level: LoggingLevel) => void;
  forwardingMcpLog: boolean;
  setForwardingMcpLog: (value: boolean) => void;
  rateLimitState: McpLogRateLimitState;
}

export interface BuildServerStdioRuntimeDependenciesInput {
  ensureToolIntegrityVerified: () => Promise<void>;
  googleApiOptions?: GoogleApiClientOptions;
  taskStore: TaskStoreAdapter;
  mcpServer: McpServer;
  taskAbortControllers: Map<string, AbortController>;
  taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  healthMonitor: { start: () => Promise<void> };
  logging: LoggingBridgeInput;
  markResourcesRegistered: () => void;
  registerTools: () => void;
  registerResources: () => Promise<void>;
  handleToolCall: (toolName: string, args: Record<string, unknown>) => Promise<CallToolResult>;
  log?: typeof baseLogger;
}

export function buildServerStdioRuntimeDependencies(
  input: BuildServerStdioRuntimeDependenciesInput
): StdioRuntimeDependenciesResult<
  ReturnType<typeof getEnv>,
  GoogleApiClient,
  AuthHandler,
  HandlerContext,
  Handlers
> {
  const log = input.log ?? baseLogger;
  const logging = input.logging as StdioLoggingBridgeInput<LoggingLevel, McpLogRateLimitState>;

  return buildStdioRuntimeDependencies({
    ensureToolIntegrityVerified: input.ensureToolIntegrityVerified,
    googleApiOptions: input.googleApiOptions,
    taskStore: input.taskStore,
    mcpServer: input.mcpServer,
    taskAbortControllers: input.taskAbortControllers,
    taskWatchdogTimers: input.taskWatchdogTimers,
    healthMonitor: input.healthMonitor,
    logging,
    markResourcesRegistered: input.markResourcesRegistered,
    registerTools: input.registerTools,
    registerResources: input.registerResources,
    handleToolCall: input.handleToolCall,
    prepareRuntimePreflight: () =>
      prepareRuntimePreflight({
        loadEnv: getEnv,
        validateToolCatalogConfiguration,
      }),
    createAuthHandler: (options?: { googleClient?: GoogleApiClient }) =>
      createServerAuthHandler(options),
    createOptionalGoogleClient,
    transport: process.env['MCP_TRANSPORT'],
    nodeEnv: process.env['NODE_ENV'],
    allowDegradedExplicitly: process.env['SERVAL_ALLOW_DEGRADED_STARTUP'] === 'true',
    initializeGoogleRuntime: async ({
      googleClient,
      envConfig,
      costTrackingEnabled,
      taskStore,
      mcpServer,
      dispatchScheduledJob,
      onProgress,
      requestDeduplicator,
    }) =>
      initializeServerGoogleRuntime({
        googleClient,
        envDataDir: envConfig.DATA_DIR,
        taskStore,
        mcpServer: (mcpServer as McpServer).server as HandlerMcpServer,
        costTrackingEnabled,
        dispatchScheduledJob,
        onProgress: (event) => {
          onProgress(event);
          void sendProgress(event.current, event.total, event.message);
        },
        requestDeduplicator: requestDeduplicator as RequestDeduplicator | undefined,
      }),
    requestDeduplicator,
    onProgress: () => {},
    afterGoogleRuntimeInitialized: ({ context, envConfig: _envConfig, log }) => {
      context.costTracker?.on('alert', (alert: { type: string; tenantId: string }) => {
        if (alert.type === 'limit_approaching') {
          quotaWarningsTotal.inc({ tenantId: alert.tenantId });
          log.warn('API quota approaching monthly limit', { tenantId: alert.tenantId });
        }
      });
    },
    preloadPythonCompute: (envConfig, log) => {
      if (!envConfig.ENABLE_PYTHON_COMPUTE) {
        return;
      }

      void import('../services/python-engine.js')
        .then(({ preloadPyodide }) => {
          preloadPyodide();
        })
        .catch((error) => {
          log.warn('Pyodide preload skipped due to initialization error', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    },
    initializeBuiltinConnectors,
    configureConnectorSheetWriter: (googleClient, log) => {
      if (googleClient?.sheets) {
        const sheetsClient = googleClient.sheets;
        const sheetWriter: SheetWriterFn = async (spreadsheetId, range, values) => {
          await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            requestBody: { values },
          });
        };
        connectorManager.setSheetWriter(sheetWriter);
        return;
      }

      log.debug('Connector sheet writer not configured (Sheets client unavailable)');
    },
    initializeBilling: (envConfig) => {
      initializeBillingIntegration(buildBillingBootstrapConfig(envConfig));
    },
    registerCompletions: (log) => {
      registerStdioCompletions({
        ensureCompletionsRegistered: ensureServerCompletionsRegistered,
        log: log as typeof baseLogger,
      });
    },
    shouldDeferResourceDiscovery: async () => {
      const { shouldDeferResourceDiscovery } = await import('../config/env.js');
      return shouldDeferResourceDiscovery();
    },
    onResourceDiscoveryDeferred: (log) => {
      log.info('Resource discovery deferred - resources will load on first access');
    },
    registerPrompts: (server) => {
      registerStdioPrompts({
        server: server as McpServer,
        registerPrompts: registerServerPrompts,
      });
    },
    registerTaskCancelHandler: ({ taskStore, taskAbortControllers, taskWatchdogTimers, log }) => {
      registerStdioTaskCancelHandler({
        taskStore: taskStore as TaskStoreAdapter,
        taskAbortControllers,
        taskWatchdogTimers,
        registerTaskCancelHandler: registerServerTaskCancelHandler,
        log: log as typeof baseLogger,
      });
    },
    registerLogging: ({ logging, server, log }) => {
      registerStdioLogging(
        {
          loggingBridgeInstalled: logging.loggingBridgeInstalled,
          setLoggingBridgeInstalled: logging.setLoggingBridgeInstalled,
          getRequestedMcpLogLevel: () => logging.requestedMcpLogLevel,
          setRequestedMcpLogLevel: logging.setRequestedMcpLogLevel,
          getForwardingMcpLog: () => logging.forwardingMcpLog,
          setForwardingMcpLog: logging.setForwardingMcpLog,
          getRateLimitState: () => logging.rateLimitState,
          server: server as McpServer,
        },
        {
          registerLogging: registerServerLoggingSetLevelHandler,
          installLoggingBridge: installServerLoggingBridge,
          log: log as typeof baseLogger,
        }
      );
    },
    startCacheCleanupTask: () => {
      cacheManager.startCleanupTask();
    },
    startHeapWatchdog,
    onHealthMonitorStarted: (log) => {
      log.info('Health monitoring started');
    },
    log,
  });
}
