/**
 * ServalSheets - Base Logger (no request context)
 *
 * Base winston logger without request context to avoid circular dependencies.
 * This file is imported by both logger.ts and request-context.ts.
 *
 * Import hierarchy:
 * - base-logger.ts (no request context) ← lowest level
 * - request-context.ts (imports base-logger)
 * - logger.ts (imports base-logger, lazy-loads request-context)
 */

import * as winston from 'winston';
import { getServiceContextFlat } from './logger-context.js';
import { redactObject } from './redact.js';

/**
 * Winston format for redacting sensitive data
 */
const redactSensitive = winston.format((info) => {
  const redacted = redactObject(info) as winston.Logform.TransformableInfo;
  return redacted;
});

/**
 * Add service context to all log entries
 */
const addServiceContext = winston.format((info) => {
  const serviceContext = getServiceContextFlat();
  Object.assign(info, serviceContext);
  return info;
});

const level =
  process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

// Detect STDIO mode
const isStdioMode = process.env['MCP_TRANSPORT'] === 'stdio' || !process.env['MCP_TRANSPORT'];

// Detect CloudWatch/JSON logging mode
const logFormat = process.env['LOG_FORMAT'] || 'text';
const isJsonFormat = logFormat === 'json';
const cloudwatchLogGroup = process.env['CLOUDWATCH_LOG_GROUP'];

/**
 * CloudWatch-compatible JSON formatter
 * Outputs structured logs compatible with CloudWatch Logs Insights queries
 */
const cloudwatchJsonFormat = winston.format((info) => {
  const entry: Record<string, unknown> = {
    timestamp: info['timestamp'],
    level: info.level,
    message: info.message,
    component: info['component'] || 'servalsheets',
  };

  // Add request context if available
  if (info['requestId']) entry['requestId'] = info['requestId'];
  if (info['traceId']) entry['traceId'] = info['traceId'];
  if (info['spanId']) entry['spanId'] = info['spanId'];

  // Add CloudWatch log group if configured
  if (cloudwatchLogGroup) {
    entry['logGroup'] = cloudwatchLogGroup;
  }

  // Add any additional metadata
  if (info['meta'] && Object.keys(info['meta']).length > 0) {
    entry['metadata'] = info['meta'];
  }

  // Handle errors with stack traces
  if (info['stack']) {
    entry['stack'] = info['stack'];
  }

  return {
    ...info,
    ...entry,
  };
});

/**
 * Base logger without request context enrichment
 * Used as fallback in request-context.ts to avoid circular dependency
 */
export const baseLogger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    addServiceContext(),
    redactSensitive(),
    ...(isJsonFormat ? [cloudwatchJsonFormat()] : []),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: isStdioMode
        ? ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
        : ['error'],
    }),
  ],
  defaultMeta: getServiceContextFlat(),
});
