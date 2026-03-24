import { describe, expect, it, vi } from 'vitest';
import { registerHttpErrorHandler } from '../../src/http-server/error-handler.js';

describe('http error handler helper', () => {
  it('logs the request and returns development error details', () => {
    const app = { use: vi.fn() };
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpErrorHandler(app, {
      isProduction: false,
      log: log as never,
    });

    const errorHandler = app.use.mock.calls[0]?.[0];
    const status = vi.fn(() => ({ json }));
    const json = vi.fn();

    errorHandler?.(
      new Error('boom'),
      {
        method: 'POST',
        path: '/mcp',
        ip: '127.0.0.1',
        get: vi.fn(() => 'vitest'),
      },
      { status },
      vi.fn()
    );

    expect(log.error).toHaveBeenCalledWith('HTTP server error', {
      error: expect.any(Error),
      request: {
        method: 'POST',
        path: '/mcp',
        ip: '127.0.0.1',
        userAgent: 'vitest',
      },
      stack: expect.any(String),
    });
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: 'boom',
      },
    });
  });

  it('redacts error details in production', () => {
    const app = { use: vi.fn() };

    registerHttpErrorHandler(app, {
      isProduction: true,
    });

    const errorHandler = app.use.mock.calls[0]?.[0];
    const status = vi.fn(() => ({ json }));
    const json = vi.fn();

    errorHandler?.(
      new Error('secret'),
      {
        method: 'GET',
        path: '/health',
        ip: '127.0.0.1',
        get: vi.fn(() => 'vitest'),
      },
      { status },
      vi.fn()
    );

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: undefined,
      },
    });
  });
});
