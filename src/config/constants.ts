/**
 * ServalSheets - Configuration Constants
 *
 * Centralized configuration values and magic numbers
 */

// ============================================================================
// Cache TTLs (in milliseconds)
// ============================================================================

/** Cache TTL for spreadsheet metadata (5 minutes) */
export const CACHE_TTL_SPREADSHEET = 300000;

/** Cache TTL for cell values (1 minute) */
export const CACHE_TTL_VALUES = 60000;

/** Cache TTL for analysis results (1 minute) */
export const CACHE_TTL_ANALYSIS = 60000;

/** Cache cleanup interval (1 minute) */
export const CACHE_CLEANUP_INTERVAL = 60000;

// ============================================================================
// Session and Security Limits
// ============================================================================

/** Maximum concurrent sessions per user */
export const MAX_SESSIONS_PER_USER = parseInt(process.env['MAX_SESSIONS_PER_USER'] ?? '5', 10);

/** Maximum total active sessions */
export const MAX_TOTAL_SESSIONS = parseInt(process.env['MAX_TOTAL_SESSIONS'] ?? '100', 10);

/** OAuth authorization code TTL (10 minutes, in seconds) */
export const OAUTH_AUTH_CODE_TTL = 600;

/** OAuth access token TTL (1 hour, in seconds) */
export const OAUTH_ACCESS_TOKEN_TTL = 3600;

/** OAuth refresh token TTL (30 days, in seconds) */
export const OAUTH_REFRESH_TOKEN_TTL = 2592000;

/** OAuth state token TTL (5 minutes, in seconds) */
export const OAUTH_STATE_TTL = 300;

// ============================================================================
// Rate Limiting
// ============================================================================

/** Rate limit window (1 minute, in milliseconds) */
export const RATE_LIMIT_WINDOW_MS = 60000;

/** Max requests per rate limit window */
export const RATE_LIMIT_MAX = 100;

/** Google API rate limit: requests per 100 seconds */
export const GOOGLE_API_RATE_LIMIT = 100;

// ============================================================================
// Request Processing
// ============================================================================

/** Maximum concurrent requests */
export const MAX_CONCURRENT_REQUESTS = parseInt(process.env['MAX_CONCURRENT_REQUESTS'] ?? '10', 10);

/** Request timeout (10 seconds, in milliseconds) */
export const REQUEST_TIMEOUT = 10000;

/** Graceful shutdown timeout (10 seconds, in milliseconds) */
export const SHUTDOWN_TIMEOUT = 10000;

// ============================================================================
// Batch Operations
// ============================================================================

/** Maximum batch size for batchUpdate operations */
export const MAX_BATCH_SIZE = 500;

/** Chunk size for large operations */
export const CHUNK_SIZE = 100;

// ============================================================================
// Retry Configuration
// ============================================================================

/** Base delay for exponential backoff (1 second, in milliseconds) */
export const RETRY_BASE_DELAY = 1000;

/** Maximum retry attempts */
export const MAX_RETRY_ATTEMPTS = 3;

/** Maximum backoff delay (32 seconds, in milliseconds) */
export const MAX_BACKOFF_DELAY = 32000;

// ============================================================================
// Circuit Breaker
// ============================================================================

/** Circuit breaker failure threshold */
export const CIRCUIT_BREAKER_THRESHOLD = 5;

/** Circuit breaker timeout (60 seconds, in milliseconds) */
export const CIRCUIT_BREAKER_TIMEOUT = 60000;

// ============================================================================
// Monitoring and Health
// ============================================================================

/** Health check heartbeat interval (30 seconds, in milliseconds) */
export const HEARTBEAT_INTERVAL = 30000;

/** Connection health check timeout (5 minutes, in milliseconds) */
export const CONNECTION_TIMEOUT = 300000;

// ============================================================================
// HTTP Server Defaults
// ============================================================================

/** Default HTTP server port */
export const DEFAULT_HTTP_PORT = 3000;

/** Default HTTP server host */
export const DEFAULT_HTTP_HOST = '127.0.0.1';

/** Maximum HTTP request body size */
export const MAX_REQUEST_BODY_SIZE = '10mb';

/** Compression threshold (1KB) */
export const COMPRESSION_THRESHOLD = 1024;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert minutes to milliseconds
 */
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/**
 * Convert hours to milliseconds
 */
export function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/**
 * Convert days to milliseconds
 */
export function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
