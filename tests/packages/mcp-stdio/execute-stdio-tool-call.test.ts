import { describe, expect, it, vi } from 'vitest';

import { executeStdioToolCall } from '../../../packages/mcp-stdio/src/execute-stdio-tool-call.js';

function createBaseDependencies() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    logger,
    dependencies: {
      ensureResourcesRegistered: vi.fn(async () => undefined),
      updateQueueMetrics: vi.fn(),
      createAbortError: (reason?: unknown) => {
        const error = new Error(String(reason ?? 'aborted'));
        error.name = 'AbortError';
        return error;
      },
      extractIdempotencyKeyFromHeaders: vi.fn(() => 'idem-1'),
      resolveCostTrackingTenantId: vi.fn(() => 'tenant-1'),
      extractPrincipalIdFromHeaders: vi.fn(() => 'principal-1'),
      createMetadataCache: vi.fn(() => ({ clear: vi.fn() })),
      createRequestContext: vi.fn((options) => ({
        logger,
        abortSignal: options.abortSignal,
        traceId: options.traceId,
        spanId: options.spanId,
        parentSpanId: options.parentSpanId,
        principalId: options.principalId,
        sessionContext: options.sessionContext,
      })),
      runWithRequestContext: vi.fn(async (_requestContext, operation) => operation()),
      buildToolResponse: vi.fn((payload) => payload as never),
      recordSpreadsheetId: vi.fn(),
      extractActionFromArgs: vi.fn(() => 'evaluate'),
      recordToolExecutionResult: vi.fn(),
      recordToolExecutionException: vi.fn(),
      isGoogleAuthError: vi.fn(() => false),
      convertGoogleAuthError: vi.fn(() => ({
        response: { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'auth' } },
      })),
      executeWithinRequest: vi.fn(),
    },
  };
}

describe('@serval/mcp-stdio executeStdioToolCall', () => {
  it('returns direct responses from request execution without wrapping success metrics', async () => {
    const { dependencies } = createBaseDependencies();
    dependencies.executeWithinRequest.mockResolvedValue({
      kind: 'response',
      response: { content: [{ type: 'text', text: 'preflight' }] },
    });

    const response = await executeStdioToolCall(
      {
        toolName: 'sheets_auth',
        args: { request: { action: 'status' } },
        isShutdown: false,
        sessionContext: undefined,
        requestQueue: {
          size: 0,
          pending: 0,
          add: async (operation) => operation(),
        },
        connectionHealthCheck: {
          recordHeartbeat: vi.fn(),
        },
      },
      dependencies
    );

    expect(response).toEqual({ content: [{ type: 'text', text: 'preflight' }] });
    expect(dependencies.recordToolExecutionResult).not.toHaveBeenCalled();
  });

  it('records successful executions and wraps the result payload', async () => {
    const { dependencies } = createBaseDependencies();
    dependencies.executeWithinRequest.mockResolvedValue({
      kind: 'result',
      result: { response: { success: true } },
    });

    const response = await executeStdioToolCall(
      {
        toolName: 'sheets_compute',
        args: { request: { action: 'evaluate' } },
        isShutdown: false,
        sessionContext: undefined,
        requestQueue: {
          size: 2,
          pending: 1,
          add: async (operation) => operation(),
        },
        connectionHealthCheck: {
          recordHeartbeat: vi.fn(),
        },
      },
      dependencies
    );

    expect(dependencies.recordToolExecutionResult).toHaveBeenCalledOnce();
    expect(dependencies.buildToolResponse).toHaveBeenCalledWith({
      response: { success: true },
    });
    expect(response).toEqual({ response: { success: true } });
  });

  it('converts AbortError failures into OPERATION_CANCELLED responses', async () => {
    const { dependencies } = createBaseDependencies();
    dependencies.executeWithinRequest.mockRejectedValue(
      Object.assign(new Error('cancelled by client'), { name: 'AbortError' })
    );

    const response = await executeStdioToolCall(
      {
        toolName: 'sheets_compute',
        args: { request: { action: 'evaluate' } },
        isShutdown: false,
        sessionContext: undefined,
        requestQueue: {
          size: 0,
          pending: 0,
          add: async (operation) => operation(),
        },
        connectionHealthCheck: {
          recordHeartbeat: vi.fn(),
        },
      },
      dependencies
    );

    expect(response).toMatchObject({
      response: {
        success: false,
        error: {
          code: 'OPERATION_CANCELLED',
          message: 'cancelled by client',
        },
      },
    });
    expect(dependencies.recordToolExecutionException).not.toHaveBeenCalled();
  });
});
