import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SetLevelRequestSchema, type LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

export interface HttpMcpLogRateLimitState {
  windowStartedAt: number;
  messagesInWindow: number;
  droppedInWindow: number;
}

export interface HttpLoggingRegistrationLogger {
  info(message: string, meta?: unknown): void;
}

export interface HttpLoggingSetLevelResponse {
  previousLevel: string;
  newLevel: string;
}

export interface HttpLoggingSubscriber {
  requestedMcpLogLevel: LoggingLevel;
  forwardingMcpLog: boolean;
  rateLimitState: HttpMcpLogRateLimitState;
  server: McpServer;
}

const defaultLogger: HttpLoggingRegistrationLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
};

export function registerHttpLoggingSetLevelHandler(params: {
  server: McpServer;
  subscriberId: string;
  subscribers: Map<string, HttpLoggingSubscriber>;
  installLoggingBridge: () => void;
  createRateLimitState: () => HttpMcpLogRateLimitState;
  handleLoggingSetLevel: (params: {
    level: LoggingLevel;
  }) => Promise<HttpLoggingSetLevelResponse>;
  log?: HttpLoggingRegistrationLogger;
}): void {
  const {
    server,
    subscriberId,
    subscribers,
    installLoggingBridge,
    createRateLimitState,
    handleLoggingSetLevel,
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

      return {};
    }
  );

  log.info('HTTP Server: Logging handler registered (logging/setLevel)');
}
