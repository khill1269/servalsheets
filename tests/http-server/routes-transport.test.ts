import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routesTransportMocks = vi.hoisted(() => ({
  sessionsTotal: { set: vi.fn() },
  extractIdempotencyKeyFromHeaders: vi.fn(),
  createResourceIndicatorValidator: vi.fn(() => ({ kind: 'validator' })),
  optionalResourceIndicatorMiddleware: vi.fn(
    () => async (_req: unknown, _res: unknown, next: () => void) => next()
  ),
  removeSessionContext: vi.fn(),
  extractPrincipalIdFromHeaders: vi.fn(),
  createRequestContext: vi.fn(() => ({ kind: 'request-context' })),
  runWithRequestContext: vi.fn(async (_context: unknown, fn: () => Promise<unknown>) => await fn()),
  sessionLimiter: {
    canCreateSession: vi.fn(() => ({ allowed: true })),
    registerSession: vi.fn(),
    unregisterSession: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  clearSessionEventStore: vi.fn(),
  createSessionEventStore: vi.fn(() => ({ kind: 'event-store' })),
  createSessionSecurityContext: vi.fn(() => ({ kind: 'security-context' })),
  normalizeMcpSessionHeader: vi.fn(),
  verifySessionSecurityContext: vi.fn(() => ({ valid: true })),
}));

vi.mock('../../src/observability/metrics.js', () => ({
  sessionsTotal: routesTransportMocks.sessionsTotal,
}));

vi.mock('../../src/utils/idempotency-key-generator.js', () => ({
  extractIdempotencyKeyFromHeaders: routesTransportMocks.extractIdempotencyKeyFromHeaders,
}));

vi.mock('../../src/security/index.js', () => ({
  createResourceIndicatorValidator: routesTransportMocks.createResourceIndicatorValidator,
  optionalResourceIndicatorMiddleware: routesTransportMocks.optionalResourceIndicatorMiddleware,
}));

vi.mock('../../src/services/session-context.js', () => ({
  removeSessionContext: routesTransportMocks.removeSessionContext,
}));

vi.mock('../../src/server/request-extraction.ts', () => ({
  extractPrincipalIdFromHeaders: routesTransportMocks.extractPrincipalIdFromHeaders,
}));

vi.mock('../../src/utils/request-context.js', () => ({
  createRequestContext: routesTransportMocks.createRequestContext,
  runWithRequestContext: routesTransportMocks.runWithRequestContext,
}));

vi.mock('../../src/utils/session-limiter.js', () => ({
  sessionLimiter: routesTransportMocks.sessionLimiter,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: routesTransportMocks.logger,
}));

vi.mock('../../src/http-server/transport-helpers.js', () => ({
  clearSessionEventStore: routesTransportMocks.clearSessionEventStore,
  createSessionEventStore: routesTransportMocks.createSessionEventStore,
  createSessionSecurityContext: routesTransportMocks.createSessionSecurityContext,
  normalizeMcpSessionHeader: routesTransportMocks.normalizeMcpSessionHeader,
  verifySessionSecurityContext: routesTransportMocks.verifySessionSecurityContext,
}));

import { registerHttpTransportRoutes } from '../../src/http-server/routes-transport.js';

describe('http transport routes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T12:00:00.000Z'));

    routesTransportMocks.sessionsTotal.set.mockReset();
    routesTransportMocks.extractIdempotencyKeyFromHeaders.mockReset();
    routesTransportMocks.createResourceIndicatorValidator.mockClear();
    routesTransportMocks.optionalResourceIndicatorMiddleware.mockClear();
    routesTransportMocks.removeSessionContext.mockReset();
    routesTransportMocks.extractPrincipalIdFromHeaders.mockReset();
    routesTransportMocks.createRequestContext.mockReset();
    routesTransportMocks.runWithRequestContext.mockReset();
    routesTransportMocks.sessionLimiter.canCreateSession.mockReset();
    routesTransportMocks.sessionLimiter.registerSession.mockReset();
    routesTransportMocks.sessionLimiter.unregisterSession.mockReset();
    routesTransportMocks.logger.info.mockReset();
    routesTransportMocks.logger.warn.mockReset();
    routesTransportMocks.logger.error.mockReset();
    routesTransportMocks.clearSessionEventStore.mockReset();
    routesTransportMocks.createSessionEventStore.mockReset();
    routesTransportMocks.createSessionSecurityContext.mockReset();
    routesTransportMocks.normalizeMcpSessionHeader.mockReset();
    routesTransportMocks.verifySessionSecurityContext.mockReset();

    routesTransportMocks.createResourceIndicatorValidator.mockReturnValue({ kind: 'validator' });
    routesTransportMocks.optionalResourceIndicatorMiddleware.mockReturnValue(
      async (_req: unknown, _res: unknown, next: () => void) => next()
    );
    routesTransportMocks.createRequestContext.mockReturnValue({ kind: 'request-context' });
    routesTransportMocks.runWithRequestContext.mockImplementation(
      async (_context: unknown, fn: () => Promise<unknown>) => await fn()
    );
    routesTransportMocks.sessionLimiter.canCreateSession.mockReturnValue({ allowed: true });
    routesTransportMocks.createSessionEventStore.mockReturnValue({ kind: 'event-store' });
    routesTransportMocks.createSessionSecurityContext.mockReturnValue({
      kind: 'security-context',
    });
    routesTransportMocks.verifySessionSecurityContext.mockReturnValue({ valid: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('evicts idle sessions and disposes their runtime state', async () => {
    const app = {
      get: vi.fn(),
      post: vi.fn(),
      all: vi.fn(),
      delete: vi.fn(),
    };
    const transport = { close: vi.fn() };
    const taskStore = { dispose: vi.fn() };
    const disposeRuntime = vi.fn();
    const eventStore = { clear: vi.fn(), replayEventsAfter: vi.fn() };
    const sessions = new Map([
      [
        'session-1',
        {
          transport,
          mcpServer: { connect: vi.fn() },
          taskStore,
          disposeRuntime,
          eventStore,
          securityContext: { owner: 'user-1' },
          lastActivity: 0,
        },
      ],
    ]);

    const { sessionCleanupInterval } = registerHttpTransportRoutes({
      app: app as never,
      enableOAuth: false,
      oauth: null,
      legacySseEnabled: false,
      host: '127.0.0.1',
      port: 3000,
      eventStoreRedisUrl: undefined,
      eventStoreTtlMs: 60_000,
      eventStoreMaxEvents: 100,
      sessionTimeoutMs: 1_000,
      sessions: sessions as never,
      createMcpServerInstance: vi.fn(async () => ({
        mcpServer: { connect: vi.fn() },
        taskStore: { dispose: vi.fn() },
        disposeRuntime: vi.fn(),
      })),
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(sessions.has('session-1')).toBe(false);
    expect(routesTransportMocks.sessionsTotal.set).toHaveBeenCalledWith(0);
    expect(routesTransportMocks.sessionLimiter.unregisterSession).toHaveBeenCalledWith('session-1');
    expect(routesTransportMocks.removeSessionContext).toHaveBeenCalledWith('session-1');
    expect(disposeRuntime).toHaveBeenCalledOnce();
    expect(taskStore.dispose).toHaveBeenCalledOnce();
    expect(routesTransportMocks.clearSessionEventStore).toHaveBeenCalledWith(eventStore);
    expect(transport.close).toHaveBeenCalledOnce();
    expect(routesTransportMocks.logger.info).toHaveBeenCalledWith('Evicted idle session', {
      sessionId: 'session-1',
    });

    clearInterval(sessionCleanupInterval);
  });

  it('uses server-held Google token for OAuth streamable HTTP runtime creation', async () => {
    const app = {
      get: vi.fn(),
      post: vi.fn(),
      all: vi.fn(),
      delete: vi.fn(),
    };
    const createMcpServerInstance = vi.fn(async () => {
      throw new Error('stop after runtime token capture');
    });
    const oauth = {
      getGoogleToken: vi.fn(async () => 'google-access-token'),
      validateToken: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    };
    routesTransportMocks.normalizeMcpSessionHeader.mockReturnValue(undefined);

    const { sessionCleanupInterval } = registerHttpTransportRoutes({
      app: app as never,
      enableOAuth: true,
      oauth: oauth as never,
      legacySseEnabled: false,
      host: '127.0.0.1',
      port: 3000,
      eventStoreRedisUrl: undefined,
      eventStoreTtlMs: 60_000,
      eventStoreMaxEvents: 100,
      sessionTimeoutMs: 1_000,
      sessions: new Map() as never,
      createMcpServerInstance,
    });

    const allArgs = app.all.mock.calls.find((call) => call[0] === '/mcp');
    expect(allArgs).toBeDefined();
    const handler = allArgs![allArgs!.length - 1] as (req: unknown, res: unknown) => Promise<void>;

    const req = {
      method: 'POST',
      path: '/mcp',
      headers: {
        authorization: 'Bearer mcp-access-token',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await handler(req, res);

    expect(oauth.getGoogleToken).toHaveBeenCalledWith(req);
    expect(createMcpServerInstance).toHaveBeenCalledWith(
      'google-access-token',
      undefined,
      expect.any(String)
    );
    expect(createMcpServerInstance).not.toHaveBeenCalledWith(
      'mcp-access-token',
      undefined,
      expect.any(String)
    );
    expect(routesTransportMocks.createSessionSecurityContext).toHaveBeenCalledWith(
      req,
      'mcp-access-token'
    );
    expect(res.status).toHaveBeenCalledWith(500);

    clearInterval(sessionCleanupInterval);
  });

  it('does NOT pass bearer token to Google when enableOAuth=false (Fix 1: no MCP token passthrough)', async () => {
    const app = {
      get: vi.fn(),
      post: vi.fn(),
      all: vi.fn(),
      delete: vi.fn(),
    };
    const createMcpServerInstance = vi.fn(async () => {
      throw new Error('stop after runtime token capture');
    });
    routesTransportMocks.normalizeMcpSessionHeader.mockReturnValue(undefined);

    const { sessionCleanupInterval } = registerHttpTransportRoutes({
      app: app as never,
      enableOAuth: false,
      oauth: null,
      legacySseEnabled: false,
      host: '127.0.0.1',
      port: 3000,
      eventStoreRedisUrl: undefined,
      eventStoreTtlMs: 60_000,
      eventStoreMaxEvents: 100,
      sessionTimeoutMs: 1_000,
      sessions: new Map() as never,
      createMcpServerInstance,
    });

    const allArgs = app.all.mock.calls.find((call) => call[0] === '/mcp');
    expect(allArgs).toBeDefined();
    const handler = allArgs![allArgs!.length - 1] as (req: unknown, res: unknown) => Promise<void>;

    const req = {
      method: 'POST',
      path: '/mcp',
      headers: {
        authorization: 'Bearer mcp-session-bearer-token',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await handler(req, res);

    // When enableOAuth=false, createMcpServerInstance MUST NOT receive the MCP
    // bearer token as the Google credential. It should receive undefined so the
    // Google client falls back to ADC (Application Default Credentials).
    if (createMcpServerInstance.mock.calls.length > 0) {
      expect(createMcpServerInstance).not.toHaveBeenCalledWith(
        'mcp-session-bearer-token',
        undefined,
        expect.any(String)
      );
      expect(createMcpServerInstance).toHaveBeenCalledWith(
        undefined,
        undefined,
        expect.any(String)
      );
    }

    clearInterval(sessionCleanupInterval);
  });
});
