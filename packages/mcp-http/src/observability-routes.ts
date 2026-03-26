export interface RegisterHttpObservabilityRoutesOptions<
  TApp,
  THealthService,
  TUserRateLimiter,
  TObservabilityOptions,
> {
  readonly app: TApp;
  readonly healthService: THealthService;
  readonly options: TObservabilityOptions;
  readonly host: string;
  readonly port: number;
  readonly legacySseEnabled: boolean;
  readonly getSessionCount: () => number;
  readonly getUserRateLimiter: () => TUserRateLimiter | null;
  readonly registerHttpObservabilityCoreRoutes: (options: {
    app: TApp;
    healthService: THealthService;
    options: TObservabilityOptions;
    host: string;
    port: number;
    legacySseEnabled: boolean;
    getSessionCount: () => number;
  }) => void;
  readonly registerHttpOpenApiDocsRoutes: (options: { app: TApp }) => void;
  readonly registerHttpMetricsRoutes: (app: TApp) => void;
  readonly registerHttpWebhookDashboardRoutes: (app: TApp) => void;
  readonly registerHttpStatsRoutes: (
    app: TApp,
    options: {
      getSessionCount: () => number;
      getUserRateLimiter: () => TUserRateLimiter | null;
    }
  ) => void;
  readonly registerHttpTraceRoutes: (app: TApp) => void;
}

export function registerHttpObservabilityRoutes<
  TApp,
  THealthService,
  TUserRateLimiter,
  TObservabilityOptions,
>(options: RegisterHttpObservabilityRoutesOptions<TApp, THealthService, TUserRateLimiter, TObservabilityOptions>): void {
  const {
    app,
    healthService,
    options: observabilityOptions,
    host,
    port,
    legacySseEnabled,
    getSessionCount,
    getUserRateLimiter,
    registerHttpObservabilityCoreRoutes,
    registerHttpOpenApiDocsRoutes,
    registerHttpMetricsRoutes,
    registerHttpWebhookDashboardRoutes,
    registerHttpStatsRoutes,
    registerHttpTraceRoutes,
  } = options;

  registerHttpObservabilityCoreRoutes({
    app,
    healthService,
    options: observabilityOptions,
    host,
    port,
    legacySseEnabled,
    getSessionCount,
  });

  registerHttpOpenApiDocsRoutes({
    app,
  });

  registerHttpMetricsRoutes(app);
  registerHttpWebhookDashboardRoutes(app);
  registerHttpStatsRoutes(app, {
    getSessionCount,
    getUserRateLimiter,
  });
  registerHttpTraceRoutes(app);
}
