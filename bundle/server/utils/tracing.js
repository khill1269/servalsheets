/**
 * OpenTelemetry-Compatible Tracing
 *
 * Lightweight distributed tracing for observability.
 *
 * Features:
 * - Span creation for tool execution, API calls, operations
 * - Context propagation across async boundaries
 * - Automatic error recording
 * - Optional console logging for debugging
 * - Memory-efficient (max spans kept in memory)
 *
 * Environment Variables:
 * - OTEL_ENABLED: 'true' to enable tracing (default: 'false')
 * - OTEL_LOG_SPANS: 'true' to log spans to console (default: 'false')
 */
import { logger } from './logger.js';
// ==================== Utility Functions ====================
/**
 * Generate a random hex ID
 */
function generateId(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
/**
 * Generate a trace ID (32 hex chars)
 */
function generateTraceId() {
    return generateId(32);
}
/**
 * Generate a span ID (16 hex chars)
 */
function generateSpanId() {
    return generateId(16);
}
/**
 * Get high-resolution timestamp in microseconds
 */
function getTimestamp() {
    return Date.now() * 1000;
}
// ==================== Span Implementation ====================
class SpanImpl {
    name;
    kind;
    startTime;
    endTime;
    attributes;
    status = 'unset';
    statusMessage;
    parentSpanId;
    context;
    events = [];
    tracer;
    ended = false;
    constructor(tracer, name, kind, parentContext, attributes) {
        this.tracer = tracer;
        this.name = name;
        this.kind = kind;
        this.startTime = getTimestamp();
        this.attributes = attributes || {};
        this.parentSpanId = parentContext?.spanId;
        this.context = {
            traceId: parentContext?.traceId || generateTraceId(),
            spanId: generateSpanId(),
            traceFlags: 1, // sampled
        };
    }
    setAttribute(key, value) {
        if (!this.ended) {
            this.attributes[key] = value;
        }
        return this;
    }
    setAttributes(attributes) {
        if (!this.ended) {
            Object.assign(this.attributes, attributes);
        }
        return this;
    }
    addEvent(name, attributes) {
        if (!this.ended) {
            this.events.push({
                name,
                timestamp: getTimestamp(),
                attributes,
            });
        }
        return this;
    }
    setStatus(status, message) {
        if (!this.ended) {
            this.status = status;
            this.statusMessage = message;
        }
        return this;
    }
    recordException(error) {
        if (!this.ended) {
            this.addEvent('exception', {
                'exception.type': error.name,
                'exception.message': error.message,
                'exception.stacktrace': error.stack,
            });
            this.setStatus('error', error.message);
        }
        return this;
    }
    end() {
        if (this.ended)
            return;
        this.ended = true;
        this.endTime = getTimestamp();
        this.tracer.onSpanEnd(this);
    }
}
// ==================== Tracer Implementation ====================
/**
 * Maximum number of spans to keep in memory for getSpans()
 * Prevents unbounded memory growth during long-running sessions
 */
const MAX_SPANS_IN_MEMORY = 1000;
class TracerImpl {
    serviceName;
    enabled;
    logSpans;
    spans = [];
    currentSpan;
    constructor(options = {}) {
        this.serviceName = options.serviceName || 'servalsheets';
        this.enabled = options.enabled ?? process.env['OTEL_ENABLED'] === 'true';
        this.logSpans = options.logSpans ?? process.env['OTEL_LOG_SPANS'] === 'true';
        if (this.enabled) {
            logger.info('OpenTelemetry tracing enabled', {
                serviceName: this.serviceName,
                logSpans: this.logSpans,
            });
        }
    }
    /**
     * Check if tracing is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get the service name
     */
    getServiceName() {
        return this.serviceName;
    }
    /**
     * Start a new span
     */
    startSpan(name, options = {}) {
        const span = new SpanImpl(this, name, options.kind || 'internal', options.parent || this.currentSpan?.context, options.attributes);
        if (this.enabled) {
            this.currentSpan = span;
        }
        return span;
    }
    /**
     * Get the current active span
     */
    getCurrentSpan() {
        return this.currentSpan;
    }
    /**
     * Execute a function within a span
     */
    async withSpan(name, fn, options = {}) {
        if (!this.enabled) {
            // Create a no-op span when disabled
            const noopSpan = new SpanImpl(this, name, 'internal');
            return fn(noopSpan);
        }
        const span = this.startSpan(name, options);
        try {
            const result = await fn(span);
            span.setStatus('ok');
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                span.recordException(error);
            }
            else {
                span.setStatus('error', String(error));
            }
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Execute a synchronous function within a span
     */
    withSpanSync(name, fn, options = {}) {
        if (!this.enabled) {
            const noopSpan = new SpanImpl(this, name, 'internal');
            return fn(noopSpan);
        }
        const span = this.startSpan(name, options);
        try {
            const result = fn(span);
            span.setStatus('ok');
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                span.recordException(error);
            }
            else {
                span.setStatus('error', String(error));
            }
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Called when a span ends
     */
    onSpanEnd(span) {
        if (!this.enabled)
            return;
        // Add to spans array with limit to prevent unbounded memory growth
        this.spans.push(span);
        if (this.spans.length > MAX_SPANS_IN_MEMORY) {
            // Remove oldest spans (FIFO)
            this.spans.splice(0, this.spans.length - MAX_SPANS_IN_MEMORY);
        }
        // Export to OTLP if enabled
        this.exportToOtlp(span);
        // Log span if configured
        if (this.logSpans) {
            const duration = span.endTime ? (span.endTime - span.startTime) / 1000 : 0;
            logger.debug(`SPAN: ${span.name}`, {
                traceId: span.context.traceId,
                spanId: span.context.spanId,
                parentSpanId: span.parentSpanId,
                duration: `${duration.toFixed(2)}ms`,
                status: span.status,
                attributes: span.attributes,
            });
        }
    }
    /**
     * Export span to OTLP collector if enabled
     */
    exportToOtlp(span) {
        // Lazy import to avoid circular dependencies
        void (async () => {
            try {
                const { getOtlpExporter } = await import('../observability/otel-export.js');
                const exporter = getOtlpExporter();
                // Convert to ServalSpan format
                exporter.addSpan({
                    traceId: span.context.traceId,
                    spanId: span.context.spanId,
                    parentId: span.parentSpanId,
                    name: span.name,
                    kind: span.kind,
                    startTime: span.startTime,
                    endTime: span.endTime ?? span.startTime,
                    attributes: span.attributes,
                    status: span.status,
                    statusMessage: span.statusMessage,
                    events: span.events.map((e) => ({
                        name: e.name,
                        time: e.timestamp,
                        attributes: e.attributes,
                    })),
                });
            }
            catch {
                // Silently ignore OTLP export errors - tracing should never break the app
            }
        })();
    }
    /**
     * Get all recorded spans (for testing/debugging)
     */
    getSpans() {
        return [...this.spans];
    }
    /**
     * Get span statistics
     */
    getStats() {
        const stats = {
            totalSpans: this.spans.length,
            spansByKind: {
                internal: 0,
                server: 0,
                client: 0,
                producer: 0,
                consumer: 0,
            },
            spansByStatus: {
                ok: 0,
                error: 0,
                unset: 0,
            },
            averageDuration: 0,
        };
        let totalDuration = 0;
        for (const span of this.spans) {
            stats.spansByKind[span.kind]++;
            stats.spansByStatus[span.status]++;
            if (span.endTime) {
                totalDuration += (span.endTime - span.startTime) / 1000;
            }
        }
        if (this.spans.length > 0) {
            stats.averageDuration = totalDuration / this.spans.length;
        }
        return stats;
    }
    /**
     * Clear recorded spans (for testing)
     */
    clearSpans() {
        this.spans = [];
    }
    /**
     * Shutdown the tracer
     */
    async shutdown() {
        // Currently no async cleanup needed
        // Could add export buffer flushing here in the future
    }
}
// ==================== Global Tracer Instance ====================
let globalTracer;
/**
 * Get the global tracer instance
 */
export function getTracer() {
    if (!globalTracer) {
        globalTracer = new TracerImpl();
    }
    return globalTracer;
}
/**
 * Initialize the tracer with options
 */
export function initTracer(options) {
    globalTracer = new TracerImpl(options);
    return globalTracer;
}
/**
 * Shutdown the tracer
 */
export async function shutdownTracer() {
    if (globalTracer) {
        await globalTracer.shutdown();
    }
}
// ==================== Convenience Functions ====================
/**
 * Start a span for tool execution
 */
export function startToolSpan(toolName, attributes) {
    return getTracer().startSpan(`tool.${toolName}`, {
        kind: 'server',
        attributes: {
            'tool.name': toolName,
            ...attributes,
        },
    });
}
/**
 * Start a span for API calls
 */
export function startApiSpan(method, endpoint, attributes) {
    return getTracer().startSpan(`api.${method}`, {
        kind: 'client',
        attributes: {
            'http.method': method,
            'http.url': endpoint,
            ...attributes,
        },
    });
}
/**
 * Start a span for operations
 */
export function startOperationSpan(operation, attributes) {
    return getTracer().startSpan(operation, {
        kind: 'internal',
        attributes,
    });
}
/**
 * Execute a function within a tool span
 */
export async function withToolSpan(toolName, fn, attributes) {
    return getTracer().withSpan(`tool.${toolName}`, fn, {
        kind: 'server',
        attributes: {
            'tool.name': toolName,
            ...attributes,
        },
    });
}
/**
 * Execute a function within an API span
 */
export async function withApiSpan(method, endpoint, fn, attributes) {
    return getTracer().withSpan(`api.${method}`, fn, {
        kind: 'client',
        attributes: {
            'http.method': method,
            'http.url': endpoint,
            ...attributes,
        },
    });
}
/**
 * Execute a function within an operation span
 */
export async function withOperationSpan(operation, fn, attributes) {
    return getTracer().withSpan(operation, fn, {
        kind: 'internal',
        attributes,
    });
}
//# sourceMappingURL=tracing.js.map