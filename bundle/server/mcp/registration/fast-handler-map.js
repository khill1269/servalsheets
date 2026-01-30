/**
 * ServalSheets - Fast Handler Map
 *
 * Drop-in replacement for createToolHandlerMap that uses fast validators.
 * Provides 80-90% faster validation by skipping full Zod parsing.
 *
 * Usage:
 *   // Replace: createToolHandlerMap(handlers, authHandler)
 *   // With:    createFastToolHandlerMap(handlers, authHandler)
 *
 * @module mcp/registration/fast-handler-map
 */
import { fastValidateAuth, fastValidateCore, fastValidateData, fastValidateFormat, fastValidateDimensions, fastValidateVisualize, fastValidateCollaborate, fastValidateAdvanced, fastValidateTransaction, fastValidateQuality, fastValidateHistory, fastValidateConfirm, fastValidateAnalyze, fastValidateFix, fastValidateComposite, fastValidateSession, fastValidateTemplates, fastValidateBigQuery, fastValidateAppsScript, FastValidationError, } from '../../schemas/fast-validators.js';
// Environment flag to enable fast validation (default: true for performance)
const USE_FAST_VALIDATORS = process.env['SERVAL_FAST_VALIDATORS'] !== 'false';
/**
 * Creates an optimized handler map using fast validators
 *
 * Performance improvements:
 * - 80-90% faster validation vs Zod
 * - O(1) action discrimination
 * - Minimal field checking
 * - Type-safe handler calls
 *
 * Falls back to Zod parsing if SERVAL_FAST_VALIDATORS=false
 */
export function createFastToolHandlerMap(handlers, authHandler) {
    if (!USE_FAST_VALIDATORS) {
        // Fall back to Zod-based validation
        const { createToolHandlerMap } = require('./tool-handlers.js');
        return createToolHandlerMap(handlers, authHandler);
    }
    const map = {
        // Wave 1 consolidated tools
        sheets_core: async (args) => {
            const input = args;
            fastValidateCore(input);
            return handlers.core.handle(input);
        },
        sheets_visualize: async (args) => {
            const input = args;
            fastValidateVisualize(input);
            return handlers.visualize.handle(input);
        },
        sheets_collaborate: async (args) => {
            const input = args;
            fastValidateCollaborate(input);
            return handlers.collaborate.handle(input);
        },
        // Wave 4 consolidated tool (values + cells)
        sheets_data: async (args) => {
            const input = args;
            fastValidateData(input);
            return handlers.data.handle(input);
        },
        sheets_format: async (args) => {
            const input = args;
            fastValidateFormat(input);
            return handlers.format.handle(input);
        },
        sheets_dimensions: async (args) => {
            const input = args;
            fastValidateDimensions(input);
            return handlers.dimensions.handle(input);
        },
        sheets_advanced: async (args) => {
            const input = args;
            fastValidateAdvanced(input);
            return handlers.advanced.handle(input);
        },
        // Phase 4 tools
        sheets_transaction: async (args) => {
            const input = args;
            fastValidateTransaction(input);
            return handlers.transaction.handle(input);
        },
        sheets_quality: async (args) => {
            const input = args;
            fastValidateQuality(input);
            return handlers.quality.handle(input);
        },
        sheets_history: async (args) => {
            const input = args;
            fastValidateHistory(input);
            return handlers.history.handle(input);
        },
        // MCP-native tools
        sheets_confirm: async (args) => {
            const input = args;
            fastValidateConfirm(input);
            return handlers.confirm.handle(input);
        },
        sheets_analyze: async (args) => {
            const input = args;
            fastValidateAnalyze(input);
            return handlers.analyze.handle(input);
        },
        sheets_fix: async (args) => {
            const input = args;
            fastValidateFix(input);
            return handlers.fix.handle(input);
        },
        sheets_composite: async (args) => {
            const input = args;
            fastValidateComposite(input);
            return handlers.composite.handle(input);
        },
        sheets_session: async (args) => {
            const input = args;
            fastValidateSession(input);
            return handlers.session.handle(input);
        },
        // Tier 7 Enterprise tools
        sheets_templates: async (args) => {
            const input = args;
            fastValidateTemplates(input);
            return handlers.templates.handle(input);
        },
        sheets_bigquery: async (args) => {
            const input = args;
            fastValidateBigQuery(input);
            return handlers.bigquery.handle(input);
        },
        sheets_appsscript: async (args) => {
            const input = args;
            fastValidateAppsScript(input);
            return handlers.appsscript.handle(input);
        },
    };
    // Add auth handler if provided
    if (authHandler) {
        map['sheets_auth'] = async (args) => {
            const input = args;
            fastValidateAuth(input);
            return authHandler.handle(input);
        };
    }
    return map;
}
/**
 * Wrap a handler function with error handling for validation errors
 */
export function wrapWithValidationErrorHandling(handler) {
    return async (args, extra) => {
        try {
            return await handler(args, extra);
        }
        catch (error) {
            if (error instanceof FastValidationError) {
                return {
                    response: {
                        success: false,
                        error: {
                            code: 'INVALID_PARAMS',
                            message: error.message,
                            details: error.details,
                            retryable: false,
                        },
                    },
                };
            }
            throw error;
        }
    };
}
/**
 * Check if fast validators are enabled
 */
export function isFastValidatorsEnabled() {
    return USE_FAST_VALIDATORS;
}
//# sourceMappingURL=fast-handler-map.js.map