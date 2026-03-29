import type { Application, RequestHandler } from 'express';
import { logger as defaultLogger } from '../utils/logger.js';
import {
  createHttpRequestIdMiddleware as createHttpRequestIdMiddlewareImpl,
  createHttpTraceContextMiddleware as createHttpTraceContextMiddlewareImpl,
  registerHttpRequestContextMiddleware as registerHttpRequestContextMiddlewareImpl,
  type HttpRequestContextLogger,
  type HttpRequestContextMiddlewareOptions,
} from '#mcp-http/request-context-middleware';

export type { HttpRequestContextLogger, HttpRequestContextMiddlewareOptions };

export function createHttpRequestIdMiddleware(
  options: Pick<HttpRequestContextMiddlewareOptions, 'createRequestId'> = {}
): RequestHandler {
  return createHttpRequestIdMiddlewareImpl(options);
}

export function createHttpTraceContextMiddleware(
  options: Pick<HttpRequestContextMiddlewareOptions, 'createRandomHex' | 'log'> = {}
): RequestHandler {
  return createHttpTraceContextMiddlewareImpl({
    ...options,
    log: (options.log ?? defaultLogger) as HttpRequestContextLogger,
  });
}

export function registerHttpRequestContextMiddleware(
  app: Pick<Application, 'use'>,
  options: HttpRequestContextMiddlewareOptions = {}
): void {
  registerHttpRequestContextMiddlewareImpl(app, {
    ...options,
    log: (options.log ?? defaultLogger) as HttpRequestContextLogger,
  });
}
