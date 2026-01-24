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
export interface OperationMetrics {
    /** Operation name (e.g., "sheets_data.write") */
    name: string;
    /** Total count */
    count: number;
    /** Success count */
    successCount: number;
    /** Failure count */
    failureCount: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Duration statistics (milliseconds) */
    duration: {
        min: number;
        max: number;
        avg: number;
        p50: number;
        p95: number;
        p99: number;
        total: number;
    };
    /** Last recorded timestamp */
    lastRecorded: number;
}
export interface CacheMetrics {
    /** Total cache requests */
    requests: number;
    /** Cache hits */
    hits: number;
    /** Cache misses */
    misses: number;
    /** Hit rate (0-1) */
    hitRate: number;
}
export interface ApiMetrics {
    /** Total API calls */
    calls: number;
    /** API calls by method */
    byMethod: Record<string, number>;
    /** Errors */
    errors: number;
    /** Error rate (0-1) */
    errorRate: number;
}
export interface SystemMetrics {
    /** Active requests */
    activeRequests: number;
    /** Total memory usage (bytes) */
    memoryUsage: number;
    /** Memory usage percentage (0-1) */
    memoryUsagePercent: number;
    /** CPU usage percentage (0-1) */
    cpuUsage: number;
    /** Uptime (seconds) */
    uptime: number;
}
export interface MetricsSummary {
    /** Service start time */
    startTime: string;
    /** Current time */
    currentTime: string;
    /** Uptime (seconds) */
    uptime: number;
    /** Operation metrics */
    operations: OperationMetrics[];
    /** Cache metrics */
    cache: CacheMetrics;
    /** API metrics */
    api: ApiMetrics;
    /** System metrics */
    system: SystemMetrics;
    /** Total operations */
    totalOperations: number;
    /** Average success rate across all operations */
    avgSuccessRate: number;
}
export interface RecordOperationOptions {
    /** Operation name */
    name: string;
    /** Duration in milliseconds */
    durationMs: number;
    /** Success status */
    success: boolean;
    /** Optional error */
    error?: Error;
}
export interface RecordApiCallOptions {
    /** Tool name (e.g., "sheets_data") */
    tool: string;
    /** Action name (e.g., "read", "write") */
    action: string;
    /** Duration in milliseconds */
    duration: number;
    /** Success status */
    success: boolean;
    /** Error type (if failed) */
    errorType?: string;
    /** Timestamp (defaults to Date.now() if not provided) */
    timestamp?: number;
}
export interface ToolMetrics {
    /** Total calls */
    totalCalls: number;
    /** Successful calls */
    successCalls: number;
    /** Failed calls */
    failedCalls: number;
    /** Average duration (ms) */
    avgDuration: number;
    /** Minimum duration (ms) */
    minDuration: number;
    /** Maximum duration (ms) */
    maxDuration: number;
}
export interface ActionMetrics {
    /** Total calls */
    totalCalls: number;
    /** Average duration (ms) */
    avgDuration: number;
}
export interface CategoryCacheMetrics {
    /** Cache hits */
    hits: number;
    /** Cache misses */
    misses: number;
    /** Hit rate (0-1) */
    hitRate: number;
}
export interface BatchOperationData {
    /** Total requests in batch */
    requestCount: number;
    /** Actual API calls executed */
    executedCount: number;
    /** API calls saved by batching */
    savedApiCalls: number;
    /** Duration in milliseconds */
    duration: number;
}
export interface BatchMetrics {
    /** Total batches executed */
    totalBatches: number;
    /** Total API calls saved */
    totalSavedCalls: number;
    /** Average efficiency (savedCalls / requestCount) */
    avgEfficiency: number;
}
export interface RateLimitMetrics {
    /** Read rate limit hits */
    readLimits: number;
    /** Write rate limit hits */
    writeLimits: number;
    /** Total rate limit hits */
    totalLimits: number;
}
export interface CircuitBreakerMetrics {
    /** Open state events */
    openEvents: number;
    /** Half-open state events */
    halfOpenEvents: number;
    /** Closed state events */
    closedEvents: number;
}
export interface OverallMetrics {
    /** Total API calls */
    totalApiCalls: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Total cache requests */
    totalCacheRequests: number;
    /** Cache hit rate (0-1) */
    cacheHitRate: number;
    /** Total batches */
    totalBatches: number;
    /** Average batch efficiency (0-1) */
    avgBatchEfficiency: number;
    /** Rate limit hits */
    rateLimitHits: number;
    /** Circuit breaker state */
    circuitBreakerState: string;
}
export declare class MetricsService {
    private startTime;
    private operations;
    private cacheRequests;
    private cacheHits;
    private cacheMisses;
    private apiCalls;
    private apiCallsByMethod;
    private apiErrors;
    private activeRequests;
    private toolMetrics;
    private actionMetrics;
    private errorMetrics;
    private categoryCacheMetrics;
    private batchOperations;
    private rateLimits;
    private circuitBreakerEvents;
    private enabled;
    private verboseLogging;
    constructor(options?: {
        enabled?: boolean;
        verboseLogging?: boolean;
    });
    /**
     * Check if metrics are enabled
     */
    isEnabled(): boolean;
    /**
     * Record an operation
     */
    recordOperation(options: RecordOperationOptions): void;
    recordOperation(name: string, durationMs: number, success: boolean): void;
    /**
     * Record cache access
     */
    recordCacheAccess(hit: boolean): void;
    /**
     * Record API call (simple signature for backward compatibility)
     */
    recordApiCall(method: string, success?: boolean): void;
    /**
     * Record API call (extended signature with tool/action tracking)
     */
    recordApiCall(options: RecordApiCallOptions): void;
    /**
     * Increment active requests counter
     */
    incrementActiveRequests(): void;
    /**
     * Decrement active requests counter
     */
    decrementActiveRequests(): void;
    /**
     * Get operation metrics
     */
    getOperationMetrics(name: string): OperationMetrics | undefined;
    /**
     * Get all operation metrics
     */
    getAllOperationMetrics(): OperationMetrics[];
    /**
     * Calculate operation metrics with percentiles
     */
    private calculateOperationMetrics;
    /**
     * Calculate percentile from sorted array
     */
    private percentile;
    /**
     * Get cache metrics (overall)
     */
    getCacheMetrics(): CacheMetrics;
    /**
     * Get cache metrics for a specific category
     */
    getCacheMetrics(category: string): CategoryCacheMetrics;
    /**
     * Get API metrics
     */
    getApiMetrics(): ApiMetrics;
    /**
     * Get system metrics
     */
    getSystemMetrics(): SystemMetrics;
    /**
     * Get comprehensive metrics summary
     */
    getSummary(): MetricsSummary;
    /**
     * Get tool-level metrics
     */
    getToolMetrics(tool: string): ToolMetrics;
    /**
     * Get action-level metrics
     */
    getActionMetrics(tool: string, action: string): ActionMetrics;
    /**
     * Record cache hit/miss for a specific category
     */
    recordCacheHit(category: string, hit: boolean): void;
    /**
     * Get cache metrics for a specific category
     */
    getCategoryCacheMetrics(category: string): CategoryCacheMetrics;
    /**
     * Record batch operation
     */
    recordBatchOperation(data: BatchOperationData): void;
    /**
     * Get batch operation metrics
     */
    getBatchMetrics(): BatchMetrics;
    /**
     * Record rate limit hit
     */
    recordRateLimitHit(type: 'read' | 'write'): void;
    /**
     * Get rate limit metrics
     */
    getRateLimitMetrics(): RateLimitMetrics;
    /**
     * Record circuit breaker state change
     */
    recordCircuitBreakerEvent(state: 'open' | 'half-open' | 'closed'): void;
    /**
     * Get circuit breaker metrics
     */
    getCircuitBreakerMetrics(): CircuitBreakerMetrics;
    /**
     * Get overall aggregated metrics
     */
    getOverallMetrics(): OverallMetrics;
    /**
     * Get metrics within a time window
     * @param windowMs Time window in milliseconds (e.g., 60000 for last minute)
     */
    getMetricsInWindow(windowMs: number): OverallMetrics;
    /**
     * Get error metrics by type
     * @returns Record mapping error types to counts
     */
    getErrorMetrics(): Record<string, number>;
    /**
     * Get comprehensive dashboard data
     * @returns Dashboard data with overview, tool breakdown, cache stats, and batch stats
     */
    getDashboardData(): {
        overview: OverallMetrics;
        toolBreakdown: Record<string, ToolMetrics>;
        cacheStats: CacheMetrics;
        batchStats: BatchMetrics;
    };
    /**
     * Clear all metrics (for testing)
     */
    clear(): void;
    /**
     * Reset all metrics (alias for clear, for testing)
     */
    reset(): void;
    /**
     * Get metrics as flat object for logging
     */
    getLogMetrics(): Record<string, unknown>;
}
/**
 * Get or create metrics service singleton
 */
export declare function getMetricsService(): MetricsService;
/**
 * Set metrics service (for testing or custom configuration)
 */
export declare function setMetricsService(service: MetricsService): void;
/**
 * Initialize metrics service with options
 */
export declare function initMetricsService(options?: {
    enabled?: boolean;
    verboseLogging?: boolean;
}): MetricsService;
/**
 * Reset metrics service (for testing only)
 * @internal
 */
export declare function resetMetricsService(): void;
//# sourceMappingURL=metrics.d.ts.map