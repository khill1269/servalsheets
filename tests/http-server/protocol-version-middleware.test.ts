import { describe, expect, it, vi } from 'vitest';
import { createHttpProtocolVersionMiddleware } from '../../src/http-server/protocol-version-middleware.js';

function createResponseDouble() {
  return {
    headers: new Map<string, unknown>(),
    statusCode: 200,
    body: undefined as unknown,
    setHeader: vi.fn(function (this: any, key: string, value: unknown) {
      this.headers.set(key, value);
    }),
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

describe('http protocol version middleware', () => {
  it('allows initialize without MCP-Protocol-Version when strict mode is enabled', () => {
    const middleware = createHttpProtocolVersionMiddleware({
      strictProtocolVersion: true,
      log: { warn: vi.fn() },
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'POST',
        path: '/mcp',
        headers: {},
        body: { method: 'initialize' },
      } as never,
      res as never,
      next
    );

    expect(res.setHeader).toHaveBeenCalledWith('MCP-Protocol-Version', '2025-11-25');
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects strict MCP requests missing the protocol header after initialize', () => {
    const middleware = createHttpProtocolVersionMiddleware({
      strictProtocolVersion: true,
      log: { warn: vi.fn() },
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'POST',
        path: '/mcp',
        headers: {},
        body: { method: 'tools/list' },
      } as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_REQUEST',
        message:
          'Missing MCP-Protocol-Version header. Expected MCP-Protocol-Version: 2025-11-25',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unsupported versions and logs the mismatch', () => {
    const log = { warn: vi.fn() };
    const middleware = createHttpProtocolVersionMiddleware({
      strictProtocolVersion: false,
      log,
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'POST',
        path: '/mcp',
        headers: { 'mcp-protocol-version': '2025-11-05' },
        body: { method: 'tools/list' },
      } as never,
      res as never,
      next
    );

    expect(log.warn).toHaveBeenCalledWith('Request rejected: unsupported MCP protocol version', {
      clientVersion: '2025-11-05',
      supportedVersion: '2025-11-25',
      path: '/mcp',
      method: 'POST',
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('skips non-MCP routes after setting the response header', () => {
    const middleware = createHttpProtocolVersionMiddleware({
      strictProtocolVersion: true,
      log: { warn: vi.fn() },
    });
    const res = createResponseDouble();
    const next = vi.fn();

    middleware(
      {
        method: 'GET',
        path: '/health',
        headers: {},
      } as never,
      res as never,
      next
    );

    expect(res.setHeader).toHaveBeenCalledWith('MCP-Protocol-Version', '2025-11-25');
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
