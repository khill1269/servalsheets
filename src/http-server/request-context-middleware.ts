import type { Application, RequestHandler } from 'express';
import { logger as defaultLogger } from '../utils/logger.js';
import {
  createHttpRequestIdMiddleware as createHttpRequestIdMiddlewareImpl,
  createHttpTraceContextMiddleware as createHttpTraceContextMiddlewareImpl,
  registerHttpRequestContextMiddleware as registerHttpRequestContextMiddlewareImpl,
  type HttpRequestContextLogger,
  type HttpRequestContextMiddlewareOptions,
} from '../../packages/mcp-http/dist/request-context-middleware.js';

export type { HttpRequestContextLogger, HttpRequestContextMiddlewareOptions };

export function createHttpRequestIdMiddleware(
  options: Pick<HttpRequestContextMiddlewareOptions, 'createRequestId'> = {}
): RequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createHttpRequestIdMiddlewareImpl(options) as any;
}

export function createHttpTraceContextMiddleware(
  options: Pick<HttpRequestContextMiddlewareOptions, 'createRandomHex' | 'log'> = {}
): RequestHandler {
  return createHttpTraceContextMiddlewareImpl({
    ...options,
    log: (options.log ?? defaultLogger) as HttpRequestContextLogger,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

export function registerHttpRequestContextMiddleware(
  app: Pick<Application, 'use'>,
  options: HttpRequestContextMiddlewareOptions = {}
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerHttpRequestContextMiddlewareImpl(app as any, {
    ...options,
    log: (options.log ?? defaultLogger) as HttpRequestContextLogger,
  });
}
