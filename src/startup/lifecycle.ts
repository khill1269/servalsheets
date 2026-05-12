/**
 * Server Lifecycle Management
 *
 * Handles startup validation, background tasks, and graceful shutdown.
 *
 * Features:
 * - Security validation (encryption keys, auth exempt list)
 * - Graceful shutdown with timeout
 * - Cleanup tasks
 * - Signal handlers for SIGTERM/SIGINT
 */

import { logger } from '../utils/logger.js';
import { ConfigError } from '../core/errors.js';
import { randomBytes } from 'crypto';
import { validateEnv } from '../config/env.js';
import { initTracer, shutdownTracer, getTracer, type TracerOptions } from '../utils/tracing.js';
import { shutdownOtlpExporter } from '../observability/otel-export.js';
import { initTraceAggregator } from '../services/trace-aggregator.js';
import {
  startConnectionHealthMonitoring,
  stopConnectionHealthMonitoring,
  getConnectionHealthMonitor,
  type ConnectionHealthConfig,
} from '../utils/connection-health.js';
import { cacheManager } from '../utils/cache-manager.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import {
  startAuditRateLimiterCleanup,
  stopAuditRateLimiterCleanup,
} from '../middleware/audit-middleware.js';
import {
  startWriteLockCleanup,
  stopWriteLockCleanup,
} from '../middleware/write-lock-middleware.js';
import { getBatchEfficiencyStats } from '../utils/batch-efficiency.js';
import { getWebhookManager, getWebhookWorker } from '../services/index.js';
import { serverStartupDuration } from '../observability/metrics.js';
import { flushStartupSummary } from './startup-profiler.js';
import { DEFER_SCHEMAS } from '../config/constants.js';
import {
  enforceProductionOAuthConfig,
  warnIfDefaultCredentialsInHttpMode,
} from '../config/embedded-oauth.js';
import { getSamplingHealth } from '../services/sampling-health-probe.js';

// Shutdown timeout (10 seconds)
const SHUTDOWN_TIMEOUT = 10000;

// Auth exempt tools (tools that don't require authentication)
// SECURITY NOTE: Only include tools that don't access user data
const AUTH_EXEMPT_TOOLS = new Set<string>([
  // Currently no tools are exempt - all require authentication
]);

/**
 * Validate ENCRYPTION_KEY in production environment
 * SEC-001: Requires encryption key for token storage in production
 */
export function requireEncryptionKeyInProduction(): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const hasEncryptionKey = Boolean(process.env['ENCRYPTION_KEY']);

  if (isProduction && !hasEncryptionKey) {
    throw new ConfigError(
      'ENCRYPTION_KEY environment variable is required in production. ' +
        'Generate with: openssl rand -hex 32',
      'ENCRYPTION_KEY'
    );
  }

  if (!hasEncryptionKey) {
    logger.warn(
      'ENCRYPTION_KEY not set - tokens will not be encrypted. ' +
        'This is acceptable for development but NOT for production.'
    );
  } else {
    const keyLength = process.env['ENCRYPTION_KEY']?.length || 0;
    if (keyLength !== 64) {
      throw new ConfigError(
        `ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyLength}. ` +
          'Generate with: openssl rand -hex 32',
        'ENCRYPTION_KEY'
      );
    }
    logger.debug('Encryption key validated (64 hex chars / 32 bytes)');
  }
}

/**
 * Require persistent session store in production
 * SEC-002: OAuth sessions must persist across server restarts in production
 *
 * Override: Set ALLOW_MEMORY_SESSIONS=true to bypass Redis requirement for local testing
 */
export function requireSessionStoreInProduction(): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const storeType = process.env['SESSION_STORE_TYPE'] ?? 'memory';
  const allowMemorySessions = process.env['ALLOW_MEMORY_SESSIONS'] === 'true';

  if (isProduction && storeType === 'memory' && !allowMemorySessions) {
    throw new ConfigError(
      'Production mode requires persistent session store. ' +
        'In-memory session store loses all OAuth sessions on restart. ' +
        'Set SESSION_STORE_TYPE=redis and REDIS_URL=redis://your-redis-host:6379, ' +
        'or set ALLOW_MEMORY_SESSIONS=true for local testing.',
      'SESSION_STORE_TYPE'
    );
  }

  if (isProduction && allowMemorySessions) {
    logger.warn(
      'Running production with memory sessions (ALLOW_MEMORY_SESSIONS=true). ' +
        'Sessions will not persist across restarts. Not recommended for real production.'
    );
  }

  if (storeType === 'redis' && !process.env['REDIS_URL']) {
    throw new ConfigError(
      'REDIS_URL is required when SESSION_STORE_TYPE=redis. ' +
        'Provide a Redis connection URL (e.g., redis://localhost:6379)',
      'REDIS_URL'
    );
  }

  if (!isProduction && storeType === 'memory') {
    logger.warn(
      'Using in-memory session store. ' +
        'OAuth sessions will be lost on server restart. ' +
        'This is acceptable for development but NOT for production.'
    );
  }
}

/**
 * Validate AUTH_EXEMPT_TOOLS list for security
 * SEC-007: Ensures only safe, non-data-accessing tools are exempt from authentication
 */
export function validateAuthExemptList(): void {
  // Define patterns for tools that are safe to be exempt
  const SAFE_PATTERNS = ['sheets_auth_status', 'sheets_authenticate', 'sheets_health_check'];

  const warnings: string[] = [];

  for (const tool of AUTH_EXEMPT_TOOLS) {
    const isSafe = SAFE_PATTERNS.some((pattern) => tool.startsWith(pattern) || tool === pattern);

    if (!isSafe) {
      warnings.push(`Tool '${tool}' in exempt list - verify it doesn't access user data`);
    }
  }

  if (warnings.length > 0) {
    logger.warn('Auth exempt list contains non-standard tools', { warnings });

    // In production, fail hard if any non-standard tools exist
    if (process.env['NODE_ENV'] === 'production') {
      throw new ConfigError(
        `AUTH_EXEMPT_TOOLS contains unverified tools in production: ${warnings.join(', ')}`,
        'AUTH_EXEMPT_TOOLS'
      );
    }
  }

  logger.info('Auth exempt list validated', {
    totalExempt: AUTH_EXEMPT_TOOLS.size,
    warningCount: warnings.length,
  });
}

/**
 * Validate OAuth configuration
 * Checks that required OAuth environment variables are set
 *
 * Also enforces:
 * - SEC-008: Production HTTP mode must have OAUTH_REDIRECT_URI explicitly set
 *   (delegates to enforceProductionOAuthConfig — throws ConfigError on violation)
 * - SEC-009: Bundled OAuth credentials warning
 *   (delegates to warnIfDefaultCredentialsInHttpMode — emits a stderr warning
 *   when no usable client secret is configured)
 */
export function validateOAuthConfig(): void {
  // SEC-008: Throws ConfigError in production HTTP mode without OAUTH_REDIRECT_URI.
  // Must run before the lighter checks below so configuration failures fail fast.
  enforceProductionOAuthConfig();

  // SEC-009: Surface a clear warning when bundled credentials are missing/sentinel.
  warnIfDefaultCredentialsInHttpMode();

  const hasClientId = Boolean(process.env['OAUTH_CLIENT_ID']);
  const hasClientSecret = Boolean(process.env['OAUTH_CLIENT_SECRET']);
  const hasRedirectUri = Boolean(process.env['OAUTH_REDIRECT_URI']);

  if (!hasClientId || !hasClientSecret) {
    logger.warn(
      'OAuth credentials not configured. HTTP server will require manual token setup. ' +
        'Run "npm run auth" to set up OAuth authentication.'
    );
  } else {
    logger.debug('OAuth configuration validated');
    if (!hasRedirectUri) {
      logger.warn('OAUTH_REDIRECT_URI not set, using default: http://localhost:3000/callback');
    }
  }
}

/**
 * Warn when STRICT_MCP_PROTOCOL_VERSION is not enabled in production.
 *
 * SEC-010: HTTP transport accepts any client protocol version unless this
 * env var is set (see src/http-server/middleware.ts:30-32). Production
 * deployments should reject older protocol versions to ensure new security
 * features (RFC 8707 audience binding, structured outputs, etc.) cannot
 * be bypassed by clients pinned to legacy versions.
 *
 * Non-fatal: emits a WARN at startup so the misconfiguration is visible
 * in logs without breaking development workflows that intentionally allow
 * older clients.
 */
export function warnIfStrictProtocolVersionDisabledInProduction(): void {
  if (process.env['NODE_ENV'] !== 'production') return;

  const raw = process.env['STRICT_MCP_PROTOCOL_VERSION'];
  const enabled = raw === 'true' || raw === '1';
  if (enabled) return;

  logger.warn(
    'STRICT_MCP_PROTOCOL_VERSION is not enabled in production. ' +
      'HTTP transport will accept any client MCP protocol version, including legacy ones ' +
      'that predate current security features. ' +
      'Set STRICT_MCP_PROTOCOL_VERSION=true to reject non-current versions.'
  );
}

/**
 * Generate encryption key if missing (development only)
 * Returns the encryption key (existing or generated)
 */
export function ensureEncryptionKey(): string {
  let encryptionKey = process.env['ENCRYPTION_KEY'];

  if (!encryptionKey) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new ConfigError('ENCRYPTION_KEY required in production', 'ENCRYPTION_KEY');
    }

    // Generate a random key for development
    encryptionKey = randomBytes(32).toString('hex');
    process.env['ENCRYPTION_KEY'] = encryptionKey;

    logger.warn(
      'Generated temporary encryption key for development. ' +
        'Set ENCRYPTION_KEY in .env for persistent tokens.'
    );
  }

  return encryptionKey;
}

/**
 * Probe sampling reachability once at startup.
 *
 * SAMPLING-001: The server advertises sampling capability based on env config
 * (presence of an LLM API key), but config presence ≠ reachability. A
 * revoked key, malformed default request, or DNS failure would only surface
 * on the first `sheets_analyze` call, far from the operator's setup window.
 *
 * Running the probe at startup makes the misconfiguration visible in
 * deployment logs immediately. The probe is intentionally fire-and-forget —
 * a slow probe must not block startup. The result is cached inside
 * `getSamplingHealth()` and consulted by analyze handlers.
 */
export async function probeSamplingHealthAtStartup(): Promise<void> {
  try {
    const health = await getSamplingHealth();
    if (health.healthy) {
      logger.info('Sampling health probe: healthy', {
        provider: health.provider,
        model: health.model,
      });
    } else {
      logger.warn('Sampling health probe: unhealthy at startup', {
        reason: health.reason,
        provider: health.provider,
        consecutiveFailures: health.consecutiveFailures,
      });
    }
  } catch (error) {
    // Probe should never throw, but defend against future regressions.
    logger.warn('Sampling health probe threw at startup', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Initialize OpenTelemetry tracing if enabled
 */
export function initializeTracing(options?: TracerOptions): void {
  const tracer = initTracer({
    serviceName: 'servalsheets',
    enabled: process.env['OTEL_ENABLED'] === 'true',
    logSpans: process.env['OTEL_LOG_SPANS'] === 'true',
    ...options,
  });

  if (tracer.isEnabled()) {
    logger.info('OpenTelemetry tracing enabled', {
      serviceName: tracer.getServiceName(),
    });
  } else {
    logger.debug('OpenTelemetry tracing disabled (set OTEL_ENABLED=true to enable)');
  }
}

/**
 * Initialize connection health monitoring
 */
export function initializeConnectionHealth(config?: ConnectionHealthConfig): void {
  const monitor = startConnectionHealthMonitoring(config);

  logger.info('Connection health monitoring started', {
    connectionId: monitor.getConnectionId(),
  });

  // Register heartbeat recorder for shutdown callback
  onShutdown(async () => {
    const stats = monitor.getStats();
    logger.info('Connection health at shutdown', {
      status: stats.status,
      uptimeSeconds: stats.uptimeSeconds,
      totalHeartbeats: stats.totalHeartbeats,
      disconnectWarnings: stats.disconnectWarnings,
    });
    stopConnectionHealthMonitoring();
  });
}

/**
 * Initialize webhook infrastructure (Phase 1: Drive API Push Notifications)
 *
 * Starts webhook worker and channel renewal tasks if Redis is available.
 * Requires REDIS_URL and WEBHOOK_ENDPOINT to be configured.
 *
 * @returns Promise<void>
 */
async function initializeWebhookInfrastructure(): Promise<void> {
  const redisUrl = process.env['REDIS_URL'];
  const webhookEndpoint = process.env['WEBHOOK_ENDPOINT'];

  if (!redisUrl) {
    logger.info('Webhook infrastructure skipped: REDIS_URL not configured');
    return;
  }

  if (!webhookEndpoint) {
    logger.info('Webhook infrastructure skipped: WEBHOOK_ENDPOINT not configured');
    return;
  }

  try {
    logger.info('Initializing webhook infrastructure...', {
      webhookEndpoint,
      workerConcurrency: process.env['WEBHOOK_WORKER_CONCURRENCY'],
      maxAttempts: process.env['WEBHOOK_MAX_ATTEMPTS'],
    });

    // Get or create webhook worker
    const worker = getWebhookWorker();
    if (worker) {
      await worker.start();
      logger.info('Webhook worker started');
    } else {
      logger.warn('Webhook worker not initialized - ensure initWebhookWorker() was called');
    }

    // Start channel renewal task (runs every hour)
    const renewalInterval = setInterval(
      async () => {
        const webhookManager = getWebhookManager();
        if (webhookManager) {
          try {
            const renewed = await webhookManager.renewExpiringChannels();
            if (renewed > 0) {
              logger.info('Webhook channels renewed', { count: renewed });
            }
          } catch (error) {
            logger.error('Channel renewal task failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      },
      60 * 60 * 1000
    ); // 1 hour

    logger.info('Webhook channel renewal task started (1 hour interval)');

    // Register shutdown callback for webhook worker
    onShutdown(async () => {
      logger.debug('Stopping webhook worker...');
      clearInterval(renewalInterval);
      const worker = getWebhookWorker();
      if (worker) {
        await worker.stop();
        logger.debug('Webhook worker stopped');
      }
    });

    logger.info('Webhook infrastructure initialized');
  } catch (error) {
    logger.error('Failed to initialize webhook infrastructure', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw - webhook infrastructure is optional
  }
}

/**
 * Start all background tasks and validate configuration
 */
export async function startBackgroundTasks(options?: {
  tracing?: TracerOptions;
  connectionHealth?: ConnectionHealthConfig;
}): Promise<void> {
  logger.info('Starting background tasks...');

  // Validate env-derived safety and durability requirements before startup work begins.
  validateEnv();

  // SEC-001: Validate ENCRYPTION_KEY in production
  requireEncryptionKeyInProduction();

  // SEC-002: Require persistent session store in production
  requireSessionStoreInProduction();

  // SEC-007: Validate AUTH_EXEMPT_TOOLS list
  validateAuthExemptList();

  // Validate OAuth configuration
  validateOAuthConfig();

  // SEC-010: Warn (non-fatal) when STRICT_MCP_PROTOCOL_VERSION is unset in production
  warnIfStrictProtocolVersionDisabledInProduction();

  // SAMPLING-001: Probe sampling reachability once at startup so a missing/revoked
  // API key, malformed request, or unreachable endpoint surfaces here in the
  // operator's startup logs rather than on the first sheets_analyze call later.
  // Non-fatal: the analyze handlers will gracefully fall back if the probe says
  // sampling is unhealthy.
  void probeSamplingHealthAtStartup();

  // Initialize OpenTelemetry tracing
  initializeTracing(options?.tracing);

  // Initialize trace aggregator for request trace collection
  initTraceAggregator({
    enabled: process.env['OTEL_ENABLED'] === 'true',
    maxSize: 1000,
    ttl: 5 * 60 * 1000, // 5 minutes
  });
  logger.info('Trace aggregator initialized');

  // Initialize connection health monitoring
  initializeConnectionHealth(options?.connectionHealth);

  // Start cache cleanup task
  cacheManager.startCleanupTask();
  logger.info('Cache cleanup task started');

  // Start middleware background timers. Previously these were module-load
  // setIntervals (unref'd) in audit-middleware.ts and write-lock-middleware.ts;
  // moving them here makes the timer lifecycle observable at the process
  // boundary and guarantees they don't run inside tests or one-shot scripts
  // that only import the middleware for its types/functions.
  startAuditRateLimiterCleanup();
  startWriteLockCleanup();
  logger.info('Middleware cleanup timers started');

  // Register shutdown callbacks
  onShutdown(async () => {
    logger.debug('Shutting down tracer...');
    await shutdownTracer();
    logger.debug('Tracer shutdown complete');
  });

  onShutdown(async () => {
    logger.debug('Shutting down OTLP exporter...');
    await shutdownOtlpExporter();
    logger.debug('OTLP exporter shutdown complete');
  });

  onShutdown(async () => {
    logger.debug('Stopping cache cleanup...');
    cacheManager.stopCleanupTask();
    const stats = cacheManager.getStats();
    logger.info('Cache stats at shutdown', {
      totalEntries: stats.totalEntries,
      totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`,
      hitRate: `${stats.hitRate.toFixed(1)}%`,
    });
  });

  onShutdown(async () => {
    logger.debug('Stopping middleware cleanup timers...');
    stopAuditRateLimiterCleanup();
    stopWriteLockCleanup();
  });

  onShutdown(async () => {
    logger.debug('Destroying request deduplicator...');
    const stats = requestDeduplicator.getStats();
    logger.info('Deduplication stats at shutdown', {
      totalRequests: stats.totalRequests,
      deduplicatedRequests: stats.deduplicatedRequests,
      deduplicationRate: `${stats.deduplicationRate.toFixed(1)}%`,
      savedRequests: stats.savedRequests,
    });
    requestDeduplicator.destroy();
  });

  // Phase 1: Initialize webhook worker and channel renewal (if Redis available)
  await initializeWebhookInfrastructure();

  logger.info('Background tasks started');
}

/**
 * Shutdown state tracking
 */
let isShuttingDown = false;
let shutdownCallbacks: Array<() => Promise<void>> = [];

/**
 * Register a callback to be called during shutdown
 */
export function onShutdown(callback: () => Promise<void>): void {
  shutdownCallbacks.push(callback);
}

/**
 * Graceful shutdown handler
 * Stops accepting connections, drains existing requests, and cleans up resources
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple shutdown calls
  if (isShuttingDown) {
    logger.debug('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  isShuttingDown = true;

  logger.info('Graceful shutdown initiated', { signal });

  // Create shutdown timeout to prevent hanging
  const shutdownTimer = setTimeout(() => {
    logger.warn(`Shutdown timeout exceeded (${SHUTDOWN_TIMEOUT}ms), forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Execute all registered shutdown callbacks
    logger.debug(`Executing ${shutdownCallbacks.length} shutdown callbacks`);
    for (const callback of shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        logger.error('Shutdown callback failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear shutdown callbacks
    shutdownCallbacks = [];

    logger.info('Graceful shutdown complete');
    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

/**
 * Register signal handlers for graceful shutdown
 */
export function registerSignalHandlers(): void {
  // Handle SIGTERM (sent by Kubernetes, Docker, systemd)
  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM').catch((error) => {
      logger.error('SIGTERM handler failed', { error });
      process.exit(1);
    });
  });

  // Handle SIGINT (Ctrl+C in terminal)
  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT').catch((error) => {
      logger.error('SIGINT handler failed', { error });
      process.exit(1);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown('uncaughtException').catch(() => {
      process.exit(1);
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    gracefulShutdown('unhandledRejection').catch(() => {
      process.exit(1);
    });
  });

  logger.info(
    'Signal handlers registered (SIGTERM, SIGINT, uncaughtException, unhandledRejection)'
  );
}

/**
 * Get shutdown status
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Record activity heartbeat for connection health monitoring
 */
export function recordActivity(source?: string): void {
  try {
    const monitor = getConnectionHealthMonitor();
    monitor.recordHeartbeat(source);
  } catch {
    // Connection health monitoring not initialized - ignore
  }
}

/**
 * Get connection health statistics
 */
export function getConnectionStats(): unknown | null {
  try {
    const monitor = getConnectionHealthMonitor();
    return monitor.getStats();
  } catch {
    return null;
  }
}

/**
 * Get tracing statistics
 */
export function getTracingStats(): unknown | null {
  try {
    const tracer = getTracer();
    return tracer.getStats();
  } catch {
    return null;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): unknown | null {
  try {
    return cacheManager.getStats();
  } catch {
    return null;
  }
}

/**
 * Get request deduplication statistics
 */
export function getDeduplicationStats(): unknown | null {
  try {
    return requestDeduplicator.getStats();
  } catch {
    return null;
  }
}

/**
 * Get batch efficiency statistics
 */
export function getBatchEfficiencyStats_(): unknown | null {
  try {
    return getBatchEfficiencyStats();
  } catch {
    return null;
  }
}

/**
 * Log environment configuration for debugging
 */
export function logEnvironmentConfig(): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const logLevel = process.env['LOG_LEVEL'] || 'info';
  const httpPort = process.env['HTTP_PORT'] || '3000';
  const otelEnabled = process.env['OTEL_ENABLED'] === 'true';
  const otelLogSpans = process.env['OTEL_LOG_SPANS'] === 'true';
  const cacheEnabled = process.env['CACHE_ENABLED'] !== 'false';
  const deduplicationEnabled = process.env['DEDUPLICATION_ENABLED'] !== 'false';

  // Calculate startup timing if available
  const startupStartTime = process.env['SERVALSHEETS_STARTUP_TIME']
    ? parseInt(process.env['SERVALSHEETS_STARTUP_TIME'], 10)
    : Date.now();
  const startupDurationMs = Date.now() - startupStartTime;

  // Record startup duration metric (Phase 0, Priority 2)
  const transport = process.env['MCP_TRANSPORT'] || 'stdio';
  const deferredSchemas = DEFER_SCHEMAS ? 'true' : 'false';
  const deferredResources =
    process.env['DISABLE_KNOWLEDGE_RESOURCES'] === 'true' ? 'false' : 'true';
  serverStartupDuration.observe(
    {
      transport,
      deferred_schemas: deferredSchemas,
      deferred_resources: deferredResources,
    },
    startupDurationMs / 1000
  );
  const startupPhases = flushStartupSummary();

  logger.info('Environment configuration', {
    nodeEnv: isProduction ? 'production' : 'development',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    logLevel,
    httpPort,
    hasOAuthClientId: Boolean(process.env['OAUTH_CLIENT_ID']),
    hasOAuthClientSecret: Boolean(process.env['OAUTH_CLIENT_SECRET']),
    hasEncryptionKey: Boolean(process.env['ENCRYPTION_KEY']),
    otelEnabled,
    otelLogSpans,
    cacheEnabled,
    deduplicationEnabled,
    startupDurationMs,
    ...(startupPhases.length > 0 ? { startupPhases } : {}),
  });
}
