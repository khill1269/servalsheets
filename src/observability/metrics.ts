/**
 * Prometheus Metrics
 *
 * Exposes key operational metrics for monitoring and alerting.
 * Access via GET /metrics endpoint.
 */

import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';

// Tool call metrics
export const toolCallsTotal = new Counter({
  name: 'servalsheets_tool_calls_total',
  help: 'Total number of tool calls',
  labelNames: ['tool', 'action', 'status'],
});

export const toolCallDuration = new Histogram({
  name: 'servalsheets_tool_call_duration_seconds',
  help: 'Tool call duration in seconds',
  labelNames: ['tool', 'action'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Google API metrics
export const googleApiCallsTotal = new Counter({
  name: 'servalsheets_google_api_calls_total',
  help: 'Total Google API calls',
  labelNames: ['method', 'status'],
});

export const googleApiDuration = new Histogram({
  name: 'servalsheets_google_api_duration_seconds',
  help: 'Google API call duration',
  labelNames: ['method'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Circuit breaker metrics
export const circuitBreakerState = new Gauge({
  name: 'servalsheets_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half_open, 2=open)',
  labelNames: ['circuit'],
});

// Cache metrics
export const cacheHitsTotal = new Counter({
  name: 'servalsheets_cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['namespace'],
});

export const cacheMissesTotal = new Counter({
  name: 'servalsheets_cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['namespace'],
});

export const cacheSize = new Gauge({
  name: 'servalsheets_cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['namespace'],
});

// Queue metrics
export const queueSize = new Gauge({
  name: 'servalsheets_queue_size',
  help: 'Current request queue size',
});

export const queuePending = new Gauge({
  name: 'servalsheets_queue_pending',
  help: 'Current pending requests in queue',
});

// Session store metrics
export const sessionsTotal = new Gauge({
  name: 'servalsheets_sessions_total',
  help: 'Total active OAuth sessions',
});

// Batch efficiency metrics
export const batchRequestsTotal = new Counter({
  name: 'servalsheets_batch_requests_total',
  help: 'Total batch requests',
  labelNames: ['operation'],
});

export const batchSizeHistogram = new Histogram({
  name: 'servalsheets_batch_size',
  help: 'Batch size distribution',
  labelNames: ['operation'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

// Range merging optimization metrics
export const rangeMergingApiCallsSavedTotal = new Counter({
  name: 'servalsheets_range_merging_api_calls_saved_total',
  help: 'Total API calls saved through synchronous range merging',
  labelNames: ['operation'],
  registers: [register],
});

export const rangeMergingReductionHistogram = new Histogram({
  name: 'servalsheets_range_merging_reduction_percentage',
  help: 'API call reduction percentage from range merging',
  labelNames: ['operation'],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

// Error rates by type
export const errorsByType = new Counter({
  name: 'servalsheets_errors_by_type_total',
  help: 'Total errors by error type',
  labelNames: ['error_type', 'tool', 'action'],
  registers: [register],
});

// HTTP/2 connection reset metrics
export const http2ConnectionResetsTotal = new Counter({
  name: 'servalsheets_http2_connection_resets_total',
  help: 'Total HTTP/2 connection resets due to credential changes',
  labelNames: ['reason'],
  registers: [register],
});

// HTTP/2 error metrics
export const http2ErrorsTotal = new Counter({
  name: 'servalsheets_http2_errors_total',
  help: 'Total HTTP/2 errors by error code',
  labelNames: ['error_code', 'error_type'],
  registers: [register],
});

// Connection health metrics
export const connectionHealthScore = new Gauge({
  name: 'servalsheets_connection_health_score',
  help: 'Connection health score (0-100, based on consecutive errors)',
  registers: [register],
});

export const consecutiveErrorsGauge = new Gauge({
  name: 'servalsheets_consecutive_errors',
  help: 'Current number of consecutive API errors',
  registers: [register],
});

export const lastSuccessfulCallTimestamp = new Gauge({
  name: 'servalsheets_last_successful_call_timestamp_seconds',
  help: 'Unix timestamp of last successful API call',
  registers: [register],
});

// MCP connection health metrics (Phase 0, Priority 1)
export const mcpConnectionStatus = new Gauge({
  name: 'servalsheets_mcp_connection_status',
  help: 'MCP connection status (0=unknown, 1=healthy, 2=warning, 3=disconnected)',
  registers: [register],
});

export const mcpConnectionHeartbeatsTotal = new Counter({
  name: 'servalsheets_mcp_heartbeats_total',
  help: 'Total MCP heartbeats recorded',
  registers: [register],
});

export const mcpConnectionActivityDelaySeconds = new Gauge({
  name: 'servalsheets_mcp_activity_delay_seconds',
  help: 'Seconds since last MCP activity',
  registers: [register],
});

export const mcpConnectionDisconnectWarnings = new Counter({
  name: 'servalsheets_mcp_disconnect_warnings_total',
  help: 'Total MCP disconnect warnings issued',
  registers: [register],
});

export const mcpConnectionUptimeSeconds = new Gauge({
  name: 'servalsheets_mcp_connection_uptime_seconds',
  help: 'MCP connection monitoring uptime in seconds',
  registers: [register],
});

// Server startup metrics (Phase 0, Priority 2)
export const serverStartupDuration = new Histogram({
  name: 'servalsheets_server_startup_duration_seconds',
  help: 'Server startup duration from process start to ready',
  labelNames: ['transport', 'deferred_schemas', 'deferred_resources'],
  buckets: [0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0],
  registers: [register],
});

// OTLP export metrics (Phase 0, Priority 3)
export const otlpSpansExportedTotal = new Counter({
  name: 'servalsheets_otlp_spans_exported_total',
  help: 'Total OTLP spans exported',
  labelNames: ['endpoint'],
  registers: [register],
});

export const otlpExportErrorsTotal = new Counter({
  name: 'servalsheets_otlp_export_errors_total',
  help: 'Total OTLP export errors',
  labelNames: ['endpoint', 'error_type'],
  registers: [register],
});

export const otlpBufferSizeGauge = new Gauge({
  name: 'servalsheets_otlp_buffer_size',
  help: 'Current OTLP span buffer size',
  registers: [register],
});

export const otlpExportDurationHistogram = new Histogram({
  name: 'servalsheets_otlp_export_duration_seconds',
  help: 'OTLP export duration in seconds',
  labelNames: ['endpoint'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
  registers: [register],
});

// Restart policy metrics (Phase 0, Priority 4)
export const restartConsecutiveFailuresGauge = new Gauge({
  name: 'servalsheets_restart_consecutive_failures',
  help: 'Current number of consecutive restart failures',
  registers: [register],
});

export const restartBackoffDelaySeconds = new Gauge({
  name: 'servalsheets_restart_backoff_delay_seconds',
  help: 'Current restart backoff delay in seconds',
  registers: [register],
});

export const restartUptimeSeconds = new Gauge({
  name: 'servalsheets_restart_uptime_seconds',
  help: 'Server uptime since last successful restart in seconds',
  registers: [register],
});

// Concurrency coordinator metrics (Dynamic 429 elimination)
export const concurrencyLimitGauge = new Gauge({
  name: 'servalsheets_concurrency_limit',
  help: 'Current dynamic concurrency limit',
  registers: [register],
});

export const concurrencyActiveOperationsGauge = new Gauge({
  name: 'servalsheets_concurrency_active_operations',
  help: 'Current number of active concurrent operations',
  registers: [register],
});

export const concurrencyQueuedOperationsGauge = new Gauge({
  name: 'servalsheets_concurrency_queued_operations',
  help: 'Current number of queued operations waiting for permits',
  registers: [register],
});

export const concurrencyUtilizationGauge = new Gauge({
  name: 'servalsheets_concurrency_utilization_percentage',
  help: 'Current concurrency utilization as percentage (0-100)',
  registers: [register],
});

export const rateLimitErrorsTotal = new Counter({
  name: 'servalsheets_rate_limit_errors_total',
  help: 'Total 429 rate limit errors encountered',
  registers: [register],
});

export const concurrencyAdjustmentsTotal = new Counter({
  name: 'servalsheets_concurrency_adjustments_total',
  help: 'Total concurrency limit adjustments',
  labelNames: ['reason', 'direction'],
  registers: [register],
});

export const quotaUtilizationGauge = new Gauge({
  name: 'servalsheets_quota_utilization_percentage',
  help: 'Current quota utilization as percentage (0-100)',
  registers: [register],
});

// Latency percentiles as Summary (better than Histogram for percentiles)
export const toolCallLatencySummary = new Summary({
  name: 'servalsheets_tool_call_latency_summary',
  help: 'Tool call latency with percentiles',
  labelNames: ['tool', 'action'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

/**
 * Helper: Record concurrency coordinator status
 */
export function recordConcurrencyStatus(status: {
  limit: number;
  active: number;
  queued: number;
  utilization: number;
}): void {
  concurrencyLimitGauge.set(status.limit);
  concurrencyActiveOperationsGauge.set(status.active);
  concurrencyQueuedOperationsGauge.set(status.queued);
  concurrencyUtilizationGauge.set(status.utilization);
}

/**
 * Helper: Record 429 rate limit error
 */
export function record429Error(): void {
  rateLimitErrorsTotal.inc();
}

/**
 * Helper: Record concurrency limit adjustment
 */
export function recordConcurrencyAdjustment(
  reason: string,
  oldLimit: number,
  newLimit: number
): void {
  const direction =
    newLimit > oldLimit ? 'increase' : newLimit < oldLimit ? 'decrease' : 'no_change';
  concurrencyAdjustmentsTotal.inc({ reason, direction });
}

/**
 * Helper: Record quota utilization
 */
export function recordQuotaUtilization(utilizationPercentage: number): void {
  quotaUtilizationGauge.set(utilizationPercentage);
}

// Batch efficiency ratio
export const batchEfficiencyRatio = new Gauge({
  name: 'servalsheets_batch_efficiency_ratio',
  help: 'Ratio of operations batched vs individual calls (0-1)',
  labelNames: ['operation_type'],
  registers: [register],
});

// Request queue depth
export const requestQueueDepth = new Gauge({
  name: 'servalsheets_request_queue_depth',
  help: 'Current number of requests in queue',
  registers: [register],
});

// Cache eviction counter
export const cacheEvictions = new Counter({
  name: 'servalsheets_cache_evictions_total',
  help: 'Total number of cache entries evicted',
  labelNames: ['reason'],
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
  }
): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
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
  state: 'closed' | 'open' | 'half_open'
): void {
  const stateValue = state === 'closed' ? 0 : state === 'half_open' ? 1 : 2;
  circuitBreakerState.set({ circuit }, stateValue);
}

/**
 * Record tool call metrics
 */
export function recordToolCall(
  tool: string,
  action: string,
  status: 'success' | 'error',
  durationSeconds: number
): void {
  toolCallsTotal.inc({ tool, action, status });
  toolCallDuration.observe({ tool, action }, durationSeconds);
}

/**
 * Record Google API call metrics
 */
export function recordGoogleApiCall(
  method: string,
  status: 'success' | 'error',
  durationSeconds: number
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
  sizeBytes: number
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
export function recordError(errorType: string, tool: string, action: string): void {
  errorsByType.inc({ error_type: errorType, tool, action });
}

/**
 * Record tool call latency in summary (for percentile calculation)
 */
export function recordToolCallLatency(tool: string, action: string, durationSeconds: number): void {
  toolCallLatencySummary.observe({ tool, action }, durationSeconds);
}

/**
 * Update batch efficiency ratio
 */
export function updateBatchEfficiency(operationType: string, ratio: number): void {
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

/**
 * Record range merging optimization
 */
export function recordRangeMerging(
  operation: string,
  apiCallsSaved: number,
  reductionPercentage: number
): void {
  rangeMergingApiCallsSavedTotal.inc({ operation }, apiCallsSaved);
  rangeMergingReductionHistogram.observe({ operation }, reductionPercentage);
}

// Rate limit and retry metrics (P3-1)
export const rateLimitHitsTotal = new Counter({
  name: 'servalsheets_rate_limit_hits_total',
  help: 'Number of 429 rate limit responses',
  labelNames: ['api', 'endpoint'],
  registers: [register],
});

export const retryAttemptsTotal = new Counter({
  name: 'servalsheets_retry_attempts_total',
  help: 'Number of retry attempts',
  labelNames: ['api', 'reason', 'success'],
  registers: [register],
});

export const retryDelayHistogram = new Histogram({
  name: 'servalsheets_retry_delay_seconds',
  help: 'Retry delay duration in seconds',
  labelNames: ['api'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Webhook renewal metrics (P3-1)
export const webhookRenewalsTotal = new Counter({
  name: 'servalsheets_webhook_renewals_total',
  help: 'Number of webhook channel renewals',
  labelNames: ['type', 'reason'],
  registers: [register],
});

// Circuit breaker transition metrics (P3-1)
export const circuitBreakerTransitionsTotal = new Counter({
  name: 'servalsheets_circuit_breaker_transitions_total',
  help: 'Circuit breaker state transitions',
  labelNames: ['breaker', 'from_state', 'to_state'],
  registers: [register],
});

// Webhook delivery metrics (Phase 4.1)
export const webhookDeliveriesTotal = new Counter({
  name: 'servalsheets_webhook_deliveries_total',
  help: 'Total webhook delivery attempts',
  labelNames: ['webhook_id', 'spreadsheet_id', 'event_type', 'status'],
  registers: [register],
});

export const webhookDeliveryDuration = new Histogram({
  name: 'servalsheets_webhook_delivery_duration_seconds',
  help: 'Webhook delivery duration in seconds',
  labelNames: ['webhook_id', 'event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const webhookQueueDepth = new Gauge({
  name: 'servalsheets_webhook_queue_depth',
  help: 'Current webhook queue depth by type',
  labelNames: ['queue_type'],
  registers: [register],
});

export const webhookActiveCount = new Gauge({
  name: 'servalsheets_webhook_active_count',
  help: 'Total number of active webhooks',
  registers: [register],
});

/**
 * Record webhook delivery attempt
 */
export function recordWebhookDelivery(
  webhookId: string,
  spreadsheetId: string,
  eventType: string,
  status: 'success' | 'failure',
  durationSeconds: number
): void {
  webhookDeliveriesTotal.inc({
    webhook_id: webhookId,
    spreadsheet_id: spreadsheetId,
    event_type: eventType,
    status,
  });
  webhookDeliveryDuration.observe(
    { webhook_id: webhookId, event_type: eventType },
    durationSeconds
  );
}

/**
 * Update webhook queue depth metrics
 */
export function updateWebhookQueueDepth(
  queueType: 'pending' | 'retry' | 'dlq',
  depth: number
): void {
  webhookQueueDepth.set({ queue_type: queueType }, depth);
}

/**
 * Update active webhook count
 */
export function updateActiveWebhookCount(count: number): void {
  webhookActiveCount.set(count);
}

/**
 * Record rate limit hit (429 response)
 */
export function recordRateLimitHit(api: string, endpoint: string): void {
  rateLimitHitsTotal.inc({ api, endpoint });
}

/**
 * Record retry attempt
 */
export function recordRetryAttempt(
  api: string,
  reason: string,
  success: boolean,
  delaySeconds: number
): void {
  retryAttemptsTotal.inc({
    api,
    reason,
    success: success ? 'true' : 'false',
  });
  retryDelayHistogram.observe({ api }, delaySeconds);
}

/**
 * Record webhook renewal
 */
export function recordWebhookRenewal(type: 'file' | 'changes', reason: string): void {
  webhookRenewalsTotal.inc({ type, reason });
}

/**
 * Record circuit breaker state transition
 */
export function recordCircuitBreakerTransition(
  breaker: string,
  fromState: 'closed' | 'open' | 'half_open',
  toState: 'closed' | 'open' | 'half_open'
): void {
  circuitBreakerTransitionsTotal.inc({
    breaker,
    from_state: fromState,
    to_state: toState,
  });
}

/**
 * Record HTTP/2 connection reset
 */
export function recordHttp2ConnectionReset(reason: string): void {
  http2ConnectionResetsTotal.inc({ reason });
}

/**
 * Record HTTP/2 error
 */
export function recordHttp2Error(errorCode: string, errorType: string): void {
  http2ErrorsTotal.inc({ error_code: errorCode, error_type: errorType });
}

/**
 * Update connection health metrics
 */
export function updateConnectionHealth(
  consecutiveErrors: number,
  lastSuccessTimestamp: number
): void {
  // Health score: 100 when no errors, decreases by 20 per consecutive error
  const healthScore = Math.max(0, 100 - consecutiveErrors * 20);

  consecutiveErrorsGauge.set(consecutiveErrors);
  connectionHealthScore.set(healthScore);
  lastSuccessfulCallTimestamp.set(lastSuccessTimestamp / 1000); // Convert ms to seconds
}

/**
 * Update MCP connection health metrics (Phase 0, Priority 1)
 */
export function updateMcpConnectionHealth(
  status: 'unknown' | 'healthy' | 'warning' | 'disconnected',
  totalHeartbeats: number,
  timeSinceLastActivityMs: number,
  disconnectWarnings: number,
  uptimeSeconds: number
): void {
  // Map status to numeric value for Prometheus gauge
  const statusValue = {
    unknown: 0,
    healthy: 1,
    warning: 2,
    disconnected: 3,
  }[status];

  mcpConnectionStatus.set(statusValue);
  mcpConnectionHeartbeatsTotal.inc(totalHeartbeats);
  mcpConnectionActivityDelaySeconds.set(timeSinceLastActivityMs / 1000);
  mcpConnectionDisconnectWarnings.inc(disconnectWarnings);
  mcpConnectionUptimeSeconds.set(uptimeSeconds);
}
