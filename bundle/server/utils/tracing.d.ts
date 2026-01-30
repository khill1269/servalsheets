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
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type SpanStatus = 'ok' | 'error' | 'unset';
export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}
export interface SpanContext {
    traceId: string;
    spanId: string;
    traceFlags: number;
}
export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: SpanAttributes;
}
export interface Span {
    name: string;
    kind: SpanKind;
    startTime: number;
    endTime?: number;
    attributes: SpanAttributes;
    status: SpanStatus;
    statusMessage?: string;
    parentSpanId?: string;
    context: SpanContext;
    events: SpanEvent[];
}
export interface TracerOptions {
    serviceName?: string;
    enabled?: boolean;
    logSpans?: boolean;
}
declare class SpanImpl implements Span {
    name: string;
    kind: SpanKind;
    startTime: number;
    endTime?: number;
    attributes: SpanAttributes;
    status: SpanStatus;
    statusMessage?: string;
    parentSpanId?: string;
    context: SpanContext;
    events: SpanEvent[];
    private tracer;
    private ended;
    constructor(tracer: TracerImpl, name: string, kind: SpanKind, parentContext?: SpanContext, attributes?: SpanAttributes);
    setAttribute(key: string, value: string | number | boolean | undefined): this;
    setAttributes(attributes: SpanAttributes): this;
    addEvent(name: string, attributes?: SpanAttributes): this;
    setStatus(status: SpanStatus, message?: string): this;
    recordException(error: Error): this;
    end(): void;
}
declare class TracerImpl {
    private serviceName;
    private enabled;
    private logSpans;
    private spans;
    private currentSpan;
    constructor(options?: TracerOptions);
    /**
     * Check if tracing is enabled
     */
    isEnabled(): boolean;
    /**
     * Get the service name
     */
    getServiceName(): string;
    /**
     * Start a new span
     */
    startSpan(name: string, options?: {
        kind?: SpanKind;
        attributes?: SpanAttributes;
        parent?: SpanContext;
    }): SpanImpl;
    /**
     * Get the current active span
     */
    getCurrentSpan(): SpanImpl | undefined;
    /**
     * Execute a function within a span
     */
    withSpan<T>(name: string, fn: (span: SpanImpl) => Promise<T>, options?: {
        kind?: SpanKind;
        attributes?: SpanAttributes;
    }): Promise<T>;
    /**
     * Execute a synchronous function within a span
     */
    withSpanSync<T>(name: string, fn: (span: SpanImpl) => T, options?: {
        kind?: SpanKind;
        attributes?: SpanAttributes;
    }): T;
    /**
     * Called when a span ends
     */
    onSpanEnd(span: Span): void;
    /**
     * Export span to OTLP collector if enabled
     */
    private exportToOtlp;
    /**
     * Get all recorded spans (for testing/debugging)
     */
    getSpans(): Span[];
    /**
     * Get span statistics
     */
    getStats(): {
        totalSpans: number;
        spansByKind: Record<SpanKind, number>;
        spansByStatus: Record<SpanStatus, number>;
        averageDuration: number;
    };
    /**
     * Clear recorded spans (for testing)
     */
    clearSpans(): void;
    /**
     * Shutdown the tracer
     */
    shutdown(): Promise<void>;
}
/**
 * Get the global tracer instance
 */
export declare function getTracer(): TracerImpl;
/**
 * Initialize the tracer with options
 */
export declare function initTracer(options?: TracerOptions): TracerImpl;
/**
 * Shutdown the tracer
 */
export declare function shutdownTracer(): Promise<void>;
/**
 * Start a span for tool execution
 */
export declare function startToolSpan(toolName: string, attributes?: SpanAttributes): SpanImpl;
/**
 * Start a span for API calls
 */
export declare function startApiSpan(method: string, endpoint: string, attributes?: SpanAttributes): SpanImpl;
/**
 * Start a span for operations
 */
export declare function startOperationSpan(operation: string, attributes?: SpanAttributes): SpanImpl;
/**
 * Execute a function within a tool span
 */
export declare function withToolSpan<T>(toolName: string, fn: (span: SpanImpl) => Promise<T>, attributes?: SpanAttributes): Promise<T>;
/**
 * Execute a function within an API span
 */
export declare function withApiSpan<T>(method: string, endpoint: string, fn: (span: SpanImpl) => Promise<T>, attributes?: SpanAttributes): Promise<T>;
/**
 * Execute a function within an operation span
 */
export declare function withOperationSpan<T>(operation: string, fn: (span: SpanImpl) => Promise<T>, attributes?: SpanAttributes): Promise<T>;
export type { SpanImpl as SpanInstance };
//# sourceMappingURL=tracing.d.ts.map