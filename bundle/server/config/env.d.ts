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
declare const EnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    HOST: z.ZodDefault<z.ZodString>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<{
        error: "error";
        info: "info";
        debug: "debug";
        warn: "warn";
    }>>;
    GOOGLE_CLIENT_ID: z.ZodOptional<z.ZodString>;
    GOOGLE_CLIENT_SECRET: z.ZodOptional<z.ZodString>;
    GOOGLE_REDIRECT_URI: z.ZodOptional<z.ZodString>;
    CREDENTIALS_PATH: z.ZodOptional<z.ZodString>;
    CACHE_ENABLED: z.ZodDefault<z.ZodCoercedBoolean<unknown>>;
    CACHE_MAX_SIZE_MB: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CACHE_TTL_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DEDUP_ENABLED: z.ZodDefault<z.ZodCoercedBoolean<unknown>>;
    DEDUP_WINDOW_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    TRACING_ENABLED: z.ZodDefault<z.ZodCoercedBoolean<unknown>>;
    TRACING_SAMPLE_RATE: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CIRCUIT_BREAKER_SUCCESS_THRESHOLD: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CIRCUIT_BREAKER_TIMEOUT_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    MAX_CONCURRENT_REQUESTS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    REQUEST_TIMEOUT_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    GRACEFUL_SHUTDOWN_TIMEOUT_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    SESSION_STORE_TYPE: z.ZodDefault<z.ZodEnum<{
        redis: "redis";
        memory: "memory";
    }>>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    JWT_SECRET: z.ZodOptional<z.ZodString>;
    STATE_SECRET: z.ZodOptional<z.ZodString>;
    OAUTH_CLIENT_SECRET: z.ZodOptional<z.ZodString>;
    OAUTH_ISSUER: z.ZodDefault<z.ZodString>;
    OAUTH_CLIENT_ID: z.ZodDefault<z.ZodString>;
    ALLOWED_REDIRECT_URIS: z.ZodDefault<z.ZodString>;
    CORS_ORIGINS: z.ZodDefault<z.ZodString>;
    ACCESS_TOKEN_TTL: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    REFRESH_TOKEN_TTL: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    MANAGED_AUTH: z.ZodDefault<z.ZodCoercedBoolean<unknown>>;
}, z.core.$strip>;
export type Env = z.infer<typeof EnvSchema>;
/**
 * Validated environment variables
 * Access via `env.PORT`, `env.NODE_ENV`, etc.
 */
export declare let env: Env;
/**
 * Validate and parse environment variables
 *
 * Call this early in application startup (before any other initialization)
 * to ensure all required configuration is present and valid.
 *
 * @throws {ZodError} if validation fails, with detailed error messages
 * @returns {Env} Validated environment configuration
 */
export declare function validateEnv(): Env;
/**
 * Check if running in production mode
 */
export declare function isProduction(): boolean;
/**
 * Check if running in development mode
 */
export declare function isDevelopment(): boolean;
/**
 * Check if running in test mode
 */
export declare function isTest(): boolean;
/**
 * Check if Google API credentials are configured
 */
export declare function hasGoogleCredentials(): boolean;
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
export declare function isManagedAuth(): boolean;
/**
 * Get cache configuration
 */
export declare function getCacheConfig(): {
    enabled: boolean;
    maxSizeMB: number;
    ttlMs: number;
};
/**
 * Get deduplication configuration
 */
export declare function getDedupConfig(): {
    enabled: boolean;
    windowMs: number;
};
/**
 * Get tracing configuration
 */
export declare function getTracingConfig(): {
    enabled: boolean;
    sampleRate: number;
};
/**
 * Get safety limits configuration
 */
export declare function getSafetyLimits(): {
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    gracefulShutdownTimeoutMs: number;
};
/**
 * Get session store configuration
 *
 * @throws {Error} if redis type is selected but REDIS_URL not provided
 */
export declare function getSessionStoreConfig(): {
    type: 'memory' | 'redis';
    redisUrl?: string;
};
/**
 * Get circuit breaker configuration
 */
export declare function getCircuitBreakerConfig(): {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
};
export {};
//# sourceMappingURL=env.d.ts.map