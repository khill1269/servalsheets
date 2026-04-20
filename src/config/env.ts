/**
 * Environment Variable Validation
 *
 * Zod-based validation for all configuration required by ServalSheets.
 * Runs at startup — any missing or invalid env vars cause immediate failure.
 *
 * MCP Protocol: 2025-11-25
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import type { CircuitBreakerConfig } from '../utils/circuit-breaker.js';

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Strict boolean parsing: rejects string values like "false", "0", "no"
 * Only accepts: true, false (boolean), or undefined (for optional fields)
 */
const StrictBooleanSchema = z
  .boolean()
  .or(z.literal('true').transform(() => true))
  .or(z.literal('false').transform(() => false))
  .default(false);

const PortSchema = z.coerce.number().int().min(1).max(65535);

const URLSchema = z.string().url();

const RedisUrlSchema = z.string().regex(/^rediss?:\/\/\S+$/);

const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']).default('info');

const SessionStoreTypeSchema = z.enum(['memory', 'redis']).default('memory');

// ============================================================================
// Google Cloud Configuration
// ============================================================================

const GoogleCloudSchema = z.object({
  // Service account key (JSON format)
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),

  // Application Default Credentials path
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // OAuth configuration (for user delegation)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: URLSchema.optional(),
});

/**
 * Validate Google credentials are present in at least one form
 */
export function hasGoogleCredentials(env: Partial<Record<string, unknown>>): boolean {
  const hasServiceAccount = !!env['GOOGLE_SERVICE_ACCOUNT_KEY'];
  const hasADC = !!env['GOOGLE_APPLICATION_CREDENTIALS'];
  const hasOAuth =
    !!env['GOOGLE_CLIENT_ID'] && !!env['GOOGLE_CLIENT_SECRET'] && !!env['GOOGLE_REDIRECT_URI'];

  return hasServiceAccount || hasADC || hasOAuth;
}

// ============================================================================
// Circuit Breaker Configurations
// ============================================================================

const CircuitBreakerSchema = z.object({
  failureThreshold: z.number().int().min(1).default(5),
  successThreshold: z.number().int().min(1).default(2),
  timeout: z.number().int().min(1000).default(30000),
});

// ============================================================================
// Redis Configuration
// ============================================================================

const RedisSchema = z.object({
  SESSION_STORE_TYPE: SessionStoreTypeSchema,
  REDIS_URL: RedisUrlSchema.optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: StrictBooleanSchema,
  REDIS_KEY_PREFIX: z.string().default('serval:'),
  REDIS_CACHE_TTL_MS: z.coerce.number().int().min(1000).default(300000),
});

// ============================================================================
// OTEL Configuration
// ============================================================================

const OtelSchema = z.object({
  OTEL_ENABLED: StrictBooleanSchema,
  OTEL_EXPORTER_TYPE: z.enum(['jaeger', 'zipkin', 'honeycomb']).optional(),
  OTEL_JAEGER_ENDPOINT: URLSchema.optional(),
  OTEL_ZIPKIN_ENDPOINT: URLSchema.optional(),
  OTEL_HONEYCOMB_API_KEY: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('servalsheets'),
  OTEL_TRACE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  OTEL_LOG_LEVEL: LogLevelSchema,
});

// ============================================================================
// Prefetch Configuration
// ============================================================================

const PrefetchSchema = z.object({
  PREFETCH_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.8),
  PREFETCH_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
  PREFETCH_BATCH_SIZE: z.coerce.number().int().min(1).default(20),
  PREFETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

// ============================================================================
// Main Environment Schema
// ============================================================================

export const EnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: PortSchema.default(3000),
  STDIO_MODE: StrictBooleanSchema.default(false),
  HTTP_MODE: StrictBooleanSchema.default(false),
  HOST: z.string().default('0.0.0.0'),

  // Logging
  LOG_LEVEL: LogLevelSchema,
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Feature Flags
  ENABLE_REQUEST_MERGING: StrictBooleanSchema.default(true),
  ENABLE_PARALLEL_EXECUTOR: StrictBooleanSchema.default(true),
  ENABLE_AGGRESSIVE_FIELD_MASKS: StrictBooleanSchema.default(true),
  ENABLE_CACHE_COMPRESSION: StrictBooleanSchema.default(true),
  ENABLE_PREFETCH: StrictBooleanSchema.default(true),
  ENABLE_COST_TRACKING: StrictBooleanSchema.default(false),
  ENABLE_METRICS_SERVER: StrictBooleanSchema.default(false),
  METRICS_PORT: z.coerce.number().default(9090),
  METRICS_HOST: z.string().default('0.0.0.0'),
  ENABLE_BILLING_INTEGRATION: StrictBooleanSchema.default(false),
  ENABLE_GRANULAR_PROGRESS: StrictBooleanSchema.default(false),
  ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS: StrictBooleanSchema.default(false),
  ENABLE_RBAC: StrictBooleanSchema.default(false),
  TASK_WATCHDOG_MS: z.coerce.number().int().min(1000).default(300000),

  // Google Cloud
  ...GoogleCloudSchema.shape,

  // Sessions
  ...RedisSchema.shape,

  // OTEL
  ...OtelSchema.shape,
  OTEL_LOG_SPANS: StrictBooleanSchema.default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: URLSchema.optional(),
  OTEL_EXPORTER_OTLP_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  OTEL_EXPORTER_OTLP_EXPORT_INTERVAL_MS: z.coerce.number().int().min(100).default(5000),

  // Prefetch
  ...PrefetchSchema.shape,
  PREFETCH_MAX_PREDICTIONS: z.coerce.number().int().min(1).default(50),

  // Circuit Breakers
  CIRCUIT_BREAKER_OAUTH: z.string().optional(),
  CIRCUIT_BREAKER_APPSSCRIPT: z.string().optional(),
  CIRCUIT_BREAKER_SNAPSHOT: z.string().optional(),
  CIRCUIT_BREAKER_WEBHOOK_DELIVERY: z.string().optional(),
  CIRCUIT_BREAKER_WEBHOOK_WORKER: z.string().optional(),
  CIRCUIT_BREAKER_FEDERATION: z.string().optional(),

  // Billing (optional)
  BILLING_ENABLED: StrictBooleanSchema.default(false),
  STRIPE_SECRET_KEY: z.string().optional(),

  // Production Safety
  TENANT_ISOLATION_REQUIRED: StrictBooleanSchema.default(false),
  DATA_DIR: z.string().default('/tmp/serval'),
  CHECKPOINT_DIR: z.string().optional(),
  PERSIST_CHECKPOINTS: StrictBooleanSchema.default(false),
  ENABLE_SAMPLING: StrictBooleanSchema.default(true),

  // Tenant / Session
  ENABLE_TENANT_ISOLATION: StrictBooleanSchema.default(false),
  SESSION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(3600000),

  // Admin Authentication
  ADMIN_SECRET: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_VIEWER_KEY: z.string().optional(),

  // OAuth
  OAUTH_ISSUER: z.string().default(''),
  OAUTH_MAX_TOKEN_TTL: z.coerce.number().int().min(1).default(86400),
  OAUTH_CLIENT_ID: z.string().default(''),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  ALLOWED_REDIRECT_URIS: z.string().default(''),
  ACCESS_TOKEN_TTL: z.coerce.number().int().min(1).default(3600),
  REFRESH_TOKEN_TTL: z.coerce.number().int().min(1).default(86400),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(1000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(10000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_BURST: z.coerce.number().int().min(1).default(50),

  // Request Limits
  MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).default(100),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  SAMPLING_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),

  // Response Handling
  COMPACT_RESPONSES: StrictBooleanSchema.default(true),
  VALIDATE_OUTPUT_SCHEMAS: StrictBooleanSchema.default(false),
  MCP_NON_FATAL_TOOL_ERRORS: StrictBooleanSchema.default(false),
  STRICT_MCP_PROTOCOL_VERSION: StrictBooleanSchema.default(false),

  // Parallel Executor
  PARALLEL_CONCURRENCY: z.coerce.number().int().min(1).default(20),
  PARALLEL_EXECUTOR_THRESHOLD: z.coerce.number().int().min(1).default(100),
  PARALLEL_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  // Request Merging
  REQUEST_MERGER_WINDOW_MS: z.coerce.number().int().min(0).default(50),

  // ETag Cache
  ETAG_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).default(1000),

  // Composite operations
  COMPOSITE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000),

  // Per-spreadsheet throttling
  PER_SPREADSHEET_RPS: z.coerce.number().min(0.1).default(10),

  // Discovery API
  DISCOVERY_API_ENABLED: StrictBooleanSchema.default(true),
  DISCOVERY_CACHE_TTL: z.coerce.number().int().min(1000).default(300000),

  // Streamable HTTP event store
  STREAMABLE_HTTP_EVENT_TTL_MS: z.coerce.number().int().min(1000).default(300000),
  STREAMABLE_HTTP_EVENT_MAX_EVENTS: z.coerce.number().int().min(1).default(1000),

  // Legacy compatibility
  ENABLE_LEGACY_SSE: StrictBooleanSchema.default(false),

  // Idempotency
  ENABLE_IDEMPOTENCY: StrictBooleanSchema.default(false),

  // Payload Validation
  ENABLE_PAYLOAD_VALIDATION: StrictBooleanSchema.default(true),

  // Checkpoints
  ENABLE_CHECKPOINTS: StrictBooleanSchema.default(false),
  TRANSACTION_WAL_DIR: z.string().optional(),

  // Audit Logging
  ENABLE_AUDIT_LOGGING: StrictBooleanSchema.default(false),
  AUDIT_HMAC_SECRET: z.string().optional(),
  AUDIT_LOG_DIR: z.string().optional(),
  AUDIT_LOG_ENCRYPTION_KEY: z.string().optional(),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),

  // Action Log Sheet
  ENABLE_ACTION_LOG_SHEET: StrictBooleanSchema.default(false),
  ACTION_LOG_SPREADSHEET_ID: z.string().optional(),
  ACTION_LOG_SHEET_NAME: z.string().default('Action Log'),

  // CORS
  CORS_ORIGINS: z.string().default(''),

  // Federation
  MCP_FEDERATION_SERVERS: z.string().optional(),
  MCP_FEDERATION_DNS_STRICT: StrictBooleanSchema.default(true),
  MCP_REMOTE_EXECUTOR_DNS_STRICT: StrictBooleanSchema.default(true),
  PLAN_ENCRYPTION_KEY: z.string().optional(),

  // Webhooks
  WEBHOOK_DNS_STRICT: StrictBooleanSchema.default(true),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),

  // Transactions
  TRANSACTIONS_ENABLED: StrictBooleanSchema.default(true),
  TRANSACTIONS_AUTO_SNAPSHOT: StrictBooleanSchema.default(true),
  TRANSACTIONS_AUTO_ROLLBACK: StrictBooleanSchema.default(true),
  MAX_TRANSACTION_OPS: z.coerce.number().int().min(1).default(100),

  // Access Pattern Tracking
  ACCESS_PATTERN_MAX_HISTORY: z.coerce.number().int().min(1).default(100),
  ACCESS_PATTERN_WINDOW_MS: z.coerce.number().int().min(1000).default(300000),

  // Sampling Consent
  SAMPLING_CONSENT_CACHE_TTL_MS: z.coerce.number().int().min(1000).default(300000),

  // BigQuery
  MAX_BIGQUERY_RESULT_ROWS: z.coerce.number().int().min(1).default(100000),

  // AppsScript
  APPSSCRIPT_MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).default(5),
  ENABLE_APPSSCRIPT_TRIGGER_COMPAT: StrictBooleanSchema.default(false),

  // Google API
  GOOGLE_API_HTTP2_ENABLED: StrictBooleanSchema.default(true),
  ENABLE_CONDITIONAL_REQUESTS: StrictBooleanSchema.default(true),
  ENABLE_DATAFILTER_BATCH: StrictBooleanSchema.default(true),
  ENABLE_TABLE_APPENDS: StrictBooleanSchema.default(true),
  ENABLE_AUTO_CONNECTION_RESET: StrictBooleanSchema.default(true),

  // Python Compute
  ENABLE_PYTHON_COMPUTE: StrictBooleanSchema.default(false),

  // Mutation Safety
  MUTATION_VERIFY_STRICT: StrictBooleanSchema.default(false),

  // Incremental OAuth Consent
  INCREMENTAL_CONSENT_ENABLED: StrictBooleanSchema.default(true),
});

export type Env = z.infer<typeof EnvSchema>;

// ============================================================================
// Validation & Export
// ============================================================================

export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    // Zod v4 uses .issues; v3 used .errors
    const errorList = result.error.issues ?? [];
    const errors = Array.isArray(errorList)
      ? errorList.map((e) => `${(e.path ?? []).join('.')}: ${e.message}`).join('\n  ')
      : String(result.error);
    logger.error(`Environment validation failed:\n  ${errors}`);
    process.exit(1);
  }

  const env = result.data;

  // ========================================================================
  // Production Validation
  // ========================================================================

  if (env.NODE_ENV === 'production' && process.env['SKIP_PREFLIGHT'] !== 'true') {
    // Google credentials must be present
    if (!hasGoogleCredentials(env)) {
      logger.error(
        'Production requires Google credentials (GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_APPLICATION_CREDENTIALS, or OAuth config)'
      );
      process.exit(1);
    }

    // OTEL must be configured for distributed tracing
    if (!env.OTEL_ENABLED) {
      logger.warn(
        'Production deployment should enable OTEL for distributed tracing (OTEL_ENABLED=true)'
      );
    }

    // Redis is required if tenant isolation is enabled
    if (env.TENANT_ISOLATION_REQUIRED && env.SESSION_STORE_TYPE === 'memory') {
      logger.error('Tenant isolation requires Redis (SESSION_STORE_TYPE=redis with REDIS_URL)');
      process.exit(1);
    }

    // Data directory must be persistent (not /tmp)
    if (env.DATA_DIR === '/tmp/serval') {
      logger.warn(
        'Data directory is /tmp/serval which will be lost on restart. Set DATA_DIR to a persistent volume.'
      );
    }

    // If checkpoints are enabled, directory must be persistent
    if (env.PERSIST_CHECKPOINTS && env.CHECKPOINT_DIR === '/tmp') {
      logger.error(
        'Persistent checkpoints require CHECKPOINT_DIR on a persistent volume (not /tmp)'
      );
      process.exit(1);
    }

    // Sampling consent must be handled for multi-tenant deployments
    if (env.TENANT_ISOLATION_REQUIRED && !env.ENABLE_SAMPLING) {
      logger.warn(
        'Multi-tenant deployment should consider sampling constraints (ENABLE_SAMPLING=true with consent)'
      );
    }
  }

  // ========================================================================
  // Redis Validation
  // ========================================================================

  if (env.SESSION_STORE_TYPE === 'redis' && !env.REDIS_URL) {
    logger.error('SESSION_STORE_TYPE=redis requires REDIS_URL to be set');
    process.exit(1);
  }

  // ========================================================================
  // OTEL Validation
  // ========================================================================

  if (env.OTEL_ENABLED) {
    if (!env.OTEL_EXPORTER_TYPE) {
      logger.error('OTEL_ENABLED requires OTEL_EXPORTER_TYPE (jaeger|zipkin|honeycomb)');
      process.exit(1);
    }

    if (env.OTEL_EXPORTER_TYPE === 'jaeger' && !env.OTEL_JAEGER_ENDPOINT) {
      logger.error('OTEL_EXPORTER_TYPE=jaeger requires OTEL_JAEGER_ENDPOINT');
      process.exit(1);
    }

    if (env.OTEL_EXPORTER_TYPE === 'zipkin' && !env.OTEL_ZIPKIN_ENDPOINT) {
      logger.error('OTEL_EXPORTER_TYPE=zipkin requires OTEL_ZIPKIN_ENDPOINT');
      process.exit(1);
    }

    if (env.OTEL_EXPORTER_TYPE === 'honeycomb' && !env.OTEL_HONEYCOMB_API_KEY) {
      logger.error('OTEL_EXPORTER_TYPE=honeycomb requires OTEL_HONEYCOMB_API_KEY');
      process.exit(1);
    }
  }

  // ========================================================================
  // Billing Validation
  // ========================================================================

  if (env.BILLING_ENABLED && !env.STRIPE_SECRET_KEY) {
    logger.error('BILLING_ENABLED requires STRIPE_SECRET_KEY');
    process.exit(1);
  }

  return env;
}

/**
 * Parse circuit breaker config from JSON or use defaults
 */
export function parseCircuitBreakerConfig(
  key: string,
  defaultConfig: CircuitBreakerConfig
): CircuitBreakerConfig {
  const value = process.env[key];
  if (!value) return defaultConfig;

  try {
    const parsed = JSON.parse(value);
    return CircuitBreakerSchema.parse(parsed);
  } catch (error) {
    logger.warn(`Failed to parse ${key}, using defaults`, { error });
    return defaultConfig;
  }
}

/**
 * Get default circuit breaker configuration
 */
export function getCircuitBreakerConfig(): CircuitBreakerConfig {
  return parseCircuitBreakerConfig('CIRCUIT_BREAKER_DEFAULT', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });
}

/**
 * Get API-specific circuit breaker configuration
 * Falls back to defaults if the env var is not set or invalid
 */
export function getApiSpecificCircuitBreakerConfig(apiName: string): CircuitBreakerConfig {
  const key = `CIRCUIT_BREAKER_${apiName.toUpperCase()}`;
  return parseCircuitBreakerConfig(key, {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });
}

/**
 * Default directory for user profile storage (volatile fallback)
 */
export const DEFAULT_PROFILE_STORAGE_DIR = '/tmp/servalsheets-profiles';

/**
 * Default directory for checkpoints
 */
export const DEFAULT_CHECKPOINT_DIR = '/tmp/serval-checkpoints';

/**
 * Get session store configuration
 */
export function getSessionStoreConfig(): { type: 'memory' | 'redis'; redisUrl?: string } {
  const e = getEnv();
  return {
    type: e.SESSION_STORE_TYPE,
    redisUrl: e.REDIS_URL,
  };
}

/**
 * Get federation configuration
 */
export function getFederationConfig(): {
  enabled: boolean;
  servers: string[];
  dnsStrict: boolean;
  serversJson?: string;
} {
  const e = getEnv();
  const servers = e.MCP_FEDERATION_SERVERS
    ? e.MCP_FEDERATION_SERVERS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return {
    enabled: servers.length > 0,
    servers,
    dnsStrict: e.MCP_FEDERATION_DNS_STRICT,
    serversJson: e.MCP_FEDERATION_SERVERS,
  };
}

/**
 * Get OTLP export configuration
 */
export function getOtlpExportConfig(): {
  endpoint: string;
  serviceName: string;
  enabled: boolean;
  batchSize: number;
  exportIntervalMs: number;
} {
  const e = getEnv();
  return {
    endpoint: e.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    serviceName: e.OTEL_SERVICE_NAME,
    enabled: e.OTEL_ENABLED,
    batchSize: e.OTEL_EXPORTER_OTLP_BATCH_SIZE,
    exportIntervalMs: e.OTEL_EXPORTER_OTLP_EXPORT_INTERVAL_MS,
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
  const e = getEnv();
  return {
    enabled: e.NODE_ENV !== 'test',
    minCells: 50,
    debounceMs: 5000,
  };
}

/**
 * Get distributed cache configuration
 */
export function getDistributedCacheConfig(): {
  enabled: boolean;
  redisUrl?: string;
  ttlMs: number;
} {
  const e = getEnv();
  return {
    enabled: e.SESSION_STORE_TYPE === 'redis' && !!e.REDIS_URL,
    redisUrl: e.REDIS_URL,
    ttlMs: e.REDIS_CACHE_TTL_MS,
  };
}

/**
 * Get prefetch configuration
 */
export function getPrefetchConfig(): {
  enabled: boolean;
  minConfidence: number;
  maxConcurrency: number;
  batchSize: number;
  timeoutMs: number;
  maxPredictions: number;
} {
  const e = getEnv();
  return {
    enabled: e.ENABLE_PREFETCH,
    minConfidence: e.PREFETCH_MIN_CONFIDENCE,
    maxConcurrency: e.PREFETCH_MAX_CONCURRENCY,
    batchSize: e.PREFETCH_BATCH_SIZE,
    timeoutMs: e.PREFETCH_TIMEOUT_MS,
    maxPredictions: e.PREFETCH_MAX_PREDICTIONS,
  };
}

/**
 * Get remote MCP executor configuration
 */
export function getRemoteMcpExecutorConfig(): {
  enabled: boolean;
  url?: string;
  timeoutMs: number;
  allowedTools: string[];
  auth?: { readonly type: 'bearer' | 'api-key'; readonly token: string };
} {
  const e = getEnv();
  return {
    enabled: false, // Feature not yet enabled via env
    url: undefined,
    timeoutMs: e.REQUEST_TIMEOUT_MS,
    allowedTools: [],
  };
}

/**
 * Check if resource discovery should be deferred
 */
export function shouldDeferResourceDiscovery(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * Get validated environment on module load
 */
export let env: Env = validateEnv();

/**
 * Reset the env cache. FOR TEST USE ONLY.
 * Call before setting process.env vars that need to be re-parsed.
 */
export function resetEnvForTest(): void {
  env = undefined as unknown as Env;
}

/**
 * Lazy accessor for validated environment (used by modules that may load before env is ready)
 */
export function getEnv(): Env {
  if (!env) {
    env = validateEnv();
  }
  return env;
}
