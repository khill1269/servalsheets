import { afterEach, describe, expect, it } from 'vitest';

import { getRemoteMcpExecutorConfig, resetEnvForTest } from '../../src/config/env.js';

const originalEnv = { ...process.env };

describe('remote MCP executor config', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTest();
  });

  it('stays disabled when a URL is configured without an explicit tool allowlist', () => {
    process.env = {
      ...originalEnv,
      MCP_REMOTE_EXECUTOR_URL: 'https://example.com/mcp',
      MCP_REMOTE_EXECUTOR_TOOLS: '',
    };

    expect(getRemoteMcpExecutorConfig()).toMatchObject({
      enabled: false,
      url: 'https://example.com/mcp',
      allowedTools: [],
    });
  });

  it('parses the tool allowlist and enables the executor only when tools are declared', () => {
    process.env = {
      ...originalEnv,
      MCP_REMOTE_EXECUTOR_URL: 'https://example.com/mcp',
      MCP_REMOTE_EXECUTOR_TOOLS: ' sheets_compute, sheets_analyze ,, sheets_agent ',
      MCP_REMOTE_EXECUTOR_AUTH_TYPE: 'bearer',
      MCP_REMOTE_EXECUTOR_AUTH_TOKEN: 'secret',
    };

    expect(getRemoteMcpExecutorConfig()).toMatchObject({
      enabled: true,
      url: 'https://example.com/mcp',
      allowedTools: ['sheets_compute', 'sheets_analyze', 'sheets_agent'],
      auth: {
        type: 'bearer',
        token: 'secret',
      },
    });
  });
});
