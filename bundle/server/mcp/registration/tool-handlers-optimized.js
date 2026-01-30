/**
 * ServalSheets - Optimized Tool Handlers
 *
 * Performance-optimized handler mapping with:
 * 1. Fast validators instead of full Zod parsing (80-90% faster)
 * 2. Pre-built handler lookup table (O(1) dispatch)
 * 3. Reduced object allocations
 * 4. Inline hot paths
 *
 * @module mcp/registration/tool-handlers-optimized
 */
import { fastValidateAuth, fastValidateCore, fastValidateData, fastValidateFormat, fastValidateDimensions, fastValidateVisualize, fastValidateCollaborate, fastValidateAdvanced, fastValidateTransaction, fastValidateQuality, fastValidateHistory, fastValidateConfirm, fastValidateAnalyze, fastValidateFix, fastValidateComposite, FastValidationError, } from '../../schemas/fast-validators.js';
// Full Zod schemas for complete validation after fast pre-check
import { SheetsAuthInputSchema, SheetsCoreInputSchema, SheetsDataInputSchema, SheetsFormatInputSchema, SheetsDimensionsInputSchema, SheetsVisualizeInputSchema, SheetsCollaborateInputSchema, SheetsAdvancedInputSchema, SheetsTransactionInputSchema, SheetsQualityInputSchema, SheetsHistoryInputSchema, SheetsConfirmInputSchema, SheetsAnalyzeInputSchema, SheetsFixInputSchema, CompositeInputSchema, } from '../../schemas/index.js';
// ============================================================================
// OPTIMIZED HANDLER MAP
// ============================================================================
/**
 * Creates an optimized handler map with fast validators
 *
 * Flow:
 * 1. Fast validation (catches obvious errors, ~100μs)
 * 2. Full Zod parse (type safety, ~1ms)
 * 3. Handler execution
 *
 * Performance improvement: Fast validation short-circuits invalid requests
 * before expensive Zod parsing, saving ~80% overhead for bad requests.
 */
export function createOptimizedHandlerMap(handlers, authHandler) {
    const map = new Map();
    // Wave 1 consolidated tools
    map.set('sheets_core', {
        fastValidator: fastValidateCore,
        zodParser: (input) => SheetsCoreInputSchema.parse(input),
        handler: (v) => handlers.core.handle(v),
    });
    map.set('sheets_visualize', {
        fastValidator: fastValidateVisualize,
        zodParser: (input) => SheetsVisualizeInputSchema.parse(input),
        handler: (v) => handlers.visualize.handle(v),
    });
    map.set('sheets_collaborate', {
        fastValidator: fastValidateCollaborate,
        zodParser: (input) => SheetsCollaborateInputSchema.parse(input),
        handler: (v) => handlers.collaborate.handle(v),
    });
    // Wave 4 consolidated tool (values + cells)
    map.set('sheets_data', {
        fastValidator: fastValidateData,
        zodParser: (input) => SheetsDataInputSchema.parse(input),
        handler: (v) => handlers.data.handle(v),
    });
    map.set('sheets_format', {
        fastValidator: fastValidateFormat,
        zodParser: (input) => SheetsFormatInputSchema.parse(input),
        handler: (v) => handlers.format.handle(v),
    });
    map.set('sheets_dimensions', {
        fastValidator: fastValidateDimensions,
        zodParser: (input) => SheetsDimensionsInputSchema.parse(input),
        handler: (v) => handlers.dimensions.handle(v),
    });
    map.set('sheets_advanced', {
        fastValidator: fastValidateAdvanced,
        zodParser: (input) => SheetsAdvancedInputSchema.parse(input),
        handler: (v) => handlers.advanced.handle(v),
    });
    map.set('sheets_transaction', {
        fastValidator: fastValidateTransaction,
        zodParser: (input) => SheetsTransactionInputSchema.parse(input),
        handler: (v) => handlers.transaction.handle(v),
    });
    map.set('sheets_quality', {
        fastValidator: fastValidateQuality,
        zodParser: (input) => SheetsQualityInputSchema.parse(input),
        handler: (v) => handlers.quality.handle(v),
    });
    map.set('sheets_history', {
        fastValidator: fastValidateHistory,
        zodParser: (input) => SheetsHistoryInputSchema.parse(input),
        handler: (v) => handlers.history.handle(v),
    });
    // MCP-native tools
    map.set('sheets_confirm', {
        fastValidator: fastValidateConfirm,
        zodParser: (input) => SheetsConfirmInputSchema.parse(input),
        handler: (v) => handlers.confirm.handle(v),
    });
    map.set('sheets_analyze', {
        fastValidator: fastValidateAnalyze,
        zodParser: (input) => SheetsAnalyzeInputSchema.parse(input),
        handler: (v) => handlers.analyze.handle(v),
    });
    map.set('sheets_fix', {
        fastValidator: fastValidateFix,
        zodParser: (input) => SheetsFixInputSchema.parse(input),
        handler: (v) => handlers.fix.handle(v),
    });
    map.set('sheets_composite', {
        fastValidator: fastValidateComposite,
        zodParser: (input) => CompositeInputSchema.parse(input),
        handler: (v) => handlers.composite.handle(v),
    });
    // Auth handler (special case)
    if (authHandler) {
        map.set('sheets_auth', {
            fastValidator: fastValidateAuth,
            zodParser: (input) => SheetsAuthInputSchema.parse(input),
            handler: (v) => authHandler.handle(v),
        });
    }
    return map;
}
/**
 * Execute a tool with optimized validation
 *
 * @param toolName - Tool name
 * @param args - Raw arguments
 * @param handlerMap - Optimized handler map
 * @param extra - Extra context (elicit, sample, etc.)
 * @returns Tool result
 */
export async function executeOptimizedTool(toolName, args, handlerMap, extra) {
    const optimized = handlerMap.get(toolName);
    if (!optimized) {
        return {
            response: {
                success: false,
                error: {
                    code: 'NOT_IMPLEMENTED',
                    message: `Handler for ${toolName} not found`,
                    retryable: false,
                },
            },
        };
    }
    try {
        // Step 1: Fast validation (catches obvious errors quickly)
        if (args && typeof args === 'object') {
            optimized.fastValidator(args);
        }
        // Step 2: Full Zod parse (type safety)
        const validated = optimized.zodParser(args);
        // Step 3: Execute handler
        return await optimized.handler(validated, extra);
    }
    catch (error) {
        if (error instanceof FastValidationError) {
            return {
                response: {
                    success: false,
                    error: error.toErrorDetail(),
                },
            };
        }
        // Zod validation error
        if (error && typeof error === 'object' && 'issues' in error) {
            return {
                response: {
                    success: false,
                    error: {
                        code: 'INVALID_PARAMS',
                        message: 'Validation failed',
                        details: { issues: error.issues },
                        retryable: false,
                    },
                },
            };
        }
        return {
            response: {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : String(error),
                    retryable: false,
                },
            },
        };
    }
}
// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================
/**
 * Convert optimized handler map to legacy format
 *
 * For backwards compatibility with existing code that expects
 * Record<string, HandlerFn> instead of Map<string, OptimizedHandler>
 */
export function toLegacyHandlerMap(optimizedMap) {
    const legacy = {};
    for (const [name, handler] of optimizedMap) {
        legacy[name] = async (args, extra) => {
            // Fast validation
            if (args && typeof args === 'object') {
                handler.fastValidator(args);
            }
            // Full Zod parse
            const validated = handler.zodParser(args);
            // Execute
            return handler.handler(validated, extra);
        };
    }
    return legacy;
}
// ============================================================================
// RESPONSE HELPERS (Optimized)
// ============================================================================
// Pre-allocated error response templates
const ERROR_TEMPLATES = {
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', retryable: false },
    NOT_IMPLEMENTED: { code: 'NOT_IMPLEMENTED', retryable: false },
    AUTHENTICATION_REQUIRED: { code: 'AUTHENTICATION_REQUIRED', retryable: false },
    INVALID_PARAMS: { code: 'INVALID_PARAMS', retryable: false },
};
/**
 * Build error response with minimal allocations
 */
export function buildErrorResponse(code, message, extra) {
    return {
        response: {
            success: false,
            error: {
                ...ERROR_TEMPLATES[code],
                message,
                ...extra,
            },
        },
    };
}
/**
 * Check if result is successful (inline for performance)
 */
export function isSuccess(result) {
    if (!result || typeof result !== 'object')
        return false;
    const obj = result;
    // Check response.success first (standard format)
    const response = obj['response'];
    if (response && typeof response === 'object') {
        return response['success'] === true;
    }
    // Fallback to top-level success
    return obj['success'] === true;
}
/**
 * Extract action from args (inline for performance)
 */
export function getAction(args) {
    if (!args || typeof args !== 'object')
        return 'unknown';
    const obj = args;
    // Direct action field
    if (typeof obj['action'] === 'string')
        return obj['action'];
    // Nested in request
    const request = obj['request'];
    if (request && typeof request === 'object') {
        const reqObj = request;
        if (typeof reqObj['action'] === 'string')
            return reqObj['action'];
    }
    return 'unknown';
}
/**
 * Extract spreadsheetId from args (inline for performance)
 */
export function getSpreadsheetId(args) {
    // OK: Explicit empty - typed as optional, invalid args object
    if (!args || typeof args !== 'object')
        return undefined;
    const obj = args;
    // Direct field
    if (typeof obj['spreadsheetId'] === 'string')
        return obj['spreadsheetId'];
    // Nested in request.params
    const request = obj['request'];
    if (request && typeof request === 'object') {
        const params = request['params'];
        if (params && typeof params === 'object') {
            const paramsObj = params;
            if (typeof paramsObj['spreadsheetId'] === 'string') {
                return paramsObj['spreadsheetId'];
            }
        }
    }
    // OK: Explicit empty - typed as optional, spreadsheetId field not found in args
    return undefined;
}
//# sourceMappingURL=tool-handlers-optimized.js.map