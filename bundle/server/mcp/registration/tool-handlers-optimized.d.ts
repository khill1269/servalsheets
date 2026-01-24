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
import type { Handlers } from '../../handlers/index.js';
import type { AuthHandler } from '../../handlers/auth.js';
type HandlerFn = (args: unknown, extra?: unknown) => Promise<unknown>;
type FastValidatorFn = (input: Record<string, unknown>) => void;
type ZodParserFn = (input: unknown) => unknown;
interface OptimizedHandler {
    fastValidator: FastValidatorFn;
    zodParser: ZodParserFn;
    handler: (validated: unknown, extra?: unknown) => Promise<unknown>;
}
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
export declare function createOptimizedHandlerMap(handlers: Handlers, authHandler?: AuthHandler): Map<string, OptimizedHandler>;
/**
 * Execute a tool with optimized validation
 *
 * @param toolName - Tool name
 * @param args - Raw arguments
 * @param handlerMap - Optimized handler map
 * @param extra - Extra context (elicit, sample, etc.)
 * @returns Tool result
 */
export declare function executeOptimizedTool(toolName: string, args: unknown, handlerMap: Map<string, OptimizedHandler>, extra?: unknown): Promise<unknown>;
/**
 * Convert optimized handler map to legacy format
 *
 * For backwards compatibility with existing code that expects
 * Record<string, HandlerFn> instead of Map<string, OptimizedHandler>
 */
export declare function toLegacyHandlerMap(optimizedMap: Map<string, OptimizedHandler>): Record<string, HandlerFn>;
declare const ERROR_TEMPLATES: {
    readonly INTERNAL_ERROR: {
        readonly code: "INTERNAL_ERROR";
        readonly retryable: false;
    };
    readonly NOT_IMPLEMENTED: {
        readonly code: "NOT_IMPLEMENTED";
        readonly retryable: false;
    };
    readonly AUTHENTICATION_REQUIRED: {
        readonly code: "AUTHENTICATION_REQUIRED";
        readonly retryable: false;
    };
    readonly INVALID_PARAMS: {
        readonly code: "INVALID_PARAMS";
        readonly retryable: false;
    };
};
/**
 * Build error response with minimal allocations
 */
export declare function buildErrorResponse(code: keyof typeof ERROR_TEMPLATES, message: string, extra?: Record<string, unknown>): {
    response: {
        success: false;
        error: Record<string, unknown>;
    };
};
/**
 * Check if result is successful (inline for performance)
 */
export declare function isSuccess(result: unknown): boolean;
/**
 * Extract action from args (inline for performance)
 */
export declare function getAction(args: unknown): string;
/**
 * Extract spreadsheetId from args (inline for performance)
 */
export declare function getSpreadsheetId(args: unknown): string | undefined;
export {};
//# sourceMappingURL=tool-handlers-optimized.d.ts.map