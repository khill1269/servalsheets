/**
 * ServalSheets - Configuration Constants
 *
 * Centralized configuration values and magic numbers
 */
/** Cache TTL for spreadsheet metadata (5 minutes) - baseline for all cache TTLs */
export declare const CACHE_TTL_SPREADSHEET = 300000;
/** Cache TTL for cell values (5 minutes) - aligned with spreadsheet metadata TTL for consistency */
export declare const CACHE_TTL_VALUES = 300000;
/** Cache TTL for analysis results (5 minutes) - aligned with spreadsheet metadata TTL for consistency */
export declare const CACHE_TTL_ANALYSIS = 300000;
/** Cache cleanup interval (5 minutes) - aligned with cache TTLs to avoid premature eviction */
export declare const CACHE_CLEANUP_INTERVAL = 300000;
/** Maximum concurrent sessions per user */
export declare const MAX_SESSIONS_PER_USER: number;
/** Maximum total active sessions */
export declare const MAX_TOTAL_SESSIONS: number;
/** OAuth authorization code TTL (10 minutes, in seconds) */
export declare const OAUTH_AUTH_CODE_TTL = 600;
/** OAuth access token TTL (1 hour, in seconds) */
export declare const OAUTH_ACCESS_TOKEN_TTL = 3600;
/** OAuth refresh token TTL (30 days, in seconds) */
export declare const OAUTH_REFRESH_TOKEN_TTL = 2592000;
/** OAuth state token TTL (5 minutes, in seconds) */
export declare const OAUTH_STATE_TTL = 300;
/** Rate limit window (1 minute, in milliseconds) */
export declare const RATE_LIMIT_WINDOW_MS = 60000;
/** Max requests per rate limit window */
export declare const RATE_LIMIT_MAX = 100;
/** Google API rate limit: requests per 100 seconds */
export declare const GOOGLE_API_RATE_LIMIT = 100;
/** Maximum concurrent requests */
export declare const MAX_CONCURRENT_REQUESTS: number;
/** Request timeout (10 seconds, in milliseconds) */
export declare const REQUEST_TIMEOUT = 10000;
/** Graceful shutdown timeout (10 seconds, in milliseconds) */
export declare const SHUTDOWN_TIMEOUT = 10000;
/**
 * Google Sheets API Batch Limit
 *
 * Per Google Sheets API documentation:
 * - Maximum 100 requests per batchUpdate call
 * - Maximum 2 MB payload size recommended
 *
 * @see https://developers.google.com/workspace/sheets/api/limits
 */
export declare const GOOGLE_SHEETS_MAX_BATCH_REQUESTS = 100;
/** Maximum batch size for batchUpdate operations */
export declare const MAX_BATCH_SIZE = 100;
/** Chunk size for large operations */
export declare const CHUNK_SIZE = 100;
/** Base delay for exponential backoff (1 second, in milliseconds) */
export declare const RETRY_BASE_DELAY = 1000;
/** Maximum retry attempts */
export declare const MAX_RETRY_ATTEMPTS = 3;
/** Maximum backoff delay (32 seconds, in milliseconds) */
export declare const MAX_BACKOFF_DELAY = 32000;
/** Circuit breaker failure threshold */
export declare const CIRCUIT_BREAKER_THRESHOLD = 5;
/** Circuit breaker timeout (60 seconds, in milliseconds) */
export declare const CIRCUIT_BREAKER_TIMEOUT = 60000;
/** Health check heartbeat interval (30 seconds, in milliseconds) */
export declare const HEARTBEAT_INTERVAL = 30000;
/** Connection health check timeout (5 minutes, in milliseconds) */
export declare const CONNECTION_TIMEOUT = 300000;
/** Default HTTP server port */
export declare const DEFAULT_HTTP_PORT = 3000;
/** Default HTTP server host */
export declare const DEFAULT_HTTP_HOST = "127.0.0.1";
/** Maximum HTTP request body size */
export declare const MAX_REQUEST_BODY_SIZE = "10mb";
/** Compression threshold (1KB) */
export declare const COMPRESSION_THRESHOLD = 1024;
/**
 * Maximum response size before using resource URIs (1MB)
 *
 * Rationale: Large responses (>1MB) should be stored as MCP resources
 * and returned as URIs instead of inline data to avoid:
 * - JavaScript string length limits (~536MB)
 * - JSON serialization performance issues
 * - Client memory pressure
 * - Network transfer overhead
 *
 * When comprehensive analysis exceeds this limit, results are stored
 * in analyze://results/{id} and a URI is returned instead.
 */
export declare const MAX_RESPONSE_SIZE_BYTES: number;
/**
 * Maximum response size for inline data (5MB)
 *
 * Hard limit - responses larger than this will fail serialization.
 * Used as a safety check before attempting JSON.stringify().
 */
export declare const MAX_INLINE_RESPONSE_SIZE_BYTES: number;
/**
 * Maximum rows before requiring pagination or resource URIs
 */
export declare const MAX_ROWS_INLINE = 10000;
/**
 * Maximum sheets before requiring pagination
 */
export declare const MAX_SHEETS_INLINE = 20;
/**
 * Default page size for paginated responses
 */
export declare const DEFAULT_PAGE_SIZE = 5;
/**
 * Maximum page size for paginated responses
 */
export declare const MAX_PAGE_SIZE = 50;
/**
 * Tool registration mode
 *
 * Controls which tools are registered to manage schema payload size.
 * Large schema payloads (500KB+) can overwhelm some MCP clients.
 *
 * Modes:
 * - 'full': All 19 tools (default, ~527KB schema payload)
 * - 'standard': 12 tools - removes MCP-native + Tier 7 (~444KB)
 * - 'lite': 8 essential tools (~199KB, recommended for Claude Desktop)
 *
 * Set via SERVAL_TOOL_MODE environment variable.
 *
 * For full mode without size issues, also set SERVAL_SCHEMA_REFS=true
 * to enable $ref optimization (reduces to ~209KB). Note: some clients
 * may not handle $refs correctly - test thoroughly.
 *
 * Configuration examples for Claude Desktop:
 *
 * Option 1 - Lite mode (safest, 199KB):
 *   "SERVAL_TOOL_MODE": "lite"
 *
 * Option 2 - Full mode with $ref optimization (209KB):
 *   "SERVAL_TOOL_MODE": "full",
 *   "SERVAL_SCHEMA_REFS": "true"
 *
 * Option 3 - Standard mode (444KB, may still cause issues):
 *   "SERVAL_TOOL_MODE": "standard"
 */
export type ToolMode = 'full' | 'standard' | 'lite';
export declare const TOOL_MODE: ToolMode;
/**
 * Deferred schema loading mode
 *
 * When enabled, tools are registered with minimal "passthrough" schemas
 * instead of full schemas. Full schemas are exposed via MCP resources
 * (schema://tools/{toolName}) for on-demand loading.
 *
 * Benefits:
 * - Reduces initial tools/list payload from ~231KB to ~5KB
 * - All 19 tools available immediately
 * - Claude fetches full schema only when needed via resources
 * - Optimal for Claude Desktop and other token-conscious clients
 *
 * Trade-offs:
 * - Claude must read schema resource before calling complex tools
 * - Server instructions guide this behavior
 *
 * Set via SERVAL_DEFER_SCHEMAS=true environment variable.
 *
 * Recommended Claude Desktop configuration:
 *   "SERVAL_DEFER_SCHEMAS": "true"
 */
export declare const DEFER_SCHEMAS: boolean;
/**
 * Essential tools (lite mode) - core spreadsheet operations
 * Reduces schema payload by 62% (527KB → 199KB)
 */
export declare const ESSENTIAL_TOOLS: readonly ["sheets_auth", "sheets_core", "sheets_data", "sheets_format", "sheets_history", "sheets_transaction", "sheets_quality", "sheets_session"];
/**
 * Standard tools - adds visualization, collaboration, dimensions, advanced
 * Removes MCP-native tools (confirm, analyze, fix) and Tier 7 enterprise tools
 */
export declare const STANDARD_TOOLS: readonly ["sheets_auth", "sheets_core", "sheets_data", "sheets_format", "sheets_history", "sheets_transaction", "sheets_quality", "sheets_session", "sheets_dimensions", "sheets_visualize", "sheets_collaborate", "sheets_advanced"];
/**
 * Convert seconds to milliseconds
 */
export declare function secondsToMs(seconds: number): number;
/**
 * Convert minutes to milliseconds
 */
export declare function minutesToMs(minutes: number): number;
/**
 * Convert hours to milliseconds
 */
export declare function hoursToMs(hours: number): number;
/**
 * Convert days to milliseconds
 */
export declare function daysToMs(days: number): number;
//# sourceMappingURL=constants.d.ts.map