/**
 * ServalSheets - Tool Handlers
 *
 * Handler mapping and tool call execution logic.
 *
 * @module mcp/registration/tool-handlers
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type {
  CallToolResult,
  RequestInfo,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { randomUUID } from 'crypto';
import PQueue from 'p-queue';
import {
  recordToolCall,
  recordToolCallLatency,
  recordError,
  recordSelfCorrection,
  updateQueueMetrics,
} from '../../observability/metrics.js';
import { resourceNotifications } from '../../resources/notifications.js';
import { withToolSpan } from '../../utils/tracing.js';
import { z, type ZodSchema, type ZodTypeAny } from 'zod';

import type { Handlers } from '../../handlers/index.js';
import { AuthHandler } from '../../handlers/auth.js';
import {
  handleGenerateTemplateAction,
  handlePreviewGenerationAction,
} from '../../handlers/composite-actions/generation.js';
import { createServerAuthHandler } from '../../server/auth-handler-factory.js';
import { ConfirmHandler } from '../../handlers/confirm.js';
import { SessionHandler } from '../../handlers/session.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import {
  createRequestContext,
  runWithRequestContext,
  getRequestContext,
  createRequestAbortError,
  recordRequestVerbosity,
  type RelatedRequestSender,
  type TaskStatusUpdater,
} from '../../utils/request-context.js';
import { extractIdempotencyKeyFromHeaders } from '../../utils/idempotency-key-generator.js';
import { recordSpreadsheetId, recordRange, TOOL_ACTIONS } from '../completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { getHistoryService } from '../../services/history-service.js';
import { handleSessionGetContext } from '../../handlers/session-actions/get-context.js';
import { handleSessionSetActive } from '../../handlers/session-actions/set-active.js';
import { buildToolExecutionErrorPayload } from './tool-execution-error.js';
import { executeTracedToolCall } from './tool-call-execution.js';
import { recordSuccessfulToolExecution, recordFailedToolExecution } from './tool-execution-side-effects.js';
import { buildToolResponse, validateOutputSchema } from './tool-response.js';
import { normalizeToolArgs } from './tool-arg-normalization.js';
import {
  extractAction,
  extractSpreadsheetId,
  isSuccessResult,
  extractCellsAffected,
} from './extraction-helpers.js';

import type { Tool, ToolInputObjectSchema } from '@modelcontextprotocol/sdk/types.js';
import { IdempotencyManager } from '../../services/idempotency-manager.js';
import type { ServiceError } from '../../core/errors.js';

export async function registerToolHandlers(
  server: McpServer,
  handlers: Handlers,
  googleApiClient: GoogleApiClient,
  idempotencyManager: IdempotencyManager
): Promise<{
  callTool: (
    name: string,
    args: Record<string, unknown>,
    requestInfo?: RequestInfo
  ) => Promise<CallToolResult>;
  registerToolsWithServer: () => Promise<void>;
  shutdown: () => void;
}> {
  const requestQueue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 100 });
  const registrationState = {
    initialized: false,
    disposed: false,
    abortController: new AbortController(),
  };

  let handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> | null = null;

  const initializeHandlers = async (): Promise<void> => {
    if (registrationState.initialized || registrationState.disposed) {
      return;
    }

    try {
      handlerMap = createHandlerMap(handlers);
      registrationState.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize handler map', { error });
      throw error;
    }
  };

  const checkAuthAsync = async (
    client: GoogleApiClient
  ): Promise<{ authenticated: boolean; error?: Error }> => {
    try {
      const auth = client.getAuth();
      if (!auth) {
        return { authenticated: false, error: new Error('No authentication') };
      }
      return { authenticated: true };
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  const isToolCallAuthExempt = (toolName: string, action?: string): boolean => {
    const AUTH_EXEMPT_TOOLS = [
      'sheets_auth',
      'sheets_confirm', // elicitation responses
    ];

    if (AUTH_EXEMPT_TOOLS.includes(toolName)) {
      return true;
    }

    const AUTH_EXEMPT_ACTIONS: Record<string, Set<string>> = {
      sheets_session: new Set(['get_context', 'set_active']),
    };

    if (action && AUTH_EXEMPT_ACTIONS[toolName]?.has(action)) {
      return true;
    }

    return false;
  };

  const handlePreInitExemptToolCall = async (
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    if (toolName === 'sheets_auth') {
      const handler = new AuthHandler(googleApiClient);
      return handler.handle(args);
    }

    if (toolName === 'sheets_session') {
      const rawAction = ((args['request'] as Record<string, unknown> | undefined)?.['action'] ??
        args['action']) as string | undefined;

      if (rawAction === 'get_context') {
        return handleSessionGetContext();
      }

      if (rawAction === 'set_active') {
        const handler = new SessionHandler(googleApiClient);
        return handler.handle(args);
      }
    }

    return null;
  };

  const buildAuthErrorResponse = (error: Error): Record<string, unknown> => {
    return {
      response: {
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: error.message,
          retryable: false,
        },
      },
    };
  };

  const callTool = async (
    name: string,
    args: Record<string, unknown>,
    requestInfo?: RequestInfo
  ): Promise<CallToolResult> => {
    const operationId = randomUUID();
    const requestId = extractIdempotencyKeyFromHeaders(requestInfo?.metadata);
    const startTime = Date.now();

    if (registrationState.disposed || registrationState.abortSignal?.aborted) {
      return buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'OPERATION_CANCELLED',
            message: 'MCP session closed',
            retryable: false,
          },
        },
      });
    }

    updateQueueMetrics(requestQueue.size, requestQueue.pending);

    return requestQueue.add(async () => {
      if (requestAbortSignal?.aborted) {
        throw createRequestAbortError(requestAbortSignal.reason, 'MCP session closed');
      }

      return runWithRequestContext(requestContext, async () => {
        requestContext.logger.debug('Tool call queued', {
          toolName: tool.name,
          queueSize: requestQueue.size,
          pendingCount: requestQueue.pending,
          traceId: requestContext.traceId,
          spanId: requestContext.spanId,
        });

        if (requestContext.abortSignal?.aborted) {
          throw createRequestAbortError(requestContext.abortSignal.reason);
        }

        recordSpreadsheetId(args);
        const rawArgs = args as Record<string, unknown>;
        const rawAction = ((rawArgs['request'] as Record<string, unknown> | undefined)?.[
          'action'
        ] ?? rawArgs['action']) as string | undefined;
        const isExempt = isToolCallAuthExempt(name, rawAction);

        if (!isExempt) {
          const authResult = await checkAuthAsync(googleApiClient);
          if (!authResult.authenticated) {
            return buildToolResponse(buildAuthErrorResponse(authResult.error!));
          }
        }

        if (!handlerMap) {
          if (isExempt) {
            const preInitResult = await handlePreInitExemptToolCall(name, rawArgs);
            if (preInitResult) {
              return buildToolResponse(preInitResult as Record<string, unknown>);
            }
          }

          const errorResponse = {
            response: {
              success: false,
              error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Google API client not initialized. Please provide credentials.',
              },
            },
          };
          return buildToolResponse(errorResponse);
        }

        const handler = handlerMap[name];
        if (!handler) {
          const errorResponse = {
            response: {
              success: false,
              error: {
                code: 'UNKNOWN_TOOL',
                message: `Tool '${name}' is not registered.`,
              },
            },
          };
          return buildToolResponse(errorResponse);
        }

        try {
          const result = await executeTracedToolCall({
            tool: { name },
            args,
            handler,
            requestContext,
            operationId,
            requestId,
          });

          await recordSuccessfulToolExecution({
            toolName: name,
            args,
            result,
            startTime,
            requestInfo,
          });

          return result as CallToolResult;
        } catch (error) {
          await recordFailedToolExecution({
            toolName: name,
            args,
            error: error instanceof Error ? error : new Error(String(error)),
            startTime,
            requestInfo,
          });

          const toolError = buildToolExecutionErrorPayload(error);
          return buildToolResponse({ response: { success: false, error: toolError } });
        }
      });
    });
  };

  const createHandlerMap = (handlers: Handlers): Record<string, Function> => {
    const map: Record<string, Function> = {};
    for (const [toolName, handler] of Object.entries(handlers)) {
      map[toolName] = (args: Record<string, unknown>) => handler.handle(args);
    }
    return map;
  };

  const registerToolsWithServer = async (): Promise<void> => {
    if (registrationState.initialized) {
      return;
    }

    await initializeHandlers();

    const tools: Tool[] = Object.keys(TOOL_ACTIONS).map((toolName) => {
      const toolIcon = TOOL_ICONS[toolName];
      const toolConfig = TOOL_EXECUTION_CONFIG[toolName];
      const toolAnnotations: ToolAnnotations = {
        priority: 1,
      };

      if (toolIcon) {
        toolAnnotations.description = toolIcon;
      }

      const schema = getToolSchema(toolName);

      return {
        name: toolName,
        description: `${toolName} tool`,
        inputSchema: schema,
        ...(toolAnnotations && { annotations: toolAnnotations }),
      };
    });

    for (const tool of tools) {
      server.setRequestHandler(
        { name: tool.name } as any,
        async (request: any) => {
          return callTool(tool.name, request.params, request._meta);
        }
      );
    }
  };

  const getToolSchema = (toolName: string): ToolInputObjectSchema => {
    return {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          properties: {
            action: { type: 'string' },
          },
          required: ['action'],
        },
      },
      required: ['request'],
    };
  };

  const shutdown = (): void => {
    if (registrationState.disposed) {
      return;
    }

    registrationState.disposed = true;
    registrationState.abortController.abort('MCP session closed');
    requestQueue.clear();
    updateQueueMetrics(requestQueue.size, requestQueue.pending);
  };

  return {
    callTool,
    registerToolsWithServer,
    shutdown,
  };
}

const logger = {
  debug: (msg: string, meta?: any) => console.debug(msg, meta),
  error: (msg: string, meta?: any) => console.error(msg, meta),
  warn: (msg: string, meta?: any) => console.warn(msg, meta),
};

const requestAbortSignal = new AbortController().signal;
const requestContext = createRequestContext({
  principalId: 'system',
  traceId: randomUUID(),
  spanId: randomUUID(),
});
const tool = { name: 'test-tool' };
