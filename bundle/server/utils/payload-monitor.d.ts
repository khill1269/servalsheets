/**
 * ServalSheets - Payload Size Monitoring
 *
 * Monitors request/response payload sizes for Google Sheets API calls
 */
export interface PayloadMetrics {
    requestSize: number;
    responseSize: number;
    requestSizeMB: number;
    responseSizeMB: number;
    timestamp: string;
    operation: string;
}
/**
 * Calculate the approximate size of a JSON object in bytes
 */
export declare function calculatePayloadSize(payload: unknown): number;
/**
 * Monitor a Google API request/response payload
 */
export declare function monitorPayload(operation: string, request: unknown, response: unknown): PayloadMetrics;
/**
 * Check if payload size is within limits
 */
export declare function isWithinLimits(payloadSize: number): boolean;
/**
 * Format bytes to human-readable string
 */
export declare function formatBytes(bytes: number): string;
//# sourceMappingURL=payload-monitor.d.ts.map