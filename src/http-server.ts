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
import {
  createHttpServer as createPackagedHttpServer,
  type HttpServerOptions as PackagedHttpServerOptions,
} from '../packages/mcp-http/dist/create-http-server.js';
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

export interface HttpServerOptions extends PackagedHttpServerOptions<HttpOAuthServerConfig> {}

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
  return createPackagedHttpServer(options, {
    defaultPort: DEFAULT_PORT,
    defaultHost: DEFAULT_HOST,
    createApp: () => {
      const app = express();
      // Trust reverse proxy (Fly.io, nginx, etc.) — required for express-rate-limit
      // to correctly identify clients via X-Forwarded-For behind a proxy.
      app.set('trust proxy', true);
      return app;
    },
    getEnvConfig: getEnv,
    getSharedHttpLoggingBridge,
    createEnsureToolIntegrityVerified: () =>
      createAsyncOnce(async () => {
        await verifyToolIntegrity();
      }),
    resolveHttpServerRuntimeConfig,
    createHealthService: () => new HealthService(null),
    registerHttpFoundationMiddleware,
    registerHttpAuthProviders,
    prepareHttpRateLimiter,
    createHttpRbacInitializer: ({ envConfig, log }) =>
      createHttpRbacInitializer({
        envConfig,
        initializeRbacManager,
        initializeBillingIntegration,
        buildBillingBootstrapConfig,
        log,
      }),
    registerHttpRequestContextMiddleware,
    registerHttpEnterpriseMiddleware,
    bootstrapHttpTransportSessions,
    registerHttpSurfaceRoutes,
    createHttpServerLifecycle,
    createMetricsExporter: () => new MetricsExporter(getMetricsService(), cacheManager),
    startMetricsServer,
    stopMetricsServer,
    initTelemetry,
    onShutdown,
    redisUrl: process.env['REDIS_URL'],
    sessionStoreType: process.env['SESSION_STORE_TYPE'],
    toolCount: TOOL_COUNT,
    actionCount: ACTION_COUNT,
    log: logger,
  });
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

function shouldUseRemoteDirectEntry(): boolean {
  return (
    process.env['MCP_HTTP_MODE'] === 'true' ||
    process.env['OAUTH_ISSUER'] !== undefined ||
    process.env['OAUTH_CLIENT_SECRET'] !== undefined
  );
}

// CLI entry point
if (isDirectEntry) {
  void runHttpServerDirectEntry({
    startHttpServer: async ({ port }) => {
      if (shouldUseRemoteDirectEntry()) {
        await startRemoteServer({ port });
        return;
      }
      await startHttpServer({ port });
    },
    logEnvironmentConfig,
    startBackgroundTasks,
    registerSignalHandlers,
    log: logger,
  });
}
