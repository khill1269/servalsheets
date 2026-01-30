/**
 * ServalSheets - Logger
 *
 * Structured logging with sensitive field redaction and service context.
 *
 * Security: Uses centralized redaction utility to prevent sensitive data
 * (tokens, API keys, credentials) from leaking into logs.
 */
import winston from 'winston';
export declare const logger: winston.Logger;
export declare function createChildLogger(meta: Record<string, unknown>): winston.Logger;
//# sourceMappingURL=logger.d.ts.map