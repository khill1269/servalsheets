/**
 * ServalSheets - Logger
 *
 * Structured logging with sensitive field redaction.
 */

import winston from 'winston';

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

const level = process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    redactSensitive(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}
