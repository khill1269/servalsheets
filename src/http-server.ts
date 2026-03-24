/**
 * ServalSheets - HTTP Transport Server
 *
 * Streamable HTTP transport for Claude Connectors Directory
 * Supports both SSE and HTTP streaming
 * MCP Protocol: 2025-11-25
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

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
import { initializeRbacManager } from './services/rbac-manager.js';
import { initializeBillingIntegration } from './services/billing-integration.js';
import { buildBillingBootstrapConfig } from './server/billing-bootstrap-config.js';
import { verifyToolIntegrity } from './security/tool-hash-registry.js';
import {
  registerHttpAuthProviders,
  type HttpOAuthServerConfig,
} from './http-server/auth-providers.js';
import { registerHttpEnterpriseMiddleware } from './http-server/enterprise-middleware.js';
import { getSharedHttpLoggingBridge } from './http-server/logging-bridge.js';
import { registerHttpFoundationMiddleware } from './http-server/middleware.js';
import { registerHttpRequestContextMiddleware } from './http-server/request-context-middleware.js';
import { createHttpRbacInitializer } from './http-server/rbac-bootstrap.js';
import { runHttpServerDirectEntry } from './http-server/direct-entry.js';
import { registerHttpSurfaceRoutes } from './http-server/route-surface.js';
import { buildRemoteHttpServerOptions } from './http-server/remote-options.js';
import { resolveHttpServerRuntimeConfig } from './http-server/runtime-config.js';
import { prepareHttpRateLimiter } from './http-server/rate-limit-bootstrap.js';
import { createHttpServerLifecycle } from './http-server/server-lifecycle.js';
import { bootstrapHttpTransportSessions } from './http-server/transport-bootstrap.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  trustProxy?: boolean;

  // OAuth mode (optional)
  enableOAuth?: boolean;
  oauthConfig?: HttpOAuthServerConfig;
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
  } = resolveHttpServerRuntimeConfig({
    envConfig,
    options,
    defaultPort: DEFAULT_PORT,
    defaultHost: DEFAULT_HOST,
    log: logger,
  });

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
  const { oauth } = registerHttpAuthProviders({
    app,
    enableOAuth: options.enableOAuth,
    oauthConfig: options.oauthConfig,
    log: logger,
  });

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
  const initializeRbac = createHttpRbacInitializer({
    envConfig,
    initializeRbacManager,
    initializeBillingIntegration,
    buildBillingBootstrapConfig,
    log: logger,
  });

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

  const { sessions, sessionCleanupInterval, cleanupSessions } = bootstrapHttpTransportSessions({
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

  registerHttpSurfaceRoutes({
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
    log: logger,
  });

  const lifecycle = createHttpServerLifecycle({
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
    createMetricsExporter: () => new MetricsExporter(getMetricsService(), cacheManager),
    startMetricsServer,
    stopMetricsServer,
    initTelemetry,
    onShutdown,
    toolCount: TOOL_COUNT,
    actionCount: ACTION_COUNT,
    log: logger,
  });

  return {
    app,
    start: lifecycle.start,
    stop: lifecycle.stop,
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
  validateEnv();
  await startHttpServer(
    buildRemoteHttpServerOptions({
      envConfig: env,
      portOverride: options.port,
    })
  );
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
  void runHttpServerDirectEntry({
    startHttpServer,
    logEnvironmentConfig,
    startBackgroundTasks,
    registerSignalHandlers,
    log: logger,
  });
}
