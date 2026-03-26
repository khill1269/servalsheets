import { describe, expect, it, vi } from 'vitest';
import { registerHttpSurfaceRoutes } from '../../src/http-server/route-surface.js';

describe('http route surface helper', () => {
  it('registers support routes with the expected dependencies', () => {
    const app = {} as never;
    const sessions = new Map<string, unknown>([['session-1', { active: true }]]);
    const getUserRateLimiter = vi.fn(() => ({ kind: 'limiter' } as never));
    const registerWellKnownHandlers = vi.fn();
    const registerHttpObservabilityRoutes = vi.fn();
    const registerHttpWebhookRoutes = vi.fn();
    const registerApiRoutes = vi.fn();
    const registerHttpErrorHandler = vi.fn();
    const registerHttpGraphQlAndAdmin = vi.fn();
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpSurfaceRoutes({
      app,
      corsOrigins: ['https://claude.ai'],
      rateLimitMax: 100,
      legacySseEnabled: false,
      authenticationRequired: true,
      healthService: { kind: 'health-service' } as never,
      observabilityOptions: {
        enableOAuth: true,
        oauthConfig: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        },
      },
      host: '127.0.0.1',
      port: 3000,
      getSessionCount: () => sessions.size,
      getUserRateLimiter,
      sessions,
      log: log as never,
      registerWellKnownHandlers: registerWellKnownHandlers as never,
      registerHttpObservabilityRoutes: registerHttpObservabilityRoutes as never,
      registerHttpWebhookRoutes: registerHttpWebhookRoutes as never,
      registerApiRoutes: registerApiRoutes as never,
      registerHttpErrorHandler: registerHttpErrorHandler as never,
      registerHttpGraphQlAndAdmin: registerHttpGraphQlAndAdmin as never,
    });

    expect(registerWellKnownHandlers).toHaveBeenCalledWith(app, {
      corsOrigins: ['https://claude.ai'],
      rateLimitMax: 100,
      legacySseEnabled: false,
      authenticationRequired: true,
    });
    expect(registerHttpObservabilityRoutes).toHaveBeenCalledWith({
      app,
      healthService: { kind: 'health-service' },
      options: {
        enableOAuth: true,
        oauthConfig: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        },
      },
      host: '127.0.0.1',
      port: 3000,
      legacySseEnabled: false,
      getSessionCount: expect.any(Function),
      getUserRateLimiter,
    });
    const observabilityArgs = registerHttpObservabilityRoutes.mock.calls[0]?.[0];
    expect(observabilityArgs.getSessionCount()).toBe(1);
    expect(observabilityArgs.getUserRateLimiter()).toEqual({ kind: 'limiter' });
    expect(registerHttpWebhookRoutes).toHaveBeenCalledWith(app);
    expect(registerApiRoutes).toHaveBeenCalledWith(app, { samplingServer: null });
    expect(log.info).toHaveBeenCalledWith('HTTP Server: =SERVAL() API enabled (POST /api/formula-eval)');
    expect(registerHttpErrorHandler).toHaveBeenCalledWith(app, { log });
    expect(registerHttpGraphQlAndAdmin).toHaveBeenCalledWith({
      app,
      sessions,
    });
  });
});
