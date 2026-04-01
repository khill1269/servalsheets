import { describe, expect, it, vi } from 'vitest';
import {
  createHostValidationMiddleware,
  createHttpsEnforcementMiddleware,
  createOriginValidationMiddleware,
} from '../../src/http-server/request-validation-middleware.js';

function createResponseDouble() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: any, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

describe('http request validation middleware', () => {
  it('rejects insecure requests when HTTPS enforcement is enabled', () => {
    const log = { warn: vi.fn() };
    const middleware = createHttpsEnforcementMiddleware({
      enabled: true,
      log,
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'GET',
        path: '/mcp',
        ip: '127.0.0.1',
        protocol: 'http',
        secure: false,
        headers: {},
      } as never,
      res as never,
      next
    );

    expect(log.warn).toHaveBeenCalledWith('Rejected non-HTTPS request in production', {
      method: 'GET',
      path: '/mcp',
      ip: '127.0.0.1',
      protocol: 'http',
      forwardedProto: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(426);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows health endpoints over HTTP for internal readiness checks', () => {
    const log = { warn: vi.fn() };
    const middleware = createHttpsEnforcementMiddleware({
      enabled: true,
      log,
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'GET',
        path: '/health/ready',
        ip: '127.0.0.1',
        protocol: 'http',
        secure: false,
        headers: {},
      } as never,
      res as never,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects invalid origin headers', () => {
    const log = { warn: vi.fn() };
    const middleware = createOriginValidationMiddleware({
      corsOrigins: ['https://claude.ai'],
      log,
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'POST',
        path: '/mcp',
        ip: '127.0.0.1',
        get: (header: string) => (header === 'origin' ? 'https://evil.example' : undefined),
      } as never,
      res as never,
      next
    );

    expect(log.warn).toHaveBeenCalledWith('Rejected request with invalid Origin', {
      origin: 'https://evil.example',
      path: '/mcp',
      method: 'POST',
      ip: '127.0.0.1',
      allowedOrigins: ['https://claude.ai'],
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid host headers', () => {
    const log = { warn: vi.fn() };
    const middleware = createHostValidationMiddleware({
      allowedHosts: ['localhost', '127.0.0.1'],
      log,
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'GET',
        path: '/mcp',
        ip: '127.0.0.1',
        get: (header: string) => (header === 'host' ? 'evil.example:3000' : undefined),
      } as never,
      res as never,
      next
    );

    expect(log.warn).toHaveBeenCalledWith(
      'Rejected request with invalid Host header (DNS rebinding protection)',
      {
        host: 'evil.example:3000',
        hostname: 'evil.example',
        path: '/mcp',
        method: 'GET',
        ip: '127.0.0.1',
      }
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through allowed host headers', () => {
    const middleware = createHostValidationMiddleware({
      allowedHosts: ['localhost', '127.0.0.1'],
      log: { warn: vi.fn() },
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'GET',
        path: '/mcp',
        get: (header: string) => (header === 'host' ? 'localhost:3000' : undefined),
      } as never,
      res as never,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows health endpoints even when the host header is not allowlisted', () => {
    const log = { warn: vi.fn() };
    const middleware = createHostValidationMiddleware({
      allowedHosts: ['localhost', '127.0.0.1'],
      log,
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'GET',
        path: '/health/ready',
        ip: '127.0.0.1',
        get: (header: string) => (header === 'host' ? '[fdaa:59:28da:a7b::1]:3000' : undefined),
      } as never,
      res as never,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
