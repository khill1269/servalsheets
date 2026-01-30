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
import { type TracerOptions } from '../utils/tracing.js';
import { type ConnectionHealthConfig } from '../utils/connection-health.js';
/**
 * Validate ENCRYPTION_KEY in production environment
 * SEC-001: Requires encryption key for token storage in production
 */
export declare function requireEncryptionKeyInProduction(): void;
/**
 * Require persistent session store in production
 * SEC-002: OAuth sessions must persist across server restarts in production
 */
export declare function requireSessionStoreInProduction(): void;
/**
 * Validate AUTH_EXEMPT_TOOLS list for security
 * SEC-007: Ensures only safe, non-data-accessing tools are exempt from authentication
 */
export declare function validateAuthExemptList(): void;
/**
 * Validate OAuth configuration
 * Checks that required OAuth environment variables are set
 */
export declare function validateOAuthConfig(): void;
/**
 * Generate encryption key if missing (development only)
 * Returns the encryption key (existing or generated)
 */
export declare function ensureEncryptionKey(): string;
/**
 * Initialize OpenTelemetry tracing if enabled
 */
export declare function initializeTracing(options?: TracerOptions): void;
/**
 * Initialize connection health monitoring
 */
export declare function initializeConnectionHealth(config?: ConnectionHealthConfig): void;
/**
 * Start all background tasks and validate configuration
 */
export declare function startBackgroundTasks(options?: {
    tracing?: TracerOptions;
    connectionHealth?: ConnectionHealthConfig;
}): Promise<void>;
/**
 * Register a callback to be called during shutdown
 */
export declare function onShutdown(callback: () => Promise<void>): void;
/**
 * Graceful shutdown handler
 * Stops accepting connections, drains existing requests, and cleans up resources
 */
export declare function gracefulShutdown(signal: string): Promise<void>;
/**
 * Register signal handlers for graceful shutdown
 */
export declare function registerSignalHandlers(): void;
/**
 * Get shutdown status
 */
export declare function isShutdownInProgress(): boolean;
/**
 * Record activity heartbeat for connection health monitoring
 */
export declare function recordActivity(source?: string): void;
/**
 * Get connection health statistics
 */
export declare function getConnectionStats(): unknown | null;
/**
 * Get tracing statistics
 */
export declare function getTracingStats(): unknown | null;
/**
 * Get cache statistics
 */
export declare function getCacheStats(): unknown | null;
/**
 * Get request deduplication statistics
 */
export declare function getDeduplicationStats(): unknown | null;
/**
 * Get batch efficiency statistics
 */
export declare function getBatchEfficiencyStats_(): unknown | null;
/**
 * Log environment configuration for debugging
 */
export declare function logEnvironmentConfig(): void;
//# sourceMappingURL=lifecycle.d.ts.map