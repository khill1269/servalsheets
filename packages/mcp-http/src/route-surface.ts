export interface HttpSurfaceLogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface RegisterHttpSurfaceRoutesOptions<
  TApp,
  THealthService,
  TUserRateLimiter,
  TObservabilityOptions,
> {
  readonly app: TApp;
  readonly corsOrigins: string[];
  readonly rateLimitMax: number;
  readonly legacySseEnabled: boolean;
  readonly authenticationRequired: boolean;
  readonly healthService: THealthService;
  readonly observabilityOptions: TObservabilityOptions;
  readonly host: string;
  readonly port: number;
  readonly getSessionCount: () => number;
  readonly getUserRateLimiter: () => TUserRateLimiter | null;
  readonly sessions: Map<string, unknown>;
  readonly log?: HttpSurfaceLogger;
  readonly registerWellKnownHandlers: (
    app: TApp,
    options: {
      corsOrigins: string[];
      rateLimitMax: number;
      legacySseEnabled: boolean;
      authenticationRequired: boolean;
    }
  ) => void;
  readonly registerHttpObservabilityRoutes: (params: {
    app: TApp;
    healthService: THealthService;
    options: TObservabilityOptions;
    host: string;
    port: number;
    legacySseEnabled: boolean;
    getSessionCount: () => number;
    getUserRateLimiter: () => TUserRateLimiter | null;
  }) => void;
  readonly registerHttpWebhookRoutes: (app: TApp) => void;
  readonly registerApiRoutes: (app: TApp, params: { samplingServer: null }) => void;
  readonly registerHttpErrorHandler: (
    app: TApp,
    params: { log: HttpSurfaceLogger }
  ) => void;
  readonly registerHttpGraphQlAndAdmin: (params: {
    app: TApp;
    sessions: Map<string, unknown>;
  }) => void;
}

const defaultLogger: HttpSurfaceLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function registerHttpSurfaceRoutes<
  TApp,
  THealthService,
  TUserRateLimiter,
  TObservabilityOptions,
>(
  options: RegisterHttpSurfaceRoutesOptions<
    TApp,
    THealthService,
    TUserRateLimiter,
    TObservabilityOptions
  >
): void {
  const {
    app,
    corsOrigins,
    rateLimitMax,
    legacySseEnabled,
    authenticationRequired,
    healthService,
    observabilityOptions,
    host,
    port,
    getSessionCount,
    getUserRateLimiter,
    sessions,
    log = defaultLogger,
    registerWellKnownHandlers,
    registerHttpObservabilityRoutes,
    registerHttpWebhookRoutes,
    registerApiRoutes,
    registerHttpErrorHandler,
    registerHttpGraphQlAndAdmin,
  } = options;

  registerWellKnownHandlers(app, {
    corsOrigins,
    rateLimitMax,
    legacySseEnabled,
    authenticationRequired,
  });

  registerHttpObservabilityRoutes({
    app,
    healthService,
    options: observabilityOptions,
    host,
    port,
    legacySseEnabled,
    getSessionCount,
    getUserRateLimiter,
  });

  registerHttpWebhookRoutes(app);
  registerApiRoutes(app, {
    samplingServer: null,
  });
  log.info('HTTP Server: =SERVAL() API enabled (POST /api/formula-eval)');

  registerHttpErrorHandler(app, { log });
  registerHttpGraphQlAndAdmin({
    app,
    sessions,
  });
}
