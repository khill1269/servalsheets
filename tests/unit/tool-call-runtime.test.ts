import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
const { getRemoteToolClient } = vi.hoisted(() => ({
  getRemoteToolClient: vi.fn(),
}));

vi.mock('../../src/services/remote-mcp-tool-client.js', () => ({
  getRemoteToolClient,
}));

import { createRequestContext } from '../../src/utils/request-context.js';
import {
  executeToolCallRuntime,
  type ToolCallRuntimeInput,
} from '../../src/mcp/registration/tool-call-runtime.js';

function createInput(overrides: Partial<ToolCallRuntimeInput> = {}): ToolCallRuntimeInput {
  return {
    tool: {
      name: 'sheets_data',
      outputSchema: z.object({}),
    },
    args: { request: { action: 'read', spreadsheetId: 'sheet-123' } },
    extra: undefined,
    handlerMap: { sheets_data: vi.fn() },
    googleClient: {} as never,
    requestAbortSignal: undefined,
    requestContext: createRequestContext({
      requestId: 'req-1',
      traceId: 'trace-1',
      principalId: 'user-1',
    }),
    requestId: 'req-1',
    traceId: 'trace-1',
    operationId: 'op-1',
    startTime: Date.now() - 5,
    timestamp: new Date().toISOString(),
    costTrackingTenantId: 'tenant-1',
    ...overrides,
  };
}

describe('executeToolCallRuntime', () => {
  beforeEach(() => {
    getRemoteToolClient.mockReset();
  });

  it('short-circuits when preflight returns a response', async () => {
    const startKeepalive = vi.fn();
    const recordSuccessful = vi.fn();

    const result = await executeToolCallRuntime(createInput(), {
      resolvePreflight: vi.fn().mockResolvedValue({
        kind: 'response',
        response: {
          content: [],
          structuredContent: {
            response: {
              success: false,
              error: { code: 'NOT_AUTHENTICATED', message: 'auth required', retryable: true },
            },
          },
        },
      }),
      startKeepalive,
      recordSuccessful,
    });

    expect(startKeepalive).not.toHaveBeenCalled();
    expect(recordSuccessful).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      response: {
        success: false,
        error: { code: 'NOT_AUTHENTICATED' },
      },
    });
  });

  it('records successful execution and wraps the result', async () => {
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const handler = vi.fn();

    const result = await executeToolCallRuntime(
      createInput(),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler,
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall: vi.fn().mockResolvedValue({
          response: {
            success: true,
            values: [[1]],
          },
        }),
        recordSuccessful,
      }
    );

    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_data',
        action: 'read',
        principalId: 'user-1',
        costTrackingTenantId: 'tenant-1',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
      },
    });
  });

  it('routes runtime execution through the transport-aware router before local execution', async () => {
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn().mockResolvedValue({
      response: {
        success: true,
        source: 'local',
      },
    });
    const executeRoutedToolCall = vi.fn(async () => ({
      response: {
        success: true,
        source: 'remote',
      },
    })) as any;

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_federation',
          outputSchema: z.object({}),
        },
        args: { request: { action: 'list_servers' } },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        executeRoutedToolCall,
        recordSuccessful,
      }
    );

    expect(executeRoutedToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_federation',
        transport: 'streamable-http',
      })
    );
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_federation',
        action: 'list_servers',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        source: 'remote',
      },
    });
  });

  it('falls back to the hosted executor for prefer_local tools after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            source: 'remote',
          },
        },
      })),
    });
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn(async () => {
      throw new Error('local compute failed');
    });

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_compute',
          outputSchema: z.object({}),
        },
        args: { request: { action: 'evaluate' } },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        recordSuccessful,
      }
    );

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_compute');
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_compute',
        action: 'evaluate',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        source: 'remote',
      },
    });
  });

  it('falls back to the hosted executor for sheets_analyze after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'analyze_data',
            source: 'remote',
          },
        },
      })),
    });
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn(async () => {
      throw new Error('local analyze failed');
    });

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_analyze',
          outputSchema: z.object({}),
        },
        args: {
          request: {
            action: 'analyze_data',
            spreadsheetId: 'spreadsheet-123',
            analysisTypes: ['summary'],
          },
        },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        recordSuccessful,
      }
    );

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_analyze');
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_analyze',
        action: 'analyze_data',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        action: 'analyze_data',
        source: 'remote',
      },
    });
  });

  it('falls back to the hosted executor for sheets_connectors after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'list_connectors',
            source: 'remote',
          },
        },
      })),
    });
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn(async () => {
      throw new Error('local connectors failed');
    });

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_connectors',
          outputSchema: z.object({}),
        },
        args: {
          request: {
            action: 'list_connectors',
          },
        },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        recordSuccessful,
      }
    );

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_connectors');
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_connectors',
        action: 'list_connectors',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        action: 'list_connectors',
        source: 'remote',
      },
    });
  });

  it('falls back to the hosted executor for sheets_agent after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'list_plans',
            source: 'remote',
          },
        },
      })),
    });
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn(async () => {
      throw new Error('local agent failed');
    });

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_agent',
          outputSchema: z.object({}),
        },
        args: {
          request: {
            action: 'list_plans',
          },
        },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        recordSuccessful,
      }
    );

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_agent');
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_agent',
        action: 'list_plans',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        action: 'list_plans',
        source: 'remote',
      },
    });
  });

  it('falls back to the hosted executor for sheets_bigquery after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'list_connections',
            source: 'remote',
          },
        },
      })),
    });
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn(async () => {
      throw new Error('local bigquery failed');
    });

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_bigquery',
          outputSchema: z.object({}),
        },
        args: {
          request: {
            action: 'list_connections',
            spreadsheetId: 'spreadsheet-123',
          },
        },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        recordSuccessful,
      }
    );

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_bigquery');
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_bigquery',
        action: 'list_connections',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        action: 'list_connections',
        source: 'remote',
      },
    });
  });

  it('falls back to the hosted executor for sheets_appsscript after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'get',
            source: 'remote',
          },
        },
      })),
    });
    const keepalive = { stop: vi.fn() };
    const recordSuccessful = vi.fn().mockResolvedValue(undefined);
    const executeToolCall = vi.fn(async () => {
      throw new Error('local appsscript failed');
    });

    const result = await executeToolCallRuntime(
      createInput({
        tool: {
          name: 'sheets_appsscript',
          outputSchema: z.object({}),
        },
        args: {
          request: {
            action: 'get',
            spreadsheetId: 'spreadsheet-123',
          },
        },
      }),
      {
        resolvePreflight: vi.fn().mockResolvedValue({
          kind: 'handler',
          handler: vi.fn(),
        }),
        startKeepalive: vi.fn().mockReturnValue(keepalive),
        executeToolCall,
        recordSuccessful,
      }
    );

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_appsscript');
    expect(recordSuccessful).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_appsscript',
        action: 'get',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: true,
        action: 'get',
        source: 'remote',
      },
    });
  });

  it('records failures and converts Google auth errors', async () => {
    const keepalive = { stop: vi.fn() };
    const error = new Error('token expired');
    const recordFailed = vi.fn().mockResolvedValue(undefined);

    const result = await executeToolCallRuntime(createInput(), {
      resolvePreflight: vi.fn().mockResolvedValue({
        kind: 'handler',
        handler: vi.fn(),
      }),
      startKeepalive: vi.fn().mockReturnValue(keepalive),
      executeToolCall: vi.fn().mockRejectedValue(error),
      buildErrorPayload: vi.fn().mockReturnValue({
        errorCode: 'TOKEN_EXPIRED',
        errorMessage: 'token expired',
        errorPayload: {
          code: 'TOKEN_EXPIRED',
          message: 'token expired',
          retryable: false,
        },
      }),
      recordFailed,
      isGoogleAuthError: vi.fn().mockReturnValue(true),
      convertGoogleAuthError: vi.fn().mockReturnValue({
        response: {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'token expired',
            retryable: true,
          },
        },
      }),
    });

    expect(recordFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_data',
        errorCode: 'TOKEN_EXPIRED',
      })
    );
    expect(keepalive.stop).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      response: {
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
        },
      },
    });
  });

  it('throws an abort error before entering request context when request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort('cancelled');

    await expect(
      executeToolCallRuntime(
        createInput({
          requestAbortSignal: controller.signal,
        })
      )
    ).rejects.toMatchObject({
      name: 'AbortError',
      code: 'OPERATION_CANCELLED',
      message: 'cancelled',
    });
  });
});
