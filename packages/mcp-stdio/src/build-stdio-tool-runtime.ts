import type PQueue from 'p-queue';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  createStdioTaskHandler,
  type StdioTaskStatusUpdaterLike,
} from './create-stdio-task-handler.js';
import {
  executeStdioToolCall,
  type ExecuteStdioToolCallDependencies,
  type StdioToolCallExtra,
  type StdioToolCallRequestContext,
} from './execute-stdio-tool-call.js';
import {
  resolveStdioToolCall,
  type ResolveStdioToolCallDependencies,
} from './resolve-stdio-tool-call.js';
import {
  ensureStdioResourcesRegistered,
  registerStdioResources,
} from './register-stdio-resources.js';
import {
  registerStdioToolSet,
  type StdioToolDefinitionLike,
} from './register-stdio-tool-set.js';
import { registerStdioTools } from './register-stdio-tools.js';

type CachedHandlerMap = Record<string, (args: unknown, extra?: unknown) => Promise<unknown>>;

type StdioResolvedRequestContext = StdioToolCallRequestContext & {
  requestId: string;
};

interface LoggerLike {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

interface StdioTaskError extends Error {
  code?: string;
}

export interface BuildStdioToolRuntimeInput<
  TTool extends StdioToolDefinitionLike = StdioToolDefinitionLike,
  TContext = unknown,
  THandlers = unknown,
  TGoogleClient = unknown,
  TAuthHandler = unknown,
  THandlerMap = CachedHandlerMap,
> {
  readonly toolDefinitions: readonly TTool[];
  readonly requestQueue: PQueue;
  readonly connectionHealthCheck: {
    recordHeartbeat(toolName: string): void;
  };
  readonly taskStore: unknown;
  readonly taskAbortControllers: Map<string, AbortController>;
  readonly taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  readonly taskWatchdogMs: number;
  readonly stagedRegistrationEnabled: boolean;
  readonly enableToolsListChangedNotifications: boolean;
  readonly getIsShutdown: () => boolean;
  readonly getContext: () => TContext | null;
  readonly getHandlers: () => THandlers | null;
  readonly getGoogleClient: () => TGoogleClient | null;
  readonly getAuthHandler: () => TAuthHandler | null;
  readonly setAuthHandler: (value: TAuthHandler | null) => void;
  readonly getCachedHandlerMap: () => THandlerMap | null;
  readonly setCachedHandlerMap: (value: THandlerMap | null) => void;
  readonly getResourcesRegistered: () => boolean;
  readonly setResourcesRegistered: (value: boolean) => void;
  readonly getResourceRegistrationPromise: () => Promise<void> | null;
  readonly setResourceRegistrationPromise: (value: Promise<void> | null) => void;
  readonly getResourceRegistrationFailed: () => boolean;
  readonly setResourceRegistrationFailed: (value: boolean) => void;
  readonly log: LoggerLike;
}

export interface BuildStdioToolRuntimeDependencies<
  TTool extends StdioToolDefinitionLike = StdioToolDefinitionLike,
  TContext = unknown,
  THandlers = unknown,
  TGoogleClient = unknown,
  TAuthHandler = unknown,
  THandlerMap = CachedHandlerMap,
  TRequestContext extends StdioResolvedRequestContext = StdioResolvedRequestContext,
> {
  readonly registerResources: () => Promise<void>;
  readonly executeToolCall: Omit<
    ExecuteStdioToolCallDependencies<TRequestContext>,
    'ensureResourcesRegistered' | 'executeWithinRequest'
  >;
  readonly resolveToolCall: Omit<
    ResolveStdioToolCallDependencies<
      TAuthHandler,
      THandlers,
      TContext,
      TGoogleClient,
      THandlerMap
    >,
    'setAuthHandler' | 'setCachedHandlerMap'
  >;
  readonly createTaskStoreNotConfiguredError: (toolName: string) => StdioTaskError;
  readonly buildToolResponse: (payload: Record<string, unknown>) => CallToolResult;
  readonly getToolIcons: (toolName: string) => import('@modelcontextprotocol/sdk/types.js').Icon[] | undefined;
  readonly getToolExecution: (
    toolName: string
  ) => import('@modelcontextprotocol/sdk/types.js').ToolExecution | undefined;
  readonly registerTaskTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema: AnySchema;
      outputSchema?: AnySchema;
      annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
      execution?: import('@modelcontextprotocol/sdk/experimental/tasks/interfaces.js').TaskToolExecution;
    },
    handler: ToolTaskHandler<AnySchema>
  ) => void;
  readonly registerTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: unknown;
      outputSchema?: unknown;
      annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
      icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
      execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
    },
    handler: (args: Record<string, unknown>, extra: unknown) => Promise<CallToolResult>
  ) => void;
  readonly initializeStageManager: (registerNewTools: (tools: readonly TTool[]) => void) => void;
  readonly getInitialTools: () => readonly TTool[];
  readonly markRegistered: (toolNames: string[]) => void;
  readonly registerToolsListCompatibilityHandler: () => void;
  readonly registerFlatToolCallInterceptor: () => void;
  readonly syncToolList: (
    toolNames: readonly string[],
    options: {
      emitOnFirstSet: boolean;
      reason: string;
    }
  ) => void;
}

export interface StdioToolRuntime {
  readonly handleToolCall: (
    toolName: string,
    args: Record<string, unknown>,
    extra?: StdioToolCallExtra
  ) => Promise<CallToolResult>;
  readonly registerTools: () => void;
  readonly registerResources: () => Promise<void>;
  readonly ensureResourcesRegistered: () => Promise<void>;
}

export function buildStdioToolRuntime<
  TTool extends StdioToolDefinitionLike = StdioToolDefinitionLike,
  TContext = unknown,
  THandlers = unknown,
  TGoogleClient = unknown,
  TAuthHandler = unknown,
  THandlerMap = CachedHandlerMap,
  TRequestContext extends StdioResolvedRequestContext = StdioResolvedRequestContext,
>(
  input: BuildStdioToolRuntimeInput<
    TTool,
    TContext,
    THandlers,
    TGoogleClient,
    TAuthHandler,
    THandlerMap
  >,
  dependencies: BuildStdioToolRuntimeDependencies<
    TTool,
    TContext,
    THandlers,
    TGoogleClient,
    TAuthHandler,
    THandlerMap,
    TRequestContext
  >
): StdioToolRuntime {
  const registerResources = async (): Promise<void> => {
    await registerStdioResources(input.getResourcesRegistered(), {
      registerResources: dependencies.registerResources,
      log: input.log,
    });
  };

  const ensureResourcesRegistered = async (): Promise<void> => {
    await ensureStdioResourcesRegistered(
      {
        resourcesRegistered: input.getResourcesRegistered(),
        resourceRegistrationPromise: input.getResourceRegistrationPromise(),
        resourceRegistrationFailed: input.getResourceRegistrationFailed(),
        setResourcesRegistered: input.setResourcesRegistered,
        setResourceRegistrationPromise: input.setResourceRegistrationPromise,
        setResourceRegistrationFailed: input.setResourceRegistrationFailed,
      },
      {
        registerResources,
        log: input.log,
      }
    );
  };

  const handleToolCall = async (
    toolName: string,
    args: Record<string, unknown>,
    extra?: StdioToolCallExtra
  ): Promise<CallToolResult> =>
    executeStdioToolCall(
      {
        toolName,
        args,
        extra,
        isShutdown: input.getIsShutdown(),
        sessionContext: (input.getContext() as { sessionContext?: unknown } | null)?.sessionContext,
        requestQueue: input.requestQueue,
        connectionHealthCheck: input.connectionHealthCheck,
      },
      {
        ...dependencies.executeToolCall,
        ensureResourcesRegistered,
        executeWithinRequest: async ({ requestContext, costTrackingTenantId, startTime }) =>
          resolveStdioToolCall(
            {
              toolName,
              args,
              authHandler: input.getAuthHandler(),
              cachedHandlerMap: input.getCachedHandlerMap(),
              handlers: input.getHandlers(),
              context: input.getContext(),
              googleClient: input.getGoogleClient(),
              extra,
              requestId: requestContext.requestId,
              costTrackingTenantId,
              startTime,
            },
            {
              ...dependencies.resolveToolCall,
              setAuthHandler: input.setAuthHandler,
              setCachedHandlerMap: input.setCachedHandlerMap,
            }
          ),
      }
    );

  const createToolTaskHandler = (toolName: string): ToolTaskHandler<AnySchema> =>
    createStdioTaskHandler(toolName, {
      createTaskStoreNotConfiguredError: dependencies.createTaskStoreNotConfiguredError,
      taskStoreForCancellation: input.taskStore as Parameters<typeof createStdioTaskHandler>[1]['taskStoreForCancellation'],
      taskAbortControllers: input.taskAbortControllers,
      taskWatchdogTimers: input.taskWatchdogTimers,
      taskWatchdogMs: input.taskWatchdogMs,
      runTool: (args, extra) =>
        handleToolCall(toolName, args, {
          sendNotification: extra?.sendNotification,
          progressToken: extra?.progressToken,
          abortSignal: extra?.abortSignal,
          taskId: extra?.taskId,
          taskStore: extra?.taskStore as StdioTaskStatusUpdaterLike | undefined,
        }),
      buildCancelledTaskResult: (message) =>
        dependencies.buildToolResponse({
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
        dependencies.buildToolResponse({
          response: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : String(error),
              retryable: false,
            },
          },
        }),
      log: input.log,
    });

  const registerToolSet = (tools: readonly TTool[]): void => {
    registerStdioToolSet(tools, {
      createTaskHandler: createToolTaskHandler,
      handleToolCall: (toolName, args, extra) =>
        handleToolCall(toolName, args, {
          ...extra,
          sendRequest: extra?.sendRequest,
          taskStore: extra?.taskStore as StdioTaskStatusUpdaterLike | undefined,
        }),
      getToolIcons: dependencies.getToolIcons,
      getToolExecution: dependencies.getToolExecution,
      registerTaskTool: dependencies.registerTaskTool,
      registerTool: dependencies.registerTool,
    });
  };

  const registerTools = (): void => {
    registerStdioTools(input.toolDefinitions, {
      initializeStageManager: dependencies.initializeStageManager,
      getInitialTools: dependencies.getInitialTools,
      registerToolSet,
      markRegistered: dependencies.markRegistered,
      stagedRegistrationEnabled: input.stagedRegistrationEnabled,
      registerToolsListCompatibilityHandler: dependencies.registerToolsListCompatibilityHandler,
      registerFlatToolCallInterceptor: dependencies.registerFlatToolCallInterceptor,
      enableToolsListChangedNotifications: input.enableToolsListChangedNotifications,
      syncToolList: dependencies.syncToolList,
      log: input.log,
    });
  };

  return {
    handleToolCall,
    registerTools,
    registerResources,
    ensureResourcesRegistered,
  };
}
