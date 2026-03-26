import { describe, expect, it, vi } from 'vitest';
import { runHttpServerDirectEntry } from '../../src/http-server/direct-entry.js';

describe('http direct entry helper', () => {
  it('runs the startup sequence and starts the HTTP server', async () => {
    const startHttpServer = vi.fn(async () => undefined);
    const logEnvironmentConfig = vi.fn();
    const startBackgroundTasks = vi.fn(async () => undefined);
    const registerSignalHandlers = vi.fn();
    const log = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await runHttpServerDirectEntry({
      startHttpServer,
      logEnvironmentConfig,
      startBackgroundTasks,
      registerSignalHandlers,
      port: 4100,
      log: log as never,
      exit: vi.fn(),
    });

    expect(logEnvironmentConfig).toHaveBeenCalledOnce();
    expect(startBackgroundTasks).toHaveBeenCalledOnce();
    expect(registerSignalHandlers).toHaveBeenCalledOnce();
    expect(startHttpServer).toHaveBeenCalledWith({ port: 4100 });
    expect(log.info).toHaveBeenCalledWith('ServalSheets HTTP server started successfully');
  });

  it('logs and exits when startup fails', async () => {
    const error = new Error('startup failed');
    const exit = vi.fn();
    const log = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await runHttpServerDirectEntry({
      startHttpServer: vi.fn(async () => {
        throw error;
      }),
      logEnvironmentConfig: vi.fn(),
      startBackgroundTasks: vi.fn(async () => undefined),
      registerSignalHandlers: vi.fn(),
      port: 4100,
      log: log as never,
      exit,
    });

    expect(log.error).toHaveBeenCalledWith('Failed to start HTTP server', { error });
    expect(exit).toHaveBeenCalledWith(1);
  });
});
