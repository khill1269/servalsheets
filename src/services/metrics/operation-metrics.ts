/**
 * Operation Metrics Service
 *
 * Tracks performance metrics for tool calls and handlers.
 * Records durations, success rates, and percentiles.
 */

export interface OperationMetrics {
  operationName: string;
  successCount: number;
  errorCount: number;
  totalCount: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  successRate: number;
  lastRecordedAt: number;
}

export class OperationMetricsService {
  private metrics: Map<string, OperationMetrics> = new Map();
  private durations: Map<string, number[]> = new Map(); // Circular buffers (max 1000)
  private maxSamplesPerOp = 1000;
  private maxOperations = 500; // LRU eviction when exceeded

  /**
   * Record operation duration (success or error)
   */
  recordDuration(operationName: string, durationMs: number, success: boolean = true): void {
    let metrics = this.metrics.get(operationName);

    if (!metrics) {
      metrics = {
        operationName,
        successCount: 0,
        errorCount: 0,
        totalCount: 0,
        totalDurationMs: 0,
        minDurationMs: durationMs,
        maxDurationMs: durationMs,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        successRate: 1.0,
        lastRecordedAt: Date.now(),
      };
      this.metrics.set(operationName, metrics);
      this.durations.set(operationName, []);
    }

    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }

    metrics.totalCount++;
    metrics.totalDurationMs += durationMs;
    metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
    metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
    metrics.avgDurationMs = metrics.totalDurationMs / metrics.totalCount;
    metrics.successRate = metrics.successCount / metrics.totalCount;
    metrics.lastRecordedAt = Date.now();

    // Store duration sample (circular buffer)
    const durations = this.durations.get(operationName)!;
    durations.push(durationMs);
    if (durations.length > this.maxSamplesPerOp) {
      durations.shift();
    }

    // Update percentiles
    this.updatePercentiles(metrics, durations);

    // LRU eviction if too many operations
    if (this.metrics.size > this.maxOperations) {
      const oldest = Array.from(this.metrics.values()).sort(
        (a, b) => a.lastRecordedAt - b.lastRecordedAt
      )[0];
      if (oldest) {
        this.metrics.delete(oldest.operationName);
        this.durations.delete(oldest.operationName);
      }
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(operationName: string): OperationMetrics | undefined {
    return this.metrics.get(operationName);
  }

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): OperationMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.durations.clear();
  }

  private updatePercentiles(metrics: OperationMetrics, durations: number[]): void {
    if (durations.length === 0) return;

    const sorted = [...durations].sort((a, b) => a - b);
    metrics.p50DurationMs = sorted[Math.floor(sorted.length * 0.5)]!;
    metrics.p95DurationMs = sorted[Math.floor(sorted.length * 0.95)]!;
    metrics.p99DurationMs = sorted[Math.floor(sorted.length * 0.99)]!;
  }
}

/**
 * Singleton instance
 */
let globalMetrics: OperationMetricsService | null = null;

export function getOperationMetricsService(): OperationMetricsService {
  if (!globalMetrics) {
    globalMetrics = new OperationMetricsService();
  }
  return globalMetrics;
}
