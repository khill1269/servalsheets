/**
 * ServalSheets - Logger
 *
 * Structured logging with sensitive field redaction and service context.
 *
 * Security: Uses centralized redaction utility to prevent sensitive data
 * (tokens, API keys, credentials) from leaking into logs.
 */
import winston from 'winston';
import { getServiceContextFlat } from './logger-context.js';
import { redactObject } from './redact.js';
/**
 * Winston format for redacting sensitive data
 * Uses centralized redaction utility for consistency
 */
const redactSensitive = winston.format((info) => {
    const redacted = redactObject(info);
    return redacted;
});
const addServiceContext = winston.format((info) => {
    const serviceContext = getServiceContextFlat();
    Object.assign(info, serviceContext);
    return info;
});
const level = process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');
// Detect if we're in STDIO mode for MCP (logs must go to stderr, not stdout)
// Winston Console transport writes to stderr by default when level is 'error' or when stderrLevels is configured
// In STDIO mode, ALL logs must go to stderr to avoid interfering with JSON-RPC on stdout
const isStdioMode = process.env['MCP_TRANSPORT'] === 'stdio' || !process.env['MCP_TRANSPORT'];
export const logger = winston.createLogger({
    level,
    format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.timestamp(), addServiceContext(), redactSensitive(), winston.format.json()),
    transports: [
        new winston.transports.Console({
            // In STDIO mode, send ALL log levels to stderr (not just errors)
            // This prevents any logs from interfering with JSON-RPC messages on stdout
            stderrLevels: isStdioMode
                ? ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
                : ['error'],
        }),
    ],
    defaultMeta: getServiceContextFlat(),
});
export function createChildLogger(meta) {
    return logger.child(meta);
}
//# sourceMappingURL=logger.js.map