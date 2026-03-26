import { describe, expect, it, vi } from 'vitest';

import { createStdioServer } from '../../../packages/mcp-stdio/src/create-stdio-server.js';

describe('@serval/mcp-stdio createStdioServer', () => {
  it('prepares bootstrap, creates the server, starts it, and returns the instance', async () => {
    const options = { name: 'servalsheets', version: '2.0.0' };
    const server = { start: vi.fn(async () => {}) };
    const prepareBootstrap = vi.fn(async () => {});
    const createServer = vi.fn(() => server);
    const startServer = vi.fn(async () => {});

    const result = await createStdioServer(options, {
      prepareBootstrap,
      createServer,
      startServer,
    });

    expect(prepareBootstrap).toHaveBeenCalledWith(options);
    expect(createServer).toHaveBeenCalledWith(options);
    expect(startServer).toHaveBeenCalledWith(server);
    expect(result).toBe(server);
  });
});
