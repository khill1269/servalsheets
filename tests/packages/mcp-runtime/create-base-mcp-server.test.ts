import { describe, expect, it } from 'vitest';

import { createBaseMcpServer } from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime createBaseMcpServer', () => {
  it('creates an MCP server with the provided identity and instructions', () => {
    const server = createBaseMcpServer({
      serverInfo: {
        name: 'runtime-test',
        version: '1.2.3',
        description: 'test server',
      },
      capabilities: {},
      instructions: 'Use tools carefully.',
    });

    const raw = server.server as unknown as {
      _serverInfo: { name: string; version: string; description?: string };
      _instructions?: string;
      _capabilities: Record<string, unknown>;
      _taskMessageQueue?: unknown;
    };

    expect(raw._serverInfo.name).toBe('runtime-test');
    expect(raw._serverInfo.version).toBe('1.2.3');
    expect(raw._serverInfo.description).toBe('test server');
    expect(raw._instructions).toBe('Use tools carefully.');
    expect(raw._capabilities).toEqual({});
    expect(raw._taskMessageQueue).toBeDefined();
  });
});
