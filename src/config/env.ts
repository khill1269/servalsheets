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
const StrictBooleanSchema = z.boolean().or(z.literal('true').transform(() => true)).or(z.literal('false').transform(() => false)).default(false);

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
export function hasGoogleCredentials(env: Partial<Record<string, string>>): boolean {
  const hasServiceAccount = !!env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const hasADC = !!env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasOAuth =
    !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET && !!env.GOOGLE_REDIRECT_URI;

  return hasServiceAccount || hasADC || hasOAuth;
}

// ============================================================================
// Circuit Breaker Configurations
// ============================================================================

const CircuitBreakerSchema: z.ZodType<CircuitBreakerConfig> = z.object({
  enabled: z.boolean().default(true),
  failureThreshold: z.number().int().min(1).default(5),
  resetTimeout: z.number().int().min(1000).default(30000),
  halfOpenRequests: z.number().int().min(1).default(3),
  readOnlyMode: z.boolean().default(false),
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

    // Feature Flags
    ENABLE_REQUEST_MERGING: StrictBooleanSchema.default(true),
    ENABLE_PARALLEL_EXECUTOR: StrictBooleanSchema.default(true),
    ENABLE_AGGRESSIVE_FIELD_MASKS: StrictBooleanSchema.default(true),
    ENABLE_CACHE_COMPRESSION: StrictBooleanSchema.default(true),
    ENABLE_PREFETCH: StrictBooleanSchema.default(true),
    ENABLE_COST_TRACKING: StrictBooleanSchema.default(false),

    // Google Cloud
    ...GoogleCloudSchema.shape,

    // Sessions
    ...SessionStoreTypeSchema.optional().transform(() => ({})).shape,
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

    // Billing (optional)
    BILLING_ENABLED: StrictBooleanSchema.default(false),
    STRIPE_SECRET_KEY: z.string().optional(),

    // Production Safety
    TENANT_ISOLATION_REQUIRED: StrictBooleanSchema.default(false),
    DATA_DIR: z.string().default('/tmp/serval'),
    CHECKPOINT_DIR: z.string().optional(),
    PERSIST_CHECKPOINTS: StrictBooleanSchema.default(false),
    ENABLE_SAMPLING: StrictBooleanSchema.default(true),
  })
  .strict();

export type Env = z.infer<typeof EnvSchema>;

// ============================================================================
// Validation & Export
// ============================================================================

export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('\n  ');
    logger.error(`Environment validation failed:\n  ${errors}`);
    process.exit(1);
  }

  const env = result.data;

  // ========================================================================
  // Production Validation
  // ========================================================================

  if (env.NODE_ENV === 'production') {
    // Google credentials must be present
    if (!hasGoogleCredentials(env)) {
      logger.error(
        'Production requires Google credentials (GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_APPLICATION_CREDENTIALS, or OAuth config)'
      );
      process.exit(1);
    }

    // OTEL must be configured for distributed tracing
    if (!env.OTEL_ENABLED) {
      logger.warn('Production deployment should enable OTEL for distributed tracing (OTEL_ENABLED=true)');
    }

    // Redis is required if tenant isolation is enabled
    if (env.TENANT_ISOLATION_REQUIRED && env.SESSION_STORE_TYPE === 'memory') {
      logger.error('Tenant isolation requires Redis (SESSION_STORE_TYPE=redis with REDIS_URL)');
      process.exit(1);
    }

    // Data directory must be persistent (not /tmp)
    if (env.DATA_DIR === '/tmp/serval') {
      logger.warn('Data directory is /tmp/serval which will be lost on restart. Set DATA_DIR to a persistent volume.');
    }

    // If checkpoints are enabled, directory must be persistent
    if (env.PERSIST_CHECKPOINTS && env.CHECKPOINT_DIR === '/tmp') {
      logger.error('Persistent checkpoints require CHECKPOINT_DIR on a persistent volume (not /tmp)');
      process.exit(1);
    }

    // Sampling consent must be handled for multi-tenant deployments
    if (env.TENANT_ISOLATION_REQUIRED && !env.ENABLE_SAMPLING) {
      logger.warn('Multi-tenant deployment should consider sampling constraints (ENABLE_SAMPLING=true with consent)');
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
 * Get validated environment on module load
 */
export const env = validateEnv();
