import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SetLevelRequestSchema, type LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import { handleLoggingSetLevel } from '../handlers/logging.js';
import type { McpLogRateLimitState } from '../server/logging-bridge-utils.js';
import { logger as defaultLogger } from '../utils/logger.js';

export interface HttpLoggingSubscriber {
  requestedMcpLogLevel: LoggingLevel;
  forwardingMcpLog: boolean;
  rateLimitState: McpLogRateLimitState;
  server: McpServer;
}

export function registerHttpLoggingSetLevelHandler(params: {
  server: McpServer;
  subscriberId: string;
  subscribers: Map<string, HttpLoggingSubscriber>;
  installLoggingBridge: () => void;
  createRateLimitState: () => McpLogRateLimitState;
  log?: typeof defaultLogger;
}): void {
  const {
    server,
    subscriberId,
    subscribers,
    installLoggingBridge,
    createRateLimitState,
    log = defaultLogger,
  } = params;

  server.server.setRequestHandler(
    SetLevelRequestSchema,
    async (request: { params: { level: LoggingLevel } }) => {
      const level = request.params.level;
      const existingSubscriber = subscribers.get(subscriberId);
      subscribers.set(subscriberId, {
        requestedMcpLogLevel: level,
        forwardingMcpLog: existingSubscriber?.forwardingMcpLog ?? false,
        rateLimitState: existingSubscriber?.rateLimitState ?? createRateLimitState(),
        server,
      });
      installLoggingBridge();

      const response = await handleLoggingSetLevel({ level });
      log.info('Log level changed via logging/setLevel', {
        previousLevel: response.previousLevel,
        newLevel: response.newLevel,
      });

      return {}; // OK: MCP logging/setLevel returns empty result after applying level change
    }
  );

  log.info('HTTP Server: Logging handler registered (logging/setLevel)');
}
