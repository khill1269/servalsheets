import { describe, expect, it, vi } from 'vitest';

import { startStdioTransport } from '../../../packages/mcp-stdio/src/start-stdio-transport.js';

describe('@serval/mcp-stdio startStdioTransport', () => {
  it('connects stdio transport and shuts down on unexpected close', async () => {
    const transport: {
      onclose?: () => void;
      onerror?: (error: Error) => void;
    } = {};
    const server = {
      connect: vi.fn(async () => {}),
    };
    const ensureResourcesRegistered = vi.fn(async () => {});
    const shutdown = vi.fn(async () => {});
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await startStdioTransport({
      createTransport: () => transport,
      server,
      ensureResourcesRegistered,
      shutdown,
      getIsShutdown: () => false,
      getProcessBreadcrumbs: () => ({ resourcesRegistered: true }),
      toolCount: 25,
      actionCount: 407,
      log,
    });

    expect(ensureResourcesRegistered).toHaveBeenCalledOnce();
    expect(server.connect).toHaveBeenCalledWith(transport);
    expect(log.info).toHaveBeenCalledWith('[Phase 2/3] Creating STDIO transport');
    expect(log.info).toHaveBeenCalledWith(
      '[Phase 3/3] \u2713 ServalSheets ready (25 tools, 407 actions)',
      expect.objectContaining({
        transport: 'stdio',
        timing: expect.objectContaining({
          transportMs: expect.any(String),
          connectMs: expect.any(String),
        }),
      })
    );

    transport.onclose?.();
    expect(log.warn).toHaveBeenCalledWith(
      'MCP transport closed unexpectedly',
      expect.objectContaining({
        wasConnected: true,
        resourcesRegistered: true,
      })
    );
    expect(shutdown).toHaveBeenCalledOnce();
  });
});
