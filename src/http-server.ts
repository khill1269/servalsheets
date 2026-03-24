/**
 * ServalSheets - HTTP Transport Server
 *
 * Streamable HTTP transport for Claude Connectors Directory
 * Supports both SSE and HTTP streaming
 * MCP Protocol: 2025-11-25
 */

import express, { Request, Response, NextFunction } from 'express';
import type { Server as NodeHttpServer } from 'node:http';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

import { OAuthProvider } from './oauth-provider.js';
import { createSamlProviderFromEnv } from './security/saml-provider.js';
import { validateEnv, env, getEnv } from './config/env.js';
import { ACTION_COUNT, TOOL_COUNT } from './schemas/action-counts.js';
import { logger } from './utils/logger.js';
import { HealthService } from './server/health.js';
import { startMetricsServer, stopMetricsServer } from './server/metrics-server.js';
import { MetricsExporter } from './services/metrics-exporter.js';
import { getMetricsService } from './services/metrics.js';
import { cacheManager } from './utils/cache-manager.js';
import { createAsyncOnce } from './server/async-once.js';
import {
  startBackgroundTasks,
  registerSignalHandlers,
  onShutdown,
  logEnvironmentConfig,
} from './startup/lifecycle.js';
import { initTelemetry } from './observability/otel-setup.js';
import { registerWellKnownHandlers } from './server/well-known.js';
import { initializeRbacManager } from './services/rbac-manager.js';
import { initializeBillingIntegration } from './services/billing-integration.js';
import { buildBillingBootstrapConfig } from './server/billing-bootstrap-config.js';
import { verifyToolIntegrity } from './security/tool-hash-registry.js';
import { registerHttpEnterpriseMiddleware } from './http-server/enterprise-middleware.js';
import { getSharedHttpLoggingBridge } from './http-server/logging-bridge.js';
import { registerHttpFoundationMiddleware } from './http-server/middleware.js';
import { registerHttpRequestContextMiddleware } from './http-server/request-context-middleware.js';
import { registerHttpGraphQlAndAdmin } from './http-server/graphql-admin.js';
import { registerHttpObservabilityRoutes } from './http-server/routes-observability.js';
import { prepareHttpRateLimiter } from './http-server/rate-limit-bootstrap.js';
import { createHttpMcpServerInstance } from './http-server/runtime-factory.js';
import {
  registerHttpTransportRoutes,
  type HttpTransportSession,
} from './http-server/routes-transport.js';
import { registerHttpWebhookRoutes } from './http-server/routes-webhooks.js';
import { registerApiRoutes } from './http-server/routes-api.js';
import { ConfigError } from './core/errors.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  trustProxy?: boolean;

  // OAuth mode (optional)
  enableOAuth?: boolean;
  oauthConfig?: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    jwtSecret: string;
    stateSecret: string;
    allowedRedirectUris: string[];
    googleClientId: string;
    googleClientSecret: string;
    accessTokenTtl: number;
    refreshTokenTtl: number;
  };
}

const DEFAULT_PORT = 3000;
// HIGH-003 FIX: Default to localhost for security (0.0.0.0 exposes to entire network)
// Override with HOST=0.0.0.0 in production if external access needed
const DEFAULT_HOST = '127.0.0.1';

// Monkey-patches removed: All schemas now use flattened z.object() pattern
// which works natively with MCP SDK v1.25.x - no patches required!

/**
 * Create HTTP server with MCP transport
 */
export function createHttpServer(options: HttpServerOptions = {}): {
  app: unknown;
  start: () => Promise<void>;
  stop: () => Promise<void> | undefined;
  sessions: unknown;
} {
  const httpLoggingBridge = getSharedHttpLoggingBridge();
  const envConfig = getEnv();
  const ensureToolIntegrityVerified = createAsyncOnce(async () => {
    await verifyToolIntegrity();
  });

  const configuredCorsOrigins = envConfig.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const corsOrigins =
    options.corsOrigins ??
    (configuredCorsOrigins.length > 0
      ? configuredCorsOrigins
      : [
          'https://claude.ai',
          'https://claude.com',
          'https://platform.openai.com',
          'https://copilot.microsoft.com',
          'https://grok.x.ai',
          'https://gemini.google.com',
          // MCP Inspector (official debugging tool) and local development clients
          'http://localhost:6274',
          'http://localhost:3000',
          'http://localhost:8080',
          'http://127.0.0.1:6274',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:8080',
        ]);
  const rateLimitWindowMs = options.rateLimitWindowMs ?? envConfig.RATE_LIMIT_WINDOW_MS;
  const rateLimitMax = options.rateLimitMax ?? envConfig.RATE_LIMIT_MAX;
  const trustProxy = options.trustProxy ?? false;
  const legacySseEnabled = envConfig.ENABLE_LEGACY_SSE;
  if (legacySseEnabled) {
    logger.warn(
      'Legacy SSE transport (/sse endpoint) is deprecated per MCP 2025-11-25. ' +
        'Migrate clients to the Streamable HTTP transport at /mcp. ' +
        'Set ENABLE_LEGACY_SSE=false to suppress this warning.'
    );
  }
  const eventStoreRedisUrl = envConfig.REDIS_URL;
  const eventStoreTtlMs = envConfig.STREAMABLE_HTTP_EVENT_TTL_MS;
  const eventStoreMaxEvents = envConfig.STREAMABLE_HTTP_EVENT_MAX_EVENTS;

  const app = express();

  // Health service for liveness/readiness probes
  // Note: GoogleClient is session-specific, so health checks will report on active sessions
  const healthService = new HealthService(null);

  registerHttpFoundationMiddleware({
    app,
    corsOrigins,
    trustProxy,
    rateLimitWindowMs,
    rateLimitMax,
  });

  // OAuth provider (optional)
  let oauth: OAuthProvider | null = null;
  if (options.enableOAuth && options.oauthConfig) {
    oauth = new OAuthProvider(options.oauthConfig);
    app.use(oauth.createRouter());
    logger.info('HTTP Server: OAuth mode enabled', {
      issuer: options.oauthConfig.issuer,
      clientId: options.oauthConfig.clientId,
    });
  }

  // SAML SSO provider (optional — enabled when SAML_ENTRY_POINT + SAML_CERT + SSO_JWT_SECRET set)
  // SECURITY: node-forge (transitive via node-saml → xml-encryption) has CVE GHSA-cfm4-qjh2-4765
  // (improper cryptographic signature verification allowing SAML assertion forgery).
  // In production, SAML routes are disabled unless SAML_ACKNOWLEDGE_CVE_GHSA_cfm4=true is set.
  const samlProvider = createSamlProviderFromEnv();
  if (samlProvider) {
    if (
      process.env['NODE_ENV'] === 'production' &&
      process.env['SAML_ACKNOWLEDGE_CVE_GHSA_cfm4'] !== 'true'
    ) {
      logger.error(
        'SAML SSO is disabled in production due to CVE GHSA-cfm4-qjh2-4765 in node-forge ' +
          '(transitive dep via node-saml → xml-encryption). ' +
          'To enable SAML in production, set SAML_ACKNOWLEDGE_CVE_GHSA_cfm4=true after ' +
          'reviewing the CVE and confirming your threat model accepts the risk.'
      );
    } else {
      app.use(samlProvider.createRouter());
      logger.info(
        'HTTP Server: SAML SSO enabled (routes: /sso/login, /sso/callback, /sso/metadata, /sso/logout)'
      );
    }
  }

  const {
    rateLimiterReady,
    getUserRateLimiter,
    middleware: perUserRateLimitMiddleware,
  } = prepareHttpRateLimiter({
    redisUrl: process.env['REDIS_URL'],
    sessionStoreType: process.env['SESSION_STORE_TYPE'],
    log: logger,
  });

  // Initialize RBAC manager when RBAC middleware is enabled so built-in roles are loaded
  // before the first permission check.
  const initializeRbac = async (): Promise<void> => {
    if (!envConfig.ENABLE_RBAC) {
      return;
    }
    try {
      await initializeRbacManager();
      logger.info('RBAC manager initialized');
      initializeBillingIntegration(buildBillingBootstrapConfig(envConfig));
    } catch (error) {
      logger.error('Failed to initialize RBAC manager', { error });
      throw error;
    }
  };

  app.use(perUserRateLimitMiddleware);

  // QuotaManager (src/services/quota-manager.ts) handles per-tenant business quota gates
  // (reads/writes/admin per month, configurable per tier). Differs from UserRateLimiter
  // (HTTP throughput). Wire after userRateLimiter when multi-tenant is enabled.

  registerHttpRequestContextMiddleware(app);

  // Enterprise middleware (all feature-flagged, default OFF)
  // Uses lazy loading: middleware modules are imported on first request to avoid
  // blocking startup, while maintaining correct middleware ordering.
  registerHttpEnterpriseMiddleware(app, {
    enableTenantIsolation: envConfig.ENABLE_TENANT_ISOLATION,
    enableRbac: envConfig.ENABLE_RBAC,
    log: logger,
  });

  // Well-known discovery endpoints (RFC 8615)
  // These must be registered before rate limiting exemption or after with explicit allow
  registerWellKnownHandlers(app, {
    corsOrigins,
    rateLimitMax,
    legacySseEnabled,
    authenticationRequired: options.enableOAuth ?? false,
  });

  registerHttpObservabilityRoutes({
    app,
    healthService,
    options,
    host,
    port,
    legacySseEnabled,
    getSessionCount: () => sessions.size,
    getUserRateLimiter,
  });

  // Store active sessions with security binding
  const sessions = new Map<string, HttpTransportSession>();
  const createMcpServerInstance = async (
    googleToken?: string,
    googleRefreshToken?: string,
    sessionId?: string
  ) =>
    createHttpMcpServerInstance({
      googleToken,
      googleRefreshToken,
      sessionId,
      subscribers: httpLoggingBridge.subscribers,
      installLoggingBridge: httpLoggingBridge.installLoggingBridge,
    });

  const { sessionCleanupInterval, cleanupSessions } = registerHttpTransportRoutes({
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
    sessions,
    createMcpServerInstance,
  });

  registerHttpWebhookRoutes(app);

  // =SERVAL() formula evaluation API
  registerApiRoutes(app, {
    samplingServer: null, // Wired at session creation; HTTP route uses standalone sampling
  });
  logger.info('HTTP Server: =SERVAL() API enabled (POST /api/formula-eval)');

  // Error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('HTTP server error', {
      error: err,
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      stack: err.stack,
    });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env['NODE_ENV'] === 'production' ? undefined : err.message,
      },
    });
  });

  let httpServer: ReturnType<typeof app.listen> | null = null;
  let dedicatedMetricsServer: NodeHttpServer | null = null;

  // Register shutdown callback to close HTTP server
  onShutdown(async () => {
    if (httpServer) {
      logger.info('Closing HTTP server...');
      return new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => {
          if (err) {
            logger.error('Error closing HTTP server', { error: err });
            reject(err);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }
  });

  // Register shutdown callback to close dedicated metrics server
  onShutdown(async () => {
    if (!dedicatedMetricsServer) {
      return;
    }
    logger.info('Closing dedicated metrics server...');
    try {
      await stopMetricsServer(dedicatedMetricsServer);
      dedicatedMetricsServer = null;
    } catch (error) {
      logger.error('Error closing dedicated metrics server', { error });
      throw error;
    }
  });

  // Clear session cleanup interval on shutdown
  onShutdown(async () => {
    clearInterval(sessionCleanupInterval);
  });

  // Register shutdown callback to close all sessions
  onShutdown(async () => {
    logger.info(`Closing ${sessions.size} active sessions...`);
    cleanupSessions();
    logger.info('All sessions closed');
  });

  registerHttpGraphQlAndAdmin({
    app,
    sessions: sessions as Map<string, unknown>,
  });

  return {
    app,
    start: async () => {
      await initTelemetry();
      await ensureToolIntegrityVerified.run();
      await Promise.all([rateLimiterReady, initializeRbac()]);
      await new Promise<void>((resolve, reject) => {
        httpServer = app.listen(port, host);

        httpServer.once('error', (error) => {
          logger.error('HTTP server failed to bind', { error, host, port });
          reject(error);
        });

        httpServer.once('listening', () => {
          logger.info(`ServalSheets HTTP server listening on ${host}:${port}`);
          if (legacySseEnabled) {
            logger.info(`SSE endpoint: http://${host}:${port}/sse`);
          } else {
            logger.info('Legacy SSE endpoints disabled (use /mcp)');
          }
          logger.info(`HTTP endpoint: http://${host}:${port}/mcp`);
          logger.info(`Health check: http://${host}:${port}/health`);
          logger.info(`Metrics: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions`);
          resolve();
        });
      });

      if (envConfig.ENABLE_METRICS_SERVER) {
        if (envConfig.METRICS_PORT === port && envConfig.METRICS_HOST === host) {
          throw new ConfigError(
            'METRICS_PORT/METRICS_HOST cannot match main HTTP server bind address. ' +
              'Use a dedicated metrics port.',
            'METRICS_PORT'
          );
        }

        const exporter = new MetricsExporter(getMetricsService(), cacheManager);
        dedicatedMetricsServer = await startMetricsServer({
          port: envConfig.METRICS_PORT,
          host: envConfig.METRICS_HOST,
          exporter,
        });

        logger.info('Dedicated metrics server enabled', {
          host: envConfig.METRICS_HOST,
          port: envConfig.METRICS_PORT,
        });
      }
    },
    stop: async () => {
      clearInterval(sessionCleanupInterval);
      cleanupSessions();

      if (dedicatedMetricsServer) {
        await stopMetricsServer(dedicatedMetricsServer);
        dedicatedMetricsServer = null;
      }
      if (httpServer) {
        return new Promise<void>((resolve, reject) => {
          httpServer!.close((err) => {
            if (err) {
              reject(err);
            } else {
              httpServer = null;
              resolve();
            }
          });
        });
      }
    },
    sessions,
  };
}

/**
 * Start HTTP server - convenience function for CLI
 */
export async function startHttpServer(options: HttpServerOptions = {}): Promise<void> {
  const port = options.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
  const server = createHttpServer({ ...options, port });
  await server.start();
}

/**
 * Start remote server with OAuth - convenience function for CLI
 * This is a compatibility wrapper that enables OAuth mode
 */
export async function startRemoteServer(options: { port?: number } = {}): Promise<void> {
  // Validate environment variables
  validateEnv();

  if (
    !env.JWT_SECRET ||
    !env.STATE_SECRET ||
    !env.OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET
  ) {
    throw new ConfigError(
      'JWT_SECRET, STATE_SECRET, OAUTH_CLIENT_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET must be set when using OAuth mode',
      'JWT_SECRET'
    );
  }

  // Load OAuth config from environment
  const oauthConfig = {
    issuer: env.OAUTH_ISSUER,
    clientId: env.OAUTH_CLIENT_ID,
    clientSecret: env.OAUTH_CLIENT_SECRET!,
    jwtSecret: env.JWT_SECRET!,
    stateSecret: env.STATE_SECRET!,
    allowedRedirectUris: env.ALLOWED_REDIRECT_URIS.split(','),
    googleClientId: env.GOOGLE_CLIENT_ID!,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
    accessTokenTtl: env.ACCESS_TOKEN_TTL,
    refreshTokenTtl: env.REFRESH_TOKEN_TTL,
    resourceIndicator: env.OAUTH_RESOURCE_INDICATOR, // RFC 8707 audience claim
  };

  const server = createHttpServer({
    port: options.port ?? env.PORT,
    host: env.HOST,
    enableOAuth: true,
    oauthConfig,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  });

  await server.start();
}

const isDirectEntry = (() => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
})();

// CLI entry point
if (isDirectEntry) {
  (async () => {
    try {
      // Log environment configuration
      logEnvironmentConfig();

      // Start background tasks and validate configuration
      await startBackgroundTasks();

      // Register signal handlers for graceful shutdown
      registerSignalHandlers();

      // Start HTTP server
      const port = parseInt(process.env['PORT'] ?? '3000', 10);
      const server = createHttpServer({ port });
      await server.start();

      logger.info('ServalSheets HTTP server started successfully');
    } catch (error) {
      logger.error('Failed to start HTTP server', { error });
      process.exit(1);
    }
  })();
}
