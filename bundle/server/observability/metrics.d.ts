/**
 * Prometheus Metrics
 *
 * Exposes key operational metrics for monitoring and alerting.
 * Access via GET /metrics endpoint.
 */
import { Counter, Histogram, Gauge, Summary } from 'prom-client';
export declare const toolCallsTotal: Counter<"tool" | "action" | "status">;
export declare const toolCallDuration: Histogram<"tool" | "action">;
export declare const googleApiCallsTotal: Counter<"method" | "status">;
export declare const googleApiDuration: Histogram<"method">;
export declare const circuitBreakerState: Gauge<"circuit">;
export declare const cacheHitsTotal: Counter<"namespace">;
export declare const cacheMissesTotal: Counter<"namespace">;
export declare const cacheSize: Gauge<"namespace">;
export declare const queueSize: Gauge<string>;
export declare const queuePending: Gauge<string>;
export declare const sessionsTotal: Gauge<string>;
export declare const batchRequestsTotal: Counter<"operation">;
export declare const batchSizeHistogram: Histogram<"operation">;
export declare const errorsByType: Counter<"tool" | "action" | "error_type">;
export declare const toolCallLatencySummary: Summary<"tool" | "action">;
export declare const batchEfficiencyRatio: Gauge<"operation_type">;
export declare const requestQueueDepth: Gauge<string>;
export declare const cacheEvictions: Counter<"reason">;
/**
 * Export metrics handler for Express
 */
export declare function metricsHandler(_req: unknown, res: {
    set: (key: string, value: string) => void;
    send: (body: string) => void;
    end: (body?: string) => void;
    status: (code: number) => {
        send: (body: string) => void;
        end: (body?: string) => void;
    };
}): Promise<void>;
/**
 * Update circuit breaker state metric
 */
export declare function updateCircuitBreakerMetric(circuit: string, state: 'closed' | 'open' | 'half_open'): void;
/**
 * Record tool call metrics
 */
export declare function recordToolCall(tool: string, action: string, status: 'success' | 'error', durationSeconds: number): void;
/**
 * Record Google API call metrics
 */
export declare function recordGoogleApiCall(method: string, status: 'success' | 'error', durationSeconds: number): void;
/**
 * Update queue metrics
 */
export declare function updateQueueMetrics(size: number, pending: number): void;
/**
 * Update cache metrics
 */
export declare function updateCacheMetrics(namespace: string, hits: number, misses: number, sizeBytes: number): void;
/**
 * Record batch operation
 */
export declare function recordBatchOperation(operation: string, size: number): void;
/**
 * Record error by type
 */
export declare function recordError(errorType: string, tool: string, action: string): void;
/**
 * Record tool call latency in summary (for percentile calculation)
 */
export declare function recordToolCallLatency(tool: string, action: string, durationSeconds: number): void;
/**
 * Update batch efficiency ratio
 */
export declare function updateBatchEfficiency(operationType: string, ratio: number): void;
/**
 * Update request queue depth
 */
export declare function updateRequestQueueDepth(depth: number): void;
/**
 * Record cache eviction
 */
export declare function recordCacheEviction(reason: string): void;
//# sourceMappingURL=metrics.d.ts.map