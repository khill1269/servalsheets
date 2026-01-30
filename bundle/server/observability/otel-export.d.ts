/**
 * ServalSheets - OpenTelemetry Export Integration
 *
 * Production-grade OTLP exporter that transforms the existing custom tracing
 * into OpenTelemetry format for export to Jaeger, Zipkin, or any OTLP collector.
 *
 * This does NOT replace the existing tracing - it adds export capability.
 *
 * Environment Variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (default: http://localhost:4318)
 * - OTEL_SERVICE_NAME: Service name (default: servalsheets)
 * - OTEL_SERVICE_VERSION: Service version (auto-detected from package.json)
 * - OTEL_EXPORT_ENABLED: Enable/disable export (default: false)
 * - OTEL_EXPORT_BATCH_SIZE: Spans per batch (default: 100)
 * - OTEL_EXPORT_INTERVAL_MS: Export interval (default: 5000)
 *
 * @see https://opentelemetry.io/docs/specs/otlp/
 */
/**
 * OpenTelemetry span status codes
 */
export declare enum OtelStatusCode {
    UNSET = 0,
    OK = 1,
    ERROR = 2
}
/**
 * OpenTelemetry span kind
 */
export declare enum OtelSpanKind {
    INTERNAL = 0,
    SERVER = 1,
    CLIENT = 2,
    PRODUCER = 3,
    CONSUMER = 4
}
/**
 * OTLP attribute value types
 */
export type OtelAttributeValue = string | number | boolean | string[] | number[] | boolean[];
/**
 * OTLP span structure
 */
export interface OtelSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    kind: OtelSpanKind;
    startTimeUnixNano: string;
    endTimeUnixNano: string;
    attributes: Array<{
        key: string;
        value: {
            stringValue?: string;
            intValue?: string;
            boolValue?: boolean;
            arrayValue?: {
                values: Array<{
                    stringValue?: string;
                }>;
            };
        };
    }>;
    status: {
        code: OtelStatusCode;
        message?: string;
    };
    events?: Array<{
        name: string;
        timeUnixNano: string;
        attributes?: OtelSpan['attributes'];
    }>;
}
/**
 * OTLP export request structure
 */
export interface OtlpExportRequest {
    resourceSpans: Array<{
        resource: {
            attributes: OtelSpan['attributes'];
        };
        scopeSpans: Array<{
            scope: {
                name: string;
                version: string;
            };
            spans: OtelSpan[];
        }>;
    }>;
}
/**
 * Configuration for OTLP exporter
 */
export interface OtlpExporterConfig {
    endpoint: string;
    serviceName: string;
    serviceVersion: string;
    enabled: boolean;
    batchSize: number;
    exportIntervalMs: number;
    headers?: Record<string, string>;
}
/**
 * Span data from ServalSheets tracing
 */
export interface ServalSpan {
    traceId: string;
    spanId: string;
    parentId?: string;
    name: string;
    kind: 'server' | 'client' | 'internal';
    startTime: number;
    endTime: number;
    attributes: Record<string, OtelAttributeValue>;
    status: 'ok' | 'error' | 'unset';
    statusMessage?: string;
    events?: Array<{
        name: string;
        time: number;
        attributes?: Record<string, OtelAttributeValue>;
    }>;
}
/**
 * OTLP Exporter for ServalSheets traces
 *
 * Batches spans and exports to OTLP-compatible backends
 */
export declare class OtlpExporter {
    private config;
    private spanBuffer;
    private exportTimer?;
    private isShuttingDown;
    private pendingExports;
    private stats;
    constructor(config?: Partial<OtlpExporterConfig>);
    /**
     * Add span to export buffer
     */
    addSpan(span: ServalSpan): void;
    /**
     * Start periodic export timer
     */
    private startExportTimer;
    /**
     * Export buffered spans to OTLP endpoint
     */
    export(): Promise<void>;
    /**
     * Build OTLP export request from ServalSheets spans
     */
    private buildOtlpRequest;
    /**
     * Convert ServalSheets span to OTLP format
     */
    private convertSpan;
    /**
     * Convert span kind
     */
    private convertKind;
    /**
     * Convert status
     */
    private convertStatus;
    /**
     * Convert attributes to OTLP format
     */
    private convertAttributes;
    /**
     * Convert milliseconds to nanoseconds string
     */
    private msToNano;
    /**
     * Pad hex string to required length
     */
    private padHex;
    /**
     * Get exporter statistics
     */
    getStats(): {
        enabled: boolean;
        spansExported: number;
        exportErrors: number;
        lastExportTime: number;
        bufferSize: number;
        pendingExports: number;
    };
    /**
     * Flush remaining spans and shutdown
     */
    shutdown(): Promise<void>;
}
/**
 * Get or create the OTLP exporter singleton
 */
export declare function getOtlpExporter(config?: Partial<OtlpExporterConfig>): OtlpExporter;
/**
 * Hook into ServalSheets tracing to export spans
 *
 * Call this during server initialization to enable OTLP export
 */
export declare function enableOtlpExport(config?: Partial<OtlpExporterConfig>): {
    exporter: OtlpExporter;
    addSpan: (span: ServalSpan) => void;
};
/**
 * Shutdown OTLP exporter and flush remaining spans
 */
export declare function shutdownOtlpExporter(): Promise<void>;
//# sourceMappingURL=otel-export.d.ts.map