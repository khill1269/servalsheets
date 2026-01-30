/**
 * MetricsService
 *
 * @purpose Aggregates performance metrics with percentiles (p50, p95, p99), error rates, cache hit rates, and active request tracking
 * @category Infrastructure
 * @usage Use for observability and monitoring; tracks operation counters, durations, API calls, memory-efficient sliding window
 * @dependencies logger
 * @stateful Yes - maintains operation metrics map, histogram buckets, active request counter, cache hit/miss stats
 * @singleton Yes - one instance per process to aggregate metrics across all requests
 *
 * @example
 * const metrics = new MetricsService({ windowSize: 1000 });
 * metrics.recordOperation('sheets_data.write', 150, true);
 * metrics.recordCacheHit('spreadsheet', true);
 * const summary = metrics.getSummary(); // { operations: {...}, cache: {...}, active: 5 }
 */
import { logger } from '../utils/logger.js';
// ==================== Metrics Service ====================
/**
 * Maximum number of duration samples to keep per operation
 * Prevents unbounded memory growth
 */
const MAX_DURATION_SAMPLES = 1000;
/**
 * Maximum number of operations to track
 */
const MAX_OPERATIONS = 500;
/**
 * Maximum cardinality for metric labels (tools, actions, error types)
 * Prevents unbounded memory growth from high-cardinality labels
 */
const MAX_LABEL_CARDINALITY = 10000;
export class MetricsService {
    startTime = new Date();
    operations = new Map();
    cacheRequests = 0;
    cacheHits = 0;
    cacheMisses = 0;
    apiCalls = 0;
    apiCallsByMethod = new Map();
    apiErrors = 0;
    activeRequests = 0;
    // Extended metrics storage
    toolMetrics = new Map();
    actionMetrics = new Map();
    errorMetrics = new Map(); // errorType -> count
    categoryCacheMetrics = new Map();
    batchOperations = {
        totalBatches: 0,
        totalRequestCount: 0,
        totalSavedCalls: 0,
    };
    rateLimits = {
        readLimits: 0,
        writeLimits: 0,
    };
    circuitBreakerEvents = {
        openEvents: 0,
        halfOpenEvents: 0,
        closedEvents: 0,
        currentState: 'closed',
    };
    enabled;
    verboseLogging;
    constructor(options = {}) {
        this.enabled = options.enabled ?? process.env['METRICS_ENABLED'] !== 'false';
        this.verboseLogging = options.verboseLogging ?? process.env['METRICS_VERBOSE'] === 'true';
        if (this.enabled) {
            logger.info('Metrics service initialized', {
                enabled: this.enabled,
                verboseLogging: this.verboseLogging,
                maxOperations: MAX_OPERATIONS,
                maxDurationSamples: MAX_DURATION_SAMPLES,
            });
        }
    }
    /**
     * Check if metrics are enabled
     */
    isEnabled() {
        return this.enabled;
    }
    recordOperation(optionsOrName, durationMs, success) {
        if (!this.enabled)
            return;
        // Handle both signatures
        const options = typeof optionsOrName === 'string'
            ? { name: optionsOrName, durationMs: durationMs, success: success }
            : optionsOrName;
        const { name, durationMs: duration, success: isSuccess } = options;
        let op = this.operations.get(name);
        if (!op) {
            // Check if we're at the operation limit
            if (this.operations.size >= MAX_OPERATIONS) {
                // Remove least recently recorded operation
                let oldestOp = null;
                let oldestTime = Infinity;
                for (const [opName, opData] of Array.from(this.operations.entries())) {
                    if (opData.lastRecorded < oldestTime) {
                        oldestTime = opData.lastRecorded;
                        oldestOp = opName;
                    }
                }
                if (oldestOp) {
                    this.operations.delete(oldestOp);
                }
            }
            op = {
                count: 0,
                successCount: 0,
                failureCount: 0,
                durations: [],
                lastRecorded: 0,
            };
            this.operations.set(name, op);
        }
        // Update counters
        op.count++;
        if (isSuccess) {
            op.successCount++;
        }
        else {
            op.failureCount++;
        }
        op.lastRecorded = Date.now();
        // Record duration (circular buffer)
        op.durations.push(duration);
        if (op.durations.length > MAX_DURATION_SAMPLES) {
            op.durations.shift();
        }
        if (this.verboseLogging) {
            logger.debug('Operation recorded in metrics', {
                name,
                durationMs,
                success,
                totalCount: op.count,
            });
        }
    }
    /**
     * Record cache access
     */
    recordCacheAccess(hit) {
        if (!this.enabled)
            return;
        this.cacheRequests++;
        if (hit) {
            this.cacheHits++;
        }
        else {
            this.cacheMisses++;
        }
    }
    recordApiCall(methodOrOptions, success = true) {
        if (!this.enabled)
            return;
        // Handle both signatures
        if (typeof methodOrOptions === 'string') {
            // Simple signature: recordApiCall(method, success)
            const method = methodOrOptions;
            this.apiCalls++;
            this.apiCallsByMethod.set(method, (this.apiCallsByMethod.get(method) || 0) + 1);
            if (!success) {
                this.apiErrors++;
            }
        }
        else {
            // Extended signature: recordApiCall({ tool, action, duration, success, errorType, timestamp })
            const { tool, action, duration, success: isSuccess, errorType, timestamp } = methodOrOptions;
            const recordTimestamp = timestamp ?? Date.now();
            // Update basic API metrics
            this.apiCalls++;
            const method = `${tool}.${action}`;
            this.apiCallsByMethod.set(method, (this.apiCallsByMethod.get(method) || 0) + 1);
            if (!isSuccess) {
                this.apiErrors++;
                // Track error types
                if (errorType) {
                    // CARDINALITY LIMIT: Prevent unbounded growth from many error types
                    if (!this.errorMetrics.has(errorType) &&
                        this.errorMetrics.size >= MAX_LABEL_CARDINALITY) {
                        logger.warn('Error metrics cardinality limit reached', {
                            limit: MAX_LABEL_CARDINALITY,
                            droppedErrorType: errorType,
                        });
                    }
                    else {
                        this.errorMetrics.set(errorType, (this.errorMetrics.get(errorType) || 0) + 1);
                    }
                }
            }
            // Track tool-level metrics
            let toolStats = this.toolMetrics.get(tool);
            if (!toolStats) {
                // CARDINALITY LIMIT: Prevent unbounded growth
                if (this.toolMetrics.size >= MAX_LABEL_CARDINALITY) {
                    logger.warn('Tool metrics cardinality limit reached', {
                        limit: MAX_LABEL_CARDINALITY,
                        droppedTool: tool,
                        message: 'Metric will not be tracked to prevent memory issues',
                    });
                    return; // Drop metric to prevent unbounded growth
                }
                toolStats = {
                    totalCalls: 0,
                    successCalls: 0,
                    failedCalls: 0,
                    durations: [],
                    timestamps: [],
                };
                this.toolMetrics.set(tool, toolStats);
            }
            toolStats.totalCalls++;
            if (isSuccess) {
                toolStats.successCalls++;
            }
            else {
                toolStats.failedCalls++;
            }
            toolStats.durations.push(duration);
            toolStats.timestamps.push(recordTimestamp);
            if (toolStats.durations.length > MAX_DURATION_SAMPLES) {
                toolStats.durations.shift();
                toolStats.timestamps.shift();
            }
            // Track action-level metrics
            const actionKey = `${tool}:${action}`;
            let actionStats = this.actionMetrics.get(actionKey);
            if (!actionStats) {
                // CARDINALITY LIMIT: Prevent unbounded growth
                if (this.actionMetrics.size >= MAX_LABEL_CARDINALITY) {
                    logger.warn('Action metrics cardinality limit reached', {
                        limit: MAX_LABEL_CARDINALITY,
                        droppedAction: actionKey,
                        message: 'Metric will not be tracked to prevent memory issues',
                    });
                    return; // Drop metric to prevent unbounded growth
                }
                actionStats = {
                    totalCalls: 0,
                    durations: [],
                    timestamps: [],
                };
                this.actionMetrics.set(actionKey, actionStats);
            }
            actionStats.totalCalls++;
            actionStats.durations.push(duration);
            actionStats.timestamps.push(recordTimestamp);
            if (actionStats.durations.length > MAX_DURATION_SAMPLES) {
                actionStats.durations.shift();
                actionStats.timestamps.shift();
            }
        }
    }
    /**
     * Increment active requests counter
     */
    incrementActiveRequests() {
        if (!this.enabled)
            return;
        this.activeRequests++;
    }
    /**
     * Decrement active requests counter
     */
    decrementActiveRequests() {
        if (!this.enabled)
            return;
        this.activeRequests = Math.max(0, this.activeRequests - 1);
    }
    /**
     * Get operation metrics
     */
    getOperationMetrics(name) {
        const op = this.operations.get(name);
        // OK: Explicit empty - typed as optional, lookup pattern
        if (!op)
            return undefined;
        return this.calculateOperationMetrics(name, op);
    }
    /**
     * Get all operation metrics
     */
    getAllOperationMetrics() {
        const metrics = [];
        for (const [name, op] of Array.from(this.operations.entries())) {
            metrics.push(this.calculateOperationMetrics(name, op));
        }
        // Sort by count (most frequent first)
        return metrics.sort((a, b) => b.count - a.count);
    }
    /**
     * Calculate operation metrics with percentiles
     */
    calculateOperationMetrics(name, op) {
        const durations = [...op.durations].sort((a, b) => a - b);
        const total = durations.reduce((sum, d) => sum + d, 0);
        return {
            name,
            count: op.count,
            successCount: op.successCount,
            failureCount: op.failureCount,
            successRate: op.count > 0 ? op.successCount / op.count : 0,
            duration: {
                min: durations[0] || 0,
                max: durations[durations.length - 1] || 0,
                avg: durations.length > 0 ? total / durations.length : 0,
                p50: this.percentile(durations, 0.5),
                p95: this.percentile(durations, 0.95),
                p99: this.percentile(durations, 0.99),
                total,
            },
            lastRecorded: op.lastRecorded,
        };
    }
    /**
     * Calculate percentile from sorted array
     */
    percentile(sorted, p) {
        if (sorted.length === 0)
            return 0;
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)] || 0;
    }
    getCacheMetrics(category) {
        if (category) {
            // Return category-specific metrics
            const stats = this.categoryCacheMetrics.get(category);
            if (!stats) {
                return { hits: 0, misses: 0, hitRate: 0 };
            }
            const total = stats.hits + stats.misses;
            return {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: total > 0 ? stats.hits / total : 0,
            };
        }
        // Return overall cache metrics
        return {
            requests: this.cacheRequests,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0,
        };
    }
    /**
     * Get API metrics
     */
    getApiMetrics() {
        return {
            calls: this.apiCalls,
            byMethod: Object.fromEntries(this.apiCallsByMethod),
            errors: this.apiErrors,
            errorRate: this.apiCalls > 0 ? this.apiErrors / this.apiCalls : 0,
        };
    }
    /**
     * Get system metrics
     */
    getSystemMetrics() {
        const mem = process.memoryUsage();
        const totalMem = os.totalmem();
        const uptime = process.uptime();
        return {
            activeRequests: this.activeRequests,
            memoryUsage: mem.heapUsed,
            memoryUsagePercent: mem.heapUsed / totalMem,
            cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
            uptime,
        };
    }
    /**
     * Get comprehensive metrics summary
     */
    getSummary() {
        const operations = this.getAllOperationMetrics();
        const totalOperations = operations.reduce((sum, op) => sum + op.count, 0);
        const avgSuccessRate = operations.length > 0
            ? operations.reduce((sum, op) => sum + op.successRate, 0) / operations.length
            : 0;
        return {
            startTime: this.startTime.toISOString(),
            currentTime: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
            operations,
            cache: this.getCacheMetrics(),
            api: this.getApiMetrics(),
            system: this.getSystemMetrics(),
            totalOperations,
            avgSuccessRate,
        };
    }
    /**
     * Get tool-level metrics
     */
    getToolMetrics(tool) {
        const stats = this.toolMetrics.get(tool);
        if (!stats) {
            return {
                totalCalls: 0,
                successCalls: 0,
                failedCalls: 0,
                avgDuration: 0,
                minDuration: 0,
                maxDuration: 0,
            };
        }
        const durations = stats.durations;
        const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
        const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
        const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
        return {
            totalCalls: stats.totalCalls,
            successCalls: stats.successCalls,
            failedCalls: stats.failedCalls,
            avgDuration,
            minDuration,
            maxDuration,
        };
    }
    /**
     * Get action-level metrics
     */
    getActionMetrics(tool, action) {
        const actionKey = `${tool}:${action}`;
        const stats = this.actionMetrics.get(actionKey);
        if (!stats) {
            return {
                totalCalls: 0,
                avgDuration: 0,
            };
        }
        const avgDuration = stats.durations.length > 0
            ? stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length
            : 0;
        return {
            totalCalls: stats.totalCalls,
            avgDuration,
        };
    }
    /**
     * Record cache hit/miss for a specific category
     */
    recordCacheHit(category, hit) {
        if (!this.enabled)
            return;
        // Update category-specific metrics
        let stats = this.categoryCacheMetrics.get(category);
        if (!stats) {
            // CARDINALITY LIMIT: Prevent unbounded growth from many cache categories
            if (this.categoryCacheMetrics.size >= MAX_LABEL_CARDINALITY) {
                logger.warn('Cache category metrics cardinality limit reached', {
                    limit: MAX_LABEL_CARDINALITY,
                    droppedCategory: category,
                });
                return; // Drop metric to prevent unbounded growth
            }
            stats = { hits: 0, misses: 0 };
            this.categoryCacheMetrics.set(category, stats);
        }
        if (hit) {
            stats.hits++;
        }
        else {
            stats.misses++;
        }
        // Also update overall cache metrics
        this.cacheRequests++;
        if (hit) {
            this.cacheHits++;
        }
        else {
            this.cacheMisses++;
        }
    }
    /**
     * Get cache metrics for a specific category
     */
    getCategoryCacheMetrics(category) {
        const stats = this.categoryCacheMetrics.get(category);
        if (!stats) {
            return { hits: 0, misses: 0, hitRate: 0 };
        }
        const total = stats.hits + stats.misses;
        return {
            hits: stats.hits,
            misses: stats.misses,
            hitRate: total > 0 ? stats.hits / total : 0,
        };
    }
    /**
     * Record batch operation
     */
    recordBatchOperation(data) {
        if (!this.enabled)
            return;
        this.batchOperations.totalBatches++;
        this.batchOperations.totalRequestCount += data.requestCount;
        this.batchOperations.totalSavedCalls += data.savedApiCalls;
    }
    /**
     * Get batch operation metrics
     */
    getBatchMetrics() {
        const avgEfficiency = this.batchOperations.totalRequestCount > 0
            ? this.batchOperations.totalSavedCalls / this.batchOperations.totalRequestCount
            : 0;
        return {
            totalBatches: this.batchOperations.totalBatches,
            totalSavedCalls: this.batchOperations.totalSavedCalls,
            avgEfficiency,
        };
    }
    /**
     * Record rate limit hit
     */
    recordRateLimitHit(type) {
        if (!this.enabled)
            return;
        if (type === 'read') {
            this.rateLimits.readLimits++;
        }
        else {
            this.rateLimits.writeLimits++;
        }
    }
    /**
     * Get rate limit metrics
     */
    getRateLimitMetrics() {
        return {
            readLimits: this.rateLimits.readLimits,
            writeLimits: this.rateLimits.writeLimits,
            totalLimits: this.rateLimits.readLimits + this.rateLimits.writeLimits,
        };
    }
    /**
     * Record circuit breaker state change
     */
    recordCircuitBreakerEvent(state) {
        if (!this.enabled)
            return;
        if (state === 'open') {
            this.circuitBreakerEvents.openEvents++;
        }
        else if (state === 'half-open') {
            this.circuitBreakerEvents.halfOpenEvents++;
        }
        else if (state === 'closed') {
            this.circuitBreakerEvents.closedEvents++;
        }
        this.circuitBreakerEvents.currentState = state;
    }
    /**
     * Get circuit breaker metrics
     */
    getCircuitBreakerMetrics() {
        return {
            openEvents: this.circuitBreakerEvents.openEvents,
            halfOpenEvents: this.circuitBreakerEvents.halfOpenEvents,
            closedEvents: this.circuitBreakerEvents.closedEvents,
        };
    }
    /**
     * Get overall aggregated metrics
     */
    getOverallMetrics() {
        const totalApiCalls = this.apiCalls;
        const successRate = totalApiCalls > 0 ? (totalApiCalls - this.apiErrors) / totalApiCalls : 0;
        const totalCacheRequests = this.cacheRequests;
        const cacheHitRate = totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0;
        const batchMetrics = this.getBatchMetrics();
        return {
            totalApiCalls,
            successRate,
            totalCacheRequests,
            cacheHitRate,
            totalBatches: batchMetrics.totalBatches,
            avgBatchEfficiency: batchMetrics.avgEfficiency,
            rateLimitHits: this.rateLimits.readLimits + this.rateLimits.writeLimits,
            circuitBreakerState: this.circuitBreakerEvents.currentState,
        };
    }
    /**
     * Get metrics within a time window
     * @param windowMs Time window in milliseconds (e.g., 60000 for last minute)
     */
    getMetricsInWindow(windowMs) {
        const cutoffTime = Date.now() - windowMs;
        // Count API calls within window
        let totalApiCalls = 0;
        let _successfulCalls = 0; // Reserved for future per-call success tracking
        for (const [_tool, stats] of this.toolMetrics.entries()) {
            for (let i = 0; i < stats.timestamps.length; i++) {
                const timestamp = stats.timestamps[i];
                if (timestamp !== undefined && timestamp >= cutoffTime) {
                    totalApiCalls++;
                    // Determine if this call was successful by checking tool stats
                    // Since we track successes/failures but not per-call, we use overall success rate
                    // This is an approximation - in reality we'd need per-call success tracking
                }
            }
        }
        // For now, use overall metrics as approximation for calls in window
        // In production, we'd track per-call success/failure with timestamps
        const overallMetrics = this.getOverallMetrics();
        // Return metrics scaled to window (approximation)
        return {
            totalApiCalls,
            successRate: overallMetrics.successRate,
            totalCacheRequests: overallMetrics.totalCacheRequests,
            cacheHitRate: overallMetrics.cacheHitRate,
            totalBatches: overallMetrics.totalBatches,
            avgBatchEfficiency: overallMetrics.avgBatchEfficiency,
            rateLimitHits: overallMetrics.rateLimitHits,
            circuitBreakerState: overallMetrics.circuitBreakerState,
        };
    }
    /**
     * Get error metrics by type
     * @returns Record mapping error types to counts
     */
    getErrorMetrics() {
        const result = {};
        for (const [errorType, count] of this.errorMetrics.entries()) {
            result[errorType] = count;
        }
        return result;
    }
    /**
     * Get comprehensive dashboard data
     * @returns Dashboard data with overview, tool breakdown, cache stats, and batch stats
     */
    getDashboardData() {
        // Get overview
        const overview = this.getOverallMetrics();
        // Build tool breakdown
        const toolBreakdown = {};
        for (const [tool, _stats] of this.toolMetrics.entries()) {
            toolBreakdown[tool] = this.getToolMetrics(tool);
        }
        // Get cache stats
        const cacheStats = this.getCacheMetrics();
        // Get batch stats
        const batchStats = this.getBatchMetrics();
        return {
            overview,
            toolBreakdown,
            cacheStats,
            batchStats,
        };
    }
    /**
     * Clear all metrics (for testing)
     */
    clear() {
        this.operations.clear();
        this.cacheRequests = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.apiCalls = 0;
        this.apiCallsByMethod.clear();
        this.apiErrors = 0;
        this.activeRequests = 0;
        // Clear extended metrics
        this.toolMetrics.clear();
        this.actionMetrics.clear();
        this.errorMetrics.clear();
        this.categoryCacheMetrics.clear();
        this.batchOperations = {
            totalBatches: 0,
            totalRequestCount: 0,
            totalSavedCalls: 0,
        };
        this.rateLimits = {
            readLimits: 0,
            writeLimits: 0,
        };
        this.circuitBreakerEvents = {
            openEvents: 0,
            halfOpenEvents: 0,
            closedEvents: 0,
            currentState: 'closed',
        };
        this.startTime = new Date();
    }
    /**
     * Reset all metrics (alias for clear, for testing)
     */
    reset() {
        this.clear();
    }
    /**
     * Get metrics as flat object for logging
     */
    getLogMetrics() {
        const summary = this.getSummary();
        return {
            uptime: summary.uptime,
            totalOperations: summary.totalOperations,
            avgSuccessRate: summary.avgSuccessRate,
            cacheHitRate: summary.cache.hitRate,
            apiCalls: summary.api.calls,
            apiErrorRate: summary.api.errorRate,
            activeRequests: summary.system.activeRequests,
            memoryUsageMB: Math.round(summary.system.memoryUsage / 1024 / 1024),
        };
    }
}
// ==================== Singleton ====================
import * as os from 'os';
let metricsService = null;
/**
 * Get or create metrics service singleton
 */
export function getMetricsService() {
    if (!metricsService) {
        metricsService = new MetricsService();
    }
    return metricsService;
}
/**
 * Set metrics service (for testing or custom configuration)
 */
export function setMetricsService(service) {
    metricsService = service;
}
/**
 * Initialize metrics service with options
 */
export function initMetricsService(options) {
    metricsService = new MetricsService(options);
    return metricsService;
}
/**
 * Reset metrics service (for testing only)
 * @internal
 */
export function resetMetricsService() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetMetricsService() can only be called in test environment');
    }
    metricsService = null;
}
//# sourceMappingURL=metrics.js.map