export interface HttpServerOptions<TOAuthConfig = unknown> {
  port?: number;
  host?: string;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  trustProxy?: boolean;
  enableOAuth?: boolean;
  oauthConfig?: TOAuthConfig;
}

export interface HttpServerInstance<TApp, TSessions> {
  readonly app: TApp;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void> | undefined;
  readonly sessions: TSessions;
}

export interface HttpServerEnvConfig {
  readonly ENABLE_TENANT_ISOLATION: boolean;
  readonly ENABLE_RBAC: boolean;
  readonly SESSION_TIMEOUT_MS: number;
  readonly ENABLE_METRICS_SERVER: boolean;
  readonly METRICS_PORT: number;
  readonly METRICS_HOST: string;
}

export interface HttpServerApplicationLike {
  use(...args: unknown[]): unknown;
}

export interface CreateHttpServerRuntimeConfig {
  readonly port: number;
  readonly host: string;
  readonly corsOrigins: string[];
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  readonly trustProxy: boolean;
  readonly legacySseEnabled: boolean;
  readonly eventStoreRedisUrl: string | undefined;
  readonly eventStoreTtlMs: number;
  readonly eventStoreMaxEvents: number;
}

export interface EnsureToolIntegrityVerifier {
  run(): Promise<void>;
}

export interface CreateHttpServerDependencies<
  TApp extends HttpServerApplicationLike,
  TEnvConfig extends HttpServerEnvConfig,
  TOAuthConfig,
  TOAuthProvider,
  THealthService,
  TUserRateLimiter,
  TSessions extends Map<string, unknown>,
  TLoggingBridge,
  TMetricsExporter,
  TMetricsServer,
  TLog,
> {
  readonly defaultPort: number;
  readonly defaultHost: string;
  readonly createApp: () => TApp;
  readonly getEnvConfig: () => TEnvConfig;
  readonly getSharedHttpLoggingBridge: () => TLoggingBridge;
  readonly createEnsureToolIntegrityVerified: () => EnsureToolIntegrityVerifier;
  readonly resolveHttpServerRuntimeConfig: (params: {
    envConfig: TEnvConfig;
    options: HttpServerOptions<TOAuthConfig>;
    defaultPort: number;
    defaultHost: string;
    log: TLog;
  }) => CreateHttpServerRuntimeConfig;
  readonly createHealthService: () => THealthService;
  readonly registerHttpFoundationMiddleware: (params: {
    app: TApp;
    corsOrigins: string[];
    trustProxy: boolean;
    rateLimitWindowMs: number;
    rateLimitMax: number;
  }) => void;
  readonly registerHttpAuthProviders: (params: {
    app: TApp;
    enableOAuth?: boolean;
    oauthConfig?: TOAuthConfig;
    log: TLog;
  }) => { oauth: TOAuthProvider | null };
  readonly prepareHttpRateLimiter: (params: {
    redisUrl: string | undefined;
    sessionStoreType: string | undefined;
    log: TLog;
  }) => {
    rateLimiterReady: Promise<void>;
    getUserRateLimiter: () => TUserRateLimiter | null;
    middleware: unknown;
  };
  readonly createHttpRbacInitializer: (params: {
    envConfig: TEnvConfig;
    log: TLog;
  }) => () => Promise<void>;
  readonly registerHttpRequestContextMiddleware: (app: TApp) => void;
  readonly registerHttpEnterpriseMiddleware: (app: TApp, params: {
    enableTenantIsolation: boolean;
    enableRbac: boolean;
    log: TLog;
  }) => void;
  readonly bootstrapHttpTransportSessions: (params: {
    app: TApp;
    enableOAuth: boolean;
    oauth: TOAuthProvider | null;
    legacySseEnabled: boolean;
    host: string;
    port: number;
    eventStoreRedisUrl: string | undefined;
    eventStoreTtlMs: number;
    eventStoreMaxEvents: number;
    sessionTimeoutMs: number;
    loggingBridge: TLoggingBridge;
  }) => {
    sessions: TSessions;
    sessionCleanupInterval: NodeJS.Timeout;
    cleanupSessions: () => void;
  };
  readonly registerHttpSurfaceRoutes: (params: {
    app: TApp;
    corsOrigins: string[];
    rateLimitMax: number;
    legacySseEnabled: boolean;
    authenticationRequired: boolean;
    healthService: THealthService;
    observabilityOptions: HttpServerOptions<TOAuthConfig>;
    host: string;
    port: number;
    getSessionCount: () => number;
    getUserRateLimiter: () => TUserRateLimiter | null;
    sessions: Map<string, unknown>;
    log: TLog;
  }) => void;
  readonly createHttpServerLifecycle: (params: {
    app: TApp;
    host: string;
    port: number;
    legacySseEnabled: boolean;
    clearSessionCleanupInterval: () => void;
    cleanupSessions: () => void;
    getSessionCount: () => number;
    ensureToolIntegrityVerified: EnsureToolIntegrityVerifier;
    rateLimiterReady: Promise<void>;
    initializeRbac: () => Promise<void>;
    enableMetricsServer: boolean;
    metricsPort: number;
    metricsHost: string;
    createMetricsExporter: () => TMetricsExporter;
    startMetricsServer: (params: {
      port: number;
      host: string;
      exporter: TMetricsExporter;
    }) => Promise<TMetricsServer>;
    stopMetricsServer: (server: TMetricsServer) => Promise<void>;
    initTelemetry: () => Promise<void>;
    onShutdown: (callback: () => Promise<void>) => void;
    toolCount: number;
    actionCount: number;
    log: TLog;
  }) => {
    start: () => Promise<void>;
    stop: () => Promise<void> | undefined;
  };
  readonly createMetricsExporter: () => TMetricsExporter;
  readonly startMetricsServer: (params: {
    port: number;
    host: string;
    exporter: TMetricsExporter;
  }) => Promise<TMetricsServer>;
  readonly stopMetricsServer: (server: TMetricsServer) => Promise<void>;
  readonly initTelemetry: () => Promise<void>;
  readonly onShutdown: (callback: () => Promise<void>) => void;
  readonly redisUrl: string | undefined;
  readonly sessionStoreType: string | undefined;
  readonly toolCount: number;
  readonly actionCount: number;
  readonly log: TLog;
}

export function createHttpServer<
  TApp extends HttpServerApplicationLike,
  TEnvConfig extends HttpServerEnvConfig,
  TOAuthConfig,
  TOAuthProvider,
  THealthService,
  TUserRateLimiter,
  TSessions extends Map<string, unknown>,
  TLoggingBridge,
  TMetricsExporter,
  TMetricsServer,
  TLog,
>(
  options: HttpServerOptions<TOAuthConfig> = {},
  dependencies: CreateHttpServerDependencies<
    TApp,
    TEnvConfig,
    TOAuthConfig,
    TOAuthProvider,
    THealthService,
    TUserRateLimiter,
    TSessions,
    TLoggingBridge,
    TMetricsExporter,
    TMetricsServer,
    TLog
  >
): HttpServerInstance<TApp, TSessions> {
  const httpLoggingBridge = dependencies.getSharedHttpLoggingBridge();
  const envConfig = dependencies.getEnvConfig();
  const ensureToolIntegrityVerified = dependencies.createEnsureToolIntegrityVerified();

  const {
    port,
    host,
    corsOrigins,
    rateLimitWindowMs,
    rateLimitMax,
    trustProxy,
    legacySseEnabled,
    eventStoreRedisUrl,
    eventStoreTtlMs,
    eventStoreMaxEvents,
  } = dependencies.resolveHttpServerRuntimeConfig({
    envConfig,
    options,
    defaultPort: dependencies.defaultPort,
    defaultHost: dependencies.defaultHost,
    log: dependencies.log,
  });

  const app = dependencies.createApp();
  const healthService = dependencies.createHealthService();

  dependencies.registerHttpFoundationMiddleware({
    app,
    corsOrigins,
    trustProxy,
    rateLimitWindowMs,
    rateLimitMax,
  });

  const { oauth } = dependencies.registerHttpAuthProviders({
    app,
    enableOAuth: options.enableOAuth,
    oauthConfig: options.oauthConfig,
    log: dependencies.log,
  });

  const {
    rateLimiterReady,
    getUserRateLimiter,
    middleware: perUserRateLimitMiddleware,
  } = dependencies.prepareHttpRateLimiter({
    redisUrl: dependencies.redisUrl,
    sessionStoreType: dependencies.sessionStoreType,
    log: dependencies.log,
  });

  const initializeRbac = dependencies.createHttpRbacInitializer({
    envConfig,
    log: dependencies.log,
  });

  app.use(perUserRateLimitMiddleware);

  dependencies.registerHttpRequestContextMiddleware(app);
  dependencies.registerHttpEnterpriseMiddleware(app, {
    enableTenantIsolation: envConfig.ENABLE_TENANT_ISOLATION,
    enableRbac: envConfig.ENABLE_RBAC,
    log: dependencies.log,
  });

  const { sessions, sessionCleanupInterval, cleanupSessions } =
    dependencies.bootstrapHttpTransportSessions({
      app,
      enableOAuth: options.enableOAuth ?? false,
      oauth,
      legacySseEnabled,
      host,
      port,
      eventStoreRedisUrl,
      eventStoreTtlMs,
      eventStoreMaxEvents,
      sessionTimeoutMs: envConfig.SESSION_TIMEOUT_MS,
      loggingBridge: httpLoggingBridge,
    });

  dependencies.registerHttpSurfaceRoutes({
    app,
    corsOrigins,
    rateLimitMax,
    legacySseEnabled,
    authenticationRequired: options.enableOAuth ?? false,
    healthService,
    observabilityOptions: options,
    host,
    port,
    getSessionCount: () => sessions.size,
    getUserRateLimiter,
    sessions: sessions as Map<string, unknown>,
    log: dependencies.log,
  });

  const lifecycle = dependencies.createHttpServerLifecycle({
    app,
    host,
    port,
    legacySseEnabled,
    clearSessionCleanupInterval: () => {
      clearInterval(sessionCleanupInterval);
    },
    cleanupSessions,
    getSessionCount: () => sessions.size,
    ensureToolIntegrityVerified,
    rateLimiterReady,
    initializeRbac,
    enableMetricsServer: envConfig.ENABLE_METRICS_SERVER,
    metricsPort: envConfig.METRICS_PORT,
    metricsHost: envConfig.METRICS_HOST,
    createMetricsExporter: dependencies.createMetricsExporter,
    startMetricsServer: dependencies.startMetricsServer,
    stopMetricsServer: dependencies.stopMetricsServer,
    initTelemetry: dependencies.initTelemetry,
    onShutdown: dependencies.onShutdown,
    toolCount: dependencies.toolCount,
    actionCount: dependencies.actionCount,
    log: dependencies.log,
  });

  return {
    app,
    start: lifecycle.start,
    stop: lifecycle.stop,
    sessions,
  };
}
