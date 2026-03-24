import { forwardServerLogMessage } from '../server/logging-bridge.js';
import { logger as defaultLogger } from '../utils/logger.js';
import type { HttpLoggingSubscriber } from './logging-registration.js';

type LoggerBridgeTarget = Pick<typeof defaultLogger, 'log'>;

export interface HttpLoggingBridge {
  readonly subscribers: Map<string, HttpLoggingSubscriber>;
  installLoggingBridge(): void;
}

export function createHttpLoggingBridge(params?: {
  log?: LoggerBridgeTarget;
}): HttpLoggingBridge {
  const log = params?.log ?? defaultLogger;
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

const sharedHttpLoggingBridge = createHttpLoggingBridge();

export function getSharedHttpLoggingBridge(): HttpLoggingBridge {
  return sharedHttpLoggingBridge;
}
