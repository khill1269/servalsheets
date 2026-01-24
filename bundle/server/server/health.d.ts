/**
 * ServalSheets - Health Check Service
 *
 * Production-ready health checks for deployment orchestration.
 * Supports Kubernetes liveness/readiness probes and Docker healthchecks.
 *
 * MCP Protocol: 2025-11-25
 */
import type { GoogleApiClient } from '../services/google-api.js';
export interface HealthCheck {
    name: string;
    status: 'ok' | 'degraded' | 'error';
    message?: string;
    latency?: number;
    metadata?: Record<string, unknown>;
}
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    checks: HealthCheck[];
}
/**
 * Health Check Service
 *
 * Provides health endpoints for monitoring and orchestration:
 * - Liveness: Is the process running?
 * - Readiness: Is the server ready to handle requests?
 */
export declare class HealthService {
    private startTime;
    private googleClient;
    constructor(googleClient: GoogleApiClient | null);
    /**
     * Liveness probe - Is the server running?
     *
     * This check always succeeds if the process is running.
     * Used by Kubernetes to restart crashed containers.
     *
     * @returns Always returns healthy status
     */
    checkLiveness(): Promise<HealthResponse>;
    /**
     * Readiness probe - Is the server ready to handle requests?
     *
     * Checks all critical dependencies and services.
     * Returns:
     * - healthy: All checks passed, ready for traffic
     * - degraded: Some non-critical issues, but can serve requests
     * - unhealthy: Critical failures, not ready for traffic
     *
     * Used by Kubernetes/load balancers to route traffic.
     */
    checkReadiness(): Promise<HealthResponse>;
    /**
     * Check authentication status
     */
    private checkAuth;
    /**
     * Check Google API connectivity
     */
    private checkGoogleApi;
    /**
     * Check cache health
     */
    private checkCache;
    /**
     * Check request deduplication
     */
    private checkRequestDeduplication;
    /**
     * Get service uptime in milliseconds
     */
    getUptime(): number;
    /**
     * Get service uptime as human-readable string
     */
    getUptimeFormatted(): string;
}
//# sourceMappingURL=health.d.ts.map