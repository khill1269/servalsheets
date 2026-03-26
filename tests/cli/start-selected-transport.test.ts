import { describe, expect, it, vi } from 'vitest';

import { startSelectedCliTransport } from '../../src/cli/start-selected-transport.js';

describe('startSelectedCliTransport', () => {
  it('starts the HTTP server for http transport', async () => {
    const startHttpServer = vi.fn(async () => undefined);
    const log = { info: vi.fn() };

    await startSelectedCliTransport(
      { transport: 'http', port: 8080 },
      { name: 'servalsheets' },
      {
        startStdioCli: vi.fn(async () => undefined),
        loadHttpServer: async () => ({ startHttpServer }),
        env: {},
        log: log as never,
      }
    );

    expect(startHttpServer).toHaveBeenCalledWith({
      port: 8080,
      name: 'servalsheets',
    });
    expect(log.info).toHaveBeenCalledWith('ServalSheets HTTP server started on port 8080');
  });

  it('starts stdio transport for stdio mode', async () => {
    const startStdioCli = vi.fn(async () => undefined);
    const createServalSheetsServer = vi.fn(async () => ({ kind: 'server' }));

    await startSelectedCliTransport(
      { transport: 'stdio' },
      { version: '1.2.3' },
      {
        startStdioCli,
        loadStdioServer: async () => ({ createServalSheetsServer }),
        env: {},
        log: { info: vi.fn() } as never,
      }
    );

    expect(startStdioCli).toHaveBeenCalledWith({
      serverOptions: { version: '1.2.3' },
      createServalSheetsServer,
      log: expect.any(Object),
    });
  });
});
