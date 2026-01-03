/**
 * ServalSheets - Request Context
 *
 * Async-local storage for per-request metadata (requestId, logger, deadlines).
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { Logger } from 'winston';
import { logger as baseLogger } from './logger.js';

export interface RequestContext {
  requestId: string;
  logger: Logger;
  timeoutMs: number;
  deadline: number;
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
}): RequestContext {
  const requestId = options?.requestId ?? randomUUID();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const logger = (options?.logger ?? baseLogger).child({ requestId });

  return {
    requestId,
    logger,
    timeoutMs,
    deadline: Date.now() + timeoutMs,
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
