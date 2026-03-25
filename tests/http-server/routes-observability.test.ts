import { describe, expect, it, vi } from 'vitest';
import { registerHttpObservabilityRoutes } from '../../src/http-server/routes-observability.js';

describe('http observability routes wrapper', () => {
  it('delegates to the extracted route registrars with shared session and limiter hooks', () => {
    const app = {} as never;
    const getUserRateLimiter = vi.fn(() => ({ kind: 'limiter' } as never));
    const registerHttpObservabilityCoreRoutes = vi.fn();
    const registerHttpOpenApiDocsRoutes = vi.fn();
    const registerHttpMetricsRoutes = vi.fn();
    const registerHttpWebhookDashboardRoutes = vi.fn();
    const registerHttpStatsRoutes = vi.fn();
    const registerHttpTraceRoutes = vi.fn();

    registerHttpObservabilityRoutes({
      app,
      healthService: { kind: 'health-service' } as never,
      options: {
        enableOAuth: true,
      },
      host: '127.0.0.1',
      port: 3000,
      legacySseEnabled: false,
      getSessionCount: () => 4,
      getUserRateLimiter,
      registerHttpObservabilityCoreRoutes: registerHttpObservabilityCoreRoutes as never,
      registerHttpOpenApiDocsRoutes: registerHttpOpenApiDocsRoutes as never,
      registerHttpMetricsRoutes: registerHttpMetricsRoutes as never,
      registerHttpWebhookDashboardRoutes: registerHttpWebhookDashboardRoutes as never,
      registerHttpStatsRoutes: registerHttpStatsRoutes as never,
      registerHttpTraceRoutes: registerHttpTraceRoutes as never,
    });

    expect(registerHttpObservabilityCoreRoutes).toHaveBeenCalledWith({
      app,
      healthService: { kind: 'health-service' },
      options: {
        enableOAuth: true,
      },
      host: '127.0.0.1',
      port: 3000,
      legacySseEnabled: false,
      getSessionCount: expect.any(Function),
    });
    expect(registerHttpOpenApiDocsRoutes).toHaveBeenCalledWith({ app });
    expect(registerHttpMetricsRoutes).toHaveBeenCalledWith(app);
    expect(registerHttpWebhookDashboardRoutes).toHaveBeenCalledWith(app);
    expect(registerHttpTraceRoutes).toHaveBeenCalledWith(app);
    expect(registerHttpStatsRoutes).toHaveBeenCalledWith(app, {
      getSessionCount: expect.any(Function),
      getUserRateLimiter: expect.any(Function),
    });

    const statsArgs = registerHttpStatsRoutes.mock.calls[0]?.[1];
    expect(statsArgs.getSessionCount()).toBe(4);
    expect(statsArgs.getUserRateLimiter()).toEqual({ kind: 'limiter' });
  });
});
