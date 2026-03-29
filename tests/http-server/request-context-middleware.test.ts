import { describe, expect, it, vi } from 'vitest';
import {
  createHttpRequestIdMiddleware,
  createHttpTraceContextMiddleware,
  registerHttpRequestContextMiddleware,
} from '../../src/http-server/request-context-middleware.js';

function createResponseDouble() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key, value);
    }),
  };
}

describe('http request-context middleware', () => {
  it('preserves client request ids and generates one when missing', () => {
    const requestIdMiddleware = createHttpRequestIdMiddleware({
      createRequestId: () => 'generated-request-id',
    });
    const next = vi.fn();

    const existingReq = {
      headers: { 'x-request-id': 'client-request-id' },
    };
    const existingRes = createResponseDouble();
    requestIdMiddleware(existingReq as never, existingRes as never, next);

    expect(existingReq.headers['x-request-id']).toBe('client-request-id');
    expect(existingRes.setHeader).toHaveBeenCalledWith('X-Request-ID', 'client-request-id');

    const generatedReq = {
      headers: {} as Record<string, string>,
    };
    const generatedRes = createResponseDouble();
    requestIdMiddleware(generatedReq as never, generatedRes as never, next);

    expect(generatedReq.headers['x-request-id']).toBe('generated-request-id');
    expect(generatedRes.setHeader).toHaveBeenCalledWith('X-Request-ID', 'generated-request-id');
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('reuses a valid incoming traceparent and emits a downstream traceparent', () => {
    const traceContextMiddleware = createHttpTraceContextMiddleware({
      createRandomHex: (byteLength) => (byteLength === 8 ? 'aaaaaaaaaaaaaaaa' : 'b'.repeat(32)),
    });
    const next = vi.fn();
    const req = {
      headers: {} as Record<string, string>,
      header: vi.fn(() => '00-0123456789abcdef0123456789abcdef-89abcdef01234567-01'),
    };
    const res = createResponseDouble();

    traceContextMiddleware(req as never, res as never, next);

    expect(req.headers['x-trace-id']).toBe('0123456789abcdef0123456789abcdef');
    expect(req.headers['x-parent-span-id']).toBe('89abcdef01234567');
    expect(req.headers['x-span-id']).toBe('aaaaaaaaaaaaaaaa');
    expect(res.setHeader).toHaveBeenCalledWith(
      'traceparent',
      '00-0123456789abcdef0123456789abcdef-aaaaaaaaaaaaaaaa-01'
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('regenerates invalid traceparent values and logs a warning', () => {
    const log = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };
    const generated = [
      '11111111111111111111111111111111',
      '2222222222222222',
      '3333333333333333',
    ];
    const traceContextMiddleware = createHttpTraceContextMiddleware({
      createRandomHex: () => generated.shift() ?? 'f'.repeat(32),
      log: log as never,
    });
    const next = vi.fn();
    const req = {
      headers: {} as Record<string, string>,
      header: vi.fn(() => 'malformed-traceparent-value'),
    };
    const res = createResponseDouble();

    traceContextMiddleware(req as never, res as never, next);

    expect(log.warn).toHaveBeenCalledWith('Invalid traceparent header, generating new trace', {
      traceparent: 'malformed-traceparent-value',
    });
    expect(req.headers['x-trace-id']).toBe('11111111111111111111111111111111');
    expect(req.headers['x-parent-span-id']).toBe('2222222222222222');
    expect(req.headers['x-span-id']).toBe('3333333333333333');
    expect(res.setHeader).toHaveBeenCalledWith(
      'traceparent',
      '00-11111111111111111111111111111111-3333333333333333-01'
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('registers request-id before trace-context middleware', () => {
    const use = vi.fn();

    registerHttpRequestContextMiddleware(
      {
        use,
      } as never,
      {
        createRequestId: () => 'request-id',
        createRandomHex: () => 'abcd'.repeat(8),
      }
    );

    expect(use).toHaveBeenCalledTimes(2);
    expect(typeof use.mock.calls[0]?.[0]).toBe('function');
    expect(typeof use.mock.calls[1]?.[0]).toBe('function');
  });
});
