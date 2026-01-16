/**
 * ServalSheets - Request Context
 *
 * Async-local storage for per-request metadata (requestId, logger, deadlines, progress notifications).
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { Logger } from 'winston';
import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { logger as baseLogger } from './logger.js';

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

const storage = new AsyncLocalStorage<RequestContext>();
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env['REQUEST_TIMEOUT_MS'] ?? process.env['GOOGLE_API_TIMEOUT_MS'] ?? '30000',
  10
);

export function createRequestContext(options?: {
  requestId?: string;
  logger?: Logger;
  timeoutMs?: number;
  sendNotification?: (notification: ServerNotification) => Promise<void>;
  progressToken?: string | number;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}): RequestContext {
  const requestId = options?.requestId ?? randomUUID();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Include trace context in logger metadata
  const loggerMeta: Record<string, string> = { requestId };
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

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestLogger(): Logger {
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
export async function sendProgress(
  progress: number,
  total?: number,
  message?: string
): Promise<void> {
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
  } catch (error) {
    // Don't fail the operation if progress notification fails
    context.logger.warn('Failed to send progress notification', {
      error,
      progress,
      total,
      message,
    });
  }
}
