/**
 * MetricsExporter
 *
 * @purpose Exports performance metrics in Prometheus text format for external monitoring (Grafana, Datadog, etc.)
 * @category Infrastructure
 * @usage Use for continuous monitoring; exposes /metrics endpoint, includes cache hits, batching efficiency, API latency
 * @dependencies MetricsService, CacheManager
 * @stateful No - reads current state from MetricsService on-demand
 * @singleton No - can be instantiated per export request
 *
 * @example
 * const exporter = new MetricsExporter(metricsService, cacheManager);
 * const prometheusText = exporter.export();
 * // # HELP servalsheets_api_calls_total Total API calls
 * // # TYPE servalsheets_api_calls_total counter
 * // servalsheets_api_calls_total{operation="read"} 1250
 */
import { MetricsService } from './metrics.js';
import { CacheManager } from '../utils/cache-manager.js';
export interface MetricsSnapshot {
    timestamp: number;
    cache: Record<string, CacheStats>;
    batching: BatchingStats;
    api: APIStats;
}
export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    hitRate: number;
}
export interface BatchingStats {
    currentWindowMs: number;
    totalBatches: number;
    totalRequests: number;
    averageBatchSize: number;
    deduplicatedCount: number;
}
export interface APIStats {
    callsByMethod: Record<string, number>;
    errorsByCode: Record<string, number>;
    totalCalls: number;
    totalErrors: number;
}
/**
 * Exports metrics in various formats
 */
export declare class MetricsExporter {
    private metricsService;
    private cacheManager?;
    constructor(metricsService: MetricsService, cacheManager?: CacheManager);
    /**
     * Get current metrics snapshot
     */
    getSnapshot(): MetricsSnapshot;
    /**
     * Export metrics in Prometheus text format
     * Spec: https://prometheus.io/docs/instrumenting/exposition_formats/
     */
    exportPrometheus(): string;
    /**
     * Export metrics in JSON format
     */
    exportJSON(): string;
    /**
     * Export metrics in human-readable text format
     */
    exportText(): string;
}
//# sourceMappingURL=metrics-exporter.d.ts.map