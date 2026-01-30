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
import type { Handlers } from '../../handlers/index.js';
import type { AuthHandler } from '../../handlers/auth.js';
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
export declare function createFastToolHandlerMap(handlers: Handlers, authHandler?: AuthHandler): Record<string, (args: unknown, extra?: unknown) => Promise<unknown>>;
/**
 * Wrap a handler function with error handling for validation errors
 */
export declare function wrapWithValidationErrorHandling<T>(handler: (args: unknown, extra?: unknown) => Promise<T>): (args: unknown, extra?: unknown) => Promise<T | {
    response: {
        success: false;
        error: Record<string, unknown>;
    };
}>;
/**
 * Check if fast validators are enabled
 */
export declare function isFastValidatorsEnabled(): boolean;
//# sourceMappingURL=fast-handler-map.d.ts.map