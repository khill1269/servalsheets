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

// Base Schemas

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

// Google Cloud Configuration

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
export function hasGoogleCredentials(env: Partial<Record<string, string>>): boolean {
  const hasServiceAccount = !!env['GOOGLE_SERVICE_ACCOUNT_KEY'];
  const hasADC = !!env['GOOGLE_APPLICATION_CREDENTIALS'];
  const hasOAuth =
    !!env['GOOGLE_CLIENT_ID'] && !!env['GOOGLE_CLIENT_SECRET'] && !!env['GOOGLE_REDIRECT_URI'];

  return hasServiceAccount || hasADC || hasOAuth;
}

// Circuit Breaker Configurations

const CircuitBreakerSchema: z.ZodType<CircuitBreakerConfig> = z.object({
  failureThreshold: z.number().int().min(1).default(5),
  successThreshold: z.number().int().min(1).default(2),
  timeout: z.number().int().min(1000).default(30000),
  name: z.string().optional(),
});

// Redis Configuration

const RedisSchema = z.object({
  SESSION_STORE_TYPE: SessionStoreTypeSchema,
  // Treat empty string as unset — smoke tests and container runtimes sometimes
  // pass through `REDIS_URL=` to explicitly opt out of Redis. Without this
  // preprocess, Zod tests the empty string against the regex and fails,
  // which `enhanceStartupError` then rewrites as a misleading "Cannot connect
  // to Redis server" banner.
  REDIS_URL: z.preprocess((value) => (value === '' ? undefined : value), RedisUrlSchema.optional()),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: StrictBooleanSchema,
  REDIS_KEY_PREFIX: z.string().default('serval:'),
  REDIS_CACHE_TTL_MS: z.coerce.number().int().min(1000).default(300000),
});

// OTEL Configuration

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

// Prefetch Configuration

const PrefetchSchema = z.object({
  PREFETCH_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.8),
  PREFETCH_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
  PREFETCH_BATCH_SIZE: z.coerce.number().int().min(1).default(20),
  PREFETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

// Main Environment Schema

export const EnvSchema = z
  .object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: PortSchema.default(3000),
    STDIO_MODE: StrictBooleanSchema.default(false),
    HTTP_MODE: StrictBooleanSchema.default(false),
    HOST: z.string().default('0.0.0.0'),

    // Logging
    LOG_LEVEL: LogLevelSchema,
    LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
    // Per-tool debug tracing (dev only): set DEBUG_TOOL=sheets_data to enable debug logs for that tool.
    // Combine with DEBUG_ACTION=read to filter to a single action. DEBUG_VERBOSE=true includes payloads.
    DEBUG_TOOL: z.string().optional(),
    DEBUG_ACTION: z.string().optional(),
    DEBUG_VERBOSE: StrictBooleanSchema.default(false),

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

    // Google Cloud
    ...GoogleCloudSchema.shape,

    // Sessions & Redis
    ...RedisSchema.shape,

    // OTEL
    ...OtelSchema.shape,

    // Prefetch
    ...PrefetchSchema.shape,

    // Circuit Breakers
    CIRCUIT_BREAKER_OAUTH: z.string().optional(),
    CIRCUIT_BREAKER_APPSSCRIPT: z.string().optional(),
    CIRCUIT_BREAKER_SNAPSHOT: z.string().optional(),
    CIRCUIT_BREAKER_WEBHOOK_DELIVERY: z.string().optional(),
    CIRCUIT_BREAKER_WEBHOOK_WORKER: z.string().optional(),
    CIRCUIT_BREAKER_FEDERATION: z.string().optional(),

    // Concurrency
    MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).default(10),

    // Request Merger
    REQUEST_MERGER_WINDOW_MS: z.coerce.number().int().min(1).default(50),

    // Prefetch (extended)
    PREFETCH_MAX_PREDICTIONS: z.coerce.number().int().min(1).default(10),

    // Access Pattern Tracker
    ACCESS_PATTERN_MAX_HISTORY: z.coerce.number().int().min(1).default(1000),
    ACCESS_PATTERN_WINDOW_MS: z.coerce.number().int().min(1).default(5000),

    // Feature flags (additional)
    ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS: StrictBooleanSchema.default(false),

    // Billing (optional)
    BILLING_ENABLED: StrictBooleanSchema.default(false),
    STRIPE_SECRET_KEY: z.string().optional(),

    // HTTP Transport
    CORS_ORIGINS: z.string().default(''),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(1000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
    ENABLE_LEGACY_SSE: StrictBooleanSchema.default(false),
    STREAMABLE_HTTP_EVENT_TTL_MS: z.coerce.number().int().min(1000).default(300000),
    STREAMABLE_HTTP_EVENT_MAX_EVENTS: z.coerce.number().int().min(1).default(1000),

    // Production Safety
    TENANT_ISOLATION_REQUIRED: StrictBooleanSchema.default(false),
    ENABLE_RBAC: StrictBooleanSchema.default(false),
    DATA_DIR: z.string().default('/tmp/servalsheets'),
    PROFILE_STORAGE_DIR: z.string().optional(),
    CHECKPOINT_DIR: z.string().optional(),
    ENABLE_CHECKPOINTS: StrictBooleanSchema.default(false),
    PERSIST_CHECKPOINTS: StrictBooleanSchema.default(false),
    ENABLE_SAMPLING: StrictBooleanSchema.default(true),

    // Sampling Consent (GDPR gate)
    // When true, assertSamplingConsent() requires explicit opt-in before any LLM sampling call.
    // Set to false only in trusted internal deployments where consent is handled upstream.
    SAMPLING_CONSENT_REQUIRED: StrictBooleanSchema.default(false),
    // TTL for sampling consent cache (milliseconds). Default: 5 minutes.
    SAMPLING_CONSENT_CACHE_TTL_MS: z.coerce.number().int().min(1000).default(300000),

    // Conditional Requests (ETag-based caching)
    // When true, cached-sheets-api.ts sends If-None-Match headers to avoid redundant data
    // transfers. Reduces Google Sheets API quota usage by 80-100x on repeated reads.
    ENABLE_CONDITIONAL_REQUESTS: StrictBooleanSchema.default(true),

    // Plan Encryption
    PLAN_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'Must be exactly 64 hexadecimal characters (32 bytes)')
      .optional(),

    // Discovery API Configuration
    DISCOVERY_API_ENABLED: StrictBooleanSchema.default(false),
    DISCOVERY_CACHE_TTL: z.coerce.number().int().min(1).default(2592000), // 30 days in seconds

    // Remote MCP Executor Configuration
    MCP_REMOTE_EXECUTOR_URL: z.string().optional(),
    MCP_REMOTE_EXECUTOR_TOOLS: z.string().optional(),
    MCP_REMOTE_EXECUTOR_AUTH_TYPE: z.string().optional(),
    MCP_REMOTE_EXECUTOR_AUTH_TOKEN: z.string().optional(),
  })
  .passthrough();

export type Env = z.infer<typeof EnvSchema>;

// Validation & Export

// The `_throwOnError` parameter is preserved for call-site compatibility (tests
// pass `true`); the function now always throws on validation failure, so the
// argument is intentionally unused. Underscore prefix satisfies eslint
// @typescript-eslint/no-unused-vars without breaking existing callers.
export function validateEnv(_throwOnError: boolean = false): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    // Zod v4 uses .issues instead of .errors
    const errorList = result.error.issues ?? [];
    const errors = Array.isArray(errorList)
      ? errorList.map((e) => `${(e.path ?? []).join('.')}: ${e.message}`).join('\n  ')
      : String(result.error);
    const message = `Environment validation failed:\n  ${errors}`;
    logger.error(message);
    throw new Error(message);
  }

  const env = result.data;

  // Production Validation

  if (env['NODE_ENV'] === 'production') {
    // Data directory must be persistent (not /tmp) — check FIRST so tests can focus on this
    if (env['DATA_DIR']?.startsWith('/tmp')) {
      const message = 'DATA_DIR must point to persistent storage in production (not /tmp)';
      logger.error(message);
      throw new Error(message);
    }

    // Profile storage directory must be persistent if set
    if (env['PROFILE_STORAGE_DIR']?.startsWith('/tmp')) {
      const message =
        'PROFILE_STORAGE_DIR must point to persistent storage in production (not /tmp)';
      logger.error(message);
      throw new Error(message);
    }

    // If checkpoints are enabled, directory must be persistent
    if (env['ENABLE_CHECKPOINTS'] && env['CHECKPOINT_DIR']?.startsWith('/tmp')) {
      const message =
        'CHECKPOINT_DIR must point to persistent storage when checkpoints are enabled in production (not /tmp)';
      logger.error(message);
      throw new Error(message);
    }

    // Google credentials must be present (bypass allowed in test/preflight-skip mode)
    if (
      process.env['SKIP_PREFLIGHT'] !== 'true' &&
      !hasGoogleCredentials(env as Partial<Record<string, string>>)
    ) {
      const message =
        'Production requires Google credentials (GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_APPLICATION_CREDENTIALS, or OAuth config)';
      logger.error(message);
      throw new Error(message);
    }

    // OTEL must be configured for distributed tracing
    if (!env['OTEL_ENABLED']) {
      logger.warn(
        'Production deployment should enable OTEL for distributed tracing (OTEL_ENABLED=true)'
      );
    }

    // Redis is required if tenant isolation is enabled
    if (env['TENANT_ISOLATION_REQUIRED'] && env['SESSION_STORE_TYPE'] === 'memory') {
      const message = 'Tenant isolation requires Redis (SESSION_STORE_TYPE=redis with REDIS_URL)';
      logger.error(message);
      throw new Error(message);
    }

    // Sampling consent must be handled for multi-tenant deployments
    if (env['TENANT_ISOLATION_REQUIRED'] && !env['ENABLE_SAMPLING']) {
      logger.warn(
        'Multi-tenant deployment should consider sampling constraints (ENABLE_SAMPLING=true with consent)'
      );
    }
  }

  // Redis Validation

  if (env['SESSION_STORE_TYPE'] === 'redis' && !env['REDIS_URL']) {
    const message = 'SESSION_STORE_TYPE=redis requires REDIS_URL to be set';
    logger.error(message);
    throw new Error(message);
  }

  // OTEL Validation

  if (env['OTEL_ENABLED']) {
    if (!env['OTEL_EXPORTER_TYPE']) {
      const message = 'OTEL_ENABLED requires OTEL_EXPORTER_TYPE (jaeger|zipkin|honeycomb)';
      logger.error(message);
      throw new Error(message);
    }

    if (env['OTEL_EXPORTER_TYPE'] === 'jaeger' && !env['OTEL_JAEGER_ENDPOINT']) {
      const message = 'OTEL_EXPORTER_TYPE=jaeger requires OTEL_JAEGER_ENDPOINT';
      logger.error(message);
      throw new Error(message);
    }

    if (env['OTEL_EXPORTER_TYPE'] === 'zipkin' && !env['OTEL_ZIPKIN_ENDPOINT']) {
      const message = 'OTEL_EXPORTER_TYPE=zipkin requires OTEL_ZIPKIN_ENDPOINT';
      logger.error(message);
      throw new Error(message);
    }

    if (env['OTEL_EXPORTER_TYPE'] === 'honeycomb' && !env['OTEL_HONEYCOMB_API_KEY']) {
      const message = 'OTEL_EXPORTER_TYPE=honeycomb requires OTEL_HONEYCOMB_API_KEY';
      logger.error(message);
      throw new Error(message);
    }
  }

  // Billing Validation

  if (env['BILLING_ENABLED'] && !env['STRIPE_SECRET_KEY']) {
    const message = 'BILLING_ENABLED requires STRIPE_SECRET_KEY';
    logger.error(message);
    throw new Error(message);
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
 * Default directory for user profile storage (volatile fallback)
 */
export const DEFAULT_PROFILE_STORAGE_DIR = '/tmp/servalsheets-profiles';
export const DEFAULT_CHECKPOINT_DIR = '/tmp/servalsheets-checkpoints';

// Config Accessor Functions
// IMPORTANT: These functions are declared BEFORE `export const env = validateEnv()`
// because tsc in Docker (with type errors + || true) can produce truncated output
// that omits exports appearing after the validateEnv() call. Functions reference
// `env` but are only called at runtime (not module load), so hoisting is safe.
// See: https://github.com/khill1269/servalsheets/issues/docker-truncated-emit

export function shouldDeferResourceDiscovery(): boolean {
  return process.env['DEFER_RESOURCE_DISCOVERY'] === 'true';
}

export function getPrefetchConfig(): { enabled: boolean } {
  return { enabled: process.env['ENABLE_PREFETCHING'] === 'true' };
}

export function getOtlpExportConfig(): {
  enabled: boolean;
  endpoint: string;
  serviceName: string;
  batchSize: number;
  exportIntervalMs: number;
  exporterType: string;
  honeycombApiKey: string | undefined;
} {
  const e = getEnv();
  const endpoint =
    ((e as Record<string, unknown>)['OTEL_JAEGER_ENDPOINT'] as string) ??
    ((e as Record<string, unknown>)['OTEL_ZIPKIN_ENDPOINT'] as string) ??
    'http://localhost:4318/v1/traces';
  return {
    enabled: ((e as Record<string, unknown>)['OTEL_ENABLED'] as boolean) ?? false,
    endpoint,
    serviceName: ((e as Record<string, unknown>)['OTEL_SERVICE_NAME'] as string) ?? 'servalsheets',
    batchSize: 100,
    exportIntervalMs: 5000,
    exporterType: ((e as Record<string, unknown>)['OTEL_EXPORTER_TYPE'] as string) ?? 'otlp',
    honeycombApiKey: (e as Record<string, unknown>)['OTEL_HONEYCOMB_API_KEY'] as string | undefined,
  };
}

export function getCircuitBreakerConfig(): CircuitBreakerConfig {
  return { failureThreshold: 5, successThreshold: 2, timeout: 30000 };
}

export function getApiSpecificCircuitBreakerConfig(api: string): CircuitBreakerConfig {
  const key = `CIRCUIT_BREAKER_${api.toUpperCase()}`;
  return parseCircuitBreakerConfig(key, getCircuitBreakerConfig());
}

export function getDistributedCacheConfig(): { enabled: boolean } {
  return { enabled: false };
}

export function getBackgroundAnalysisConfig(): { enabled: boolean; intervalMs: number } {
  return { enabled: true, intervalMs: 60000 };
}

export function getFederationConfig(): { enabled: boolean } {
  return { enabled: true };
}

export function getRemoteMcpExecutorConfig(): {
  enabled: boolean;
  url?: string;
  allowedTools: string[];
  auth?: { type: string; token: string };
  maxConcurrent: number;
  timeoutMs: number;
} {
  const e = getEnv();
  const url = (e as Record<string, unknown>)['MCP_REMOTE_EXECUTOR_URL'] as string | undefined;
  const toolsStr = (e as Record<string, unknown>)['MCP_REMOTE_EXECUTOR_TOOLS'] as
    | string
    | undefined;
  const authType = (e as Record<string, unknown>)['MCP_REMOTE_EXECUTOR_AUTH_TYPE'] as
    | string
    | undefined;
  const authToken = (e as Record<string, unknown>)['MCP_REMOTE_EXECUTOR_AUTH_TOKEN'] as
    | string
    | undefined;

  // Parse and clean tool list
  const allowedTools = (toolsStr || '')
    .split(',')
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);

  // Enabled only if URL exists and tools are explicitly declared
  const enabled = !!url && allowedTools.length > 0;

  const config: {
    enabled: boolean;
    url?: string;
    allowedTools: string[];
    auth?: { type: string; token: string };
    maxConcurrent: number;
    timeoutMs: number;
  } = {
    enabled,
    allowedTools,
    maxConcurrent: 5,
    timeoutMs: 30000,
  };

  // Always include URL if it was set, regardless of enabled status
  if (url) {
    config.url = url;
  }

  // Only include auth if it's fully specified
  if (enabled && authType && authToken) {
    config.auth = { type: authType, token: authToken };
  }

  return config;
}

export function getSessionStoreConfig(): { type: string; redisUrl?: string } {
  const e = getEnv();
  const storeType = (e as Record<string, unknown>)['SESSION_STORE_TYPE'] as string;
  const redisUrl = (e as Record<string, unknown>)['REDIS_URL'] as string | undefined;

  if (storeType === 'redis') {
    if (!redisUrl || !redisUrl.match(/^rediss?:\/\//)) {
      const message =
        'REDIS_URL is required when SESSION_STORE_TYPE=redis and must start with redis:// or rediss://';
      logger.error(message);
      throw new Error(message);
    }
    return { type: 'redis', redisUrl };
  }

  return { type: storeType || 'memory' };
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

/**
 * Reset the env cache. FOR TEST USE ONLY.
 * Call before setting process.env vars that need to be re-parsed.
 */
export function resetEnvForTest(): void {
  env = undefined as unknown as Env;
}

// Module Initialization
//
// env is populated lazily on first getEnv() call rather than at import time.
// This prevents process.exit(1) from firing before the MCP server can emit a
// structured error to the client.  Callers that import `env` directly (e.g.
// rate-limit-middleware, routes-webhooks, oauth-provider) all access it inside
// function bodies that run after server startup, so the value will be set by
// the time they read it.
//
// IMPORTANT: never call getEnv() at module scope in files that import env.ts —
// that re-introduces the eager-exit anti-pattern.  Use getEnv() inside
// functions only.
export let env: Env = undefined as unknown as Env;
