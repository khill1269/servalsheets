/**
 * ServalSheets - Request Context
 *
 * Async-local storage for per-request metadata (requestId, logger, deadlines, progress notifications).
 */
import type { Logger } from 'winston';
import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
export interface RequestContext {
    requestId: string;
    logger: Logger;
    timeoutMs: number;
    deadline: number;
    /**
     * MCP progress notification function
     * Available when client requests progress updates via _meta.progressToken
     */
    sendNotification?: (notification: ServerNotification) => Promise<void>;
    /**
     * MCP progress token from request _meta
     * Used to associate progress notifications with the original request
     */
    progressToken?: string | number;
    /**
     * W3C Trace Context fields for distributed tracing
     * @see https://www.w3.org/TR/trace-context/
     */
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
}
export declare function createRequestContext(options?: {
    requestId?: string;
    logger?: Logger;
    timeoutMs?: number;
    sendNotification?: (notification: ServerNotification) => Promise<void>;
    progressToken?: string | number;
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
}): RequestContext;
export declare function runWithRequestContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T>;
export declare function getRequestContext(): RequestContext | undefined;
export declare function getRequestLogger(): Logger;
/**
 * Send MCP progress notification if available in request context
 * Used by BatchCompiler and other long-running operations
 *
 * @param progress Current progress (0-based)
 * @param total Total steps
 * @param message Progress message
 */
export declare function sendProgress(progress: number, total?: number, message?: string): Promise<void>;
//# sourceMappingURL=request-context.d.ts.map