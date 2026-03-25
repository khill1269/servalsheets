import { describe, expect, it, vi } from 'vitest';

import {
  ensureStdioResourcesRegistered,
  registerStdioResources,
} from '../../../packages/mcp-stdio/src/register-stdio-resources.js';

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('@serval/mcp-stdio registerStdioResources', () => {
  it('swallows duplicate registration errors', async () => {
    const log = createLogger();

    await expect(
      registerStdioResources(false, {
        registerResources: vi.fn(async () => {
          throw new Error('resource already registered');
        }),
        log,
      })
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('skips work when resources are already registered', async () => {
    const registerResourcesFn = vi.fn(async () => undefined);

    await registerStdioResources(true, {
      registerResources: registerResourcesFn,
      log: createLogger(),
    });

    expect(registerResourcesFn).not.toHaveBeenCalled();
  });
});

describe('@serval/mcp-stdio ensureStdioResourcesRegistered', () => {
  it('registers resources once and updates state', async () => {
    let resourcesRegistered = false;
    let resourceRegistrationPromise: Promise<void> | null = null;
    let resourceRegistrationFailed = false;

    await ensureStdioResourcesRegistered(
      {
        get resourcesRegistered() {
          return resourcesRegistered;
        },
        get resourceRegistrationPromise() {
          return resourceRegistrationPromise;
        },
        get resourceRegistrationFailed() {
          return resourceRegistrationFailed;
        },
        setResourcesRegistered: (value) => {
          resourcesRegistered = value;
        },
        setResourceRegistrationPromise: (value) => {
          resourceRegistrationPromise = value;
        },
        setResourceRegistrationFailed: (value) => {
          resourceRegistrationFailed = value;
        },
      },
      {
        registerResources: vi.fn(async () => undefined),
        log: createLogger(),
      }
    );

    expect(resourcesRegistered).toBe(true);
    expect(resourceRegistrationPromise).toBeNull();
    expect(resourceRegistrationFailed).toBe(false);
  });

  it('poisons retries after registration failure', async () => {
    let resourcesRegistered = false;
    let resourceRegistrationPromise: Promise<void> | null = null;
    let resourceRegistrationFailed = false;

    await expect(
      ensureStdioResourcesRegistered(
        {
          get resourcesRegistered() {
            return resourcesRegistered;
          },
          get resourceRegistrationPromise() {
            return resourceRegistrationPromise;
          },
          get resourceRegistrationFailed() {
            return resourceRegistrationFailed;
          },
          setResourcesRegistered: (value) => {
            resourcesRegistered = value;
          },
          setResourceRegistrationPromise: (value) => {
            resourceRegistrationPromise = value;
          },
          setResourceRegistrationFailed: (value) => {
            resourceRegistrationFailed = value;
          },
        },
        {
          registerResources: vi.fn(async () => {
            throw new Error('boom');
          }),
          log: createLogger(),
        }
      )
    ).rejects.toThrow('boom');

    expect(resourceRegistrationFailed).toBe(true);
    expect(resourceRegistrationPromise).toBeNull();
    expect(resourcesRegistered).toBe(false);
  });
});
