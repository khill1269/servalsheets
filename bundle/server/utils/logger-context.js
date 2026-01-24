/**
 * ServalSheets - Logger Context
 *
 * Service-level metadata for structured logging.
 */
import * as os from 'os';
import { randomUUID } from 'crypto';
import { VERSION } from '../version.js';
let serviceContext = null;
/**
 * Get or create service context
 */
export function getServiceContext() {
    if (!serviceContext) {
        serviceContext = {
            service: 'servalsheets',
            version: VERSION,
            environment: process.env['NODE_ENV'] || 'development',
            hostname: os.hostname(),
            nodeVersion: process.version,
            pid: process.pid,
            instanceId: process.env['INSTANCE_ID'] || randomUUID(),
            startTime: new Date().toISOString(),
        };
    }
    return serviceContext;
}
/**
 * Get service context as flat object for logging
 */
export function getServiceContextFlat() {
    const ctx = getServiceContext();
    return {
        service: ctx.service,
        version: ctx.version,
        environment: ctx.environment,
        hostname: ctx.hostname,
        nodeVersion: ctx.nodeVersion,
        pid: ctx.pid,
        instanceId: ctx.instanceId,
    };
}
/**
 * Reset service context (for testing)
 */
export function resetServiceContext() {
    serviceContext = null;
}
//# sourceMappingURL=logger-context.js.map