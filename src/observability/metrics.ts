/**
 * Prometheus Metrics
 *
 * Exposes key operational metrics for monitoring and alerting.
 * Access via GET /metrics endpoint.
 */

import { register, Counter, Histogram, Gauge, Summary } from "prom-client";

// Tool call metrics
export const toolCallsTotal = new Counter({
  name: "servalsheets_tool_calls_total",
  help: "Total number of tool calls",
  labelNames: ["tool", "action", "status"],
});

export const toolCallDuration = new Histogram({
  name: "servalsheets_tool_call_duration_seconds",
  help: "Tool call duration in seconds",
  labelNames: ["tool", "action"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Google API metrics
export const googleApiCallsTotal = new Counter({
  name: "servalsheets_google_api_calls_total",
  help: "Total Google API calls",
  labelNames: ["method", "status"],
});

export const googleApiDuration = new Histogram({
  name: "servalsheets_google_api_duration_seconds",
  help: "Google API call duration",
  labelNames: ["method"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Circuit breaker metrics
export const circuitBreakerState = new Gauge({
  name: "servalsheets_circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=half_open, 2=open)",
  labelNames: ["circuit"],
});

// Cache metrics
export const cacheHitsTotal = new Counter({
  name: "servalsheets_cache_hits_total",
  help: "Total cache hits",
  labelNames: ["namespace"],
});

export const cacheMissesTotal = new Counter({
  name: "servalsheets_cache_misses_total",
  help: "Total cache misses",
  labelNames: ["namespace"],
});

export const cacheSize = new Gauge({
  name: "servalsheets_cache_size_bytes",
  help: "Current cache size in bytes",
  labelNames: ["namespace"],
});

// Queue metrics
export const queueSize = new Gauge({
  name: "servalsheets_queue_size",
  help: "Current request queue size",
});

export const queuePending = new Gauge({
  name: "servalsheets_queue_pending",
  help: "Current pending requests in queue",
});

// Session store metrics
export const sessionsTotal = new Gauge({
  name: "servalsheets_sessions_total",
  help: "Total active OAuth sessions",
});

// Batch efficiency metrics
export const batchRequestsTotal = new Counter({
  name: "servalsheets_batch_requests_total",
  help: "Total batch requests",
  labelNames: ["operation"],
});

export const batchSizeHistogram = new Histogram({
  name: "servalsheets_batch_size",
  help: "Batch size distribution",
  labelNames: ["operation"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

// Error rates by type
export const errorsByType = new Counter({
  name: "servalsheets_errors_by_type_total",
  help: "Total errors by error type",
  labelNames: ["error_type", "tool", "action"],
  registers: [register],
});

// Latency percentiles as Summary (better than Histogram for percentiles)
export const toolCallLatencySummary = new Summary({
  name: "servalsheets_tool_call_latency_summary",
  help: "Tool call latency with percentiles",
  labelNames: ["tool", "action"],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

// Batch efficiency ratio
export const batchEfficiencyRatio = new Gauge({
  name: "servalsheets_batch_efficiency_ratio",
  help: "Ratio of operations batched vs individual calls (0-1)",
  labelNames: ["operation_type"],
  registers: [register],
});

// Request queue depth
export const requestQueueDepth = new Gauge({
  name: "servalsheets_request_queue_depth",
  help: "Current number of requests in queue",
  registers: [register],
});

// Cache eviction counter
export const cacheEvictions = new Counter({
  name: "servalsheets_cache_evictions_total",
  help: "Total number of cache entries evicted",
  labelNames: ["reason"],
  registers: [register],
});

/**
 * Export metrics handler for Express
 */
export async function metricsHandler(
  _req: unknown,
  res: {
    set: (key: string, value: string) => void;
    send: (body: string) => void;
    end: (body?: string) => void;
    status: (code: number) => {
      send: (body: string) => void;
      end: (body?: string) => void;
    };
  },
): Promise<void> {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Update circuit breaker state metric
 */
export function updateCircuitBreakerMetric(
  circuit: string,
  state: "closed" | "open" | "half_open",
): void {
  const stateValue = state === "closed" ? 0 : state === "half_open" ? 1 : 2;
  circuitBreakerState.set({ circuit }, stateValue);
}

/**
 * Record tool call metrics
 */
export function recordToolCall(
  tool: string,
  action: string,
  status: "success" | "error",
  durationSeconds: number,
): void {
  toolCallsTotal.inc({ tool, action, status });
  toolCallDuration.observe({ tool, action }, durationSeconds);
}

/**
 * Record Google API call metrics
 */
export function recordGoogleApiCall(
  method: string,
  status: "success" | "error",
  durationSeconds: number,
): void {
  googleApiCallsTotal.inc({ method, status });
  googleApiDuration.observe({ method }, durationSeconds);
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(size: number, pending: number): void {
  queueSize.set(size);
  queuePending.set(pending);
}

/**
 * Update cache metrics
 */
export function updateCacheMetrics(
  namespace: string,
  hits: number,
  misses: number,
  sizeBytes: number,
): void {
  cacheHitsTotal.inc({ namespace }, hits);
  cacheMissesTotal.inc({ namespace }, misses);
  cacheSize.set({ namespace }, sizeBytes);
}

/**
 * Record batch operation
 */
export function recordBatchOperation(operation: string, size: number): void {
  batchRequestsTotal.inc({ operation });
  batchSizeHistogram.observe({ operation }, size);
}

/**
 * Record error by type
 */
export function recordError(
  errorType: string,
  tool: string,
  action: string,
): void {
  errorsByType.inc({ error_type: errorType, tool, action });
}

/**
 * Record tool call latency in summary (for percentile calculation)
 */
export function recordToolCallLatency(
  tool: string,
  action: string,
  durationSeconds: number,
): void {
  toolCallLatencySummary.observe({ tool, action }, durationSeconds);
}

/**
 * Update batch efficiency ratio
 */
export function updateBatchEfficiency(
  operationType: string,
  ratio: number,
): void {
  batchEfficiencyRatio.set({ operation_type: operationType }, ratio);
}

/**
 * Update request queue depth
 */
export function updateRequestQueueDepth(depth: number): void {
  requestQueueDepth.set(depth);
}

/**
 * Record cache eviction
 */
export function recordCacheEviction(reason: string): void {
  cacheEvictions.inc({ reason });
}
