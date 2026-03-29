import { describe, expect, it, vi } from 'vitest';

import { createHttpServer } from '../../../packages/mcp-http/src/create-http-server.js';

describe('@serval/mcp-http createHttpServer', () => {
  it('orchestrates the HTTP server runtime and returns lifecycle handles', () => {
    const app = { use: vi.fn() };
    const envConfig = {
      ENABLE_TENANT_ISOLATION: true,
      ENABLE_RBAC: false,
      SESSION_TIMEOUT_MS: 60000,
      ENABLE_METRICS_SERVER: true,
      METRICS_PORT: 9090,
      METRICS_HOST: '127.0.0.1',
    };
    const loggingBridge = {
      subscribers: new Map(),
      installLoggingBridge: vi.fn(),
    };
    const ensureToolIntegrityVerified = { run: vi.fn(async () => {}) };
    const sessions = new Map([['session-1', { kind: 'session' }]]);
    const getUserRateLimiter = vi.fn(() => null);
    const cleanupSessions = vi.fn();
    const rateLimiterReady = Promise.resolve();
    const initializeRbac = vi.fn(async () => {});
    const lifecycle = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    const dependencies = {
      defaultPort: 3000,
      defaultHost: '127.0.0.1',
      createApp: vi.fn(() => app),
      getEnvConfig: vi.fn(() => envConfig),
      getSharedHttpLoggingBridge: vi.fn(() => loggingBridge),
      createEnsureToolIntegrityVerified: vi.fn(() => ensureToolIntegrityVerified),
      resolveHttpServerRuntimeConfig: vi.fn(() => ({
        port: 4100,
        host: '0.0.0.0',
        corsOrigins: ['https://client.example'],
        rateLimitWindowMs: 15000,
        rateLimitMax: 25,
        trustProxy: true,
        legacySseEnabled: false,
        eventStoreRedisUrl: 'redis://localhost:6379',
        eventStoreTtlMs: 120000,
        eventStoreMaxEvents: 250,
      })),
      createHealthService: vi.fn(() => ({ kind: 'health-service' })),
      registerHttpFoundationMiddleware: vi.fn(),
      registerHttpAuthProviders: vi.fn(() => ({ oauth: { kind: 'oauth-provider' } })),
      prepareHttpRateLimiter: vi.fn(() => ({
        rateLimiterReady,
        getUserRateLimiter,
        middleware: 'per-user-rate-limit',
      })),
      createHttpRbacInitializer: vi.fn(() => initializeRbac),
      registerHttpRequestContextMiddleware: vi.fn(),
      registerHttpEnterpriseMiddleware: vi.fn(),
      bootstrapHttpTransportSessions: vi.fn(() => ({
        sessions,
        sessionCleanupInterval: { kind: 'interval' } as unknown as NodeJS.Timeout,
        cleanupSessions,
      })),
      registerHttpSurfaceRoutes: vi.fn(),
      createHttpServerLifecycle: vi.fn(() => lifecycle),
      createMetricsExporter: vi.fn(() => ({ kind: 'metrics-exporter' })),
      startMetricsServer: vi.fn(async () => ({ kind: 'metrics-server' })),
      stopMetricsServer: vi.fn(async () => {}),
      initTelemetry: vi.fn(async () => {}),
      onShutdown: vi.fn(),
      redisUrl: 'redis://localhost:6379',
      sessionStoreType: 'redis',
      toolCount: 25,
      actionCount: 407,
      log,
    };

    const result = createHttpServer(
      {
        enableOAuth: true,
        oauthConfig: { issuer: 'https://issuer.example' },
      },
      dependencies
    );

    expect(dependencies.resolveHttpServerRuntimeConfig).toHaveBeenCalledWith({
      envConfig,
      options: {
        enableOAuth: true,
        oauthConfig: { issuer: 'https://issuer.example' },
      },
      defaultPort: 3000,
      defaultHost: '127.0.0.1',
      log,
    });
    expect(dependencies.registerHttpFoundationMiddleware).toHaveBeenCalledWith({
      app,
      corsOrigins: ['https://client.example'],
      trustProxy: true,
      rateLimitWindowMs: 15000,
      rateLimitMax: 25,
    });
    expect(app.use).toHaveBeenCalledWith('per-user-rate-limit');
    expect(dependencies.registerHttpRequestContextMiddleware).toHaveBeenCalledWith(app);
    expect(dependencies.registerHttpEnterpriseMiddleware).toHaveBeenCalledWith(app, {
      enableTenantIsolation: true,
      enableRbac: false,
      log,
    });
    expect(dependencies.bootstrapHttpTransportSessions).toHaveBeenCalledWith({
      app,
      enableOAuth: true,
      oauth: { kind: 'oauth-provider' },
      legacySseEnabled: false,
      host: '0.0.0.0',
      port: 4100,
      eventStoreRedisUrl: 'redis://localhost:6379',
      eventStoreTtlMs: 120000,
      eventStoreMaxEvents: 250,
      sessionTimeoutMs: 60000,
      loggingBridge,
    });
    expect(dependencies.registerHttpSurfaceRoutes).toHaveBeenCalledWith({
      app,
      corsOrigins: ['https://client.example'],
      rateLimitMax: 25,
      legacySseEnabled: false,
      authenticationRequired: true,
      healthService: { kind: 'health-service' },
      observabilityOptions: {
        enableOAuth: true,
        oauthConfig: { issuer: 'https://issuer.example' },
      },
      host: '0.0.0.0',
      port: 4100,
      getSessionCount: expect.any(Function),
      getUserRateLimiter,
      sessions,
      log,
    });
    expect(dependencies.createHttpServerLifecycle).toHaveBeenCalledWith({
      app,
      host: '0.0.0.0',
      port: 4100,
      legacySseEnabled: false,
      clearSessionCleanupInterval: expect.any(Function),
      cleanupSessions,
      getSessionCount: expect.any(Function),
      ensureToolIntegrityVerified,
      rateLimiterReady,
      initializeRbac,
      enableMetricsServer: true,
      metricsPort: 9090,
      metricsHost: '127.0.0.1',
      createMetricsExporter: dependencies.createMetricsExporter,
      startMetricsServer: dependencies.startMetricsServer,
      stopMetricsServer: dependencies.stopMetricsServer,
      initTelemetry: dependencies.initTelemetry,
      onShutdown: dependencies.onShutdown,
      toolCount: 25,
      actionCount: 407,
      log,
    });

    expect(result).toEqual({
      app,
      start: lifecycle.start,
      stop: lifecycle.stop,
      sessions,
    });
  });
});
