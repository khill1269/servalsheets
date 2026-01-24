/**
 * ServalSheets - Request Context
 *
 * Async-local storage for per-request metadata (requestId, logger, deadlines, progress notifications).
 */
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { logger as baseLogger } from './logger.js';
const storage = new AsyncLocalStorage();
const DEFAULT_TIMEOUT_MS = parseInt(process.env['REQUEST_TIMEOUT_MS'] ?? process.env['GOOGLE_API_TIMEOUT_MS'] ?? '30000', 10);
export function createRequestContext(options) {
    const requestId = options?.requestId ?? randomUUID();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // Include trace context in logger metadata
    const loggerMeta = { requestId };
    if (options?.traceId) {
        loggerMeta['traceId'] = options.traceId;
    }
    if (options?.spanId) {
        loggerMeta['spanId'] = options.spanId;
    }
    if (options?.parentSpanId) {
        loggerMeta['parentSpanId'] = options.parentSpanId;
    }
    const logger = (options?.logger ?? baseLogger).child(loggerMeta);
    return {
        requestId,
        logger,
        timeoutMs,
        deadline: Date.now() + timeoutMs,
        sendNotification: options?.sendNotification,
        progressToken: options?.progressToken,
        traceId: options?.traceId,
        spanId: options?.spanId,
        parentSpanId: options?.parentSpanId,
    };
}
export function runWithRequestContext(context, fn) {
    return storage.run(context, fn);
}
export function getRequestContext() {
    return storage.getStore();
}
export function getRequestLogger() {
    return storage.getStore()?.logger ?? baseLogger;
}
/**
 * Send MCP progress notification if available in request context
 * Used by BatchCompiler and other long-running operations
 *
 * @param progress Current progress (0-based)
 * @param total Total steps
 * @param message Progress message
 */
export async function sendProgress(progress, total, message) {
    const context = storage.getStore();
    if (!context?.sendNotification || !context?.progressToken) {
        // Progress notifications not requested by client or not in request context
        return;
    }
    try {
        await context.sendNotification({
            method: 'notifications/progress',
            params: {
                progressToken: context.progressToken,
                progress,
                total,
                message,
            },
        });
    }
    catch (error) {
        // Don't fail the operation if progress notification fails
        context.logger.warn('Failed to send progress notification', {
            error,
            progress,
            total,
            message,
        });
    }
}
//# sourceMappingURL=request-context.js.map