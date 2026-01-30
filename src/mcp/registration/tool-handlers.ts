/**
 * ServalSheets - Tool Handlers
 *
 * Handler mapping and tool call execution logic.
 *
 * @module mcp/registration/tool-handlers
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { randomUUID } from 'crypto';
import { recordToolCall } from '../../observability/metrics.js';
import type { ZodSchema, ZodTypeAny } from 'zod';

import type { Handlers } from '../../handlers/index.js';
import { AuthHandler } from '../../handlers/auth.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import {
  createRequestContext,
  runWithRequestContext,
  getRequestLogger,
  getRequestContext,
} from '../../utils/request-context.js';
import { compactResponse, isCompactModeEnabled } from '../../utils/response-compactor.js';
import { recordSpreadsheetId } from '../completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { getHistoryService } from '../../services/history-service.js';
import type { OperationHistory } from '../../types/history.js';
import { prepareSchemaForRegistration, wrapInputSchemaForLegacyRequest } from './schema-helpers.js';
import type { ToolDefinition } from './tool-definitions.js';
import { ACTIVE_TOOL_DEFINITIONS } from './tool-definitions.js';
import {
  extractAction,
  extractSpreadsheetId,
  extractSheetId,
  extractCellsAffected,
  extractSnapshotId,
  extractErrorMessage,
  extractErrorCode,
  isSuccessResult,
} from './extraction-helpers.js';
import {
  SheetsAuthInputSchema,
  SheetsCoreInputSchema,
  SheetsDataInputSchema,
  SheetsFormatInputSchema,
  SheetsDimensionsInputSchema,
  SheetsVisualizeInputSchema,
  SheetsCollaborateInputSchema,
  SheetsAdvancedInputSchema,
  SheetsTransactionInputSchema,
  SheetsQualityInputSchema,
  SheetsHistoryInputSchema,
  SheetsConfirmInputSchema,
  SheetsAnalyzeInputSchema,
  SheetsFixInputSchema,
  CompositeInputSchema,
  SheetsSessionInputSchema,
  // Tier 7 Enterprise tools
  SheetsTemplatesInputSchema,
  SheetsBigQueryInputSchema,
  SheetsAppsScriptInputSchema,
  SheetsWebhookInputSchema,
  SheetsDependenciesInputSchema,
} from '../../schemas/index.js';
import { parseWithCache } from '../../utils/schema-cache.js';
import { registerToolsListCompatibilityHandler } from './tools-list-compat.js';

// Wrap input schemas for legacy envelopes during validation.
// Keep registration schemas unwrapped to avoid MCP SDK tools/list empty schema bug.
const SheetsAuthInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAuthInputSchema);
const SheetsCoreInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsCoreInputSchema);
const SheetsDataInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsDataInputSchema);
const SheetsFormatInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsFormatInputSchema);
const SheetsDimensionsInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsDimensionsInputSchema);
const SheetsVisualizeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsVisualizeInputSchema);
const SheetsCollaborateInputSchemaLegacy =
  wrapInputSchemaForLegacyRequest(SheetsCollaborateInputSchema);
const SheetsAdvancedInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAdvancedInputSchema);
const SheetsTransactionInputSchemaLegacy =
  wrapInputSchemaForLegacyRequest(SheetsTransactionInputSchema);
const SheetsQualityInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsQualityInputSchema);
const SheetsHistoryInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsHistoryInputSchema);
const SheetsConfirmInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsConfirmInputSchema);
const SheetsAnalyzeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAnalyzeInputSchema);
const SheetsFixInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsFixInputSchema);
const CompositeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(CompositeInputSchema);
const SheetsSessionInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsSessionInputSchema);
const SheetsTemplatesInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsTemplatesInputSchema);
const SheetsBigQueryInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsBigQueryInputSchema);
const SheetsAppsScriptInputSchemaLegacy =
  wrapInputSchemaForLegacyRequest(SheetsAppsScriptInputSchema);
const SheetsWebhookInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsWebhookInputSchema);
const SheetsDependenciesInputSchemaLegacy =
  wrapInputSchemaForLegacyRequest(SheetsDependenciesInputSchema);

const parseForHandler = <T>(schema: ZodTypeAny, args: unknown, schemaName: string): T =>
  parseWithCache(schema as ZodSchema<T>, args, schemaName);

// ============================================================================
// HANDLER MAPPING
// ============================================================================

/**
 * Creates a map of tool names to handler functions
 *
 * Each handler receives validated input and returns structured output.
 * The MCP SDK validates input against inputSchema before calling the handler.
 */
export function createToolHandlerMap(
  handlers: Handlers,
  authHandler?: AuthHandler
): Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> {
  const map: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> = {
    sheets_core: (args) =>
      handlers.core.handle(
        parseForHandler<Parameters<Handlers['core']['handle']>[0]>(
          SheetsCoreInputSchemaLegacy,
          args,
          'SheetsCoreInput'
        )
      ),
    sheets_data: (args) =>
      handlers.data.handle(
        parseForHandler<Parameters<Handlers['data']['handle']>[0]>(
          SheetsDataInputSchemaLegacy,
          args,
          'SheetsDataInput'
        )
      ),
    sheets_format: (args) =>
      handlers.format.handle(
        parseForHandler<Parameters<Handlers['format']['handle']>[0]>(
          SheetsFormatInputSchemaLegacy,
          args,
          'SheetsFormatInput'
        )
      ),
    sheets_dimensions: (args) =>
      handlers.dimensions.handle(
        parseForHandler<Parameters<Handlers['dimensions']['handle']>[0]>(
          SheetsDimensionsInputSchemaLegacy,
          args,
          'SheetsDimensionsInput'
        )
      ),
    sheets_visualize: (args) =>
      handlers.visualize.handle(
        parseForHandler<Parameters<Handlers['visualize']['handle']>[0]>(
          SheetsVisualizeInputSchemaLegacy,
          args,
          'SheetsVisualizeInput'
        )
      ),
    sheets_collaborate: (args) =>
      handlers.collaborate.handle(
        parseForHandler<Parameters<Handlers['collaborate']['handle']>[0]>(
          SheetsCollaborateInputSchemaLegacy,
          args,
          'SheetsCollaborateInput'
        )
      ),
    sheets_advanced: (args) =>
      handlers.advanced.handle(
        parseForHandler<Parameters<Handlers['advanced']['handle']>[0]>(
          SheetsAdvancedInputSchemaLegacy,
          args,
          'SheetsAdvancedInput'
        )
      ),
    sheets_transaction: (args) =>
      handlers.transaction.handle(
        parseForHandler<Parameters<Handlers['transaction']['handle']>[0]>(
          SheetsTransactionInputSchemaLegacy,
          args,
          'SheetsTransactionInput'
        )
      ),
    sheets_quality: (args) =>
      handlers.quality.handle(
        parseForHandler<Parameters<Handlers['quality']['handle']>[0]>(
          SheetsQualityInputSchemaLegacy,
          args,
          'SheetsQualityInput'
        )
      ),
    sheets_history: (args) =>
      handlers.history.handle(
        parseForHandler<Parameters<Handlers['history']['handle']>[0]>(
          SheetsHistoryInputSchemaLegacy,
          args,
          'SheetsHistoryInput'
        )
      ),
    // MCP-native tools (use Server instance from context for Elicitation/Sampling)
    sheets_confirm: (args) =>
      handlers.confirm.handle(
        parseForHandler<Parameters<Handlers['confirm']['handle']>[0]>(
          SheetsConfirmInputSchemaLegacy,
          args,
          'SheetsConfirmInput'
        )
      ),
    sheets_analyze: (args) =>
      handlers.analyze.handle(
        parseForHandler<Parameters<Handlers['analyze']['handle']>[0]>(
          SheetsAnalyzeInputSchemaLegacy,
          args,
          'SheetsAnalyzeInput'
        )
      ),
    sheets_fix: (args) =>
      handlers.fix.handle(
        parseForHandler<Parameters<Handlers['fix']['handle']>[0]>(
          SheetsFixInputSchemaLegacy,
          args,
          'SheetsFixInput'
        )
      ),
    // Composite operations
    sheets_composite: (args) =>
      handlers.composite.handle(
        parseForHandler<Parameters<Handlers['composite']['handle']>[0]>(
          CompositeInputSchemaLegacy,
          args,
          'CompositeInput'
        )
      ),
    // Session context for NL excellence
    sheets_session: (args) =>
      handlers.session.handle(
        parseForHandler<Parameters<Handlers['session']['handle']>[0]>(
          SheetsSessionInputSchemaLegacy,
          args,
          'SheetsSessionInput'
        )
      ),
    // Tier 7 Enterprise tools
    sheets_templates: (args) =>
      handlers.templates.handle(
        parseForHandler<Parameters<Handlers['templates']['handle']>[0]>(
          SheetsTemplatesInputSchemaLegacy,
          args,
          'SheetsTemplatesInput'
        )
      ),
    sheets_bigquery: (args) =>
      handlers.bigquery.handle(
        parseForHandler<Parameters<Handlers['bigquery']['handle']>[0]>(
          SheetsBigQueryInputSchemaLegacy,
          args,
          'SheetsBigQueryInput'
        )
      ),
    sheets_appsscript: (args) =>
      handlers.appsscript.handle(
        parseForHandler<Parameters<Handlers['appsscript']['handle']>[0]>(
          SheetsAppsScriptInputSchemaLegacy,
          args,
          'SheetsAppsScriptInput'
        )
      ),
    sheets_webhook: (args) =>
      handlers.webhooks.handle(
        parseForHandler<Parameters<Handlers['webhooks']['handle']>[0]>(
          SheetsWebhookInputSchemaLegacy,
          args,
          'SheetsWebhookInput'
        )
      ),
    sheets_dependencies: (args) =>
      handlers.dependencies.handle(
        parseForHandler<Parameters<Handlers['dependencies']['handle']>[0]>(
          SheetsDependenciesInputSchemaLegacy,
          args,
          'SheetsDependenciesInput'
        )
      ),
  };

  if (authHandler) {
    map['sheets_auth'] = (args) =>
      authHandler.handle(
        parseForHandler<Parameters<AuthHandler['handle']>[0]>(
          SheetsAuthInputSchemaLegacy,
          args,
          'SheetsAuthInput'
        )
      );
  }

  return map;
}

// ============================================================================
// RESPONSE BUILDING
// ============================================================================

/**
 * Builds a compliant MCP tool response
 *
 * MCP 2025-11-25 Response Requirements:
 * - content: Array of content blocks (always present)
 * - structuredContent: Typed object matching outputSchema
 * - isError: true for tool errors (LLM can retry), undefined for success
 *
 * @param result - The handler result (should match output schema)
 * @returns CallToolResult with content, structuredContent, and optional isError
 */
export function buildToolResponse(result: unknown): CallToolResult {
  let structuredContent: Record<string, unknown>;

  if (typeof result !== 'object' || result === null) {
    structuredContent = {
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Tool handler returned non-object result',
          retryable: false,
        },
      },
    };
  } else if ('response' in result) {
    structuredContent = result as Record<string, unknown>;
  } else if ('success' in result) {
    structuredContent = { response: result as Record<string, unknown> };
  } else {
    structuredContent = {
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Tool handler returned invalid response shape',
          retryable: false,
        },
      },
    };
  }

  // Add request correlation ID for tracing (if available)
  const requestContext = getRequestContext();
  if (requestContext && 'response' in structuredContent) {
    const resp = structuredContent['response'] as Record<string, unknown>;
    if (resp && typeof resp === 'object') {
      // Add _meta with requestId for correlation across logs/errors
      resp['_meta'] = {
        ...(typeof resp['_meta'] === 'object' ? (resp['_meta'] as Record<string, unknown>) : {}),
        requestId: requestContext.requestId,
        ...(requestContext.traceId && { traceId: requestContext.traceId }),
        ...(requestContext.spanId && { spanId: requestContext.spanId }),
      };
    }
  }

  // Apply response compaction if enabled (reduces context window pressure)
  if (isCompactModeEnabled()) {
    structuredContent = compactResponse(structuredContent);
  }

  const response = structuredContent['response'];
  const responseSuccess =
    response && typeof response === 'object'
      ? (response as { success?: boolean }).success
      : undefined;

  // Detect errors from success: false in response (or legacy top-level success)
  const isError = responseSuccess === false || structuredContent['success'] === false;

  // DEBUG: Log sheets_collaborate responses to diagnose validation issue
  if (typeof result === 'object' && result !== null && 'response' in result) {
    const resp = (result as Record<string, unknown>)['response'];
    if (resp && typeof resp === 'object' && 'action' in resp) {
      const action = (resp as Record<string, unknown>)['action'];
      if (typeof action === 'string' && action.includes('permission')) {
        const logger = getRequestLogger();
        logger.info('[DEBUG] buildToolResponse for sharing', {
          action,
          responseSuccess,
          responseSuccessType: typeof responseSuccess,
          isError,
          structuredContentKeys: Object.keys(structuredContent),
          responseKeys:
            response && typeof response === 'object' ? Object.keys(response) : undefined,
        });
      }
    }
  }

  return {
    // Human-readable content for display
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    // Typed structured content for programmatic access
    structuredContent,
    // Error flag - only set when true, undefined otherwise (MCP convention)
    isError: isError ? true : undefined,
  };
}

// ============================================================================
// HISTORY RECORDING HELPERS
// ============================================================================
// Note: Extraction helpers moved to extraction-helpers.ts for reusability

// ============================================================================
// TOOL CALL HANDLER
// ============================================================================

function normalizeToolArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object') {
    // OK: Explicit empty - invalid args will be caught by Zod validation downstream
    return {};
  }
  const record = args as Record<string, unknown>;
  const request = record['request'];
  if (!request || typeof request !== 'object') {
    return { request: record };
  }

  const requestRecord = request as Record<string, unknown>;
  const params = requestRecord['params'];
  if (params && typeof params === 'object') {
    const action =
      typeof requestRecord['action'] === 'string' ? { action: requestRecord['action'] } : {};
    return { request: { ...(params as Record<string, unknown>), ...action } };
  }

  return { request: requestRecord };
}

function createToolCallHandler(
  tool: ToolDefinition,
  handlerMap: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> | null
): (
  args: Record<string, unknown>,
  extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }
) => Promise<CallToolResult> {
  return async (
    args: Record<string, unknown>,
    extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }
  ) => {
    const requestId = extra?.requestId ? String(extra.requestId) : undefined;
    const requestContext = createRequestContext({ requestId });

    // Generate operation ID and start time for history tracking
    const operationId = randomUUID();
    const startTime = Date.now();
    const timestamp = new Date(startTime).toISOString();

    return runWithRequestContext(requestContext, async () => {
      recordSpreadsheetId(args);

      if (!handlerMap) {
        const errorResponse = {
          response: {
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Google API client not initialized. Please provide credentials.',
              retryable: false,
              suggestedFix: 'Set GOOGLE_APPLICATION_CREDENTIALS or configure OAuth',
            },
          },
        };

        // Record failed operation in history
        const historyService = getHistoryService();
        historyService.record({
          id: operationId,
          timestamp,
          tool: tool.name,
          action: extractAction(args),
          params: args,
          result: 'error',
          duration: Date.now() - startTime,
          errorMessage: 'Google API client not initialized. Please provide credentials.',
          errorCode: 'AUTHENTICATION_REQUIRED',
          requestId,
          spreadsheetId: extractSpreadsheetId(args),
        });

        return buildToolResponse(errorResponse);
      }

      const handler = handlerMap[tool.name];
      if (!handler) {
        const errorResponse = {
          response: {
            success: false,
            error: {
              code: 'NOT_IMPLEMENTED',
              message: `Handler for ${tool.name} not yet implemented`,
              retryable: false,
              suggestedFix: 'This tool is planned for a future release',
            },
          },
        };

        // Record failed operation in history
        const historyService = getHistoryService();
        historyService.record({
          id: operationId,
          timestamp,
          tool: tool.name,
          action: extractAction(args),
          params: args,
          result: 'error',
          duration: Date.now() - startTime,
          errorMessage: `Handler for ${tool.name} not yet implemented`,
          errorCode: 'NOT_IMPLEMENTED',
          requestId,
          spreadsheetId: extractSpreadsheetId(args),
        });

        return buildToolResponse(errorResponse);
      }

      try {
        // Execute handler - pass extra context for MCP-native tools
        const result = await handler(normalizeToolArgs(args), extra);
        const duration = Date.now() - startTime;

        // Record operation in history
        const historyService = getHistoryService();
        const operation: OperationHistory = {
          id: operationId,
          timestamp,
          tool: tool.name,
          action: extractAction(args),
          params: args,
          result: isSuccessResult(result) ? 'success' : 'error',
          duration,
          cellsAffected: extractCellsAffected(result),
          snapshotId: extractSnapshotId(result),
          errorMessage: extractErrorMessage(result),
          errorCode: extractErrorCode(result),
          requestId,
          spreadsheetId: extractSpreadsheetId(args),
          sheetId: extractSheetId(args),
        };

        historyService.record(operation);

        // Record metrics for observability
        const action = extractAction(args);
        const status = isSuccessResult(result) ? 'success' : 'error';
        recordToolCall(tool.name, action, status, duration / 1000);

        return buildToolResponse(result);
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Record failed operation in history
        const historyService = getHistoryService();
        historyService.record({
          id: operationId,
          timestamp,
          tool: tool.name,
          action: extractAction(args),
          params: args,
          result: 'error',
          duration,
          errorMessage,
          errorCode: 'INTERNAL_ERROR',
          requestId,
          spreadsheetId: extractSpreadsheetId(args),
        });

        // Record error metrics
        recordToolCall(tool.name, extractAction(args), 'error', duration / 1000);

        // Return structured error instead of throwing (Task 1.2)
        // This ensures MCP clients receive tool errors (isError: true) not protocol errors
        const errorResponse = {
          response: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: errorMessage,
              retryable: false,
            },
          },
        };

        return buildToolResponse(errorResponse);
      }
    });
  };
}

function createToolTaskHandler(
  toolName: string,
  runTool: (
    args: Record<string, unknown>,
    extra?: { requestId?: string | number }
  ) => Promise<CallToolResult>
): ToolTaskHandler<AnySchema> {
  return {
    createTask: async (args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }

      const task = await extra.taskStore.createTask({
        ttl: extra.taskRequestedTtl ?? undefined,
      });

      const taskStore = extra.taskStore;
      void (async () => {
        try {
          const result = await runTool(args as Record<string, unknown>, extra);
          await taskStore.storeTaskResult(task.taskId, 'completed', result);
        } catch (error) {
          const errorResult = buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
              },
            },
          });
          try {
            await taskStore.storeTaskResult(task.taskId, 'failed', errorResult);
          } catch (storeError) {
            // Use structured logging to avoid corrupting stdio transport
            import('../../utils/logger.js')
              .then(({ logger }) => {
                logger.error('Failed to store task result', {
                  toolName,
                  error: storeError,
                });
              })
              .catch(() => {
                // Fallback if logger import fails
              });
          }
        }
      })();

      return { task };
    },
    getTask: async (_args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }
      return await extra.taskStore.getTask(extra.taskId);
    },
    getTaskResult: async (_args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }
      return (await extra.taskStore.getTaskResult(extra.taskId)) as CallToolResult;
    },
  };
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Registers all ServalSheets tools with the MCP server
 *
 * Handles SDK compatibility for discriminated union schemas.
 *
 * @param server - McpServer instance
 * @param handlers - Tool handlers (null if not authenticated)
 */
export async function registerServalSheetsTools(
  server: McpServer,
  handlers: Handlers | null,
  options?: { googleClient?: GoogleApiClient | null }
): Promise<void> {
  const authHandler = new AuthHandler({
    googleClient: options?.googleClient ?? null,
    elicitationServer: server.server,
  });

  const handlerMap = handlers
    ? createToolHandlerMap(handlers, authHandler)
    : {
        sheets_auth: (args: unknown) =>
          authHandler.handle(
            parseForHandler<Parameters<AuthHandler['handle']>[0]>(
              SheetsAuthInputSchema,
              args,
              'SheetsAuthInput'
            )
          ),
      };

  for (const tool of ACTIVE_TOOL_DEFINITIONS) {
    // Prepare schemas for SDK registration
    const inputSchemaForRegistration = prepareSchemaForRegistration(tool.inputSchema, 'input');
    const outputSchemaForRegistration = prepareSchemaForRegistration(tool.outputSchema, 'output');

    // Register tool with prepared schemas
    // Type assertion needed due to TypeScript's deep type instantiation limits
    const execution = TOOL_EXECUTION_CONFIG[tool.name];
    const supportsTasks = execution?.taskSupport && execution.taskSupport !== 'forbidden';
    const runTool = createToolCallHandler(tool, handlerMap);

    if (supportsTasks) {
      const taskHandler = createToolTaskHandler(tool.name, runTool);
      const taskSupport = execution?.taskSupport === 'required' ? 'required' : 'optional';
      const taskExecution = {
        ...(execution ?? {}),
        taskSupport,
      };

      server.experimental.tasks.registerToolTask<AnySchema, AnySchema>(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: inputSchemaForRegistration as AnySchema,
          outputSchema: outputSchemaForRegistration as AnySchema,
          annotations: tool.annotations,
          execution: taskExecution,
        } as Parameters<typeof server.experimental.tasks.registerToolTask<AnySchema, AnySchema>>[1],
        taskHandler
      );
      continue;
    }

    (
      server.registerTool as (
        name: string,
        config: {
          title?: string;
          description?: string;
          inputSchema?: unknown;
          outputSchema?: unknown;
          annotations?: ToolAnnotations;
          icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
          execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
        },
        cb: (
          args: Record<string, unknown>,
          extra?: {
            requestId?: string | number;
            elicit?: unknown;
            sample?: unknown;
          }
        ) => Promise<CallToolResult>
      ) => void
    )(
      tool.name,
      {
        title: tool.annotations.title,
        description: tool.description,
        inputSchema: inputSchemaForRegistration,
        outputSchema: outputSchemaForRegistration,
        annotations: tool.annotations,
        icons: TOOL_ICONS[tool.name],
        execution,
      },
      runTool
    );
  }

  // Override tools/list to safely serialize schemas with transforms/pipes.
  registerToolsListCompatibilityHandler(server);

  // NOTE: We register unwrapped object schemas for tools/list compatibility.
  // Legacy request envelopes are handled during validation via wrapInputSchemaForLegacyRequest.
}
