import { describe, expect, it, vi } from 'vitest';

import { resolveStdioToolCall } from '../../../packages/mcp-stdio/src/resolve-stdio-tool-call.js';

describe('@serval/mcp-stdio resolveStdioToolCall', () => {
  it('handles sheets_auth and updates the auth handler', async () => {
    const setAuthHandler = vi.fn();
    const result = await resolveStdioToolCall(
      {
        toolName: 'sheets_auth',
        args: { request: { action: 'status' } },
        authHandler: null,
        handlers: null,
        context: null,
        googleClient: null,
        cachedHandlerMap: null,
        requestId: 'req-1',
        costTrackingTenantId: 'tenant-1',
        startTime: Date.now(),
      },
      {
        handleSheetsAuthToolCall: vi.fn(async () => ({
          authHandler: { kind: 'auth' },
          result: { response: { success: true } },
        })),
        setAuthHandler,
        recordToolCall: vi.fn(),
        buildToolResponse: vi.fn((payload) => payload as never),
        isToolCallAuthExempt: vi.fn(() => false),
        checkAuthAsync: vi.fn(async () => ({ authenticated: true })),
        buildAuthErrorResponse: vi.fn((error) => error),
        handlePreInitExemptToolCall: vi.fn(async () => null),
        dispatchServerToolCall: vi.fn(),
        setCachedHandlerMap: vi.fn(),
      }
    );

    expect(setAuthHandler).toHaveBeenCalledWith({ kind: 'auth' });
    expect(result).toEqual({
      kind: 'response',
      response: { response: { success: true } },
    });
  });

  it('returns an auth error response before dispatch when authentication fails', async () => {
    const result = await resolveStdioToolCall(
      {
        toolName: 'sheets_compute',
        args: { request: { action: 'evaluate' } },
        authHandler: null,
        handlers: { kind: 'handlers' },
        context: { kind: 'context' },
        googleClient: { kind: 'google-client' },
        cachedHandlerMap: null,
        requestId: 'req-2',
        costTrackingTenantId: 'tenant-2',
        startTime: Date.now(),
      },
      {
        handleSheetsAuthToolCall: vi.fn(),
        setAuthHandler: vi.fn(),
        recordToolCall: vi.fn(),
        buildToolResponse: vi.fn((payload) => payload as never),
        isToolCallAuthExempt: vi.fn(() => false),
        checkAuthAsync: vi.fn(async () => ({
          authenticated: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'login required' },
        })),
        buildAuthErrorResponse: vi.fn((error) => error),
        handlePreInitExemptToolCall: vi.fn(async () => null),
        dispatchServerToolCall: vi.fn(),
        setCachedHandlerMap: vi.fn(),
      }
    );

    expect(result).toEqual({
      kind: 'response',
      response: {
        code: 'NOT_AUTHENTICATED',
        message: 'login required',
      },
    });
  });

  it('returns dispatch results and updates the cached handler map', async () => {
    const setCachedHandlerMap = vi.fn();
    const result = await resolveStdioToolCall(
      {
        toolName: 'sheets_compute',
        args: { request: { action: 'evaluate' } },
        extra: { abortSignal: new AbortController().signal },
        authHandler: { kind: 'auth' },
        handlers: { kind: 'handlers' },
        context: { kind: 'context' },
        googleClient: { kind: 'google-client' },
        cachedHandlerMap: { existing: true },
        requestId: 'req-3',
        costTrackingTenantId: 'tenant-3',
        startTime: Date.now(),
      },
      {
        handleSheetsAuthToolCall: vi.fn(),
        setAuthHandler: vi.fn(),
        recordToolCall: vi.fn(),
        buildToolResponse: vi.fn((payload) => payload as never),
        isToolCallAuthExempt: vi.fn(() => false),
        checkAuthAsync: vi.fn(async () => ({ authenticated: true })),
        buildAuthErrorResponse: vi.fn((error) => error),
        handlePreInitExemptToolCall: vi.fn(async () => null),
        dispatchServerToolCall: vi.fn(async () => ({
          kind: 'result',
          result: { response: { success: true } },
          handlerMap: { cached: true },
        })) as never,
        setCachedHandlerMap,
      }
    );

    expect(setCachedHandlerMap).toHaveBeenCalledWith({ cached: true });
    expect(result).toEqual({
      kind: 'result',
      result: { response: { success: true } },
    });
  });
});
