import {
  createHttpLoggingBridge as createPackagedHttpLoggingBridge,
  type HttpLoggingBridge,
  type LoggerBridgeTarget,
} from '../../packages/mcp-http/dist/logging-bridge.js';
import { forwardServerLogMessage } from '../server/logging-bridge.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type { HttpLoggingBridge };

export function createHttpLoggingBridge(params?: { log?: LoggerBridgeTarget }): HttpLoggingBridge {
  return createPackagedHttpLoggingBridge({
    log: params?.log ?? defaultLogger,
    forwardServerLogMessage,
  });
}

const sharedHttpLoggingBridge = createHttpLoggingBridge();

export function getSharedHttpLoggingBridge(): HttpLoggingBridge {
  return sharedHttpLoggingBridge;
}
