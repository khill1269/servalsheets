import { describe, expect, it, vi } from 'vitest';
import { bootstrapHttpTransportSessions } from '../../src/http-server/transport-bootstrap.js';

describe('http transport bootstrap helper', () => {
  it('creates the session map and wires transport registration', async () => {
    const sessionCleanupInterval = { kind: 'interval' } as never;
    const cleanupSessions = vi.fn();
    const registerHttpTransportRoutes = vi.fn(() => ({
      sessionCleanupInterval,
      cleanupSessions,
    }));
    const createHttpMcpServerInstance = vi.fn(async () => ({
      mcpServer: { kind: 'mcp-server' },
      taskStore: { kind: 'task-store' },
      disposeRuntime: vi.fn(),
    }));
    const loggingBridge = {
      subscribers: new Map(),
      installLoggingBridge: vi.fn(),
    };

    const result = bootstrapHttpTransportSessions({
      app: {} as never,
      enableOAuth: true,
      oauth: { kind: 'oauth' } as never,
      legacySseEnabled: false,
      host: '127.0.0.1',
      port: 3000,
      eventStoreRedisUrl: 'redis://localhost:6379',
      eventStoreTtlMs: 30000,
      eventStoreMaxEvents: 100,
      sessionTimeoutMs: 60000,
      loggingBridge,
      createHttpMcpServerInstance: createHttpMcpServerInstance as never,
      registerHttpTransportRoutes: registerHttpTransportRoutes as never,
    });

    expect(result.sessions).toBeInstanceOf(Map);
    expect(result.sessionCleanupInterval).toBe(sessionCleanupInterval);
    expect(result.cleanupSessions).toBe(cleanupSessions);
    expect(registerHttpTransportRoutes).toHaveBeenCalledOnce();

    const transportArgs = registerHttpTransportRoutes.mock.calls[0]?.[0];
    expect(transportArgs.sessions).toBe(result.sessions);
    expect(transportArgs.enableOAuth).toBe(true);
    expect(transportArgs.oauth).toEqual({ kind: 'oauth' });
    expect(transportArgs.host).toBe('127.0.0.1');
    expect(transportArgs.port).toBe(3000);

    await transportArgs.createMcpServerInstance('access-token', 'refresh-token', 'session-1');

    expect(createHttpMcpServerInstance).toHaveBeenCalledWith({
      googleToken: 'access-token',
      googleRefreshToken: 'refresh-token',
      sessionId: 'session-1',
      subscribers: loggingBridge.subscribers,
      installLoggingBridge: loggingBridge.installLoggingBridge,
    });
  });
});
