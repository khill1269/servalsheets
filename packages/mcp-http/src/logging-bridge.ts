import type { HttpLoggingSubscriber } from './logging-registration.js';

export interface LoggerBridgeTarget {
  log(levelOrEntry: unknown, message?: unknown, ...meta: unknown[]): unknown;
}

export interface ForwardHttpServerLogMessageParams {
  levelOrEntry: unknown;
  message: unknown;
  meta: unknown[];
  requestedMcpLogLevel: HttpLoggingSubscriber['requestedMcpLogLevel'];
  forwardingMcpLog: boolean;
  setForwardingMcpLog: (value: boolean) => void;
  rateLimitState: HttpLoggingSubscriber['rateLimitState'];
  server: HttpLoggingSubscriber['server'];
}

export interface HttpLoggingBridge {
  readonly subscribers: Map<string, HttpLoggingSubscriber>;
  installLoggingBridge(): void;
}

const defaultLogger: LoggerBridgeTarget = {
  log(levelOrEntry: unknown, message?: unknown, ...meta: unknown[]) {
    console.log(levelOrEntry, message, ...meta);
  },
};

function defaultForwardServerLogMessage(_params: ForwardHttpServerLogMessageParams): void {
  return;
}

export function createHttpLoggingBridge(params?: {
  log?: LoggerBridgeTarget;
  forwardServerLogMessage?: (params: ForwardHttpServerLogMessageParams) => void;
}): HttpLoggingBridge {
  const log = params?.log ?? defaultLogger;
  const forwardServerLogMessage =
    params?.forwardServerLogMessage ?? defaultForwardServerLogMessage;
  const subscribers = new Map<string, HttpLoggingSubscriber>();
  let installed = false;

  const installLoggingBridge = (): void => {
    if (installed) {
      return;
    }

    installed = true;
    const originalLog = log.log.bind(log);

    log.log = ((levelOrEntry: unknown, message?: unknown, ...meta: unknown[]) => {
      const result = (originalLog as (...args: unknown[]) => unknown)(levelOrEntry, message, ...meta);

      if (subscribers.size === 0) {
        return result;
      }

      for (const [subscriberId, subscriber] of subscribers.entries()) {
        forwardServerLogMessage({
          levelOrEntry,
          message,
          meta,
          requestedMcpLogLevel: subscriber.requestedMcpLogLevel,
          forwardingMcpLog: subscriber.forwardingMcpLog,
          setForwardingMcpLog: (value) => {
            const currentSubscriber = subscribers.get(subscriberId);
            if (currentSubscriber) {
              currentSubscriber.forwardingMcpLog = value;
            }
          },
          rateLimitState: subscriber.rateLimitState,
          server: subscriber.server,
        });
      }

      return result;
    }) as typeof log.log;
  };

  return {
    subscribers,
    installLoggingBridge,
  };
}
