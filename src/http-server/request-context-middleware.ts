import { randomBytes, randomUUID } from 'crypto';
import type { Application, RequestHandler } from 'express';
import { logger as defaultLogger } from '../utils/logger.js';

export interface HttpRequestContextMiddlewareOptions {
  readonly createRequestId?: () => string;
  readonly createRandomHex?: (byteLength: number) => string;
  readonly log?: typeof defaultLogger;
}

function defaultCreateRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}

export function createHttpRequestIdMiddleware(
  options: Pick<HttpRequestContextMiddlewareOptions, 'createRequestId'> = {}
): RequestHandler {
  const createRequestId = options.createRequestId ?? randomUUID;

  return (req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? createRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };
}

export function createHttpTraceContextMiddleware(
  options: Pick<HttpRequestContextMiddlewareOptions, 'createRandomHex' | 'log'> = {}
): RequestHandler {
  const createRandomHex = options.createRandomHex ?? defaultCreateRandomHex;
  const log = options.log ?? defaultLogger;

  return (req, res, next) => {
    const incomingTraceparent = req.header('traceparent');

    let traceId: string;
    let parentId: string;

    if (incomingTraceparent) {
      const parts = incomingTraceparent.split('-');
      const isValidTraceId = /^[0-9a-f]{32}$/.test(parts[1] ?? '');
      const isValidParentId = /^[0-9a-f]{16}$/.test(parts[2] ?? '');
      if (parts.length === 4 && parts[0] === '00' && isValidTraceId && isValidParentId) {
        traceId = parts[1]!;
        parentId = parts[2]!;
      } else {
        traceId = createRandomHex(16);
        parentId = createRandomHex(8);
        log.warn('Invalid traceparent header, generating new trace', {
          traceparent: incomingTraceparent.slice(0, 100),
        });
      }
    } else {
      traceId = createRandomHex(16);
      parentId = createRandomHex(8);
    }

    const spanId = createRandomHex(8);
    const traceparent = `00-${traceId}-${spanId}-01`;
    res.setHeader('traceparent', traceparent);

    req.headers['x-trace-id'] = traceId;
    req.headers['x-span-id'] = spanId;
    req.headers['x-parent-span-id'] = parentId;

    next();
  };
}

export function registerHttpRequestContextMiddleware(
  app: Pick<Application, 'use'>,
  options: HttpRequestContextMiddlewareOptions = {}
): void {
  app.use(createHttpRequestIdMiddleware(options));
  app.use(createHttpTraceContextMiddleware(options));
}
