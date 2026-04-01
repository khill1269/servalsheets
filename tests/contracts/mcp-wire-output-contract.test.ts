import { afterEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerServalSheetsResources } from '../../src/mcp/registration/resource-registration.js';
import { registerToolsListCompatibilityHandler } from '../../src/mcp/registration/tools-list-compat.js';
import { resetAvailableToolNames } from '../../src/mcp/tool-registry-state.js';

function createMockResourceServer() {
  return {
    registerResource: vi.fn(),
  } as unknown as McpServer;
}

function createMockToolsListServer() {
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

describe('MCP wire output contracts', () => {
  afterEach(() => {
    resetAvailableToolNames();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('registers fixed resources with canonical names and URI schemes', () => {
    const server = createMockResourceServer();

    registerServalSheetsResources(server, null);

    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, string | unknown, Record<string, unknown>, (...args: unknown[]) => unknown]
    >;
    const staticResourceCalls = calls.filter(
      (call): call is [string, string, Record<string, unknown>, (...args: unknown[]) => unknown] =>
        typeof call[1] === 'string'
    );

    expect(staticResourceCalls.length).toBeGreaterThan(0);

    for (const [name, uri] of staticResourceCalls) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(uri).toMatch(/^[a-z][a-z0-9+.-]*:/i);
    }

    expect(staticResourceCalls).toContainEqual(
      expect.arrayContaining([
        'server_health',
        'metrics://servalsheets/health',
      ])
    );

    expect(staticResourceCalls).toContainEqual(
      expect.arrayContaining([
        'guide_tool_selection',
        'guide://tool-selection',
      ])
    );
  });

  it('keeps stdio tools/list payload under the wire-size budget', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'stdio');

    const mock = createMockToolsListServer();

    registerToolsListCompatibilityHandler(mock.server);
    const response = await mock.getHandler()({ params: {} });
    const payloadBytes = Buffer.byteLength(JSON.stringify(response), 'utf8');

    expect(payloadBytes).toBeLessThan(300_000);
    expect(response.tools.length).toBeGreaterThan(0);
  });

  it('keeps bundled tools/list payload below the hard safety cap', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'http');

    const mock = createMockToolsListServer();

    registerToolsListCompatibilityHandler(mock.server);
    const response = await mock.getHandler()({ params: {} });
    const payloadBytes = Buffer.byteLength(JSON.stringify(response), 'utf8');

    expect(payloadBytes).toBeLessThan(1_000_000);
    expect(response.tools.length).toBeGreaterThan(0);
  });
});
