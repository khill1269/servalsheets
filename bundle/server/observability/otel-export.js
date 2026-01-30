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
import { logger } from '../utils/logger.js';
import { VERSION } from '../version.js';
/**
 * OpenTelemetry span status codes
 */
export var OtelStatusCode;
(function (OtelStatusCode) {
    OtelStatusCode[OtelStatusCode["UNSET"] = 0] = "UNSET";
    OtelStatusCode[OtelStatusCode["OK"] = 1] = "OK";
    OtelStatusCode[OtelStatusCode["ERROR"] = 2] = "ERROR";
})(OtelStatusCode || (OtelStatusCode = {}));
/**
 * OpenTelemetry span kind
 */
export var OtelSpanKind;
(function (OtelSpanKind) {
    OtelSpanKind[OtelSpanKind["INTERNAL"] = 0] = "INTERNAL";
    OtelSpanKind[OtelSpanKind["SERVER"] = 1] = "SERVER";
    OtelSpanKind[OtelSpanKind["CLIENT"] = 2] = "CLIENT";
    OtelSpanKind[OtelSpanKind["PRODUCER"] = 3] = "PRODUCER";
    OtelSpanKind[OtelSpanKind["CONSUMER"] = 4] = "CONSUMER";
})(OtelSpanKind || (OtelSpanKind = {}));
/**
 * OTLP Exporter for ServalSheets traces
 *
 * Batches spans and exports to OTLP-compatible backends
 */
export class OtlpExporter {
    config;
    spanBuffer = [];
    exportTimer;
    isShuttingDown = false;
    pendingExports = 0;
    stats = {
        spansExported: 0,
        exportErrors: 0,
        lastExportTime: 0,
    };
    constructor(config) {
        this.config = {
            endpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
            serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'servalsheets',
            serviceVersion: process.env['OTEL_SERVICE_VERSION'] ?? VERSION,
            enabled: process.env['OTEL_EXPORT_ENABLED'] === 'true',
            batchSize: parseInt(process.env['OTEL_EXPORT_BATCH_SIZE'] ?? '100', 10),
            exportIntervalMs: parseInt(process.env['OTEL_EXPORT_INTERVAL_MS'] ?? '5000', 10),
            ...config,
        };
        if (this.config.enabled) {
            this.startExportTimer();
            logger.info('OTLP exporter initialized', {
                endpoint: this.config.endpoint,
                serviceName: this.config.serviceName,
                batchSize: this.config.batchSize,
                exportIntervalMs: this.config.exportIntervalMs,
            });
        }
    }
    /**
     * Add span to export buffer
     */
    addSpan(span) {
        if (!this.config.enabled || this.isShuttingDown) {
            return;
        }
        this.spanBuffer.push(span);
        // Export immediately if buffer is full
        if (this.spanBuffer.length >= this.config.batchSize) {
            void this.export();
        }
    }
    /**
     * Start periodic export timer
     */
    startExportTimer() {
        this.exportTimer = setInterval(() => {
            if (this.spanBuffer.length > 0) {
                void this.export();
            }
        }, this.config.exportIntervalMs);
        // Don't prevent Node from exiting
        this.exportTimer.unref();
    }
    /**
     * Export buffered spans to OTLP endpoint
     */
    async export() {
        if (this.spanBuffer.length === 0) {
            return;
        }
        // Take current buffer and clear it
        const spans = this.spanBuffer.splice(0, this.config.batchSize);
        this.pendingExports++;
        try {
            const request = this.buildOtlpRequest(spans);
            const response = await fetch(`${this.config.endpoint}/v1/traces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.config.headers,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OTLP export failed: ${response.status} - ${errorText}`);
            }
            this.stats.spansExported += spans.length;
            this.stats.lastExportTime = Date.now();
        }
        catch (error) {
            this.stats.exportErrors++;
            logger.error('OTLP export error', {
                error: error instanceof Error ? error.message : String(error),
                spansLost: spans.length,
            });
            // Don't re-add spans - they're lost (prevent memory growth)
        }
        finally {
            this.pendingExports--;
        }
    }
    /**
     * Build OTLP export request from ServalSheets spans
     */
    buildOtlpRequest(spans) {
        return {
            resourceSpans: [
                {
                    resource: {
                        attributes: [
                            {
                                key: 'service.name',
                                value: { stringValue: this.config.serviceName },
                            },
                            {
                                key: 'service.version',
                                value: { stringValue: this.config.serviceVersion },
                            },
                            {
                                key: 'telemetry.sdk.name',
                                value: { stringValue: 'servalsheets-tracing' },
                            },
                            {
                                key: 'telemetry.sdk.language',
                                value: { stringValue: 'nodejs' },
                            },
                        ],
                    },
                    scopeSpans: [
                        {
                            scope: {
                                name: 'servalsheets',
                                version: this.config.serviceVersion,
                            },
                            spans: spans.map((span) => this.convertSpan(span)),
                        },
                    ],
                },
            ],
        };
    }
    /**
     * Convert ServalSheets span to OTLP format
     */
    convertSpan(span) {
        const otelSpan = {
            traceId: this.padHex(span.traceId, 32),
            spanId: this.padHex(span.spanId, 16),
            name: span.name,
            kind: this.convertKind(span.kind),
            startTimeUnixNano: this.msToNano(span.startTime),
            endTimeUnixNano: this.msToNano(span.endTime),
            attributes: this.convertAttributes(span.attributes),
            status: {
                code: this.convertStatus(span.status),
                message: span.statusMessage,
            },
        };
        if (span.parentId) {
            otelSpan.parentSpanId = this.padHex(span.parentId, 16);
        }
        if (span.events && span.events.length > 0) {
            otelSpan.events = span.events.map((event) => ({
                name: event.name,
                timeUnixNano: this.msToNano(event.time),
                attributes: event.attributes ? this.convertAttributes(event.attributes) : undefined,
            }));
        }
        return otelSpan;
    }
    /**
     * Convert span kind
     */
    convertKind(kind) {
        switch (kind) {
            case 'server':
                return OtelSpanKind.SERVER;
            case 'client':
                return OtelSpanKind.CLIENT;
            case 'internal':
                return OtelSpanKind.INTERNAL;
            default:
                return OtelSpanKind.INTERNAL;
        }
    }
    /**
     * Convert status
     */
    convertStatus(status) {
        switch (status) {
            case 'ok':
                return OtelStatusCode.OK;
            case 'error':
                return OtelStatusCode.ERROR;
            case 'unset':
                return OtelStatusCode.UNSET;
            default:
                return OtelStatusCode.UNSET;
        }
    }
    /**
     * Convert attributes to OTLP format
     */
    convertAttributes(attrs) {
        return Object.entries(attrs).map(([key, value]) => {
            if (typeof value === 'string') {
                return { key, value: { stringValue: value } };
            }
            else if (typeof value === 'number') {
                return { key, value: { intValue: value.toString() } };
            }
            else if (typeof value === 'boolean') {
                return { key, value: { boolValue: value } };
            }
            else if (Array.isArray(value)) {
                return {
                    key,
                    value: {
                        arrayValue: {
                            values: value.map((v) => ({ stringValue: String(v) })),
                        },
                    },
                };
            }
            return { key, value: { stringValue: String(value) } };
        });
    }
    /**
     * Convert milliseconds to nanoseconds string
     */
    msToNano(ms) {
        return (BigInt(ms) * BigInt(1000000)).toString();
    }
    /**
     * Pad hex string to required length
     */
    padHex(hex, length) {
        // Remove any non-hex characters and lowercase
        const clean = hex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        // Pad or truncate to required length
        if (clean.length >= length) {
            return clean.substring(0, length);
        }
        return clean.padStart(length, '0');
    }
    /**
     * Get exporter statistics
     */
    getStats() {
        return {
            enabled: this.config.enabled,
            ...this.stats,
            bufferSize: this.spanBuffer.length,
            pendingExports: this.pendingExports,
        };
    }
    /**
     * Flush remaining spans and shutdown
     */
    async shutdown() {
        this.isShuttingDown = true;
        if (this.exportTimer) {
            clearInterval(this.exportTimer);
        }
        // Export remaining spans
        if (this.spanBuffer.length > 0) {
            await this.export();
        }
        // Wait for pending exports
        const maxWait = 5000;
        const start = Date.now();
        while (this.pendingExports > 0 && Date.now() - start < maxWait) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        logger.info('OTLP exporter shutdown', this.stats);
    }
}
// Singleton instance
let exporterInstance = null;
/**
 * Get or create the OTLP exporter singleton
 */
export function getOtlpExporter(config) {
    if (!exporterInstance) {
        exporterInstance = new OtlpExporter(config);
    }
    return exporterInstance;
}
/**
 * Hook into ServalSheets tracing to export spans
 *
 * Call this during server initialization to enable OTLP export
 */
export function enableOtlpExport(config) {
    const exporter = getOtlpExporter(config);
    return {
        exporter,
        addSpan: (span) => exporter.addSpan(span),
    };
}
/**
 * Shutdown OTLP exporter and flush remaining spans
 */
export async function shutdownOtlpExporter() {
    if (exporterInstance) {
        await exporterInstance.shutdown();
        exporterInstance = null;
    }
}
//# sourceMappingURL=otel-export.js.map