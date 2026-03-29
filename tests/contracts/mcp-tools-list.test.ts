import { afterEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  replaceAvailableToolNames,
  resetAvailableToolNames,
} from '../../src/mcp/tool-registry-state.js';

function createMockServer() {
  let capturedHandler:
    | ((request: { params?: Record<string, unknown> }) => { tools: Record<string, unknown>[] })
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
  afterEach(() => {
    resetAvailableToolNames();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../src/config/constants.js');
  });

  it('serves bundled tools from repo-owned availability state without SDK private fields', () => {
    vi.doMock('../../src/config/constants.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/constants.js')>(
        '../../src/config/constants.js'
      );
      return {
        ...actual,
        getEffectiveToolMode: () => 'bundled' as const,
      };
    });

    replaceAvailableToolNames(['sheets_auth', 'sheets_core']);
    const mock = createMockServer();

    return import('../../src/mcp/registration/tools-list-compat.js').then(
      ({ registerToolsListCompatibilityHandler }) => {
        registerToolsListCompatibilityHandler(mock.server);
        const response = mock.getHandler()({ params: {} });

        const toolNames = response.tools.map((tool) => String(tool['name'])).sort();
        expect(toolNames).toEqual(['sheets_auth', 'sheets_core']);
      }
    );
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
