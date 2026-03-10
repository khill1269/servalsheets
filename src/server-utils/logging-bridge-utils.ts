import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

const MCP_LOG_SEVERITY: Record<LoggingLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

const WINSTON_TO_MCP_LOG_LEVEL: Record<string, LoggingLevel> = {
  error: 'error',
  warn: 'warning',
  info: 'info',
  http: 'info',
  verbose: 'debug',
  debug: 'debug',
  silly: 'debug',
};

export function normalizeMcpLogLevel(winstonLevel: string): LoggingLevel {
  return WINSTON_TO_MCP_LOG_LEVEL[winstonLevel] ?? 'info';
}

export function shouldForwardMcpLog(winstonLevel: string, requestedLevel: LoggingLevel): boolean {
  const messageLevel = normalizeMcpLogLevel(winstonLevel);
  return MCP_LOG_SEVERITY[messageLevel] <= MCP_LOG_SEVERITY[requestedLevel];
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
