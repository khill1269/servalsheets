import { describe, expect, it } from 'vitest';

import { isRemoteMcpExecutorToolEnabled } from '../../src/services/remote-mcp-tool-client.js';

describe('isRemoteMcpExecutorToolEnabled', () => {
  it('requires the remote executor to be enabled and the tool to be allowlisted', () => {
    expect(
      isRemoteMcpExecutorToolEnabled('sheets_compute', {
        enabled: true,
        url: 'https://example.com/mcp',
        timeoutMs: 30000,
        allowedTools: ['sheets_compute', 'sheets_analyze'],
      })
    ).toBe(true);

    expect(
      isRemoteMcpExecutorToolEnabled('sheets_agent', {
        enabled: true,
        url: 'https://example.com/mcp',
        timeoutMs: 30000,
        allowedTools: ['sheets_compute', 'sheets_analyze'],
      })
    ).toBe(false);

    expect(
      isRemoteMcpExecutorToolEnabled('sheets_compute', {
        enabled: false,
        url: 'https://example.com/mcp',
        timeoutMs: 30000,
        allowedTools: ['sheets_compute'],
      })
    ).toBe(false);
  });
});
