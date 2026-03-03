import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import { logger as baseLogger } from '../utils/logger.js';
import {
  normalizeMcpLogLevel,
  safeStringify,
  shouldForwardMcpLog,
} from '../server-utils/logging-bridge-utils.js';

interface ForwardLogMessageParams {
  levelOrEntry: unknown;
  message: unknown;
  meta: unknown[];
  requestedMcpLogLevel: LoggingLevel | null;
  forwardingMcpLog: boolean;
  setForwardingMcpLog: (value: boolean) => void;
  server: McpServer;
}

export function forwardServerLogMessage(params: ForwardLogMessageParams): void {
  const {
    levelOrEntry,
    message,
    meta,
    requestedMcpLogLevel,
    forwardingMcpLog,
    setForwardingMcpLog,
    server,
  } = params;
  if (!requestedMcpLogLevel || forwardingMcpLog) {
    return;
  }

  let level = 'info';
  let text = '';
  let data: unknown = message;

  if (typeof levelOrEntry === 'string') {
    level = levelOrEntry;
    if (typeof message === 'string') {
      text = message;
    } else if (message !== undefined) {
      text = safeStringify(message);
    }
    data = meta.length === 0 ? message : meta.length === 1 ? meta[0] : meta;
  } else if (typeof levelOrEntry === 'object' && levelOrEntry !== null) {
    const entry = levelOrEntry as Record<string, unknown>;
    if (typeof entry['level'] !== 'string') {
      return;
    }
    level = entry['level'];
    if (typeof entry['message'] === 'string') {
      text = entry['message'];
    } else if (entry['message'] !== undefined) {
      text = safeStringify(entry['message']);
    }
    data = entry;
  } else {
    return;
  }

  if (!shouldForwardMcpLog(level, requestedMcpLogLevel)) {
    return;
  }

  setForwardingMcpLog(true);
  void server.server
    .sendLoggingMessage({
      level: normalizeMcpLogLevel(level),
      logger: 'servalsheets',
      data: { message: text, meta: data },
    })
    .catch(() => {
      // Best-effort bridge: avoid recursive logging on notification failure.
    })
    .finally(() => {
      setForwardingMcpLog(false);
    });
}

export function installServerLoggingBridge(params: {
  loggingBridgeInstalled: boolean;
  setLoggingBridgeInstalled: (value: boolean) => void;
  getRequestedMcpLogLevel: () => LoggingLevel | null;
  getForwardingMcpLog: () => boolean;
  setForwardingMcpLog: (value: boolean) => void;
  server: McpServer;
}): void {
  const {
    loggingBridgeInstalled,
    setLoggingBridgeInstalled,
    getRequestedMcpLogLevel,
    getForwardingMcpLog,
    setForwardingMcpLog,
    server,
  } = params;

  if (loggingBridgeInstalled) {
    return;
  }

  setLoggingBridgeInstalled(true);
  const originalLog = baseLogger.log.bind(baseLogger);

  baseLogger.log = ((levelOrEntry: unknown, message?: unknown, ...meta: unknown[]) => {
    const result = (originalLog as (...args: unknown[]) => unknown)(levelOrEntry, message, ...meta);
    forwardServerLogMessage({
      levelOrEntry,
      message,
      meta,
      requestedMcpLogLevel: getRequestedMcpLogLevel(),
      forwardingMcpLog: getForwardingMcpLog(),
      setForwardingMcpLog,
      server,
    });
    return result;
  }) as typeof baseLogger.log;
}
