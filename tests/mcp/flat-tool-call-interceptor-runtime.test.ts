import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { register } from 'prom-client';
import {
  resetRegisteredToolRuntime,
  setRegisteredToolRuntime,
} from '../../src/mcp/registration/registered-tool-runtime.js';

function createMockServer() {
  const originalHandler = vi.fn(
    async (
      request: { params: { name: string; arguments?: Record<string, unknown>; task?: unknown } },
      extra?: unknown
    ) => {
      const { getRegisteredToolRuntime } = await import(
        '../../src/mcp/registration/registered-tool-runtime.js'
      );
      const runtime = getRegisteredToolRuntime(request.params.name);
      if (!runtime) {
        throw new Error(`Tool ${request.params.name} not found`);
      }
      return runtime.handler(request.params.arguments ?? {}, extra);
    }
  );

  const rawServer = {
    server: {
      _requestHandlers: new Map<string, typeof originalHandler>([['tools/call', originalHandler]]),
    },
  };
  const server = rawServer as unknown as McpServer;

  return {
    server,
    getHandler() {
      const handler = rawServer.server._requestHandlers.get('tools/call');
      if (!handler) {
        throw new Error('tools/call handler was not registered');
      }
      return handler;
    },
  };
}

describe('flat tool call interceptor runtime registry', () => {
  afterEach(() => {
    resetRegisteredToolRuntime();
    register.clear();
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
    const { registerFlatToolCallInterceptor } =
      await import('../../src/mcp/registration/flat-tool-call-interceptor.js');

    expect(registerFlatToolCallInterceptor(mock.server)).toBe(true);
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

    // Post–BUG #1 fix, routeFlatToolCall wraps flat args in the canonical
    // `{ request: { ... } }` envelope (see src/mcp/registration/flat-tool-routing.ts:95-103).
    // Compound handlers' schemas validate `request: z.discriminatedUnion(...)`
    // and reject bare args, so this envelope is load-bearing.
    expect(compoundHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          action: 'read',
          spreadsheetId: 'spreadsheet-123',
          range: 'A1:B4',
        }),
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

  it('throws in flat mode when the SDK request handler map is unavailable', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'flat' as const,
      };
    });

    const { registerFlatToolCallInterceptor } =
      await import('../../src/mcp/registration/flat-tool-call-interceptor.js');

    expect(() => registerFlatToolCallInterceptor({ server: {} } as McpServer)).toThrow(
      /_requestHandlers map is not accessible/
    );
  });

  it('skips registration in bundled mode', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'bundled' as const,
      };
    });

    const { registerFlatToolCallInterceptor } =
      await import('../../src/mcp/registration/flat-tool-call-interceptor.js');

    expect(registerFlatToolCallInterceptor({ server: {} } as McpServer)).toBe(false);
  });
});
