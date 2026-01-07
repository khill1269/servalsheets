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
 * Architectural Notes (MCP 2025-11-25):
 * - sheets_confirm: Uses Elicitation (SEP-1036) for user confirmation
 * - sheets_analyze: Uses Sampling (SEP-1577) for AI analysis
 * - Removed: sheets_plan, sheets_insights (replaced by MCP-native patterns)
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
import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import { randomUUID } from 'crypto';
import { recordToolCall } from '../observability/metrics.js';

import type { Handlers } from '../handlers/index.js';
import { AuthHandler } from '../handlers/auth.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
import { completeRange, completeSpreadsheetId, recordSpreadsheetId } from './completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from './features-2025-11-25.js';
import { getHistoryService } from '../services/history-service.js';
import type { OperationHistory } from '../types/history.js';
import { registerChartResources } from '../resources/charts.js';
import { registerPivotResources } from '../resources/pivots.js';
import { registerQualityResources } from '../resources/quality.js';
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
  SheetsValidationInputSchema, SheetsValidationOutputSchema, SHEETS_VALIDATION_ANNOTATIONS,
  SheetsConflictInputSchema, SheetsConflictOutputSchema, SHEETS_CONFLICT_ANNOTATIONS,
  SheetsImpactInputSchema, SheetsImpactOutputSchema, SHEETS_IMPACT_ANNOTATIONS,
  SheetsHistoryInputSchema, SheetsHistoryOutputSchema, SHEETS_HISTORY_ANNOTATIONS,
  // New MCP-native tools
  SheetsConfirmInputSchema, SheetsConfirmOutputSchema, SHEETS_CONFIRM_ANNOTATIONS,
  SheetsAnalyzeInputSchema, SheetsAnalyzeOutputSchema, SHEETS_ANALYZE_ANNOTATIONS,
  SheetsFixInputSchema, SheetsFixOutputSchema, SHEETS_FIX_ANNOTATIONS,
  // LLM-optimized descriptions
  TOOL_DESCRIPTIONS,
} from '../schemas/index.js';
import {
  FirstOperationPromptArgsSchema,
  AnalyzeSpreadsheetPromptArgsSchema,
  TransformDataPromptArgsSchema,
  CreateReportPromptArgsSchema,
  CleanDataPromptArgsSchema,
  MigrateDataPromptArgsSchema,
  SetupBudgetPromptArgsSchema,
  ImportDataPromptArgsSchema,
  SetupCollaborationPromptArgsSchema,
  DiagnoseErrorsPromptArgsSchema,
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
 * 16 core tools + 5 enterprise tools + 3 MCP-native tools = 24 tools
 *
 * Schema Pattern: z.object({ request: z.discriminatedUnion('action', ...) })
 * - Actions are discriminated by `action` within `request`
 * - Responses are discriminated by `success` within `response`
 *
 * Note: Removed sheets_plan and sheets_insights (anti-patterns).
 * Replaced with sheets_confirm (Elicitation) and sheets_analyze (Sampling).
 *
 * Descriptions: All tool descriptions are imported from descriptions.ts to maintain
 * a single source of truth for LLM-optimized tool descriptions.
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'sheets_auth',
    description: TOOL_DESCRIPTIONS['sheets_auth']!,
    inputSchema: SheetsAuthInputSchema,
    outputSchema: SheetsAuthOutputSchema,
    annotations: SHEETS_AUTH_ANNOTATIONS,
  },
  {
    name: 'sheets_spreadsheet',
    description: TOOL_DESCRIPTIONS['sheets_spreadsheet']!,
    inputSchema: SheetSpreadsheetInputSchema,
    outputSchema: SheetsSpreadsheetOutputSchema,
    annotations: SHEETS_SPREADSHEET_ANNOTATIONS,
  },
  {
    name: 'sheets_sheet',
    description: TOOL_DESCRIPTIONS['sheets_sheet']!,
    inputSchema: SheetsSheetInputSchema,
    outputSchema: SheetsSheetOutputSchema,
    annotations: SHEETS_SHEET_ANNOTATIONS,
  },
  {
    name: 'sheets_values',
    description: TOOL_DESCRIPTIONS['sheets_values']!,
    inputSchema: SheetsValuesInputSchema,
    outputSchema: SheetsValuesOutputSchema,
    annotations: SHEETS_VALUES_ANNOTATIONS,
  },
  {
    name: 'sheets_cells',
    description: TOOL_DESCRIPTIONS['sheets_cells']!,
    inputSchema: SheetsCellsInputSchema,
    outputSchema: SheetsCellsOutputSchema,
    annotations: SHEETS_CELLS_ANNOTATIONS,
  },
  {
    name: 'sheets_format',
    description: TOOL_DESCRIPTIONS['sheets_format']!,
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: SHEETS_FORMAT_ANNOTATIONS,
  },
  {
    name: 'sheets_dimensions',
    description: TOOL_DESCRIPTIONS['sheets_dimensions']!,
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: SHEETS_DIMENSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_rules',
    description: TOOL_DESCRIPTIONS['sheets_rules']!,
    inputSchema: SheetsRulesInputSchema,
    outputSchema: SheetsRulesOutputSchema,
    annotations: SHEETS_RULES_ANNOTATIONS,
  },
  {
    name: 'sheets_charts',
    description: TOOL_DESCRIPTIONS['sheets_charts']!,
    inputSchema: SheetsChartsInputSchema,
    outputSchema: SheetsChartsOutputSchema,
    annotations: SHEETS_CHARTS_ANNOTATIONS,
  },
  {
    name: 'sheets_pivot',
    description: TOOL_DESCRIPTIONS['sheets_pivot']!,
    inputSchema: SheetsPivotInputSchema,
    outputSchema: SheetsPivotOutputSchema,
    annotations: SHEETS_PIVOT_ANNOTATIONS,
  },
  {
    name: 'sheets_filter_sort',
    description: TOOL_DESCRIPTIONS['sheets_filter_sort']!,
    inputSchema: SheetsFilterSortInputSchema,
    outputSchema: SheetsFilterSortOutputSchema,
    annotations: SHEETS_FILTER_SORT_ANNOTATIONS,
  },
  {
    name: 'sheets_sharing',
    description: TOOL_DESCRIPTIONS['sheets_sharing']!,
    inputSchema: SheetsSharingInputSchema,
    outputSchema: SheetsSharingOutputSchema,
    annotations: SHEETS_SHARING_ANNOTATIONS,
  },
  {
    name: 'sheets_comments',
    description: TOOL_DESCRIPTIONS['sheets_comments']!,
    inputSchema: SheetsCommentsInputSchema,
    outputSchema: SheetsCommentsOutputSchema,
    annotations: SHEETS_COMMENTS_ANNOTATIONS,
  },
  {
    name: 'sheets_versions',
    description: TOOL_DESCRIPTIONS['sheets_versions']!,
    inputSchema: SheetsVersionsInputSchema,
    outputSchema: SheetsVersionsOutputSchema,
    annotations: SHEETS_VERSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_analysis',
    description: TOOL_DESCRIPTIONS['sheets_analysis']!,
    inputSchema: SheetsAnalysisInputSchema,
    outputSchema: SheetsAnalysisOutputSchema,
    annotations: SHEETS_ANALYSIS_ANNOTATIONS,
  },
  {
    name: 'sheets_advanced',
    description: TOOL_DESCRIPTIONS['sheets_advanced']!,
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: SHEETS_ADVANCED_ANNOTATIONS,
  },
  {
    name: 'sheets_transaction',
    description: TOOL_DESCRIPTIONS['sheets_transaction']!,
    inputSchema: SheetsTransactionInputSchema,
    outputSchema: SheetsTransactionOutputSchema,
    annotations: SHEETS_TRANSACTION_ANNOTATIONS,
  },
  {
    name: 'sheets_validation',
    description: TOOL_DESCRIPTIONS['sheets_validation']!,
    inputSchema: SheetsValidationInputSchema,
    outputSchema: SheetsValidationOutputSchema,
    annotations: SHEETS_VALIDATION_ANNOTATIONS,
  },
  {
    name: 'sheets_conflict',
    description: TOOL_DESCRIPTIONS['sheets_conflict']!,
    inputSchema: SheetsConflictInputSchema,
    outputSchema: SheetsConflictOutputSchema,
    annotations: SHEETS_CONFLICT_ANNOTATIONS,
  },
  {
    name: 'sheets_impact',
    description: TOOL_DESCRIPTIONS['sheets_impact']!,
    inputSchema: SheetsImpactInputSchema,
    outputSchema: SheetsImpactOutputSchema,
    annotations: SHEETS_IMPACT_ANNOTATIONS,
  },
  {
    name: 'sheets_history',
    description: TOOL_DESCRIPTIONS['sheets_history']!,
    inputSchema: SheetsHistoryInputSchema,
    outputSchema: SheetsHistoryOutputSchema,
    annotations: SHEETS_HISTORY_ANNOTATIONS,
  },
  // ============================================================================
  // MCP-NATIVE TOOLS (Elicitation & Sampling)
  // ============================================================================
  {
    name: 'sheets_confirm',
    description: TOOL_DESCRIPTIONS['sheets_confirm']!,
    inputSchema: SheetsConfirmInputSchema,
    outputSchema: SheetsConfirmOutputSchema,
    annotations: SHEETS_CONFIRM_ANNOTATIONS,
  },
  {
    name: 'sheets_analyze',
    description: TOOL_DESCRIPTIONS['sheets_analyze']!,
    inputSchema: SheetsAnalyzeInputSchema,
    outputSchema: SheetsAnalyzeOutputSchema,
    annotations: SHEETS_ANALYZE_ANNOTATIONS,
  },
  {
    name: 'sheets_fix',
    description: TOOL_DESCRIPTIONS['sheets_fix']!,
    inputSchema: SheetsFixInputSchema,
    outputSchema: SheetsFixOutputSchema,
    annotations: SHEETS_FIX_ANNOTATIONS,
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
): Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> {
  const map: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> = {
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
    'sheets_validation': (args) => handlers.validation.handle(SheetsValidationInputSchema.parse(args)),
    'sheets_conflict': (args) => handlers.conflict.handle(SheetsConflictInputSchema.parse(args)),
    'sheets_impact': (args) => handlers.impact.handle(SheetsImpactInputSchema.parse(args)),
    'sheets_history': (args) => handlers.history.handle(SheetsHistoryInputSchema.parse(args)),
    // MCP-native tools (use Server instance from context for Elicitation/Sampling)
    'sheets_confirm': (args) => handlers.confirm.handle(SheetsConfirmInputSchema.parse(args)),
    'sheets_analyze': (args) => handlers.analyze.handle(SheetsAnalyzeInputSchema.parse(args)),
    'sheets_fix': (args) => handlers.fix.handle(SheetsFixInputSchema.parse(args)),
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
  handlerMap: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> | null
): (args: Record<string, unknown>, extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }) => Promise<CallToolResult> {
  return async (args: Record<string, unknown>, extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }) => {
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
        const result = await handler(args, extra);
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
            // Use logger instead of console.error to avoid corrupting stdio transport
            import('../utils/logger.js').then(({ logger }) => {
              logger.error('Failed to store task result', { toolName, error: storeError });
            }).catch(() => {
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
      cb: (args: Record<string, unknown>, extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }) => Promise<CallToolResult>
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

  // Register additional data exploration resources
  registerChartResources(server, googleClient?.sheets ?? null);
  registerPivotResources(server, googleClient?.sheets ?? null);
  registerQualityResources(server, googleClient?.sheets ?? null);
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

I'm your Google Sheets assistant with 24 powerful tools and 188 actions.

## 🚀 Quick Start
Test spreadsheet: \`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms\`

## 📊 Capabilities
• Data Operations: Read, write, batch operations
• Analysis: Data quality, statistics, formula audit
• AI Analysis: Pattern detection, anomalies, formula generation (via MCP Sampling)
• Formatting: Colors, fonts, conditional formatting
• Advanced: Charts, pivots, sharing, versions

## 🛡️ Safety Features
• Dry-run mode, effect limits, auto-snapshots
• User confirmation for multi-step operations (via MCP Elicitation)

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

Please run these tests in order:
1. sheets_auth action: "status" → Verify authentication
2. sheets_spreadsheet action: "get", spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" → Get metadata
3. sheets_values action: "read", spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", range: "Sheet1!A1:D10" → Read sample data
4. sheets_analysis action: "structure_analysis", spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" → Analyze structure

If all tests pass, you're ready to use ServalSheets!
If auth fails, follow the authentication flow first.`,
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
5. AI Insights: sheets_analyze action "analyze" (uses MCP Sampling)

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
3. Confirm with user (sheets_confirm via Elicitation)
4. Execute with safety limits
5. Verify results`,
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
${reportType === 'charts' ? '5. Add charts (use sheets_analyze to suggest best chart types)\n' : ''}
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
1. Analysis: Run data quality check + AI analysis (sheets_analyze)
2. Plan: Identify duplicates, empty cells, format issues
3. Confirm: Present plan to user (sheets_confirm via Elicitation)
4. Execute: Apply with auto-snapshot
5. Validate: Compare before/after`,
          },
        }],
      };
    }
  );

  // === NEW WORKFLOW PROMPTS ===

  server.registerPrompt(
    'migrate_data',
    {
      description: '📦 Migrate data between spreadsheets with validation',
      argsSchema: MigrateDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📦 Data Migration

Source: ${args['sourceSpreadsheetId']} (${args['sourceRange']})
Target: ${args['targetSpreadsheetId']} (${args['targetRange'] || 'auto-detect'})

Migration Workflow:
1. Read source data: sheets_values action "read"
2. Validate data: Check schema, detect issues
3. Check target: Ensure compatibility
4. Plan operation: Present migration plan
5. Confirm: Use sheets_confirm for user approval
6. Execute: Copy data with transaction safety
7. Validate: Compare row counts, checksums

Safety: Creates snapshots of both sheets before migration.`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'setup_budget',
    {
      description: '💰 Create a budget tracking spreadsheet with formulas and formatting',
      argsSchema: SetupBudgetPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const budgetType = args['budgetType'] || 'personal';
      const spreadsheetId = args['spreadsheetId'];

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `💰 Setting up ${budgetType} budget tracker
${spreadsheetId ? `Spreadsheet: ${spreadsheetId}` : 'Creating new spreadsheet'}

Budget Setup:
1. Create structure:
   - Income sheet: Categories, amounts, dates
   - Expenses sheet: Categories, amounts, dates
   - Summary sheet: Totals, remaining, charts

2. Add formulas:
   - SUMIF for category totals
   - Date filters for monthly/yearly views
   - Remaining budget calculations

3. Format cells:
   - Currency format for amounts
   - Conditional formatting: red for overspent
   - Freeze headers

4. Add charts:
   - Pie chart: Expense breakdown
   - Line chart: Monthly trends
   - Use sheets_analyze to suggest optimal chart types

5. Setup validation:
   - Dropdowns for categories
   - Date validation
   - Positive number validation for income

Final: Apply professional formatting, add instructions sheet.`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'import_data',
    {
      description: '📥 Import external data into Google Sheets with transformation',
      argsSchema: ImportDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📥 Data Import Workflow

Spreadsheet: ${args['spreadsheetId']}
Data source: ${args['dataSource']}
Target: ${args['targetSheet'] || 'new sheet'}

Import Steps:
1. Prepare data:
   - Parse source format (CSV, JSON, API response)
   - Validate structure
   - Clean special characters

2. Create target sheet:
   - sheets_sheet action "add"
   - Name appropriately

3. Import data:
   - Use sheets_values action "write" or "append"
   - Handle large datasets (batch if > 10k rows)

4. Post-import:
   - Auto-format headers
   - Freeze top row
   - Auto-resize columns
   - Add data validation

5. Quality check:
   - Run sheets_analysis "data_quality"
   - Verify row counts
   - Check for import errors

Pro tip: Use sheets_transaction to batch all operations into 1 API call.`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'setup_collaboration',
    {
      description: '👥 Configure sharing and permissions for team collaboration',
      argsSchema: SetupCollaborationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const role = args['role'] || 'writer';
      const collaborators = args['collaborators'] as string[];

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `👥 Setting up collaboration

Spreadsheet: ${args['spreadsheetId']}
Adding ${collaborators.length} collaborator(s) as "${role}"

Collaboration Setup:
1. Share spreadsheet:
   ${collaborators.map((email, i) => `   ${i + 1}. sheets_sharing action "share", email: "${email}", role: "${role}"`).join('\n')}

2. Setup protected ranges:
   - Lock critical formulas/headers
   - sheets_advanced action "add_protected_range"
   - Allow editors to only edit data cells

3. Add version control:
   - Create initial snapshot
   - sheets_versions action "create_snapshot"

4. Setup comments:
   - Add collaboration guidelines comment
   - sheets_comments action "add"

5. Configure notifications:
   - Enable edit notifications
   - Setup comment alerts

Best practices:
- Use "commenter" role for stakeholders
- Use "writer" role for team members
- Reserve "owner" role transfers for handoffs`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'diagnose_errors',
    {
      description: '🔧 Troubleshoot and diagnose spreadsheet issues',
      argsSchema: DiagnoseErrorsPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const errorDesc = args['errorDescription'] || 'general diagnostics';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔧 Diagnosing: ${errorDesc}

Spreadsheet: ${args['spreadsheetId']}

Diagnostic Workflow:
1. Basic checks:
   - sheets_spreadsheet "get": Verify access
   - Check sheet count, total cells

2. Data quality:
   - sheets_analysis "data_quality": Find data issues
   - sheets_analysis "formula_audit": Check formula errors

3. AI analysis:
   - sheets_analyze "analyze": Deep pattern analysis
   - Detect anomalies, inconsistencies

4. Performance check:
   - Check formula complexity
   - Identify slow formulas (nested VLOOKUPs)
   - Recommend ARRAYFORMULA or INDEX/MATCH

5. Structure analysis:
   - sheets_analysis "structure_analysis"
   - Check for duplicate headers
   - Verify data types per column

Common Issues:
- #REF! errors: Deleted referenced cells
- #DIV/0!: Division by zero
- #N/A: VLOOKUP not found
- Circular references: Formula refers to itself
- Performance: Too many volatile functions (NOW, RAND)

Report:
- Issue summary
- Affected ranges
- Recommended fixes
- Preventive measures`,
          },
        }],
      };
    }
  );

  // Error Recovery Prompt - AI-powered troubleshooting
  server.registerPrompt(
    'recover_from_error',
    {
      description: '🔧 Recover from ServalSheets errors - AI-powered troubleshooting and self-healing',
      argsSchema: {
        errorCode: z.string().describe('The error code from the failed operation'),
        errorMessage: z.string().optional().describe('The full error message'),
        toolName: z.string().optional().describe('The tool that failed (e.g., sheets_values)'),
        context: z.string().optional().describe('What you were trying to do'),
      },
    },
    async (args: Record<string, unknown>) => {
      const errorCode = args['errorCode'] as string || 'UNKNOWN_ERROR';
      const errorMessage = args['errorMessage'] as string || '';
      const toolName = args['toolName'] as string || '';
      const context = args['context'] as string || '';

      const recoveryGuide: Record<string, string> = {
        'INTERNAL_ERROR': `🔴 INTERNAL_ERROR - Likely Fixed in v1.3.0-hotfix.1

This was the "taskStore.isTaskCancelled is not a function" bug.

✅ Fix Applied:
- Task cancellation bug fixed
- Rebuild: npm run build
- Restart Claude Desktop completely (Cmd+Q then relaunch)

Verification:
1. node dist/cli.js --version (should show v1.3.0)
2. Check if error persists after restart
3. Logs: ~/Library/Logs/Claude/mcp*.log

If still occurring after restart:
• Verify dist/server.js contains "this.taskStore.isTaskCancelled"
• Check Claude Desktop config path is correct
• Try: rm -rf dist && npm run build`,

        'QUOTA_EXCEEDED': `⚠️ QUOTA_EXCEEDED - Google API Rate Limit

Immediate Actions:
1. Wait 60 seconds before retry
2. Switch to batch operations (saves 80% quota):
   sheets_values action="batch_read" ranges=["A1:B2","D1:E2"]
   Instead of: Multiple individual "read" calls

Prevention:
• Check quota: sheets_auth action="status"
• Use semantic ranges: {"semantic":{"column":"Revenue"}}
• Batch operations: batch_read, batch_write, batch_update

Recovery Time: 60 seconds per 100 requests`,

        'RANGE_NOT_FOUND': `❌ RANGE_NOT_FOUND - Sheet or Range Doesn't Exist

Diagnosis:
1. List all sheets: sheets_spreadsheet action="get"
2. Check exact spelling (case-sensitive!)
3. Verify format: "SheetName!A1:D10"

Common Fixes:
• "Sheet1" not "sheet1" (case matters!)
• Include sheet name: "Data!A1:D10" not just "A1:D10"
• Check sheet wasn't deleted/renamed

Try semantic ranges: {"semantic":{"sheet":"Sales","column":"Total"}}`,

        'PERMISSION_DENIED': `🔒 PERMISSION_DENIED - Authentication or Access Issue

Recovery Steps:
1. Check auth: sheets_auth action="status"
2. Re-authenticate: sheets_auth action="login"
3. Complete OAuth in browser
4. Retry operation

Access Check:
• Verify spreadsheet is shared with your account
• sheets_sharing action="list_permissions" to see current access
• Request owner to share if needed

OAuth Scopes Needed:
https://www.googleapis.com/auth/spreadsheets`,

        'INVALID_RANGE': `📏 INVALID_RANGE - Range Format Incorrect

Valid Formats:
✅ "A1:D10"
✅ "Sheet1!A1:D10"
✅ "Sheet1!A:A" (entire column)
✅ "Sheet1!1:1" (entire row)

Invalid Formats:
❌ "A1-D10" (use : not -)
❌ "A1..D10"
❌ "SheetName A1:D10" (missing !)

Alternative: Use semantic ranges
{"semantic":{"sheet":"Data","column":"Revenue","includeHeader":false}}`,

        'RATE_LIMIT_EXCEEDED': `🚦 RATE_LIMIT_EXCEEDED - Too Many Requests

Built-in Circuit Breaker Active:
• Automatic exponential backoff
• Request spacing (1-2 seconds)
• Auto-retry with delays

Your Action:
• Wait 10 seconds
• Use batch operations next time
• Let circuit breaker handle retries

Prevention: Batch operations reduce rate limit usage by 80%`,

        'AUTH_EXPIRED': `🔑 AUTH_EXPIRED - Token Expired

Auto-Recovery (Usually Works):
• Server auto-refreshes tokens
• Just retry your operation
• Token refresh happens automatically

Manual Recovery:
1. sheets_auth action="logout"
2. sheets_auth action="login"
3. Complete OAuth flow
4. Retry operation

Token Details:
• Expire after 1 hour
• Auto-refresh when possible
• Encrypted storage: GOOGLE_TOKEN_STORE_PATH`,

        'NOT_FOUND': `🔍 NOT_FOUND - Spreadsheet Doesn't Exist

Verify ID:
• Format: 44 chars, alphanumeric plus - and _
• Get from URL: docs.google.com/spreadsheets/d/{ID}/...
• Check for typos

Find Spreadsheets:
1. List all: sheets_spreadsheet action="list"
2. Create new: sheets_spreadsheet action="create" name="My Sheet"

Common Issues:
• Spreadsheet deleted
• Wrong ID copied
• No access permission`,
      };

      const recovery = recoveryGuide[errorCode] || `🔧 ${errorCode} Recovery

Tool: ${toolName || 'unknown'}
Message: ${errorMessage || 'No message provided'}
Context: ${context || 'No context provided'}

General Recovery:
1. Check tool description for correct format (see Quick Examples)
2. Verify spreadsheet ID and permissions
3. Check auth: sheets_auth action="status"
4. Review history: sheets_history
5. Try dry-run: {"safety":{"dryRun":true}}

Common Fixes:
• Auth: sheets_auth action="login"
• Quota: Wait 60s, use batch_read/batch_write
• Range: Verify with sheets_spreadsheet action="get"
• Format: See tool description Quick Examples

Still Stuck?
• Logs: ~/Library/Logs/Claude/mcp*.log
• Version: node dist/cli.js --version
• Restart: Quit Claude Desktop (Cmd+Q), wait 5s, relaunch`;

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: recovery,
          },
        }],
      };
    }
  );

  // Performance Troubleshooting Prompt
  server.registerPrompt(
    'troubleshoot_performance',
    {
      description: '⚡ Diagnose and fix slow spreadsheet operations',
      argsSchema: {
        spreadsheetId: z.string().describe('The spreadsheet ID'),
        operation: z.string().optional().describe('What operation was slow'),
        responseTime: z.number().optional().describe('How long it took (ms)'),
      },
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const operation = args['operation'] as string || 'unknown';
      const responseTime = args['responseTime'] as number || 0;

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `⚡ Performance Troubleshooting for ${spreadsheetId}

Operation: ${operation}
${responseTime > 0 ? `Response Time: ${responseTime}ms` : ''}

Common Performance Issues:

1. **Large Range Reads** (>10K cells)
   • Problem: Reading entire sheets instead of specific ranges
   • Fix: Use precise ranges like "A1:D100" instead of "A:Z"
   • Tool: sheets_values with exact range
   • Improvement: 80-90% faster

2. **Multiple Individual Operations**
   • Problem: 50 separate read calls instead of 1 batch
   • Fix: Use batch_read with multiple ranges
   • Tool: sheets_values action="batch_read" ranges=["A1:B10","D1:E10"]
   • Improvement: Saves 80% API quota, 3-5x faster

3. **Formula Recalculation**
   • Problem: Complex formulas with circular references
   • Fix: Use optimize_formulas prompt
   • Check: sheets_analysis action="formula_audit"
   • Improvement: 50-70% faster calculations

4. **Network Latency**
   • Problem: Too many round trips to Google API
   • Fix: Bundle operations in sheets_transaction
   • Improvement: Single API call instead of N calls

5. **Unoptimized Queries**
   • Problem: Reading full sheet to find one value
   • Fix: Use sheets_values action="find" with criteria
   • Improvement: 95% faster than scanning

Diagnostic Steps:

1. Check range size:
   • sheets_spreadsheet action="get" → See total rows/columns
   • If >10K cells, reduce range

2. Enable profiling:
   • Add timing: const start = Date.now()
   • Measure each operation
   • Identify slowest step

3. Review recent operations:
   • sheets_history action="list" limit=10
   • Look for repeated calls

4. Analyze data structure:
   • sheets_analysis action="performance"
   • Get optimization suggestions

Quick Fixes by Operation Type:

• sheets_values read → Use batch_read, exact ranges
• sheets_format → Batch in sheets_transaction
• sheets_analysis → Limit to <10K cells
• sheets_pivot → Reduce source range size
• sheets_charts → Limit data points to <1000

Apply fixes and retest!`,
          },
        }],
      };
    }
  );

  // Data Quality Fix Prompt
  server.registerPrompt(
    'fix_data_quality',
    {
      description: '🔍 Identify and fix data quality issues',
      argsSchema: {
        spreadsheetId: z.string().describe('The spreadsheet ID'),
        range: z.string().describe('Range to analyze'),
        issues: z.string().optional().describe('Known issues'),
      },
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const range = args['range'] as string;
      const issues = args['issues'] as string || 'auto-detect';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔍 Data Quality Analysis for ${spreadsheetId}
Range: ${range}
${issues !== 'auto-detect' ? `Known Issues: ${issues}` : ''}

Step 1: Detect Issues
Run: sheets_analysis action="analyze" spreadsheetId="${spreadsheetId}" range="${range}"

Common Data Quality Problems:

1. **Empty Cells in Required Columns**
   • Detection: Check for null/empty values
   • Fix: sheets_values action="find" find="" → Fill or remove rows
   • Prevention: Add validation rules

2. **Duplicate Headers**
   • Detection: Count unique values in row 1
   • Fix: sheets_sheet action="update" → Rename duplicates
   • Prevention: Validate on import

3. **Inconsistent Formats**
   • Detection: Mixed date formats, number formats
   • Fix: sheets_format action="set_number_format" format="YYYY-MM-DD"
   • Prevention: Apply format before data entry

4. **Invalid Values**
   • Detection: Negative ages, future dates, out-of-range numbers
   • Fix: sheets_values action="replace" with valid values
   • Prevention: sheets_rules action="add_validation"

5. **Extra Whitespace**
   • Detection: Leading/trailing spaces
   • Fix: Use TRIM formula or sheets_advanced find_replace
   • Prevention: Input validation

Cleanup Workflow:

1. Analyze:
   sheets_analysis action="analyze" range="${range}"

2. Fix empty cells:
   • Delete: sheets_dimensions action="delete_rows"
   • Fill: sheets_values action="write" with default values

3. Standardize formats:
   • Dates: sheets_format format="yyyy-mm-dd"
   • Currency: sheets_format format="$#,##0.00"
   • Percentages: sheets_format format="0.00%"

4. Remove duplicates:
   • Find: sheets_values action="find"
   • Mark or delete duplicates

5. Add validation:
   • sheets_rules action="add_validation" type="LIST"
   • Prevent future bad data

6. Verify:
   • Re-run sheets_analysis
   • Check quality score improved

After cleanup, consider:
• Create snapshot: sheets_versions action="create_snapshot"
• Document changes: sheets_comments action="add"`,
          },
        }],
      };
    }
  );

  // Formula Optimization Prompt
  server.registerPrompt(
    'optimize_formulas',
    {
      description: '📊 Optimize slow or inefficient formulas',
      argsSchema: {
        spreadsheetId: z.string().describe('The spreadsheet ID'),
        range: z.string().optional().describe('Range with slow formulas'),
      },
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const range = args['range'] as string || 'entire sheet';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📊 Formula Optimization for ${spreadsheetId}
${range !== 'entire sheet' ? `Range: ${range}` : ''}

Step 1: Audit Formulas
Run: sheets_analysis action="formula_audit" spreadsheetId="${spreadsheetId}"

Common Formula Performance Issues:

1. **VLOOKUP** (Slow for large datasets)
   • Problem: O(n) lookup, scans entire column
   • Fix: Replace with INDEX/MATCH
   • Before: =VLOOKUP(A2,Data!A:D,3,FALSE)
   • After: =INDEX(Data!C:C,MATCH(A2,Data!A:A,0))
   • Improvement: 60% faster

2. **Array Formulas** (Resource intensive)
   • Problem: Recalculates entire array on every change
   • Fix: Split into individual cell formulas
   • Or: Use FILTER() with specific criteria
   • Improvement: 70% faster

3. **Volatile Functions** (Recalculate constantly)
   • Problem: NOW(), RAND(), INDIRECT() recalc on every edit
   • Fix: Replace with static values or manual triggers
   • NOW() → Use timestamp in cell, update manually
   • INDIRECT() → Use direct cell references
   • Improvement: 80% less recalculation

4. **Circular References**
   • Problem: Formulas referencing themselves
   • Detection: sheets_analysis shows circular_refs
   • Fix: Break cycle by moving calculation to different cell
   • Improvement: Prevents infinite loops

5. **Nested IFs** (Hard to read and slow)
   • Problem: =IF(A1>10,IF(A1>20,"High","Medium"),"Low")
   • Fix: Use IFS() or lookup table
   • After: =IFS(A1>20,"High",A1>10,"Medium",TRUE,"Low")
   • Improvement: More readable, 30% faster

Optimization Workflow:

1. Find slow formulas:
   • sheets_analysis action="formula_audit"
   • Look for: VLOOKUP, array formulas, volatile functions

2. Test performance:
   • Time recalculation (Ctrl+Alt+Shift+F9 in Sheets)
   • Identify slowest formulas

3. Replace VLOOKUP:
   • Find all: sheets_advanced action="find_replace" find="VLOOKUP"
   • Replace manually with INDEX/MATCH pattern

4. Simplify array formulas:
   • Convert to individual formulas
   • Or use more efficient array operations

5. Remove volatile functions:
   • Replace NOW() with manual timestamp
   • Replace INDIRECT() with direct references

6. Verify improvements:
   • Re-run formula audit
   • Test recalculation speed

Formula Best Practices:

• Use named ranges (easier to read and maintain)
• Avoid full column references (A:A) when possible
• Cache lookup results instead of repeated calculations
• Use FILTER() instead of complex IF arrays
• Break complex formulas into intermediate cells

After optimization:
• Document changes in comments
• Create version snapshot
• Monitor performance over time`,
          },
        }],
      };
    }
  );

  // Bulk Import Workflow Prompt
  server.registerPrompt(
    'bulk_import_data',
    {
      description: '📥 Efficiently import large datasets',
      argsSchema: {
        spreadsheetId: z.string().describe('Target spreadsheet ID'),
        dataSize: z.number().optional().describe('Approximate row count'),
        dataSource: z.string().optional().describe('Source description'),
      },
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const dataSize = args['dataSize'] as number || 0;
      const dataSource = args['dataSource'] as string || 'external source';

      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📥 Bulk Data Import Workflow for ${spreadsheetId}
Source: ${dataSource}
${dataSize > 0 ? `Estimated Rows: ${dataSize}` : ''}

Optimal Import Strategy:

${dataSize > 10000 ? `⚠️ LARGE DATASET (${dataSize} rows)
Use chunked imports with transactions` : ''}

Step 1: Prepare Target Sheet
1. Create or clear target sheet:
   sheets_sheet action="add" title="Import_${new Date().toISOString().split('T')[0]}"

2. Setup structure:
   • Headers: sheets_values action="write" range="A1:Z1" values=[["Col1","Col2",...]]
   • Format headers: sheets_format range="A1:Z1" bold=true backgroundColor="#4285F4"
   • Freeze: sheets_dimensions action="freeze_rows" count=1

Step 2: Validate Source Data
1. Check data quality before import
2. Remove: Empty rows, invalid characters, duplicates
3. Standardize: Date formats, number formats, text encoding

Step 3: Import Data (Choose Strategy)

**Strategy A: Small Dataset (<1000 rows)**
• Single batch write:
  sheets_values action="batch_write" ranges=["A2:Z1001"] values=[...]

**Strategy B: Medium Dataset (1K-10K rows)**
• Transaction with chunks:
  sheets_transaction action="begin"
  For each chunk of 1000 rows:
    sheets_transaction action="add_operation" operation=write
  sheets_transaction action="commit"

**Strategy C: Large Dataset (>10K rows)**
• Multiple transactions:
  For every 5000 rows:
    Begin transaction → Write 5 chunks of 1000 → Commit
    Wait 2 seconds between transactions

Step 4: Post-Import Processing

1. Auto-resize columns:
   sheets_dimensions action="auto_resize" dimension="COLUMNS"

2. Apply formatting:
   • Currency columns: sheets_format format="$#,##0.00"
   • Date columns: sheets_format format="yyyy-mm-dd"
   • Conditional formatting: sheets_rules for visual cues

3. Add validation rules:
   • Dropdowns: sheets_rules action="add_validation" type="LIST"
   • Range validation: For numeric columns

4. Create summary:
   • Row count, column count
   • Add to first sheet or separate "Summary" sheet

Step 5: Verification

1. Data quality check:
   sheets_analysis action="analyze" range="A1:Z${dataSize || 10000}"

2. Spot check:
   • First 10 rows: sheets_values range="A2:Z11"
   • Last 10 rows: Check end of data
   • Random sample: Middle rows

3. Create checkpoint:
   sheets_versions action="create_snapshot" description="After ${dataSource} import"

Performance Tips:

• Batch size: 1000 rows optimal for balance of speed/reliability
• Use batch_write not individual writes (80% faster)
• Wait 2s between large transactions (avoid rate limits)
• Format after data import (faster than formatting during)
• Create indexes with named ranges for quick access

Error Recovery:

• If import fails mid-way:
  1. sheets_history action="list" - Find last successful operation
  2. sheets_transaction action="rollback" - Undo partial import
  3. Resume from last checkpoint

• If data quality issues found:
  Use fix_data_quality prompt for cleanup

Import complete! ✅`,
          },
        }],
      };
    }
  );
}
