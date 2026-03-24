import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpServerLifecycle } from '../../src/http-server/server-lifecycle.js';

function createListeningServerDouble() {
  const listeners = new Map<string, (error?: Error) => void>();
  return {
    listeners,
    once: vi.fn((event: 'error' | 'listening', listener: (error?: Error) => void) => {
      listeners.set(event, listener);
    }),
    close: vi.fn((callback: (error?: Error | null) => void) => {
      callback();
    }),
  };
}

describe('http server lifecycle helper', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the HTTP server, logs endpoints, and optionally starts the metrics server', async () => {
    const listeningServer = createListeningServerDouble();
    const app = {
      listen: vi.fn(() => {
        queueMicrotask(() => {
          listeningServer.listeners.get('listening')?.();
        });
        return listeningServer;
      }),
    };
    const initTelemetry = vi.fn(async () => undefined);
    const ensureToolIntegrityVerified = {
      run: vi.fn(async () => undefined),
    };
    const initializeRbac = vi.fn(async () => undefined);
    const createMetricsExporter = vi.fn(() => ({ kind: 'exporter' }));
    const startMetricsServer = vi.fn(async () => ({ kind: 'metrics-server' }));
    const stopMetricsServer = vi.fn(async () => undefined);
    const onShutdown = vi.fn();
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    const lifecycle = createHttpServerLifecycle({
      app: app as never,
      host: '127.0.0.1',
      port: 3000,
      legacySseEnabled: false,
      clearSessionCleanupInterval: vi.fn(),
      cleanupSessions: vi.fn(),
      getSessionCount: () => 0,
      ensureToolIntegrityVerified,
      rateLimiterReady: Promise.resolve(),
      initializeRbac,
      enableMetricsServer: true,
      metricsPort: 3001,
      metricsHost: '127.0.0.1',
      createMetricsExporter,
      startMetricsServer,
      stopMetricsServer,
      initTelemetry,
      onShutdown,
      toolCount: 25,
      actionCount: 407,
      log: log as never,
    });

    await lifecycle.start();

    expect(initTelemetry).toHaveBeenCalledOnce();
    expect(ensureToolIntegrityVerified.run).toHaveBeenCalledOnce();
    expect(initializeRbac).toHaveBeenCalledOnce();
    expect(app.listen).toHaveBeenCalledWith(3000, '127.0.0.1');
    expect(createMetricsExporter).toHaveBeenCalledOnce();
    expect(startMetricsServer).toHaveBeenCalledWith({
      port: 3001,
      host: '127.0.0.1',
      exporter: { kind: 'exporter' },
    });
    expect(log.info).toHaveBeenCalledWith('ServalSheets HTTP server listening on 127.0.0.1:3000');
    expect(log.info).toHaveBeenCalledWith('Legacy SSE endpoints disabled (use /mcp)');
    expect(log.info).toHaveBeenCalledWith('HTTP endpoint: http://127.0.0.1:3000/mcp');
    expect(log.info).toHaveBeenCalledWith('Health check: http://127.0.0.1:3000/health');
    expect(log.info).toHaveBeenCalledWith('Metrics: 25 tools, 407 actions');
    expect(onShutdown).toHaveBeenCalledTimes(4);
  });

  it('stops listener, metrics server, interval, and sessions', async () => {
    const listeningServer = createListeningServerDouble();
    const clearSessionCleanupInterval = vi.fn();
    const cleanupSessions = vi.fn();
    const stopMetricsServer = vi.fn(async () => undefined);

    const lifecycle = createHttpServerLifecycle({
      app: {
        listen: vi.fn(() => {
          queueMicrotask(() => {
            listeningServer.listeners.get('listening')?.();
          });
          return listeningServer;
        }),
      } as never,
      host: '127.0.0.1',
      port: 3000,
      legacySseEnabled: true,
      clearSessionCleanupInterval,
      cleanupSessions,
      getSessionCount: () => 3,
      ensureToolIntegrityVerified: {
        run: vi.fn(async () => undefined),
      },
      rateLimiterReady: Promise.resolve(),
      initializeRbac: vi.fn(async () => undefined),
      enableMetricsServer: true,
      metricsPort: 3001,
      metricsHost: '127.0.0.1',
      createMetricsExporter: () => ({ kind: 'exporter' }),
      startMetricsServer: vi.fn(async () => ({ kind: 'metrics-server' })),
      stopMetricsServer,
      initTelemetry: vi.fn(async () => undefined),
      onShutdown: vi.fn(),
      toolCount: 25,
      actionCount: 407,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
      } as never,
    });

    await lifecycle.start();
    await lifecycle.stop();

    expect(clearSessionCleanupInterval).toHaveBeenCalledOnce();
    expect(cleanupSessions).toHaveBeenCalledOnce();
    expect(stopMetricsServer).toHaveBeenCalledWith({ kind: 'metrics-server' });
    expect(listeningServer.close).toHaveBeenCalledOnce();
  });
});
