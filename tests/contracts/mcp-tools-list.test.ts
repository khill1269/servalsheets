import { afterEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { register } from 'prom-client';

function createMockServer() {
  let capturedHandler:
    | ((
        request: { params?: Record<string, unknown> },
        extra?: Record<string, unknown>
      ) => Promise<{ tools: Record<string, unknown>[]; nextCursor?: string }>)
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
        throw new Error('tools/list handler was not registered');
      }
      return capturedHandler;
    },
  };
}

describe('MCP tools/list runtime ownership', () => {
  afterEach(async () => {
    const { resetAvailableToolNames } = await import('../../src/mcp/tool-registry-state.js');
    register.clear();
    resetAvailableToolNames();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../src/config/constants.js');
  });

  it('serves bundled tools from repo-owned availability state without SDK private fields', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'bundled' as const,
      };
    });

    const { replaceAvailableToolNames } = await import('../../src/mcp/tool-registry-state.js');
    replaceAvailableToolNames(['sheets_auth', 'sheets_core']);
    const mock = createMockServer();

    const { registerToolsListCompatibilityHandler } =
      await import('../../src/mcp/registration/tools-list-compat.js');
    registerToolsListCompatibilityHandler(mock.server);
    const response = await mock.getHandler()({ params: {} });

    const toolNames = response.tools.map((tool) => String(tool['name'])).sort();
    expect(toolNames).toEqual(['sheets_auth', 'sheets_core']);
  });

  it('filters bundled tool visibility by request authentication state', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'bundled' as const,
      };
    });

    const { replaceAvailableToolNames } = await import('../../src/mcp/tool-registry-state.js');
    replaceAvailableToolNames(['sheets_auth', 'sheets_history', 'sheets_data']);
    const mock = createMockServer();
    const { registerToolsListCompatibilityHandler } =
      await import('../../src/mcp/registration/tools-list-compat.js');

    registerToolsListCompatibilityHandler(mock.server);
    const response = await mock.getHandler()({ params: {} }, { authenticated: false });

    const toolNames = response.tools.map((tool) => String(tool['name'])).sort();
    expect(toolNames).toEqual(['sheets_auth', 'sheets_history']);

    const historyTool = response.tools.find((tool) => tool['name'] === 'sheets_history');
    const requestSchema = (historyTool?.['inputSchema'] as Record<string, any>)?.['properties']?.[
      'request'
    ] as Record<string, any>;
    const actionEnum = ((requestSchema?.['properties'] as Record<string, any>)?.['action']?.[
      'enum'
    ] ?? []) as string[];
    const metadata = ((historyTool?.['inputSchema'] as Record<string, unknown>)?.[
      'x-servalsheets'
    ] ?? {}) as Record<string, any>;

    expect(actionEnum.slice().sort()).toEqual(['get', 'list', 'stats']);
    expect(metadata['access']).toMatchObject({
      authenticated: false,
      filteredBy: 'authentication',
    });
  });

  it('paginates the flat tools/list surface with an opaque cursor', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'flat' as const,
      };
    });

    const mock = createMockServer();
    const { registerToolsListCompatibilityHandler } =
      await import('../../src/mcp/registration/tools-list-compat.js');
    registerToolsListCompatibilityHandler(mock.server);

    const firstPage = await mock.getHandler()({ params: {} });
    expect(firstPage.tools.length).toBeLessThanOrEqual(100);
    expect(firstPage.tools[0]['name']).toBe('sheets_discover');
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await mock.getHandler()({ params: { cursor: firstPage.nextCursor } });
    expect(secondPage.tools.length).toBeGreaterThan(0);
    expect(secondPage.tools.every((tool) => tool['name'] !== 'sheets_discover')).toBe(true);

    const firstPageNames = new Set(firstPage.tools.map((tool) => String(tool['name'])));
    expect(secondPage.tools.some((tool) => firstPageNames.has(String(tool['name'])))).toBe(false);
  });

  it('rejects invalid flat tools/list cursors as invalid params', async () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'flat' as const,
      };
    });

    const mock = createMockServer();
    const { registerToolsListCompatibilityHandler } =
      await import('../../src/mcp/registration/tools-list-compat.js');
    registerToolsListCompatibilityHandler(mock.server);

    await expect(
      mock.getHandler()({ params: { cursor: 'not-a-valid-cursor' } })
    ).rejects.toMatchObject({
      code: -32602,
    });
  });

  it('does not depend on _registeredTools inside the compatibility handler source', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('src/mcp/registration/tools-list-compat.ts', 'utf-8');

    expect(source).not.toContain('_registeredTools');
  });

  it('does not depend on _registeredTools inside the flat tool call interceptor source', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('src/mcp/registration/flat-tool-call-interceptor.ts', 'utf-8');

    expect(source).not.toContain('_registeredTools');
  });
});
