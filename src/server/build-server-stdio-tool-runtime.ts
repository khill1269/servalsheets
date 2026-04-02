import type PQueue from 'p-queue';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TaskStoreAdapter } from '../core/index.js';
import type { HandlerContext, Handlers } from '../handlers/index.js';
import type { GoogleApiClient } from '../services/index.js';
import type { AuthHandler } from '../handlers/auth.js';
import {
  checkAuthAsync,
  buildAuthErrorResponse,
  isGoogleAuthError,
  convertGoogleAuthError,
} from '../utils/auth-guard.js';
import { logger as baseLogger } from '../utils/logger.js';
import {
  createRequestAbortError,
  createRequestContext,
  runWithRequestContext,
  type RequestContext,
  type RelatedRequestSender,
  type RequestScopedMetadataCache,
  type RequestScopedSessionContext,
  type TaskStatusUpdater,
} from '../utils/request-context.js';
import { extractIdempotencyKeyFromHeaders } from '../utils/idempotency-key-generator.js';
import { TOOL_DEFINITIONS, isToolCallAuthExempt } from '../mcp/registration/tool-definitions.js';
import { buildToolResponse } from '../mcp/registration/tool-handlers.js';
import { registerToolsListCompatibilityHandler } from '../mcp/registration/tools-list-compat.js';
import { registerFlatToolCallInterceptor } from '../mcp/registration/flat-tool-call-interceptor.js';
import { TOOL_ICONS, TOOL_EXECUTION_CONFIG } from '../mcp/features-2025-11-25.js';
import { recordSpreadsheetId } from '../mcp/completions.js';
import { resourceNotifications } from '../resources/notifications.js';
import { STAGED_REGISTRATION } from '../config/constants.js';
import { toolStageManager } from '../mcp/registration/tool-stage-manager.js';
import { getEnv } from '../config/env.js';
import { resolveCostTrackingTenantId } from '../utils/tenant-identification.js';
import { extractActionFromArgs, extractPrincipalIdFromHeaders } from './request-extraction.js';
import { recordToolExecutionException, recordToolExecutionResult } from './tool-call-metrics.js';
import { handlePreInitExemptToolCall, handleSheetsAuthToolCall } from './preinit-tool-routing.js';
import { dispatchServerToolCall } from './handler-dispatch.js';
import { registerServerResources } from './resource-registration.js';
import { ServiceError } from '../core/errors.js';
import {
  buildStdioToolRuntime,
  type BuildStdioToolRuntimeInput as PackageBuildStdioToolRuntimeInput,
  type StdioToolRuntime,
} from '../../packages/mcp-stdio/dist/build-stdio-tool-runtime.js';
import { createMetadataCache } from '../services/metadata-cache.js';
import { recordToolCall, updateQueueMetrics } from '../observability/metrics.js';

type CachedHandlerMap = Record<string, (args: unknown, extra?: unknown) => Promise<unknown>>;

interface LoggerLike {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface BuildServerStdioToolRuntimeInput {
  server: McpServer;
  requestQueue: PQueue;
  connectionHealthCheck: {
    recordHeartbeat(toolName: string): void;
  };
  taskStore: TaskStoreAdapter;
  taskAbortControllers: Map<string, AbortController>;
  taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  getIsShutdown: () => boolean;
  getContext: () => HandlerContext | null;
  getHandlers: () => Handlers | null;
  getGoogleClient: () => GoogleApiClient | null;
  getAuthHandler: () => AuthHandler | null;
  setAuthHandler: (value: AuthHandler | null) => void;
  getCachedHandlerMap: () => CachedHandlerMap | null;
  setCachedHandlerMap: (value: CachedHandlerMap | null) => void;
  getResourcesRegistered: () => boolean;
  setResourcesRegistered: (value: boolean) => void;
  getResourceRegistrationPromise: () => Promise<void> | null;
  setResourceRegistrationPromise: (value: Promise<void> | null) => void;
  getResourceRegistrationFailed: () => boolean;
  setResourceRegistrationFailed: (value: boolean) => void;
  log?: LoggerLike;
}

export function buildServerStdioToolRuntime(
  input: BuildServerStdioToolRuntimeInput
): StdioToolRuntime {
  const log = input.log ?? baseLogger;

  return buildStdioToolRuntime<
    (typeof TOOL_DEFINITIONS)[number],
    HandlerContext,
    Handlers,
    GoogleApiClient,
    AuthHandler,
    CachedHandlerMap
  >(
    {
      toolDefinitions: TOOL_DEFINITIONS,
      requestQueue: input.requestQueue,
      connectionHealthCheck: input.connectionHealthCheck,
      taskStore: input.taskStore,
      taskAbortControllers: input.taskAbortControllers,
      taskWatchdogTimers: input.taskWatchdogTimers,
      taskWatchdogMs: getEnv().TASK_WATCHDOG_MS,
      stagedRegistrationEnabled: STAGED_REGISTRATION,
      enableToolsListChangedNotifications: getEnv().ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS,
      getIsShutdown: input.getIsShutdown,
      getContext: input.getContext,
      getHandlers: input.getHandlers,
      getGoogleClient: input.getGoogleClient,
      getAuthHandler: input.getAuthHandler,
      setAuthHandler: input.setAuthHandler,
      getCachedHandlerMap: input.getCachedHandlerMap,
      setCachedHandlerMap: input.setCachedHandlerMap,
      getResourcesRegistered: input.getResourcesRegistered,
      setResourcesRegistered: input.setResourcesRegistered,
      getResourceRegistrationPromise: input.getResourceRegistrationPromise,
      setResourceRegistrationPromise: input.setResourceRegistrationPromise,
      getResourceRegistrationFailed: input.getResourceRegistrationFailed,
      setResourceRegistrationFailed: input.setResourceRegistrationFailed,
      log,
    } satisfies PackageBuildStdioToolRuntimeInput<
      (typeof TOOL_DEFINITIONS)[number],
      HandlerContext,
      Handlers,
      GoogleApiClient,
      AuthHandler,
      CachedHandlerMap
    >,
    {
      registerResources: () =>
        registerServerResources({
          server: input.server,
          googleClient: input.getGoogleClient(),
          context: input.getContext(),
        }),
      executeToolCall: {
        updateQueueMetrics,
        createAbortError: (reason) => createRequestAbortError(reason),
        extractIdempotencyKeyFromHeaders,
        resolveCostTrackingTenantId,
        extractPrincipalIdFromHeaders,
        createMetadataCache: () =>
          input.getGoogleClient()?.sheets
            ? createMetadataCache(input.getGoogleClient()!.sheets)
            : undefined,
        createRequestContext: (options) =>
          createRequestContext({
            ...options,
            metadataCache: options.metadataCache as RequestScopedMetadataCache | undefined,
            sendRequest: options.sendRequest as RelatedRequestSender | undefined,
            sessionContext: options.sessionContext as RequestScopedSessionContext | undefined,
            taskStore: options.taskStore as TaskStatusUpdater | undefined,
          }),
        runWithRequestContext: async (requestContext, operation) =>
          await runWithRequestContext(requestContext as RequestContext, operation),
        buildToolResponse,
        recordSpreadsheetId,
        extractActionFromArgs,
        recordToolExecutionResult,
        recordToolExecutionException,
        isGoogleAuthError,
        convertGoogleAuthError,
      },
      resolveToolCall: {
        handleSheetsAuthToolCall,
        recordToolCall,
        buildToolResponse,
        isToolCallAuthExempt,
        checkAuthAsync,
        buildAuthErrorResponse: (error) =>
          buildAuthErrorResponse(error as Parameters<typeof buildAuthErrorResponse>[0]),
        handlePreInitExemptToolCall,
        dispatchServerToolCall,
      },
      createTaskStoreNotConfiguredError: (missingToolName) =>
        new ServiceError(
          `[${missingToolName}] Task store not configured`,
          'INTERNAL_ERROR',
          missingToolName
        ),
      buildToolResponse,
      getToolIcons: (toolName) => TOOL_ICONS[toolName],
      getToolExecution: (toolName) => TOOL_EXECUTION_CONFIG[toolName],
      registerTaskTool: (name, config, handler) => {
        input.server.experimental.tasks.registerToolTask(name, config, handler);
      },
      registerTool: (name, config, handler) => {
        (
          input.server.registerTool as (
            toolName: string,
            toolConfig: {
              title?: string;
              description?: string;
              inputSchema?: unknown;
              outputSchema?: unknown;
              annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
              icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
              execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
            },
            cb: (args: Record<string, unknown>, extra: unknown) => Promise<CallToolResult>
          ) => void
        )(name, config, handler);
      },
      initializeStageManager: (registerNewTools) => {
        toolStageManager.initialize(TOOL_DEFINITIONS, registerNewTools);
      },
      getInitialTools: () => toolStageManager.getInitialTools(),
      markRegistered: (toolNames) => {
        toolStageManager.markRegistered(toolNames);
      },
      registerToolsListCompatibilityHandler: () => {
        registerToolsListCompatibilityHandler(input.server);
      },
      registerFlatToolCallInterceptor: () => {
        registerFlatToolCallInterceptor(input.server);
      },
      syncToolList: (toolNames, options) => {
        resourceNotifications.syncToolList(toolNames, options);
      },
    }
  );
}
