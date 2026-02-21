/**
 * Environment Variable Validation
 *
 * Centralizes all environment variable access and validation using Zod.
 * Fails fast on startup with clear error messages if configuration is invalid.
 *
 * Anti-pattern Prevention:
 * - No scattered process.env access throughout codebase
 * - Type-safe environment variables
 * - Clear error messages for misconfiguration
 * - Validates early (fail fast)
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { URL_REGEX } from './google-limits.js';

/**
 * Environment variable schema with validation rules and defaults
 */
const EnvSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  // HIGH-003 FIX: Default to 127.0.0.1 for security (0.0.0.0 exposes to entire network)
  HOST: z.string().default('127.0.0.1'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Google API Configuration (optional - can run without for testing)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .regex(URL_REGEX, 'Invalid URL format')
    .optional()
    .catch(undefined), // Gracefully fall back if env var is set to invalid URL (e.g., OOB redirect)

  // OAuth token storage paths (optional)
  // Note: Use GOOGLE_TOKEN_STORE_PATH in CLI (not TOKEN_PATH)
  CREDENTIALS_PATH: z.string().optional(),

  // Performance tuning
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_MAX_SIZE_MB: z.coerce.number().positive().default(100),
  CACHE_TTL_MS: z.coerce.number().positive().default(300000), // 5 minutes

  // Distributed Cache (Redis L2)
  // Enables Redis L2 cache for data responses (metadata, values)
  // Provides 15-25% latency improvement across replicas
  CACHE_REDIS_ENABLED: z.coerce.boolean().default(false), // Opt-in for now
  CACHE_REDIS_TTL_SECONDS: z.coerce.number().int().positive().default(600), // 10 minutes

  // Background Analysis Configuration
  // Automatically monitors data quality after destructive operations
  ENABLE_BACKGROUND_ANALYSIS: z.coerce.boolean().default(true),
  BACKGROUND_ANALYSIS_MIN_CELLS: z.coerce.number().int().positive().default(10),
  BACKGROUND_ANALYSIS_DEBOUNCE_MS: z.coerce.number().int().positive().default(2000), // 2 seconds

  // Feature flags (staged rollout)
  ENABLE_DATAFILTER_BATCH: z.coerce.boolean().default(true),
  ENABLE_TABLE_APPENDS: z.coerce.boolean().default(true),
  ENABLE_PAYLOAD_VALIDATION: z.coerce.boolean().default(true),
  ENABLE_LEGACY_SSE: z.coerce.boolean().default(true),
  ENABLE_AGGRESSIVE_FIELD_MASKS: z.coerce.boolean().default(true), // Priority 8: 40-60% payload reduction
  ENABLE_CONDITIONAL_REQUESTS: z.coerce.boolean().default(true), // Priority 9: ETag-based conditional reads (10-20% quota savings)
  // HTTP/2 connection health management (prevents GOAWAY errors)
  ENABLE_AUTO_CONNECTION_RESET: z.coerce.boolean().default(true),
  GOOGLE_API_HTTP2_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'), // Enabled by default, only false if explicitly set
  GOOGLE_API_MAX_IDLE_MS: z.coerce.number().int().positive().default(300000), // 5 minutes
  GOOGLE_API_KEEPALIVE_INTERVAL_MS: z.coerce.number().int().nonnegative().default(60000), // 1 minute, 0 = disabled
  GOOGLE_API_CONNECTION_RESET_THRESHOLD: z.coerce.number().int().positive().default(3), // Consecutive failures before reset
  GOOGLE_API_MAX_SOCKETS: z.coerce.number().int().positive().default(50), // Connection pool size
  GOOGLE_API_KEEPALIVE_TIMEOUT: z.coerce.number().int().positive().default(30000), // Keep-alive timeout (30s)

  // Performance optimization flags
  // RequestMerger: Merges overlapping range reads within 50ms window (20-40% API savings)
  // Enabled by default — production-ready with safe 50ms window and metrics tracking
  ENABLE_REQUEST_MERGING: z.coerce.boolean().default(true),
  // ParallelExecutor: Parallel execution for large batch operations (40% faster)
  // Disabled pending test coverage — concurrent API calls need validation before enabling
  ENABLE_PARALLEL_EXECUTOR: z.coerce.boolean().default(false),
  PARALLEL_EXECUTOR_THRESHOLD: z.coerce.number().int().positive().default(100),
  // Granular progress notifications for long-running operations
  // Enabled by default — non-breaking MCP-compliant progress updates for CSV import, dedup, batch ops
  ENABLE_GRANULAR_PROGRESS: z.coerce.boolean().default(true),

  // Deduplication
  DEDUP_ENABLED: z.coerce.boolean().default(true),
  DEDUP_WINDOW_MS: z.coerce.number().positive().default(5000), // 5 seconds

  // Tracing & Observability (OTEL enabled by default for production observability)
  TRACING_ENABLED: z.coerce.boolean().default(true),
  TRACING_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  OTEL_ENABLED: z.coerce.boolean().default(true), // Internal tracing infrastructure
  OTEL_LOG_SPANS: z.coerce.boolean().default(false), // Debug logging of spans

  // OTLP Export Configuration (production observability)
  OTEL_EXPORT_ENABLED: z.coerce.boolean().default(false), // Opt-in OTLP export
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'), // OTLP collector endpoint
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(), // Additional headers (comma-separated key=value pairs)
  OTEL_SERVICE_NAME: z.string().default('servalsheets'),
  OTEL_EXPORT_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  OTEL_EXPORT_INTERVAL_MS: z.coerce.number().int().positive().default(5000), // 5 seconds
  OTEL_EXPORT_MAX_QUEUE_SIZE: z.coerce.number().int().positive().default(1000),

  // Circuit Breaker
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_SUCCESS_THRESHOLD: z.coerce.number().int().positive().default(2),
  CIRCUIT_BREAKER_TIMEOUT_MS: z.coerce.number().positive().default(30000), // 30 seconds

  // Safety limits
  MAX_CONCURRENT_REQUESTS: z.coerce.number().int().positive().default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().positive().default(30000), // 30 seconds

  // Per-action timeout overrides for operations that need longer than MCP 30s default
  // Use these to configure timeouts for specific actions that naturally take longer
  COMPOSITE_TIMEOUT_MS: z.coerce.number().positive().default(120000), // 2 minutes for CSV/XLSX imports
  LARGE_PAYLOAD_TIMEOUT_MS: z.coerce.number().positive().default(60000), // 1 minute for large data operations

  // Graceful shutdown
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: z.coerce.number().positive().default(10000), // 10 seconds

  // Session Store Configuration (for OAuth)
  SESSION_STORE_TYPE: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().regex(URL_REGEX, 'Invalid URL format').optional().catch(undefined),

  // Admin Dashboard Configuration
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_VIEWER_KEY: z.string().optional(),
  ADMIN_SESSION_TTL_MS: z.coerce.number().positive().default(86400000), // 24 hours

  // Session idle timeout (HTTP transport only)
  // Sessions inactive beyond this duration are automatically evicted
  SESSION_TIMEOUT_MS: z.coerce.number().positive().default(1800000), // 30 minutes

  // Streamable HTTP event store (resumability)
  STREAMABLE_HTTP_EVENT_TTL_MS: z.coerce.number().positive().default(300000), // 5 minutes
  STREAMABLE_HTTP_EVENT_MAX_EVENTS: z.coerce.number().int().positive().default(5000),

  // OAuth Server Configuration (for remote server)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  STATE_SECRET: z.string().min(32, 'STATE_SECRET must be at least 32 characters').optional(),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  OAUTH_ISSUER: z.string().default('https://servalsheets.example.com'),
  OAUTH_CLIENT_ID: z.string().default('servalsheets'),
  // Claude/Anthropic Directory required callback URLs + localhost for development
  ALLOWED_REDIRECT_URIS: z
    .string()
    .default(
      'http://localhost:3000/callback,' +
        'http://localhost:6274/oauth/callback,' +
        'http://localhost:6274/oauth/callback/debug,' +
        'https://claude.ai/api/mcp/auth_callback,' +
        'https://claude.com/api/mcp/auth_callback'
    ),
  CORS_ORIGINS: z.string().default('https://claude.ai,https://claude.com'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(3600), // 1 hour
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2592000), // 30 days

  // Google Cloud Managed Auth Mode
  // When true: Uses Application Default Credentials, disables sheets_auth tool
  // Set to true when deploying to Cloud Run, GKE, or Cloud Functions
  MANAGED_AUTH: z.coerce.boolean().default(false),

  // Webhook Configuration (Phase 1: Drive API Push Notifications)
  // Public HTTPS endpoint for Google Drive API to send notifications
  // Required for webhook functionality, must be accessible from Google servers
  WEBHOOK_ENDPOINT: z
    .string()
    .regex(URL_REGEX, 'Invalid URL format')
    .refine((url) => url.startsWith('https://'), 'Webhook endpoint must use HTTPS')
    .optional(),
  WEBHOOK_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),

  // MCP Federation Configuration (Feature 3: Server Federation)
  // Enables calling external MCP servers for composite workflows
  // Example: Weather APIs, ML servers, database connectors
  MCP_FEDERATION_ENABLED: z.coerce.boolean().default(false),
  MCP_FEDERATION_TIMEOUT_MS: z.coerce.number().positive().default(30000), // 30 seconds
  MCP_FEDERATION_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
  // JSON array of server configs: [{"name":"weather-api","url":"http://localhost:3001"}]
  MCP_FEDERATION_SERVERS: z.string().optional(),

  // Context Optimization
  // Disables 800KB of embedded knowledge resources to reduce context usage
  // Knowledge files still available in dist/knowledge/ if needed
  DISABLE_KNOWLEDGE_RESOURCES: z.coerce.boolean().default(false),

  // Resource Discovery Optimization
  // Defers resource registration until first access (saves 300-500ms on cold start)
  // Disabled by default for compatibility; enable explicitly for production optimization
  DEFER_RESOURCE_DISCOVERY: z.coerce.boolean().default(false),

  // Incremental consent (SaaS deployments)
  INCREMENTAL_CONSENT_ENABLED: z.coerce.boolean().default(false),

  // Enterprise feature flags (all opt-in, default OFF)
  ENABLE_RBAC: z.coerce.boolean().default(false),
  ENABLE_AUDIT_LOGGING: z.coerce.boolean().default(false),
  ENABLE_TENANT_ISOLATION: z.coerce.boolean().default(false),
  ENABLE_IDEMPOTENCY: z.coerce.boolean().default(false),
  ENABLE_COST_TRACKING: z.coerce.boolean().default(false),

  // Predictive Prefetching (80% latency reduction on sequential operations)
  // Intelligently prefetches data based on access patterns (adjacent ranges, predicted next access)
  // Enabled by default - production-ready with circuit breaker and background refresh
  ENABLE_PREFETCH: z.coerce.boolean().default(true),
  PREFETCH_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  PREFETCH_CONCURRENCY: z.coerce.number().int().positive().default(2),
  PREFETCH_BACKGROUND_REFRESH: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validated environment variables
 * Access via `env.PORT`, `env.NODE_ENV`, etc.
 */
export let env: Env;

function ensureEnv(): Env {
  if (!env) {
    env = EnvSchema.parse(process.env);
  }
  return env;
}

/**
 * Validate and parse environment variables
 *
 * Call this early in application startup (before any other initialization)
 * to ensure all required configuration is present and valid.
 *
 * @throws {ZodError} if validation fails, with detailed error messages
 * @returns {Env} Validated environment configuration
 */
export function validateEnv(): Env {
  try {
    env = EnvSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Environment validation failed', { issues: error.issues });

      // Log individual issues for clarity
      for (const issue of error.issues) {
        const path = issue.path.join('.');
        logger.error(`Configuration error: ${path}`, { message: issue.message });
      }

      logger.error(
        'Please check your environment variables or .env file. See .env.example for required configuration.'
      );
      process.exit(1);
    }

    throw error;
  }
}

/**
 * Access validated environment variables without re-parsing.
 * Uses defaults if validateEnv() has not been called yet.
 */
export function getEnv(): Env {
  return ensureEnv();
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return ensureEnv().NODE_ENV === 'production';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return ensureEnv().NODE_ENV === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return ensureEnv().NODE_ENV === 'test';
}

/**
 * Check if Google API credentials are configured
 */
export function hasGoogleCredentials(): boolean {
  const current = ensureEnv();
  return !!(
    current.GOOGLE_CLIENT_ID &&
    current.GOOGLE_CLIENT_SECRET &&
    current.GOOGLE_REDIRECT_URI
  );
}

/**
 * Check if managed authentication mode is enabled
 *
 * When true:
 * - Uses Google Cloud Application Default Credentials (ADC)
 * - Disables sheets_auth tool (not needed)
 * - Skips OAuth infrastructure initialization
 *
 * Set MANAGED_AUTH=true when deploying to:
 * - Google Cloud Run
 * - Google Kubernetes Engine (GKE)
 * - Google Cloud Functions
 * - Any environment with GOOGLE_APPLICATION_CREDENTIALS set
 */
export function isManagedAuth(): boolean {
  return ensureEnv().MANAGED_AUTH;
}

/**
 * Get cache configuration
 */
export function getCacheConfig(): {
  enabled: boolean;
  maxSizeMB: number;
  ttlMs: number;
} {
  const current = ensureEnv();
  return {
    enabled: current.CACHE_ENABLED,
    maxSizeMB: current.CACHE_MAX_SIZE_MB,
    ttlMs: current.CACHE_TTL_MS,
  };
}

/**
 * Get deduplication configuration
 */
export function getDedupConfig(): { enabled: boolean; windowMs: number } {
  const current = ensureEnv();
  return {
    enabled: current.DEDUP_ENABLED,
    windowMs: current.DEDUP_WINDOW_MS,
  };
}

/**
 * Get tracing configuration
 */
export function getTracingConfig(): { enabled: boolean; sampleRate: number } {
  const current = ensureEnv();
  return {
    enabled: current.TRACING_ENABLED,
    sampleRate: current.TRACING_SAMPLE_RATE,
  };
}

/**
 * Get safety limits configuration
 */
export function getSafetyLimits(): {
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  gracefulShutdownTimeoutMs: number;
} {
  const current = ensureEnv();
  return {
    maxConcurrentRequests: current.MAX_CONCURRENT_REQUESTS,
    requestTimeoutMs: current.REQUEST_TIMEOUT_MS,
    gracefulShutdownTimeoutMs: current.GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  };
}

/**
 * Get session store configuration
 *
 * @throws {Error} if redis type is selected but REDIS_URL not provided
 */
export function getSessionStoreConfig(): {
  type: 'memory' | 'redis';
  redisUrl?: string;
} {
  const current = ensureEnv();
  const type = current.SESSION_STORE_TYPE;
  const redisUrl = current.REDIS_URL;

  if (type === 'redis' && !redisUrl) {
    throw new Error(
      'REDIS_URL is required when SESSION_STORE_TYPE=redis. ' +
        'Please provide a Redis connection URL (e.g., redis://localhost:6379)'
    );
  }

  return { type, redisUrl };
}

/**
 * Get circuit breaker configuration
 */
export function getCircuitBreakerConfig(): {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
} {
  const current = ensureEnv();
  return {
    failureThreshold: current.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    successThreshold: current.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
    timeout: current.CIRCUIT_BREAKER_TIMEOUT_MS,
  };
}

/**
 * Get background analysis configuration
 */
export function getBackgroundAnalysisConfig(): {
  enabled: boolean;
  minCells: number;
  debounceMs: number;
} {
  const current = ensureEnv();
  return {
    enabled: current.ENABLE_BACKGROUND_ANALYSIS,
    minCells: current.BACKGROUND_ANALYSIS_MIN_CELLS,
    debounceMs: current.BACKGROUND_ANALYSIS_DEBOUNCE_MS,
  };
}

/**
 * Get distributed cache (Redis) configuration
 */
export function getDistributedCacheConfig(): {
  enabled: boolean;
  redisUrl?: string;
  ttlSeconds: number;
} {
  const current = ensureEnv();
  return {
    enabled: current.CACHE_REDIS_ENABLED && !!current.REDIS_URL,
    redisUrl: current.REDIS_URL,
    ttlSeconds: current.CACHE_REDIS_TTL_SECONDS,
  };
}

/**
 * Check if resource discovery should be deferred
 *
 * When true:
 * - Resource registration is skipped during server initialization
 * - Resources are registered lazily on first tool call
 * - Saves 300-500ms on cold start
 *
 * Enable for:
 * - Production deployments where startup time is critical
 * - Claude Desktop with many resources
 *
 * Keep disabled (default) for:
 * - Testing environments that call resources/list immediately
 * - Development environments
 *
 * Note: Resources will be registered before the first tool call,
 * so they may not be available for immediate resources/list requests.
 */
export function shouldDeferResourceDiscovery(): boolean {
  return ensureEnv().DEFER_RESOURCE_DISCOVERY;
}

/**
 * Get MCP federation configuration
 *
 * When enabled:
 * - ServalSheets can call tools on external MCP servers
 * - Enables composite workflows (e.g., weather data → Sheets)
 * - Requires MCP_FEDERATION_SERVERS JSON configuration
 *
 * Example MCP_FEDERATION_SERVERS:
 * ```json
 * [
 *   {
 *     "name": "weather-api",
 *     "url": "http://localhost:3001",
 *     "auth": {"type": "bearer", "token": "sk-..."}
 *   }
 * ]
 * ```
 */
export function getFederationConfig(): {
  enabled: boolean;
  timeoutMs: number;
  maxConnections: number;
  serversJson?: string;
} {
  const current = ensureEnv();
  return {
    enabled: current.MCP_FEDERATION_ENABLED,
    timeoutMs: current.MCP_FEDERATION_TIMEOUT_MS,
    maxConnections: current.MCP_FEDERATION_MAX_CONNECTIONS,
    serversJson: current.MCP_FEDERATION_SERVERS,
  };
}

/**
 * Get OpenTelemetry OTLP export configuration
 *
 * When enabled:
 * - Exports spans to OTLP collector (Jaeger, Zipkin, Honeycomb, etc.)
 * - Provides production observability and distributed tracing
 * - Batches spans for efficient export
 *
 * Example setup:
 * ```bash
 * # Local Jaeger (all-in-one)
 * docker run -d -p 4318:4318 -p 16686:16686 jaegertracing/all-in-one:latest
 * export OTEL_EXPORT_ENABLED=true
 * export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *
 * # Honeycomb
 * export OTEL_EXPORT_ENABLED=true
 * export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
 * export OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=YOUR_API_KEY"
 * ```
 */
export function getOtlpExportConfig(): {
  enabled: boolean;
  endpoint: string;
  serviceName: string;
  headers?: string;
  batchSize: number;
  exportIntervalMs: number;
  maxQueueSize: number;
} {
  const current = ensureEnv();
  return {
    enabled: current.OTEL_EXPORT_ENABLED,
    endpoint: current.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: current.OTEL_SERVICE_NAME,
    headers: current.OTEL_EXPORTER_OTLP_HEADERS,
    batchSize: current.OTEL_EXPORT_BATCH_SIZE,
    exportIntervalMs: current.OTEL_EXPORT_INTERVAL_MS,
    maxQueueSize: current.OTEL_EXPORT_MAX_QUEUE_SIZE,
  };
}

/**
 * Get predictive prefetching configuration
 *
 * When enabled:
 * - Prefetches data based on access patterns (80% latency reduction)
 * - Background refresh keeps hot data in cache
 * - Circuit breaker prevents quota exhaustion
 * - Low concurrency (2) to avoid interfering with user requests
 *
 * Performance impact:
 * - Sequential operations: 70-80% latency reduction (read → analyze → chart)
 * - First 100 rows on open: Instant response after initial load
 * - Adjacent range reads: Prefetched and cached
 *
 * Safety:
 * - Min confidence threshold (default 0.5) prevents wasteful prefetches
 * - Circuit breaker opens at 30% failure rate
 * - Non-blocking - errors don't affect main operations
 */
export function getPrefetchConfig(): {
  enabled: boolean;
  minConfidence: number;
  concurrency: number;
  backgroundRefresh: boolean;
} {
  const current = ensureEnv();
  return {
    enabled: current.ENABLE_PREFETCH,
    minConfidence: current.PREFETCH_MIN_CONFIDENCE,
    concurrency: current.PREFETCH_CONCURRENCY,
    backgroundRefresh: current.PREFETCH_BACKGROUND_REFRESH,
  };
}
