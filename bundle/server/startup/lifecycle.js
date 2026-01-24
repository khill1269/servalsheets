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
import { randomBytes } from 'crypto';
import { initTracer, shutdownTracer, getTracer } from '../utils/tracing.js';
import { shutdownOtlpExporter } from '../observability/otel-export.js';
import { startConnectionHealthMonitoring, stopConnectionHealthMonitoring, getConnectionHealthMonitor, } from '../utils/connection-health.js';
import { cacheManager } from '../utils/cache-manager.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import { getBatchEfficiencyStats } from '../utils/batch-efficiency.js';
// Shutdown timeout (10 seconds)
const SHUTDOWN_TIMEOUT = 10000;
// Auth exempt tools (tools that don't require authentication)
// SECURITY NOTE: Only include tools that don't access user data
const AUTH_EXEMPT_TOOLS = new Set([
// Currently no tools are exempt - all require authentication
]);
/**
 * Validate ENCRYPTION_KEY in production environment
 * SEC-001: Requires encryption key for token storage in production
 */
export function requireEncryptionKeyInProduction() {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const hasEncryptionKey = Boolean(process.env['ENCRYPTION_KEY']);
    if (isProduction && !hasEncryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is required in production. ' +
            'Generate with: openssl rand -hex 32');
    }
    if (!hasEncryptionKey) {
        logger.warn('ENCRYPTION_KEY not set - tokens will not be encrypted. ' +
            'This is acceptable for development but NOT for production.');
    }
    else {
        const keyLength = process.env['ENCRYPTION_KEY']?.length || 0;
        if (keyLength !== 64) {
            throw new Error(`ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyLength}. ` +
                'Generate with: openssl rand -hex 32');
        }
        logger.debug('Encryption key validated (64 hex chars / 32 bytes)');
    }
}
/**
 * Require persistent session store in production
 * SEC-002: OAuth sessions must persist across server restarts in production
 */
export function requireSessionStoreInProduction() {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const storeType = process.env['SESSION_STORE_TYPE'] ?? 'memory';
    if (isProduction && storeType === 'memory') {
        throw new Error('Production mode requires persistent session store. ' +
            'In-memory session store loses all OAuth sessions on restart. ' +
            'Set SESSION_STORE_TYPE=redis and REDIS_URL=redis://your-redis-host:6379');
    }
    if (storeType === 'redis' && !process.env['REDIS_URL']) {
        throw new Error('REDIS_URL is required when SESSION_STORE_TYPE=redis. ' +
            'Provide a Redis connection URL (e.g., redis://localhost:6379)');
    }
    if (!isProduction && storeType === 'memory') {
        logger.warn('Using in-memory session store. ' +
            'OAuth sessions will be lost on server restart. ' +
            'This is acceptable for development but NOT for production.');
    }
}
/**
 * Validate AUTH_EXEMPT_TOOLS list for security
 * SEC-007: Ensures only safe, non-data-accessing tools are exempt from authentication
 */
export function validateAuthExemptList() {
    // Define patterns for tools that are safe to be exempt
    const SAFE_PATTERNS = ['sheets_auth_status', 'sheets_authenticate', 'sheets_health_check'];
    const warnings = [];
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
            throw new Error(`AUTH_EXEMPT_TOOLS contains unverified tools in production: ${warnings.join(', ')}`);
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
 */
export function validateOAuthConfig() {
    const hasClientId = Boolean(process.env['OAUTH_CLIENT_ID']);
    const hasClientSecret = Boolean(process.env['OAUTH_CLIENT_SECRET']);
    const hasRedirectUri = Boolean(process.env['OAUTH_REDIRECT_URI']);
    if (!hasClientId || !hasClientSecret) {
        logger.warn('OAuth credentials not configured. HTTP server will require manual token setup. ' +
            'Run "npm run auth" to set up OAuth authentication.');
    }
    else {
        logger.debug('OAuth configuration validated');
        if (!hasRedirectUri) {
            logger.warn('OAUTH_REDIRECT_URI not set, using default: http://localhost:3000/callback');
        }
    }
}
/**
 * Generate encryption key if missing (development only)
 * Returns the encryption key (existing or generated)
 */
export function ensureEncryptionKey() {
    let encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
        if (process.env['NODE_ENV'] === 'production') {
            throw new Error('ENCRYPTION_KEY required in production');
        }
        // Generate a random key for development
        encryptionKey = randomBytes(32).toString('hex');
        process.env['ENCRYPTION_KEY'] = encryptionKey;
        logger.warn('Generated temporary encryption key for development. ' +
            'Set ENCRYPTION_KEY in .env for persistent tokens.');
    }
    return encryptionKey;
}
/**
 * Initialize OpenTelemetry tracing if enabled
 */
export function initializeTracing(options) {
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
    }
    else {
        logger.debug('OpenTelemetry tracing disabled (set OTEL_ENABLED=true to enable)');
    }
}
/**
 * Initialize connection health monitoring
 */
export function initializeConnectionHealth(config) {
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
 * Start all background tasks and validate configuration
 */
export async function startBackgroundTasks(options) {
    logger.info('Starting background tasks...');
    // SEC-001: Validate ENCRYPTION_KEY in production
    requireEncryptionKeyInProduction();
    // SEC-002: Require persistent session store in production
    requireSessionStoreInProduction();
    // SEC-007: Validate AUTH_EXEMPT_TOOLS list
    validateAuthExemptList();
    // Validate OAuth configuration
    validateOAuthConfig();
    // Initialize OpenTelemetry tracing
    initializeTracing(options?.tracing);
    // Initialize connection health monitoring
    initializeConnectionHealth(options?.connectionHealth);
    // Start cache cleanup task
    cacheManager.startCleanupTask();
    logger.info('Cache cleanup task started');
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
    logger.info('Background tasks started');
}
/**
 * Shutdown state tracking
 */
let isShuttingDown = false;
let shutdownCallbacks = [];
/**
 * Register a callback to be called during shutdown
 */
export function onShutdown(callback) {
    shutdownCallbacks.push(callback);
}
/**
 * Graceful shutdown handler
 * Stops accepting connections, drains existing requests, and cleans up resources
 */
export async function gracefulShutdown(signal) {
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
            }
            catch (error) {
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
    }
    catch (error) {
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
export function registerSignalHandlers() {
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
    logger.info('Signal handlers registered (SIGTERM, SIGINT, uncaughtException, unhandledRejection)');
}
/**
 * Get shutdown status
 */
export function isShutdownInProgress() {
    return isShuttingDown;
}
/**
 * Record activity heartbeat for connection health monitoring
 */
export function recordActivity(source) {
    try {
        const monitor = getConnectionHealthMonitor();
        monitor.recordHeartbeat(source);
    }
    catch {
        // Connection health monitoring not initialized - ignore
    }
}
/**
 * Get connection health statistics
 */
export function getConnectionStats() {
    try {
        const monitor = getConnectionHealthMonitor();
        return monitor.getStats();
    }
    catch {
        return null;
    }
}
/**
 * Get tracing statistics
 */
export function getTracingStats() {
    try {
        const tracer = getTracer();
        return tracer.getStats();
    }
    catch {
        return null;
    }
}
/**
 * Get cache statistics
 */
export function getCacheStats() {
    try {
        return cacheManager.getStats();
    }
    catch {
        return null;
    }
}
/**
 * Get request deduplication statistics
 */
export function getDeduplicationStats() {
    try {
        return requestDeduplicator.getStats();
    }
    catch {
        return null;
    }
}
/**
 * Get batch efficiency statistics
 */
export function getBatchEfficiencyStats_() {
    try {
        return getBatchEfficiencyStats();
    }
    catch {
        return null;
    }
}
/**
 * Log environment configuration for debugging
 */
export function logEnvironmentConfig() {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const logLevel = process.env['LOG_LEVEL'] || 'info';
    const httpPort = process.env['HTTP_PORT'] || '3000';
    const otelEnabled = process.env['OTEL_ENABLED'] === 'true';
    const otelLogSpans = process.env['OTEL_LOG_SPANS'] === 'true';
    const cacheEnabled = process.env['CACHE_ENABLED'] !== 'false';
    const deduplicationEnabled = process.env['DEDUPLICATION_ENABLED'] !== 'false';
    logger.info('Environment configuration', {
        nodeEnv: isProduction ? 'production' : 'development',
        logLevel,
        httpPort,
        hasOAuthClientId: Boolean(process.env['OAUTH_CLIENT_ID']),
        hasOAuthClientSecret: Boolean(process.env['OAUTH_CLIENT_SECRET']),
        hasEncryptionKey: Boolean(process.env['ENCRYPTION_KEY']),
        otelEnabled,
        otelLogSpans,
        cacheEnabled,
        deduplicationEnabled,
    });
}
//# sourceMappingURL=lifecycle.js.map