/**
 * ServalSheets - Logger
 *
 * Structured logging with sensitive field redaction and service context.
 */

import winston from 'winston';
import { getServiceContextFlat } from './logger-context.js';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = [
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'authorization',
  'client_secret',
  'clientsecret',
  'private_key',
  'jwt',
  'jwtsecret',
  'secret',
  'password',
  'api_key',
  'apikey',
  'cookie',
  'set-cookie',
  'credentials',
];

const MAX_REDACTION_DEPTH = 6;

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lower === sensitive || lower.includes(sensitive));
}

function redactString(value: string): string {
  if (value.startsWith('Bearer ')) {
    return `Bearer ${REDACTED}`;
  }
  return value;
}

function redactValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= MAX_REDACTION_DEPTH) {
    return '[Truncated]';
  }

  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = shouldRedactKey(key) ? REDACTED : redactValue(entry, seen, depth + 1);
  }
  return result;
}

const redactSensitive = winston.format((info) => {
  const redacted = redactValue(info, new WeakSet(), 0) as winston.Logform.TransformableInfo;
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
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    addServiceContext(),
    redactSensitive(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      // In STDIO mode, send ALL log levels to stderr (not just errors)
      // This prevents any logs from interfering with JSON-RPC messages on stdout
      stderrLevels: isStdioMode ? ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] : ['error'],
    })
  ],
  defaultMeta: getServiceContextFlat(),
});

export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}
