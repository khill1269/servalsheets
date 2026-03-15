import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startupMocks = vi.hoisted(() => ({
  registerServerResources: vi.fn(),
  validateEnv: vi.fn(),
}));

vi.mock('../../src/server-runtime/resource-registration.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/server-runtime/resource-registration.js')>();
  return {
    ...actual,
    registerServerResources: startupMocks.registerServerResources,
  };
});

vi.mock('../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env.js')>();
  return {
    ...actual,
    validateEnv: startupMocks.validateEnv,
  };
});

import { ServalSheetsServer } from '../../src/server.js';

describe('server resource registration safeguards', () => {
  beforeEach(() => {
    startupMocks.validateEnv.mockImplementation(() => undefined);
    startupMocks.registerServerResources.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('swallows duplicate registration errors from the SDK', async () => {
    startupMocks.registerServerResources.mockRejectedValueOnce(
      new Error('Resource already registered')
    );

    const server = new ServalSheetsServer();

    await expect(
      (
        server as unknown as {
          registerResources: () => Promise<void>;
        }
      ).registerResources()
    ).resolves.toBeUndefined();
  });

  it('rethrows non-duplicate registration errors', async () => {
    startupMocks.registerServerResources.mockRejectedValueOnce(new Error('network failed'));

    const server = new ServalSheetsServer();

    await expect(
      (
        server as unknown as {
          registerResources: () => Promise<void>;
        }
      ).registerResources()
    ).rejects.toThrow('network failed');
  });

  it('registers resources before connect when startup left discovery deferred', async () => {
    const server = new ServalSheetsServer();

    vi.spyOn(server, 'initialize').mockResolvedValue(undefined);
    const registerResourcesSpy = vi
      .spyOn(
        server as unknown as {
          registerResources: () => Promise<void>;
        },
        'registerResources'
      )
      .mockResolvedValue(undefined);
    const connectSpy = vi.spyOn(server.server, 'connect').mockImplementation(async () => undefined);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await server.start();

    expect(registerResourcesSpy).toHaveBeenCalledTimes(1);
    expect(registerResourcesSpy.mock.invocationCallOrder[0]).toBeLessThan(
      connectSpy.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(
      (
        server as unknown as {
          resourcesRegistered: boolean;
        }
      ).resourcesRegistered
    ).toBe(true);

    await server.shutdown();
  });
});
