/**
 * MetricsDashboard
 *
 * @purpose Aggregates and formats operational metrics into human-readable dashboard; shows API efficiency, caching gains, cost savings
 * @category Infrastructure
 * @usage Use for monitoring and observability; queries Prometheus registry, formats as tables/charts, calculates savings percentages
 * @dependencies prom-client (Prometheus registry)
 * @stateful No - queries metrics from Prometheus registry on-demand
 * @singleton No - can be instantiated per dashboard request
 *
 * @example
 * const dashboard = new MetricsDashboard();
 * const report = dashboard.generate();
 * logger.info(report); // Formatted dashboard with API calls, cache hits, batching efficiency, cost savings
 */
/**
 * API efficiency metrics
 */
export interface ApiEfficiencyMetrics {
    /** Total Google API calls made */
    totalApiCalls: number;
    /** Estimated API calls without optimization */
    estimatedUnoptimizedCalls: number;
    /** API calls saved through optimization */
    callsSaved: number;
    /** Efficiency improvement percentage */
    efficiencyGain: string;
    /** Batching statistics */
    batching: {
        totalBatchRequests: number;
        averageBatchSize: number;
        efficiencyRatio: number;
        callsSavedByBatching: number;
    };
    /** Cache statistics */
    caching: {
        totalHits: number;
        totalMisses: number;
        hitRate: string;
        callsSavedByCache: number;
    };
    /** Request deduplication statistics */
    deduplication: {
        duplicatesDetected: number;
        callsSavedByDedup: number;
    };
}
/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    /** Average tool call duration */
    avgToolCallDuration: string;
    /** Average API call duration */
    avgApiCallDuration: string;
    /** Total operations processed */
    totalOperations: number;
    /** Operations per minute */
    operationsPerMinute: number;
}
/**
 * Tool usage metrics
 */
export interface ToolUsageMetrics {
    /** Total tool calls */
    totalCalls: number;
    /** Most used tools */
    topTools: Array<{
        name: string;
        calls: number;
        percentage: string;
    }>;
    /** Success rate */
    successRate: string;
}
/**
 * Complete dashboard data
 */
export interface MetricsDashboard {
    /** Snapshot timestamp */
    timestamp: string;
    /** Uptime in seconds */
    uptimeSeconds: number;
    /** API efficiency metrics */
    apiEfficiency: ApiEfficiencyMetrics;
    /** Performance metrics */
    performance: PerformanceMetrics;
    /** Tool usage metrics */
    toolUsage: ToolUsageMetrics;
    /** Cost savings estimate (based on Google Sheets API quotas) */
    costSavings: {
        /** Estimated cost per 100 API calls (USD) */
        costPer100Calls: number;
        /** Total cost without optimization */
        estimatedUnoptimizedCost: string;
        /** Actual cost with optimization */
        actualCost: string;
        /** Cost savings */
        savings: string;
    };
}
/**
 * Generate complete metrics dashboard
 */
export declare function generateMetricsDashboard(): Promise<MetricsDashboard>;
/**
 * Format dashboard as human-readable text
 */
export declare function formatDashboardAsText(dashboard: MetricsDashboard): string;
//# sourceMappingURL=metrics-dashboard.d.ts.map