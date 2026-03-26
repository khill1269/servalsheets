import { describe, expect, it, vi } from 'vitest';
import { startStdioServer } from '../../../packages/mcp-stdio/src/start-stdio-server.js';

describe('@serval/mcp-stdio startStdioServer', () => {
  it('runs init, registers lifecycle handlers, and starts transport', async () => {
    const initTelemetry = vi.fn(async () => {});
    const validateEnv = vi.fn();
    const verifyToolIntegrity = vi.fn(async () => {});
    const initialize = vi.fn(async () => {});
    const shutdown = vi.fn(async () => {});
    const startTransport = vi.fn(async () => {});
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const listeners = new Map<string, (...args: unknown[]) => void | Promise<void>>();
    const processLike = {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void | Promise<void>) => {
        listeners.set(event, listener);
      }),
      exit: vi.fn(),
    };

    await startStdioServer({
      initTelemetry,
      validateEnv,
      verifyToolIntegrity,
      initialize,
      shutdown,
      startTransport,
      getProcessBreadcrumbs: () => ({ resourcesRegistered: false }),
      processLike,
      log,
    });

    expect(initTelemetry).toHaveBeenCalledOnce();
    expect(validateEnv).toHaveBeenCalledOnce();
    expect(verifyToolIntegrity).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledOnce();
    expect(startTransport).toHaveBeenCalledOnce();
    expect(processLike.on).toHaveBeenCalledTimes(5);
    expect(listeners.has('SIGINT')).toBe(true);
    expect(listeners.has('SIGTERM')).toBe(true);
    expect(listeners.has('SIGHUP')).toBe(true);
    expect(listeners.has('uncaughtException')).toBe(true);
    expect(listeners.has('unhandledRejection')).toBe(true);
    expect(log.info).toHaveBeenCalledWith('[Phase 1/3] Initializing handlers...');
  });

  it('shuts down and exits when a registered shutdown signal fires', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void | Promise<void>>();
    const shutdown = vi.fn(async () => {});
    const processLike = {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void | Promise<void>) => {
        listeners.set(event, listener);
      }),
      exit: vi.fn(),
    };
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await startStdioServer({
      initTelemetry: async () => {},
      validateEnv: () => {},
      verifyToolIntegrity: async () => {},
      initialize: async () => {},
      shutdown,
      startTransport: async () => {},
      getProcessBreadcrumbs: () => ({}),
      processLike,
      log,
    });

    const sigintHandler = listeners.get('SIGINT');
    expect(sigintHandler).toBeDefined();

    await sigintHandler?.();

    expect(log.warn).toHaveBeenCalledWith('ServalSheets: Received SIGINT, shutting down...');
    expect(shutdown).toHaveBeenCalledOnce();
    expect(processLike.exit).toHaveBeenCalledWith(0);
  });
});
