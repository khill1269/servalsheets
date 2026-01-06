/**
 * ServalSheets - MCP Registration Helpers
 * 
 * PRODUCTION-GRADE | MCP 2025-11-25 COMPLIANT
 *
 * Tool registration for multiple transports with SDK compatibility layer.
 * 
 * Architecture:
 * - Schemas use z.discriminatedUnion() for action-based dispatch
 * - SDK compatibility layer converts to JSON Schema for tools/list
 * - Full type safety maintained throughout
 * 
 * @module mcp/registration
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type {
  ToolTaskHandler,
  TaskToolExecution,
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import type { ZodTypeAny } from 'zod';
import { randomUUID } from 'crypto';

import type { Handlers } from '../handlers/index.js';
import { AuthHandler } from '../handlers/auth.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
import { completeRange, completeSpreadsheetId, recordSpreadsheetId } from './completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from './features-2025-11-25.js';
import { getHistoryService } from '../services/history-service.js';
import type { OperationHistory } from '../types/history.js';
import {
  isDiscriminatedUnion,
  zodToJsonSchemaCompat,
  verifyJsonSchema,
} from '../utils/schema-compat.js';
import {
  SheetsAuthInputSchema, SheetsAuthOutputSchema, SHEETS_AUTH_ANNOTATIONS,
  SheetSpreadsheetInputSchema, SheetsSpreadsheetOutputSchema, SHEETS_SPREADSHEET_ANNOTATIONS,
  SheetsSheetInputSchema, SheetsSheetOutputSchema, SHEETS_SHEET_ANNOTATIONS,
  SheetsValuesInputSchema, SheetsValuesOutputSchema, SHEETS_VALUES_ANNOTATIONS,
  SheetsCellsInputSchema, SheetsCellsOutputSchema, SHEETS_CELLS_ANNOTATIONS,
  SheetsFormatInputSchema, SheetsFormatOutputSchema, SHEETS_FORMAT_ANNOTATIONS,
  SheetsDimensionsInputSchema, SheetsDimensionsOutputSchema, SHEETS_DIMENSIONS_ANNOTATIONS,
  SheetsRulesInputSchema, SheetsRulesOutputSchema, SHEETS_RULES_ANNOTATIONS,
  SheetsChartsInputSchema, SheetsChartsOutputSchema, SHEETS_CHARTS_ANNOTATIONS,
  SheetsPivotInputSchema, SheetsPivotOutputSchema, SHEETS_PIVOT_ANNOTATIONS,
  SheetsFilterSortInputSchema, SheetsFilterSortOutputSchema, SHEETS_FILTER_SORT_ANNOTATIONS,
  SheetsSharingInputSchema, SheetsSharingOutputSchema, SHEETS_SHARING_ANNOTATIONS,
  SheetsCommentsInputSchema, SheetsCommentsOutputSchema, SHEETS_COMMENTS_ANNOTATIONS,
  SheetsVersionsInputSchema, SheetsVersionsOutputSchema, SHEETS_VERSIONS_ANNOTATIONS,
  SheetsAnalysisInputSchema, SheetsAnalysisOutputSchema, SHEETS_ANALYSIS_ANNOTATIONS,
  SheetsAdvancedInputSchema, SheetsAdvancedOutputSchema, SHEETS_ADVANCED_ANNOTATIONS,
  SheetsTransactionInputSchema, SheetsTransactionOutputSchema, SHEETS_TRANSACTION_ANNOTATIONS,
  SheetsWorkflowInputSchema, SheetsWorkflowOutputSchema, SHEETS_WORKFLOW_ANNOTATIONS,
  SheetsInsightsInputSchema, SheetsInsightsOutputSchema, SHEETS_INSIGHTS_ANNOTATIONS,
  SheetsValidationInputSchema, SheetsValidationOutputSchema, SHEETS_VALIDATION_ANNOTATIONS,
  SheetsPlanningInputSchema, SheetsPlanningOutputSchema, SHEETS_PLANNING_ANNOTATIONS,
  SheetsConflictInputSchema, SheetsConflictOutputSchema, SHEETS_CONFLICT_ANNOTATIONS,
  SheetsImpactInputSchema, SheetsImpactOutputSchema, SHEETS_IMPACT_ANNOTATIONS,
  SheetsHistoryInputSchema, SheetsHistoryOutputSchema, SHEETS_HISTORY_ANNOTATIONS,
} from '../schemas/index.js';
import {
  FirstOperationPromptArgsSchema,
  AnalyzeSpreadsheetPromptArgsSchema,
  TransformDataPromptArgsSchema,
  CreateReportPromptArgsSchema,
  CleanDataPromptArgsSchema,
} from '../schemas/prompts.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tool definition with Zod schemas
 * 
 * Schemas can be z.object(), z.discriminatedUnion(), or other Zod types.
 * The SDK compatibility layer handles conversion to JSON Schema.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;
  readonly annotations: ToolAnnotations;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Complete tool registry for ServalSheets
 * 
 * 16 tools, 165 actions
 * 
 * Schema Pattern: z.object({ request: z.discriminatedUnion('action', ...) })
 * - Actions are discriminated by `action` within `request`
 * - Responses are discriminated by `success` within `response`
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'sheets_auth',
    description: '🔐 MANDATORY FIRST STEP: Authentication management. ALWAYS call this with action:"status" before using any other sheets_* tool. Actions: status (check auth), login (get OAuth URL), callback (complete OAuth with code), logout (clear credentials)',
    inputSchema: SheetsAuthInputSchema,
    outputSchema: SheetsAuthOutputSchema,
    annotations: SHEETS_AUTH_ANNOTATIONS,
  },
  {
    name: 'sheets_spreadsheet',
    description: 'Spreadsheet operations: create, get, copy, update properties',
    inputSchema: SheetSpreadsheetInputSchema,
    outputSchema: SheetsSpreadsheetOutputSchema,
    annotations: SHEETS_SPREADSHEET_ANNOTATIONS,
  },
  {
    name: 'sheets_sheet',
    description: 'Sheet/tab operations: add, delete, duplicate, update, list',
    inputSchema: SheetsSheetInputSchema,
    outputSchema: SheetsSheetOutputSchema,
    annotations: SHEETS_SHEET_ANNOTATIONS,
  },
  {
    name: 'sheets_values',
    description: 'Cell values: read, write, append, clear, find, replace',
    inputSchema: SheetsValuesInputSchema,
    outputSchema: SheetsValuesOutputSchema,
    annotations: SHEETS_VALUES_ANNOTATIONS,
  },
  {
    name: 'sheets_cells',
    description: 'Cell operations: notes, validation, hyperlinks, merge',
    inputSchema: SheetsCellsInputSchema,
    outputSchema: SheetsCellsOutputSchema,
    annotations: SHEETS_CELLS_ANNOTATIONS,
  },
  {
    name: 'sheets_format',
    description: 'Formatting: colors, fonts, borders, alignment, presets',
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: SHEETS_FORMAT_ANNOTATIONS,
  },
  {
    name: 'sheets_dimensions',
    description: 'Rows/columns: insert, delete, move, resize, freeze, group',
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: SHEETS_DIMENSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_rules',
    description: 'Rules: conditional formatting, data validation',
    inputSchema: SheetsRulesInputSchema,
    outputSchema: SheetsRulesOutputSchema,
    annotations: SHEETS_RULES_ANNOTATIONS,
  },
  {
    name: 'sheets_charts',
    description: 'Charts: create, update, delete, move, export',
    inputSchema: SheetsChartsInputSchema,
    outputSchema: SheetsChartsOutputSchema,
    annotations: SHEETS_CHARTS_ANNOTATIONS,
  },
  {
    name: 'sheets_pivot',
    description: 'Pivot tables: create, update, refresh, calculated fields',
    inputSchema: SheetsPivotInputSchema,
    outputSchema: SheetsPivotOutputSchema,
    annotations: SHEETS_PIVOT_ANNOTATIONS,
  },
  {
    name: 'sheets_filter_sort',
    description: 'Filter/sort: basic filter, filter views, slicers, sort',
    inputSchema: SheetsFilterSortInputSchema,
    outputSchema: SheetsFilterSortOutputSchema,
    annotations: SHEETS_FILTER_SORT_ANNOTATIONS,
  },
  {
    name: 'sheets_sharing',
    description: 'Sharing: permissions, transfer ownership, link sharing',
    inputSchema: SheetsSharingInputSchema,
    outputSchema: SheetsSharingOutputSchema,
    annotations: SHEETS_SHARING_ANNOTATIONS,
  },
  {
    name: 'sheets_comments',
    description: 'Comments: add, reply, resolve, delete',
    inputSchema: SheetsCommentsInputSchema,
    outputSchema: SheetsCommentsOutputSchema,
    annotations: SHEETS_COMMENTS_ANNOTATIONS,
  },
  {
    name: 'sheets_versions',
    description: 'Versions: revisions, snapshots, restore, compare',
    inputSchema: SheetsVersionsInputSchema,
    outputSchema: SheetsVersionsOutputSchema,
    annotations: SHEETS_VERSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_analysis',
    description: 'Analysis: data quality, formula audit, statistics (read-only)',
    inputSchema: SheetsAnalysisInputSchema,
    outputSchema: SheetsAnalysisOutputSchema,
    annotations: SHEETS_ANALYSIS_ANNOTATIONS,
  },
  {
    name: 'sheets_advanced',
    description: 'Advanced: named ranges, protected ranges, metadata, banding',
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: SHEETS_ADVANCED_ANNOTATIONS,
  },
  {
    name: 'sheets_transaction',
    description: 'Transaction support: begin, queue operations, commit/rollback atomically with auto-snapshot. Batch multiple operations into 1 API call, saving 80% API usage.',
    inputSchema: SheetsTransactionInputSchema,
    outputSchema: SheetsTransactionOutputSchema,
    annotations: SHEETS_TRANSACTION_ANNOTATIONS,
  },
  {
    name: 'sheets_workflow',
    description: 'Smart workflows: detect common multi-step operations, execute workflows with auto-chaining. 50% reduction in tool calls for common tasks.',
    inputSchema: SheetsWorkflowInputSchema,
    outputSchema: SheetsWorkflowOutputSchema,
    annotations: SHEETS_WORKFLOW_ANNOTATIONS,
  },
  {
    name: 'sheets_insights',
    description: 'AI-powered data insights: anomaly detection, relationship discovery, predictions, quality analysis with recommendations.',
    inputSchema: SheetsInsightsInputSchema,
    outputSchema: SheetsInsightsOutputSchema,
    annotations: SHEETS_INSIGHTS_ANNOTATIONS,
  },
  {
    name: 'sheets_validation',
    description: 'Data validation: 11 builtin validators (type, range, format, uniqueness, pattern, etc.) with custom rule support.',
    inputSchema: SheetsValidationInputSchema,
    outputSchema: SheetsValidationOutputSchema,
    annotations: SHEETS_VALIDATION_ANNOTATIONS,
  },
  {
    name: 'sheets_plan',
    description: 'Natural language operation planning: create executable plans from intent with cost estimation and risk analysis.',
    inputSchema: SheetsPlanningInputSchema,
    outputSchema: SheetsPlanningOutputSchema,
    annotations: SHEETS_PLANNING_ANNOTATIONS,
  },
  {
    name: 'sheets_conflict',
    description: 'Conflict detection and resolution: detect concurrent modifications with 6 resolution strategies.',
    inputSchema: SheetsConflictInputSchema,
    outputSchema: SheetsConflictOutputSchema,
    annotations: SHEETS_CONFLICT_ANNOTATIONS,
  },
  {
    name: 'sheets_impact',
    description: 'Impact analysis: pre-execution analysis with dependency tracking (formulas, charts, pivot tables, etc.).',
    inputSchema: SheetsImpactInputSchema,
    outputSchema: SheetsImpactOutputSchema,
    annotations: SHEETS_IMPACT_ANNOTATIONS,
  },
  {
    name: 'sheets_history',
    description: 'Operation history: track last 100 operations for debugging and undo foundation.',
    inputSchema: SheetsHistoryInputSchema,
    outputSchema: SheetsHistoryOutputSchema,
    annotations: SHEETS_HISTORY_ANNOTATIONS,
  },
] as const;

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
): Record<string, (args: unknown) => Promise<unknown>> {
  const map: Record<string, (args: unknown) => Promise<unknown>> = {
    'sheets_spreadsheet': (args) => handlers.spreadsheet.handle(SheetSpreadsheetInputSchema.parse(args)),
    'sheets_sheet': (args) => handlers.sheet.handle(SheetsSheetInputSchema.parse(args)),
    'sheets_values': (args) => handlers.values.handle(SheetsValuesInputSchema.parse(args)),
    'sheets_cells': (args) => handlers.cells.handle(SheetsCellsInputSchema.parse(args)),
    'sheets_format': (args) => handlers.format.handle(SheetsFormatInputSchema.parse(args)),
    'sheets_dimensions': (args) => handlers.dimensions.handle(SheetsDimensionsInputSchema.parse(args)),
    'sheets_rules': (args) => handlers.rules.handle(SheetsRulesInputSchema.parse(args)),
    'sheets_charts': (args) => handlers.charts.handle(SheetsChartsInputSchema.parse(args)),
    'sheets_pivot': (args) => handlers.pivot.handle(SheetsPivotInputSchema.parse(args)),
    'sheets_filter_sort': (args) => handlers.filterSort.handle(SheetsFilterSortInputSchema.parse(args)),
    'sheets_sharing': (args) => handlers.sharing.handle(SheetsSharingInputSchema.parse(args)),
    'sheets_comments': (args) => handlers.comments.handle(SheetsCommentsInputSchema.parse(args)),
    'sheets_versions': (args) => handlers.versions.handle(SheetsVersionsInputSchema.parse(args)),
    'sheets_analysis': (args) => handlers.analysis.handle(SheetsAnalysisInputSchema.parse(args)),
    'sheets_advanced': (args) => handlers.advanced.handle(SheetsAdvancedInputSchema.parse(args)),
    'sheets_transaction': (args) => handlers.transaction.handle(SheetsTransactionInputSchema.parse(args)),
    'sheets_workflow': (args) => handlers.workflow.handle(SheetsWorkflowInputSchema.parse(args)),
    'sheets_insights': (args) => handlers.insights.handle(SheetsInsightsInputSchema.parse(args)),
    'sheets_validation': (args) => handlers.validation.handle(SheetsValidationInputSchema.parse(args)),
    'sheets_plan': (args) => handlers.planning.handle(SheetsPlanningInputSchema.parse(args)),
    'sheets_conflict': (args) => handlers.conflict.handle(SheetsConflictInputSchema.parse(args)),
    'sheets_impact': (args) => handlers.impact.handle(SheetsImpactInputSchema.parse(args)),
    'sheets_history': (args) => handlers.history.handle(SheetsHistoryInputSchema.parse(args)),
  };

  if (authHandler) {
    map['sheets_auth'] = (args) => authHandler.handle(SheetsAuthInputSchema.parse(args));
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

  const response = structuredContent['response'];
  const responseSuccess = (response && typeof response === 'object')
    ? (response as { success?: boolean }).success
    : undefined;

  // Detect errors from success: false in response (or legacy top-level success)
  const isError = responseSuccess === false
    || (structuredContent['success'] === false);

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
// SCHEMA PREPARATION
// ============================================================================

/**
 * Prepares a schema for MCP SDK registration
 * 
 * The MCP SDK v1.25.x has a limitation where normalizeObjectSchema() only
 * recognizes z.object() schemas. Discriminated unions and other Zod types
 * result in empty JSON Schema in tools/list.
 * 
 * This function converts non-object schemas to JSON Schema format to ensure
 * proper serialization in the tools/list response.
 * 
 * @param schema - Zod schema to prepare
 * @returns Schema ready for registerTool() - either original or JSON Schema
 */
export function prepareSchemaForRegistration(schema: ZodTypeAny): AnySchema | Record<string, unknown> {
  // Discriminated unions need conversion to JSON Schema
  if (isDiscriminatedUnion(schema)) {
    return zodToJsonSchemaCompat(schema) as Record<string, unknown>;
  }

  // z.object() and other schemas work natively
  return schema as unknown as AnySchema;
}

// ============================================================================
// HISTORY RECORDING HELPERS
// ============================================================================

/**
 * Extract action from tool arguments
 */
function extractAction(args: Record<string, unknown>): string {
  // Extract action from request object (discriminated union pattern)
  const request = args['request'] as Record<string, unknown> | undefined;
  if (request && typeof request['action'] === 'string') {
    return request['action'];
  }
  // Fallback for non-discriminated schemas
  if (typeof args['action'] === 'string') {
    return args['action'];
  }
  return 'unknown';
}

/**
 * Extract spreadsheetId from tool arguments
 */
function extractSpreadsheetId(args: Record<string, unknown>): string | undefined {
  const request = args['request'] as Record<string, unknown> | undefined;
  const params = request?.['params'] as Record<string, unknown> | undefined;
  if (params && typeof params['spreadsheetId'] === 'string') {
    return params['spreadsheetId'];
  }
  if (typeof args['spreadsheetId'] === 'string') {
    return args['spreadsheetId'];
  }
  return undefined;
}

/**
 * Extract sheetId from tool arguments
 */
function extractSheetId(args: Record<string, unknown>): number | undefined {
  const request = args['request'] as Record<string, unknown> | undefined;
  const params = request?.['params'] as Record<string, unknown> | undefined;
  if (params && typeof params['sheetId'] === 'number') {
    return params['sheetId'];
  }
  if (typeof args['sheetId'] === 'number') {
    return args['sheetId'];
  }
  return undefined;
}

/**
 * Check if result is successful
 */
function isSuccessResult(result: unknown): boolean {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const response = (result as Record<string, unknown>)['response'];
  if (response && typeof response === 'object') {
    return (response as Record<string, unknown>)['success'] === true;
  }
  return (result as Record<string, unknown>)['success'] === true;
}

/**
 * Extract cellsAffected from tool result
 */
function extractCellsAffected(result: unknown): number | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const response = (result as Record<string, unknown>)['response'];
  const data = response && typeof response === 'object' ? response : result;
  const dataObj = data as Record<string, unknown>;

  // Try common field names
  if (typeof dataObj['cellsAffected'] === 'number') {
    return dataObj['cellsAffected'];
  }
  if (typeof dataObj['updatedCells'] === 'number') {
    return dataObj['updatedCells'];
  }

  // Try mutation summary
  const mutation = dataObj['mutation'] as Record<string, unknown> | undefined;
  if (mutation && typeof mutation['cellsAffected'] === 'number') {
    return mutation['cellsAffected'];
  }

  return undefined;
}

/**
 * Extract snapshotId from tool result
 */
function extractSnapshotId(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const response = (result as Record<string, unknown>)['response'];
  const data = response && typeof response === 'object' ? response : result;
  const mutation = (data as Record<string, unknown>)['mutation'] as Record<string, unknown> | undefined;

  if (mutation && typeof mutation['revertSnapshotId'] === 'string') {
    return mutation['revertSnapshotId'];
  }

  return undefined;
}

/**
 * Extract error message from tool result
 */
function extractErrorMessage(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const response = (result as Record<string, unknown>)['response'];
  if (response && typeof response === 'object') {
    const error = (response as Record<string, unknown>)['error'] as Record<string, unknown> | undefined;
    if (error && typeof error['message'] === 'string') {
      return error['message'];
    }
  }
  return undefined;
}

/**
 * Extract error code from tool result
 */
function extractErrorCode(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const response = (result as Record<string, unknown>)['response'];
  if (response && typeof response === 'object') {
    const error = (response as Record<string, unknown>)['error'] as Record<string, unknown> | undefined;
    if (error && typeof error['code'] === 'string') {
      return error['code'];
    }
  }
  return undefined;
}

// ============================================================================
// TOOL CALL HANDLER
// ============================================================================

function createToolCallHandler(
  tool: ToolDefinition,
  handlerMap: Record<string, (args: unknown) => Promise<unknown>> | null
): (args: Record<string, unknown>, extra?: { requestId?: string | number }) => Promise<CallToolResult> {
  return async (args: Record<string, unknown>, extra?: { requestId?: string | number }) => {
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
        // Execute handler
        const result = await handler(args);
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

        throw error;
      }
    });
  };
}

function createToolTaskHandler(
  toolName: string,
  runTool: (args: Record<string, unknown>, extra?: { requestId?: string | number }) => Promise<CallToolResult>
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
            console.error(`[${toolName}] Failed to store task result`, storeError);
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
      return await extra.taskStore.getTaskResult(extra.taskId) as CallToolResult;
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
export function registerServalSheetsTools(
  server: McpServer,
  handlers: Handlers | null,
  options?: { googleClient?: GoogleApiClient | null }
): void {
  const authHandler = new AuthHandler({
    googleClient: options?.googleClient ?? null,
    elicitationServer: server.server,
  });

  const handlerMap = handlers
    ? createToolHandlerMap(handlers, authHandler)
    : { 'sheets_auth': (args: unknown) => authHandler.handle(SheetsAuthInputSchema.parse(args)) };

  for (const tool of TOOL_DEFINITIONS) {
    // Prepare schemas for SDK registration
    const inputSchemaForRegistration = prepareSchemaForRegistration(tool.inputSchema);
    const outputSchemaForRegistration = prepareSchemaForRegistration(tool.outputSchema);

    // Development-only schema validation (only for JSON Schema objects)
    if (process.env['NODE_ENV'] !== 'production') {
      const isZodSchema = (schema: unknown): boolean =>
        Boolean(schema && typeof schema === 'object' && '_def' in (schema as Record<string, unknown>));

      if (!isZodSchema(inputSchemaForRegistration)) {
        verifyJsonSchema(inputSchemaForRegistration);
      }
      if (!isZodSchema(outputSchemaForRegistration)) {
        verifyJsonSchema(outputSchemaForRegistration);
      }
    }

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
      } as TaskToolExecution;

      server.experimental.tasks.registerToolTask<AnySchema, AnySchema>(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: tool.inputSchema as AnySchema,
          outputSchema: tool.outputSchema as AnySchema,
          annotations: tool.annotations,
          execution: taskExecution,
        },
        taskHandler
      );
      continue;
    }

    (server.registerTool as (
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
      cb: (args: Record<string, unknown>, extra?: { requestId?: string | number }) => Promise<CallToolResult>
    ) => void)(
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
}


// ============================================================================
// RESOURCES REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets resources with the MCP server
 * 
 * Resources provide read-only access to spreadsheet metadata via URI templates.
 * 
 * @param server - McpServer instance
 * @param googleClient - Google API client (null if not authenticated)
 */
export function registerServalSheetsResources(server: McpServer, googleClient: GoogleApiClient | null): void {
  const spreadsheetTemplate = new ResourceTemplate('sheets:///{spreadsheetId}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
    },
  });

  const rangeTemplate = new ResourceTemplate('sheets:///{spreadsheetId}/{range}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
      range: async (value) => completeRange(value),
    },
  });

  server.registerResource(
    'spreadsheet',
    spreadsheetTemplate,
    {
      title: 'Spreadsheet',
      description: 'Google Sheets spreadsheet metadata (properties and sheet list)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId) ? rawSpreadsheetId[0] : rawSpreadsheetId;

      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return { contents: [] };
      }

      if (!googleClient) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Not authenticated' }),
          }],
        };
      }

      try {
        const sheetsResponse = await googleClient.sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'properties,sheets.properties',
        });

        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(sheetsResponse.data, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          }],
        };
      }
    }
  );

  server.registerResource(
    'spreadsheet_range',
    rangeTemplate,
    {
      title: 'Spreadsheet Range',
      description: 'Google Sheets range values (A1 notation)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const rawRange = variables['range'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId) ? rawSpreadsheetId[0] : rawSpreadsheetId;
      const encodedRange = Array.isArray(rawRange) ? rawRange[0] : rawRange;
      const range = typeof encodedRange === 'string'
        ? decodeURIComponent(encodedRange)
        : undefined;

      if (!spreadsheetId || typeof spreadsheetId !== 'string' || !range) {
        return { contents: [] };
      }

      if (!googleClient) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Not authenticated' }),
          }],
        };
      }

      try {
        const valuesResponse = await googleClient.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(valuesResponse.data, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          }],
        };
      }
    }
  );
}

// ============================================================================
// PROMPTS REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets prompts with the MCP server
 * 
 * Prompts provide guided workflows and templates for common operations.
 * 
 * @param server - McpServer instance
 */
export function registerServalSheetsPrompts(server: McpServer): void {
  // === ONBOARDING PROMPTS ===

  server.registerPrompt(
    'welcome',
    {
      description: '🎉 Welcome to ServalSheets! Get started with this guided introduction.',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🎉 Welcome to ServalSheets!

I'm your Google Sheets assistant with 15 powerful tools and 156 actions.

## 🚀 Quick Start
Test spreadsheet: \`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms\`

## 📊 Capabilities
• Data Operations: Read, write, batch operations
• Analysis: Data quality, statistics, formula audit
• Formatting: Colors, fonts, conditional formatting
• Advanced: Charts, pivots, sharing, versions

## 🛡️ Safety Features
• Dry-run mode, effect limits, auto-snapshots

What would you like to do first?`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'test_connection',
    {
      description: '🔍 Test your ServalSheets connection with a public spreadsheet',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔍 Testing ServalSheets connection!

Test spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

Please run:
1. sheets_spreadsheet action: "get"
2. sheets_values action: "read", range: "Sheet1!A1:D10"
3. sheets_analysis action: "structure_analysis"

If tests pass, you're ready!`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'first_operation',
    {
      description: '👶 Your first ServalSheets operation - a guided walkthrough',
      argsSchema: FirstOperationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `👶 First ServalSheets operation!

Spreadsheet: ${spreadsheetId}

Steps:
1. Read data: sheets_spreadsheet action "get"
2. Analyze quality: sheets_analysis action "data_quality"
3. Get statistics: sheets_analysis action "statistics"
4. Format headers: sheets_format (use dryRun first!)

Safety tips: Always read before modify, use dryRun for destructive ops.`,
          },
        }],
      };
    }
  );

  // === ANALYSIS PROMPTS ===

  server.registerPrompt(
    'analyze_spreadsheet',
    {
      description: '🔬 Comprehensive analysis of spreadsheet data quality and structure',
      argsSchema: AnalyzeSpreadsheetPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔬 Analyzing: ${args['spreadsheetId']}

Run comprehensive analysis:
1. Metadata: sheets_spreadsheet action "get"
2. Data Quality: sheets_analysis action "data_quality"
3. Structure: sheets_analysis action "structure_analysis"
4. Formula Audit: sheets_analysis action "formula_audit"

Provide: quality score, issues found, recommended fixes.`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'transform_data',
    {
      description: '🔄 Transform data in a spreadsheet range with safety checks',
      argsSchema: TransformDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔄 Transform data

Spreadsheet: ${args['spreadsheetId']}
Range: ${args['range']}
Transform: ${args['transformation']}

Workflow:
1. Read current data
2. Plan transformation
3. Preview (dryRun: true)
4. Get confirmation
5. Execute with safety limits
6. Verify results`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'create_report',
    {
      description: '📈 Generate a formatted report from spreadsheet data',
      argsSchema: CreateReportPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const reportType = args['reportType'] || 'summary';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📈 Creating ${reportType} report from ${args['spreadsheetId']}

Steps:
1. Read source data
2. Create "Report" sheet
3. Add summary statistics
4. Apply formatting
${reportType === 'charts' ? '5. Add charts\n' : ''}
Final: Auto-resize, freeze header, add timestamp`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'clean_data',
    {
      description: '🧹 Clean and standardize data in a spreadsheet range',
      argsSchema: CleanDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🧹 Cleaning data: ${args['spreadsheetId']}, range ${args['range']}

Phases:
1. Analysis: Run data quality check
2. Plan: Identify duplicates, empty cells, format issues
3. Preview: Show changes with dryRun
4. Execute: Apply with auto-snapshot
5. Validate: Compare before/after`,
          },
        }],
      };
    }
  );
}
