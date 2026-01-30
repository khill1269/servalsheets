/**
 * ServalSheets - Logger Context
 *
 * Service-level metadata for structured logging.
 */
/**
 * Service metadata for logging context
 */
export interface ServiceContext {
    /** Service name */
    service: string;
    /** Service version */
    version: string;
    /** Deployment environment */
    environment: string;
    /** Hostname */
    hostname: string;
    /** Node.js version */
    nodeVersion: string;
    /** Process ID */
    pid: number;
    /** Instance ID (for multi-instance deployments) */
    instanceId: string;
    /** Service start time */
    startTime: string;
}
/**
 * Get or create service context
 */
export declare function getServiceContext(): ServiceContext;
/**
 * Get service context as flat object for logging
 */
export declare function getServiceContextFlat(): Record<string, string | number>;
/**
 * Reset service context (for testing)
 */
export declare function resetServiceContext(): void;
//# sourceMappingURL=logger-context.d.ts.map