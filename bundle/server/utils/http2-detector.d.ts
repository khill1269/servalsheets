/**
 * HTTP/2 Detection Utility
 *
 * Detects and logs HTTP/2 protocol usage for Google API requests.
 * The googleapis library (gaxios) automatically negotiates HTTP/2 via ALPN
 * (Application-Layer Protocol Negotiation) when enabled.
 *
 * Benefits of HTTP/2:
 * - 5-15% latency reduction for API calls
 * - Multiplexing: Multiple requests over single connection
 * - Header compression: Reduced overhead
 * - Server push capability
 *
 * MCP Protocol: 2025-11-25
 */
/**
 * Check if HTTP/2 is supported by the current Node.js runtime
 * HTTP/2 support was added in Node.js 8.4.0 and stabilized in 14.x
 *
 * @returns true if Node.js version supports HTTP/2
 */
export declare function isHTTP2Supported(): boolean;
/**
 * Get Node.js version information for HTTP/2 diagnostics
 *
 * @returns Object with version details and HTTP/2 support status
 */
export declare function getNodeVersionInfo(): {
    version: string;
    major: number;
    minor: number;
    patch: number;
    http2Supported: boolean;
};
/**
 * Log HTTP/2 support status at startup
 * Should be called during service initialization
 */
export declare function logHTTP2Capabilities(): void;
/**
 * Detect HTTP version from response metadata
 * Note: gaxios may not always expose the HTTP version in response metadata
 *
 * @param response - API response object (may contain protocol info)
 * @returns Detected HTTP version string
 */
export declare function detectHTTPVersion(response: unknown): string;
/**
 * Log HTTP version for a request/response (development/debugging)
 * Only logs in development or when explicitly enabled
 *
 * @param response - API response object
 * @param operation - Operation name for logging context
 */
export declare function logHTTPVersion(response: unknown, operation?: string): void;
/**
 * Get HTTP/2 performance statistics
 * Returns expected performance improvements when HTTP/2 is enabled
 *
 * @returns Object with performance metrics
 */
export declare function getHTTP2PerformanceMetrics(): {
    enabled: boolean;
    expectedLatencyReduction: string;
    features: string[];
    nodeVersion: string;
};
/**
 * Validate HTTP/2 configuration
 * Checks if HTTP/2 is properly enabled for googleapis
 *
 * @param http2Enabled - Whether HTTP/2 is enabled in config
 * @returns Validation result with warnings if any
 */
export declare function validateHTTP2Config(http2Enabled: boolean): {
    valid: boolean;
    warnings: string[];
};
//# sourceMappingURL=http2-detector.d.ts.map