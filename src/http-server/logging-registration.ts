import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import {
  registerHttpLoggingSetLevelHandler as registerPackagedHttpLoggingSetLevelHandler,
  type HttpLoggingSetLevelResponse,
  type HttpLoggingSubscriber,
} from '#mcp-http/logging-registration';
import { handleLoggingSetLevel } from '../handlers/logging.js';
import type { McpLogRateLimitState } from '../server/logging-bridge-utils.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type { HttpLoggingSubscriber };

export function registerHttpLoggingSetLevelHandler(params: {
  server: McpServer;
  subscriberId: string;
  subscribers: Map<string, HttpLoggingSubscriber>;
  installLoggingBridge: () => void;
  createRateLimitState: () => McpLogRateLimitState;
  log?: typeof defaultLogger;
}): void {
  registerPackagedHttpLoggingSetLevelHandler({
    ...params,
    handleLoggingSetLevel: ({ level }: { level: LoggingLevel }) =>
      handleLoggingSetLevel({ level }) as Promise<HttpLoggingSetLevelResponse>,
    log: params.log ?? defaultLogger,
  });
}
