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
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // OAuth token storage paths (optional)
  // Note: Use GOOGLE_TOKEN_STORE_PATH in CLI (not TOKEN_PATH)
  CREDENTIALS_PATH: z.string().optional(),

  // Performance tuning
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_MAX_SIZE_MB: z.coerce.number().positive().default(100),
  CACHE_TTL_MS: z.coerce.number().positive().default(300000), // 5 minutes

  // Deduplication
  DEDUP_ENABLED: z.coerce.boolean().default(true),
  DEDUP_WINDOW_MS: z.coerce.number().positive().default(5000), // 5 seconds

  // Tracing & Observability
  TRACING_ENABLED: z.coerce.boolean().default(false),
  TRACING_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // Circuit Breaker
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_SUCCESS_THRESHOLD: z.coerce.number().int().positive().default(2),
  CIRCUIT_BREAKER_TIMEOUT_MS: z.coerce.number().positive().default(30000), // 30 seconds

  // Safety limits
  MAX_CONCURRENT_REQUESTS: z.coerce.number().int().positive().default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().positive().default(30000), // 30 seconds

  // Graceful shutdown
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: z.coerce.number().positive().default(10000), // 10 seconds

  // Session Store Configuration (for OAuth)
  SESSION_STORE_TYPE: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().url().optional(),

  // OAuth Server Configuration (for remote server)
  JWT_SECRET: z.string().optional(),
  STATE_SECRET: z.string().optional(),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  OAUTH_ISSUER: z.string().default('https://servalsheets.example.com'),
  OAUTH_CLIENT_ID: z.string().default('servalsheets'),
  ALLOWED_REDIRECT_URIS: z.string().default('http://localhost:3000/callback'),
  CORS_ORIGINS: z.string().default('https://claude.ai,https://claude.com'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(3600), // 1 hour
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2592000), // 30 days

  // Google Cloud Managed Auth Mode
  // When true: Uses Application Default Credentials, disables sheets_auth tool
  // Set to true when deploying to Cloud Run, GKE, or Cloud Functions
  MANAGED_AUTH: z.coerce.boolean().default(false),
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
      console.error('❌ Environment validation failed:');
      console.error('');

      for (const issue of error.issues) {
        const path = issue.path.join('.');
        const message = issue.message;
        console.error(`  - ${path}: ${message}`);
      }

      console.error('');
      console.error('Please check your environment variables or .env file.');
      console.error('See .env.example for required configuration.');
      process.exit(1);
    }

    throw error;
  }
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
