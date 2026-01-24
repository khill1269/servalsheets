/**
 * ServalSheets - Heap Monitor
 *
 * Monitors Node.js heap usage to detect memory leaks
 * Provides automatic alerting at configurable thresholds
 */
export interface HeapStats {
    timestamp: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapLimitMB: number;
    utilizationPercent: number;
    externalMB: number;
    rss: number;
}
export interface HeapMonitorOptions {
    /** Monitoring interval in milliseconds (default: 30 minutes) */
    intervalMs?: number;
    /** Heap utilization warning threshold (0-1, default: 0.7) */
    warningThreshold?: number;
    /** Heap utilization critical threshold (0-1, default: 0.85) */
    criticalThreshold?: number;
    /** Enable heap snapshots at critical threshold (default: false) */
    enableSnapshots?: boolean;
    /** Path for heap snapshots (default: ./heap-snapshots) */
    snapshotPath?: string;
}
/**
 * Heap monitor for detecting memory leaks in production
 */
export declare class HeapMonitor {
    private interval?;
    private intervalMs;
    private warningThreshold;
    private criticalThreshold;
    private enableSnapshots;
    private snapshotPath;
    private lastWarningTime;
    private lastCriticalTime;
    private consecutiveWarnings;
    private consecutiveCritical;
    constructor(options?: HeapMonitorOptions);
    /**
     * Start monitoring heap usage
     */
    start(): void;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Get current heap statistics
     */
    getHeapStats(): HeapStats;
    /**
     * Check heap and alert if thresholds exceeded
     */
    private checkHeap;
    /**
     * Get recommendation based on heap utilization
     */
    private getRecommendation;
    /**
     * Take heap snapshot for analysis
     */
    private takeHeapSnapshot;
    /**
     * Force garbage collection (if --expose-gc flag enabled)
     */
    forceGC(): void;
}
/**
 * Create and start heap monitor if enabled via environment variables
 */
export declare function startHeapMonitorIfEnabled(): HeapMonitor | null;
//# sourceMappingURL=heap-monitor.d.ts.map