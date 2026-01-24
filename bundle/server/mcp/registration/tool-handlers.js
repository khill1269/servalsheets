/**
 * ServalSheets - Tool Handlers
 *
 * Handler mapping and tool call execution logic.
 *
 * @module mcp/registration/tool-handlers
 */
import { randomUUID } from 'crypto';
import { recordToolCall } from '../../observability/metrics.js';
import { AuthHandler } from '../../handlers/auth.js';
import { createRequestContext, runWithRequestContext, getRequestLogger, } from '../../utils/request-context.js';
import { recordSpreadsheetId } from '../completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { getHistoryService } from '../../services/history-service.js';
import { prepareSchemaForRegistration, wrapInputSchemaForLegacyRequest } from './schema-helpers.js';
import { ACTIVE_TOOL_DEFINITIONS } from './tool-definitions.js';
import { extractAction, extractSpreadsheetId, extractSheetId, extractCellsAffected, extractSnapshotId, extractErrorMessage, extractErrorCode, isSuccessResult, } from './extraction-helpers.js';
import { SheetsAuthInputSchema, SheetsCoreInputSchema, SheetsDataInputSchema, SheetsFormatInputSchema, SheetsDimensionsInputSchema, SheetsVisualizeInputSchema, SheetsCollaborateInputSchema, SheetsAdvancedInputSchema, SheetsTransactionInputSchema, SheetsQualityInputSchema, SheetsHistoryInputSchema, SheetsConfirmInputSchema, SheetsAnalyzeInputSchema, SheetsFixInputSchema, CompositeInputSchema, SheetsSessionInputSchema, 
// Tier 7 Enterprise tools
SheetsTemplatesInputSchema, SheetsBigQueryInputSchema, SheetsAppsScriptInputSchema, } from '../../schemas/index.js';
// ============================================================================
// HANDLER MAPPING
// ============================================================================
/**
 * Creates a map of tool names to handler functions
 *
 * Each handler receives validated input and returns structured output.
 * The MCP SDK validates input against inputSchema before calling the handler.
 */
export function createToolHandlerMap(handlers, authHandler) {
    const map = {
        sheets_core: (args) => handlers.core.handle(SheetsCoreInputSchema.parse(args)),
        sheets_data: (args) => handlers.data.handle(SheetsDataInputSchema.parse(args)),
        sheets_format: (args) => handlers.format.handle(SheetsFormatInputSchema.parse(args)),
        sheets_dimensions: (args) => handlers.dimensions.handle(SheetsDimensionsInputSchema.parse(args)),
        sheets_visualize: (args) => handlers.visualize.handle(SheetsVisualizeInputSchema.parse(args)),
        sheets_collaborate: (args) => handlers.collaborate.handle(SheetsCollaborateInputSchema.parse(args)),
        sheets_advanced: (args) => handlers.advanced.handle(SheetsAdvancedInputSchema.parse(args)),
        sheets_transaction: (args) => handlers.transaction.handle(SheetsTransactionInputSchema.parse(args)),
        sheets_quality: (args) => handlers.quality.handle(SheetsQualityInputSchema.parse(args)),
        sheets_history: (args) => handlers.history.handle(SheetsHistoryInputSchema.parse(args)),
        // MCP-native tools (use Server instance from context for Elicitation/Sampling)
        sheets_confirm: (args) => handlers.confirm.handle(SheetsConfirmInputSchema.parse(args)),
        sheets_analyze: (args) => handlers.analyze.handle(SheetsAnalyzeInputSchema.parse(args)),
        sheets_fix: (args) => handlers.fix.handle(SheetsFixInputSchema.parse(args)),
        // Composite operations
        sheets_composite: (args) => handlers.composite.handle(CompositeInputSchema.parse(args)),
        // Session context for NL excellence
        sheets_session: (args) => handlers.session.handle(SheetsSessionInputSchema.parse(args)),
        // Tier 7 Enterprise tools
        sheets_templates: (args) => handlers.templates.handle(SheetsTemplatesInputSchema.parse(args)),
        sheets_bigquery: (args) => handlers.bigquery.handle(SheetsBigQueryInputSchema.parse(args)),
        sheets_appsscript: (args) => handlers.appsscript.handle(SheetsAppsScriptInputSchema.parse(args)),
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
export function buildToolResponse(result) {
    let structuredContent;
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
    }
    else if ('response' in result) {
        structuredContent = result;
    }
    else if ('success' in result) {
        structuredContent = { response: result };
    }
    else {
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
    const responseSuccess = response && typeof response === 'object'
        ? response.success
        : undefined;
    // Detect errors from success: false in response (or legacy top-level success)
    const isError = responseSuccess === false || structuredContent['success'] === false;
    // DEBUG: Log sheets_collaborate responses to diagnose validation issue
    if (typeof result === 'object' && result !== null && 'response' in result) {
        const resp = result['response'];
        if (resp && typeof resp === 'object' && 'action' in resp) {
            const action = resp['action'];
            if (typeof action === 'string' && action.includes('permission')) {
                const logger = getRequestLogger();
                logger.info('[DEBUG] buildToolResponse for sharing', {
                    action,
                    responseSuccess,
                    responseSuccessType: typeof responseSuccess,
                    isError,
                    structuredContentKeys: Object.keys(structuredContent),
                    responseKeys: response && typeof response === 'object' ? Object.keys(response) : undefined,
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
function normalizeToolArgs(args) {
    if (!args || typeof args !== 'object') {
        // OK: Explicit empty - invalid args will be caught by Zod validation downstream
        return {};
    }
    const record = args;
    const request = record['request'];
    if (!request || typeof request !== 'object') {
        return { request: record };
    }
    const requestRecord = request;
    const params = requestRecord['params'];
    if (params && typeof params === 'object') {
        const action = typeof requestRecord['action'] === 'string' ? { action: requestRecord['action'] } : {};
        return { request: { ...params, ...action } };
    }
    return { request: requestRecord };
}
function createToolCallHandler(tool, handlerMap) {
    return async (args, extra) => {
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
                const operation = {
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
            }
            catch (error) {
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
function createToolTaskHandler(toolName, runTool) {
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
                    const result = await runTool(args, extra);
                    await taskStore.storeTaskResult(task.taskId, 'completed', result);
                }
                catch (error) {
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
                    }
                    catch (storeError) {
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
            return (await extra.taskStore.getTaskResult(extra.taskId));
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
export async function registerServalSheetsTools(server, handlers, options) {
    const authHandler = new AuthHandler({
        googleClient: options?.googleClient ?? null,
        elicitationServer: server.server,
    });
    const handlerMap = handlers
        ? createToolHandlerMap(handlers, authHandler)
        : {
            sheets_auth: (args) => authHandler.handle(SheetsAuthInputSchema.parse(args)),
        };
    for (const tool of ACTIVE_TOOL_DEFINITIONS) {
        // Prepare schemas for SDK registration
        const inputSchemaForRegistration = prepareSchemaForRegistration(wrapInputSchemaForLegacyRequest(tool.inputSchema));
        const outputSchemaForRegistration = prepareSchemaForRegistration(tool.outputSchema);
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
            server.experimental.tasks.registerToolTask(tool.name, {
                title: tool.annotations.title,
                description: tool.description,
                inputSchema: inputSchemaForRegistration,
                outputSchema: outputSchemaForRegistration,
                annotations: tool.annotations,
                execution: taskExecution,
            }, taskHandler);
            continue;
        }
        server.registerTool(tool.name, {
            title: tool.annotations.title,
            description: tool.description,
            inputSchema: inputSchemaForRegistration,
            outputSchema: outputSchemaForRegistration,
            annotations: tool.annotations,
            icons: TOOL_ICONS[tool.name],
            execution,
        }, runTool);
    }
    // KNOWN_ISSUE: MCP SDK v1.25.x Bug - Discriminated Unions Serialize as Empty
    //
    // PROBLEM: The MCP SDK's normalizeObjectSchema() returns undefined for discriminated
    // unions, causing tools/list to use EMPTY_OBJECT_JSON_SCHEMA ({ type: "object", properties: {} }).
    //
    // ROOT CAUSE: In @modelcontextprotocol/sdk/dist/esm/server/mcp.js, the tools/list handler:
    //   inputSchema: (() => {
    //     const obj = normalizeObjectSchema(tool.inputSchema);
    //     return obj ? toJsonSchemaCompat(obj, {...}) : EMPTY_OBJECT_JSON_SCHEMA;
    //   })()
    //
    // ATTEMPTS MADE:
    // 1. Pre-converting to JSON Schema - SDK still calls normalizeObjectSchema on it
    // 2. Monkey-patching after initialization - Handler already set up
    // 3. Overriding tools/list handler - SDK doesn't allow replacement
    //
    // SOLUTIONS (pick one):
    // A) Wrap all schemas in z.object() before registration (RECOMMENDED)
    // B) Monkey-patch normalizeObjectSchema BEFORE McpServer construction
    // C) Fork/patch the SDK
    // D) Wait for SDK v1.26 fix
    //
    // IMPACT: All 16 tools show empty schemas in tools/list, breaking LLM tool discovery.
    // WORKAROUND: LLMs can still call tools (validation works), but can't discover parameters.
    //
    // For now, tools are registered as-is. This preserves validation but breaks discovery.
}
//# sourceMappingURL=tool-handlers.js.map