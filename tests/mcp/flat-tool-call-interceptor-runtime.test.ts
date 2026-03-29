import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetRegisteredToolRuntime,
  setRegisteredToolRuntime,
} from '../../src/mcp/registration/registered-tool-runtime.js';

function createMockServer() {
  let capturedHandler:
    | ((
        request: { params: { name: string; arguments?: Record<string, unknown>; task?: unknown } },
        extra?: unknown
      ) => Promise<unknown>)
    | undefined;

  const server = {
    server: {
      setRequestHandler: vi.fn((_schema, handler) => {
        capturedHandler = handler as typeof capturedHandler;
      }),
    },
  } as unknown as McpServer;

  return {
    server,
    getHandler() {
      if (!capturedHandler) {
        throw new Error('tools/call handler was not registered');
      }
      return capturedHandler;
    },
  };
}

describe('flat tool call interceptor runtime registry', () => {
  afterEach(() => {
    resetRegisteredToolRuntime();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('routes flat tool calls through the repo-owned runtime registry', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'flat' as const,
      };
    });

    const compoundHandler = vi.fn().mockResolvedValue({
      content: [],
      structuredContent: {
        response: {
          success: true,
          action: 'read',
        },
      },
    });

    setRegisteredToolRuntime('sheets_data', {
      enabled: true,
      handler: compoundHandler,
    });

    const mock = createMockServer();
    const { registerFlatToolCallInterceptor } = await import(
      '../../src/mcp/registration/flat-tool-call-interceptor.js'
    );

    registerFlatToolCallInterceptor(mock.server);
    const handler = mock.getHandler();

    const result = await handler(
      {
        params: {
          name: 'sheets_data_read',
          arguments: {
            spreadsheetId: 'spreadsheet-123',
            range: 'A1:B4',
          },
        },
      },
      { requestId: 'flat-runtime-test' }
    );

    expect(compoundHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        spreadsheetId: 'spreadsheet-123',
        range: 'A1:B4',
      }),
      { requestId: 'flat-runtime-test' }
    );
    expect(result).toMatchObject({
      structuredContent: {
        response: {
          success: true,
          action: 'read',
        },
      },
    });
  });
});
