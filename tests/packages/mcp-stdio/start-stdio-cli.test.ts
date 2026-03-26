import { describe, expect, it, vi } from 'vitest';

import { startStdioCli } from '../../../packages/mcp-stdio/src/start-stdio-cli.js';

describe('@serval/mcp-stdio startStdioCli', () => {
  it('starts the stdio server and logs success', async () => {
    const serverOptions = { name: 'servalsheets' };
    const createServalSheetsServer = vi.fn(async () => ({ kind: 'server' }));
    const log = {
      info: vi.fn(),
    };

    await startStdioCli({
      serverOptions,
      createServalSheetsServer,
      log,
    });

    expect(createServalSheetsServer).toHaveBeenCalledWith(serverOptions);
    expect(log.info).toHaveBeenCalledWith('ServalSheets STDIO server started successfully');
  });
});
