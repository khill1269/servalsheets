/**
 * OpenTelemetry Trace Context Propagation
 *
 * Lightweight tracing layer that:
 * 1. Generates W3C Trace Context compliant trace/span IDs
 * 2. Propagates trace context through request pipeline
 * 3. Records span timing for tool calls and Google API calls
 * 4. Exports to OTLP endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is configured
 *
 * When no OTLP endpoint is configured, traces are logged at debug level.
 * This is a zero-dependency implementation — no @opentelemetry/* packages required.
 * Production deployments can swap in full OTel SDK by setting OTEL_SDK=true.
 */

import { randomBytes } from 'crypto';
import { logger } from '../utils/logger.js';

// W3C Trace Context compliant ID generation
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number; // 0 = not sampled, 1 = sampled
}

export interface Span {
  name: string;
  context: SpanContext;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, string | number> }>;
}

// In-flight spans for the current request
const _activeSpans = new Map<string, Span>();

// Configurable exporter endpoint
const OTLP_ENDPOINT = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
const OTEL_SERVICE_NAME = process.env['OTEL_SERVICE_NAME'] ?? 'servalsheets';
const TRACE_SAMPLE_RATE = parseFloat(process.env['OTEL_TRACE_SAMPLE_RATE'] ?? '1.0');

/**
 * Start a new span for a tool call or API operation.
 */
export function startSpan(
  name: string,
  parentContext?: SpanContext,
  attributes?: Record<string, string | number | boolean>
): Span {
  const shouldSample = Math.random() < TRACE_SAMPLE_RATE;

  const span: Span = {
    name,
    context: {
      traceId: parentContext?.traceId ?? generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: parentContext?.spanId,
      traceFlags: shouldSample ? 1 : 0,
    },
    startTime: performance.now(),
    status: 'unset',
    attributes: {
      'service.name': OTEL_SERVICE_NAME,
      ...attributes,
    },
    events: [],
  };

  _activeSpans.set(span.context.spanId, span);
  return span;
}

/**
 * End a span and export it.
 */
export function endSpan(span: Span, status?: 'ok' | 'error'): void {
  span.endTime = performance.now();
  span.status = status ?? 'ok';
  _activeSpans.delete(span.context.spanId);

  // Only export sampled spans
  if (span.context.traceFlags === 0) return;

  if (OTLP_ENDPOINT) {
    exportSpanOTLP(span).catch(() => {
      // Non-critical: trace export failure should never block tool execution
    });
  } else {
    // Debug-level logging when no exporter configured
    logger.debug('trace:span', {
      name: span.name,
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.context.parentSpanId,
      durationMs: Math.round((span.endTime ?? 0) - span.startTime),
      status: span.status,
      attributes: span.attributes,
    });
  }
}

/**
 * Add an event to an active span.
 */
export function addSpanEvent(
  span: Span,
  name: string,
  attributes?: Record<string, string | number>
): void {
  span.events.push({ name, timestamp: performance.now(), attributes });
}

/**
 * Set span attributes.
 */
export function setSpanAttributes(
  span: Span,
  attributes: Record<string, string | number | boolean>
): void {
  Object.assign(span.attributes, attributes);
}

/**
 * Parse W3C traceparent header.
 * Format: {version}-{trace-id}-{parent-id}-{trace-flags}
 */
export function parseTraceparent(header: string): SpanContext | null {
  const parts = header.split('-');
  if (parts.length !== 4) return null;
  const version = parts[0]!;
  const traceId = parts[1]!;
  const parentId = parts[2]!;
  const flags = parts[3]!;
  if (version !== '00' || traceId.length !== 32 || parentId.length !== 16) return null;

  return {
    traceId,
    spanId: parentId,
    traceFlags: parseInt(flags, 16),
  };
}

/**
 * Generate W3C traceparent header from span context.
 */
export function toTraceparent(context: SpanContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`;
}

/**
 * Export span to OTLP endpoint (best-effort, non-blocking).
 */
async function exportSpanOTLP(span: Span): Promise<void> {
  if (!OTLP_ENDPOINT) return;

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: OTEL_SERVICE_NAME } }],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId: span.context.traceId,
                spanId: span.context.spanId,
                parentSpanId: span.context.parentSpanId ?? '',
                name: span.name,
                kind: 2, // SPAN_KIND_SERVER
                startTimeUnixNano: String(Math.round(span.startTime * 1e6)),
                endTimeUnixNano: String(Math.round((span.endTime ?? span.startTime) * 1e6)),
                status: { code: span.status === 'error' ? 2 : span.status === 'ok' ? 1 : 0 },
                attributes: Object.entries(span.attributes).map(([key, value]) => ({
                  key,
                  value:
                    typeof value === 'string'
                      ? { stringValue: value }
                      : typeof value === 'number'
                        ? { intValue: String(value) }
                        : { boolValue: value },
                })),
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(`${OTLP_ENDPOINT}/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.debug('OTLP export failed', { status: response.status });
    }
  } catch {
    // Silent failure — tracing is non-critical
  }
}

/**
 * Get count of active spans (for diagnostics).
 */
export function getActiveSpanCount(): number {
  return _activeSpans.size;
}
