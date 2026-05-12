/**
 * Webhook Delivery Metrics
 *
 * Tracks webhook push notification delivery rates, latency, and retry patterns.
 * Exposes data through the Prometheus /metrics endpoint.
 *
 * @category Metrics
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';

// Lazy import to avoid issues at module load time
function getOrCreate<T>(name: string, factory: () => T): T {
  const existing = register.getSingleMetric(name);
  if (existing) return existing as T;
  return factory();
}

const webhookDeliveriesTotal = getOrCreate(
  'servalsheets_webhook_deliveries_total',
  () =>
    new Counter({
      name: 'servalsheets_webhook_deliveries_total',
      help: 'Total webhook push notification delivery attempts',
      labelNames: ['subscription_id', 'event_type', 'status'] as const,
      registers: [register],
    })
);

const webhookDeliveryDurationSeconds = getOrCreate(
  'servalsheets_webhook_delivery_duration_seconds',
  () =>
    new Histogram({
      name: 'servalsheets_webhook_delivery_duration_seconds',
      help: 'Webhook push delivery latency from event emission to HTTP response',
      labelNames: ['event_type'] as const,
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [register],
    })
);

const webhookRetriesTotal = getOrCreate(
  'servalsheets_webhook_retries_total',
  () =>
    new Counter({
      name: 'servalsheets_webhook_retries_total',
      help: 'Total webhook delivery retry attempts (after initial failure)',
      labelNames: ['event_type', 'retry_number'] as const,
      registers: [register],
    })
);

const webhookQueueDepth = getOrCreate(
  'servalsheets_webhook_queue_depth',
  () =>
    new Gauge({
      name: 'servalsheets_webhook_queue_depth',
      help: 'Current number of pending webhook deliveries in the queue',
      registers: [register],
    })
);

const webhookSubscriptionsActive = getOrCreate(
  'servalsheets_webhook_subscriptions_active',
  () =>
    new Gauge({
      name: 'servalsheets_webhook_subscriptions_active',
      help: 'Number of currently active webhook subscriptions',
      registers: [register],
    })
);

// ============================================================================
// Recording functions
// ============================================================================

export function recordWebhookDelivery(
  subscriptionId: string,
  eventType: string,
  status: 'success' | 'failed' | 'timeout',
  durationMs: number
): void {
  webhookDeliveriesTotal.inc({ subscription_id: subscriptionId, event_type: eventType, status });
  webhookDeliveryDurationSeconds.observe({ event_type: eventType }, durationMs / 1000);
}

export function recordWebhookRetry(eventType: string, retryNumber: number): void {
  webhookRetriesTotal.inc({ event_type: eventType, retry_number: String(retryNumber) });
}

export function setWebhookQueueDepth(depth: number): void {
  webhookQueueDepth.set(depth);
}

export function setWebhookSubscriptionsActive(count: number): void {
  webhookSubscriptionsActive.set(count);
}
