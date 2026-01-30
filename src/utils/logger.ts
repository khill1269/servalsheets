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
  const redacted = redactObject(info) as winston.Logform.TransformableInfo;
  return redacted;
});

/**
 * Add request context (requestId, traceId, spanId) to all log entries
 * Enables request correlation across services and distributed tracing
 * Uses AsyncLocalStorage to automatically inject context without manual passing
 */
const addRequestContext = winston.format((info) => {
  // Use lazy import to avoid circular dependency
  try {
    const { getRequestContext } =
      require('./request-context.js') as typeof import('./request-context.js');
    const ctx = getRequestContext();
    if (ctx) {
      // Only add fields that exist (don't pollute logs with undefined)
      if (ctx.requestId) info['requestId'] = ctx.requestId;
      if (ctx.traceId) info['traceId'] = ctx.traceId;
      if (ctx.spanId) info['spanId'] = ctx.spanId;
    }
  } catch {
    // Ignore errors (module may not be available during initialization)
  }
  return info;
});

const addServiceContext = winston.format((info) => {
  const serviceContext = getServiceContextFlat();
  Object.assign(info, serviceContext);
  return info;
});

const level =
  process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

// Detect if we're in STDIO mode for MCP (logs must go to stderr, not stdout)
// Winston Console transport writes to stderr by default when level is 'error' or when stderrLevels is configured
// In STDIO mode, ALL logs must go to stderr to avoid interfering with JSON-RPC on stdout
const isStdioMode = process.env['MCP_TRANSPORT'] === 'stdio' || !process.env['MCP_TRANSPORT'];

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    addRequestContext(), // Auto-inject requestId, traceId, spanId from AsyncLocalStorage
    addServiceContext(),
    redactSensitive(),
    winston.format.json()
  ),
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

export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}
