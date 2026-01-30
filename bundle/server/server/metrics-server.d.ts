/**
 * ServalSheets - Metrics Server
 *
 * HTTP server for exposing performance metrics
 * Prometheus-compatible /metrics endpoint
 */
import { type Server } from 'node:http';
import { MetricsExporter } from '../services/metrics-exporter.js';
export interface MetricsServerOptions {
    port: number;
    host?: string;
    exporter: MetricsExporter;
}
/**
 * Start HTTP server for metrics endpoint
 * Serves metrics in Prometheus, JSON, and text formats
 */
export declare function startMetricsServer(options: MetricsServerOptions): Promise<Server>;
/**
 * Stop metrics server gracefully
 */
export declare function stopMetricsServer(server: Server): Promise<void>;
//# sourceMappingURL=metrics-server.d.ts.map