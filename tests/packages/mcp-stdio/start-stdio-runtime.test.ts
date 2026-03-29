import { describe, expect, it, vi } from 'vitest';

import { startStdioRuntime } from '../../../packages/mcp-stdio/src/start-stdio-runtime.js';

describe('@serval/mcp-stdio startStdioRuntime', () => {
  it('composes startStdioServer with the stdio transport startup', async () => {
    const startServer = vi.fn(async (options: { startTransport: () => Promise<void> }) => {
      await options.startTransport();
    });
    const startTransport = vi.fn(async () => undefined);

    await startStdioRuntime(
      {
        initTelemetry: vi.fn(async () => undefined),
        validateEnv: vi.fn(),
        verifyToolIntegrity: vi.fn(async () => undefined),
        initialize: vi.fn(async () => undefined),
        shutdown: vi.fn(async () => undefined),
        getProcessBreadcrumbs: () => ({ phase: 'start' }),
        server: { connect: vi.fn(async () => undefined) } as unknown as import('../../../packages/mcp-stdio/src/start-stdio-transport.js').StdioConnectableServer<import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport>,
        ensureResourcesRegistered: vi.fn(async () => undefined),
        getIsShutdown: vi.fn(() => false),
        toolCount: 25,
        actionCount: 407,
        log: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      },
      {
        startServer,
        startTransport,
      }
    );

    expect(startServer).toHaveBeenCalledOnce();
    expect(startTransport).toHaveBeenCalledOnce();
    expect(startTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        server: { kind: 'server' },
        toolCount: 25,
        actionCount: 407,
      })
    );
  });
});
