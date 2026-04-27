/**
 * OpenTelemetry SDK Initialization
 *
 * Sets up the OpenTelemetry Node.js SDK with:
 * - Trace collection (OTLP/Console exporters)
 * - Metrics collection (Prometheus exporter)
 *
 * Only initializes when ENABLE_OTEL=true (production observability).
 * No-op when disabled to avoid overhead for existing users.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { trace, metrics, type Tracer, type Meter } from '@opentelemetry/api';
import { logger } from '../utils/logger.js';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK.
 * Only runs if OTEL_ENABLED=true (set in env.ts Zod schema); otherwise no-op.
 */
export async function initTelemetry(): Promise<void> {
  // Use the canonical env var name from src/config/env.ts:91 (OTEL_ENABLED).
  // Previously read ENABLE_OTEL which did not match the Zod schema, causing
  // OTel to silently never start even when OTEL_ENABLED=true was set.
  if (process.env['OTEL_ENABLED'] !== 'true') {
    logger.debug('OpenTelemetry disabled (OTEL_ENABLED not set)');
    return;
  }

  try {
    const serviceName = process.env['OTEL_SERVICE_NAME'] || 'servalsheets';
    const metricsPort = parseInt(process.env['OTEL_METRICS_PORT'] || '9464', 10);
    const tracesExporter = process.env['OTEL_TRACES_EXPORTER'] || 'none';
    const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

    // Span processors for traces
    const spanProcessors: BatchSpanProcessor[] = [];

    if (tracesExporter === 'console') {
      spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
      logger.info('OTEL: Console span exporter enabled');
    }

    if (otlpEndpoint) {
      spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpEndpoint })));
      logger.info(`OTEL: OTLP exporter enabled (${otlpEndpoint})`);
    }

    // Prometheus metrics exporter
    const prometheusExporter = new PrometheusExporter({ port: metricsPort, endpoint: '/metrics' });
    logger.info(`OTEL: Prometheus metrics on http://localhost:${metricsPort}/metrics`);

    // Initialize SDK with explicit options
    sdk = new NodeSDK({
      serviceName,
      spanProcessors,
      metricReader: prometheusExporter,
    });

    await sdk.start();
    logger.info(`OpenTelemetry SDK initialized (service: ${serviceName})`);
  } catch (err) {
    logger.error('Failed to initialize OpenTelemetry SDK', err);
  }
}

/** Get tracer instance (no-op tracer when OTEL disabled) */
export function getTracer(): Tracer {
  return trace.getTracer('servalsheets');
}

/** Get meter instance (no-op meter when OTEL disabled) */
export function getMeter(): Meter {
  return metrics.getMeter('servalsheets');
}
