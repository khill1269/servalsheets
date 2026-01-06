/**
 * ServalSheets - Metrics Service
 *
 * Performance metrics aggregation for monitoring and observability.
 *
 * Features:
 * - Operation counters (success, failure, total)
 * - Duration metrics (min, max, avg, p50, p95, p99)
 * - Error rate tracking
 * - Cache hit rate tracking
 * - API call counters
 * - Active request tracking
 * - Memory-efficient (sliding window)
 */

import { logger } from '../utils/logger.js';

// ==================== Types ====================

export interface OperationMetrics {
  /** Operation name (e.g., "sheets_values.write") */
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

class MetricsService {
  private startTime: Date = new Date();
  private operations: Map<string, {
    count: number;
    successCount: number;
    failureCount: number;
    durations: number[]; // Circular buffer
    lastRecorded: number;
  }> = new Map();

  private cacheRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  private apiCalls = 0;
  private apiCallsByMethod: Map<string, number> = new Map();
  private apiErrors = 0;

  private activeRequests = 0;

  private enabled: boolean;
  private verboseLogging: boolean;

  constructor(options: { enabled?: boolean; verboseLogging?: boolean } = {}) {
    this.enabled = options.enabled ?? (process.env['METRICS_ENABLED'] !== 'false');
    this.verboseLogging = options.verboseLogging ?? (process.env['METRICS_VERBOSE'] === 'true');

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
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record an operation
   */
  recordOperation(options: RecordOperationOptions): void {
    if (!this.enabled) return;

    const { name, durationMs, success } = options;

    let op = this.operations.get(name);
    if (!op) {
      // Check if we're at the operation limit
      if (this.operations.size >= MAX_OPERATIONS) {
        // Remove least recently recorded operation
        let oldestOp: string | null = null;
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
    if (success) {
      op.successCount++;
    } else {
      op.failureCount++;
    }
    op.lastRecorded = Date.now();

    // Record duration (circular buffer)
    op.durations.push(durationMs);
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
  recordCacheAccess(hit: boolean): void {
    if (!this.enabled) return;

    this.cacheRequests++;
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  /**
   * Record API call
   */
  recordApiCall(method: string, error?: boolean): void {
    if (!this.enabled) return;

    this.apiCalls++;
    this.apiCallsByMethod.set(method, (this.apiCallsByMethod.get(method) || 0) + 1);
    if (error) {
      this.apiErrors++;
    }
  }

  /**
   * Increment active requests counter
   */
  incrementActiveRequests(): void {
    if (!this.enabled) return;
    this.activeRequests++;
  }

  /**
   * Decrement active requests counter
   */
  decrementActiveRequests(): void {
    if (!this.enabled) return;
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Get operation metrics
   */
  getOperationMetrics(name: string): OperationMetrics | undefined {
    const op = this.operations.get(name);
    if (!op) return undefined;

    return this.calculateOperationMetrics(name, op);
  }

  /**
   * Get all operation metrics
   */
  getAllOperationMetrics(): OperationMetrics[] {
    const metrics: OperationMetrics[] = [];
    for (const [name, op] of Array.from(this.operations.entries())) {
      metrics.push(this.calculateOperationMetrics(name, op));
    }
    // Sort by count (most frequent first)
    return metrics.sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate operation metrics with percentiles
   */
  private calculateOperationMetrics(name: string, op: {
    count: number;
    successCount: number;
    failureCount: number;
    durations: number[];
    lastRecorded: number;
  }): OperationMetrics {
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
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
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
  getApiMetrics(): ApiMetrics {
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
  getSystemMetrics(): SystemMetrics {
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
  getSummary(): MetricsSummary {
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
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.operations.clear();
    this.cacheRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCalls = 0;
    this.apiCallsByMethod.clear();
    this.apiErrors = 0;
    this.activeRequests = 0;
    this.startTime = new Date();
  }

  /**
   * Get metrics as flat object for logging
   */
  getLogMetrics(): Record<string, unknown> {
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

let metricsService: MetricsService | null = null;

/**
 * Get or create metrics service singleton
 */
export function getMetricsService(): MetricsService {
  if (!metricsService) {
    metricsService = new MetricsService();
  }
  return metricsService;
}

/**
 * Set metrics service (for testing or custom configuration)
 */
export function setMetricsService(service: MetricsService): void {
  metricsService = service;
}

/**
 * Initialize metrics service with options
 */
export function initMetricsService(options?: { enabled?: boolean; verboseLogging?: boolean }): MetricsService {
  metricsService = new MetricsService(options);
  return metricsService;
}
