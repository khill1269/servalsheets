import type { Express } from 'express';
import type { OAuthProvider } from '../auth/oauth-provider.js';
import type { HttpLoggingBridge } from './logging-bridge.js';
import { createHttpMcpServerInstance } from './runtime-factory.js';
import {
  registerHttpTransportRoutes,
  type HttpTransportSession,
} from './routes-transport.js';

export interface BootstrapHttpTransportSessionsOptions {
  readonly app: Express;
  readonly enableOAuth: boolean;
  readonly oauth: OAuthProvider | null;
  readonly legacySseEnabled: boolean;
  readonly host: string;
  readonly port: number;
  readonly eventStoreRedisUrl: string | undefined;
  readonly eventStoreTtlMs: number;
  readonly eventStoreMaxEvents: number;
  readonly sessionTimeoutMs: number;
  readonly loggingBridge: Pick<HttpLoggingBridge, 'subscribers' | 'installLoggingBridge'>;
  readonly createHttpMcpServerInstance?: typeof createHttpMcpServerInstance;
  readonly registerHttpTransportRoutes?: typeof registerHttpTransportRoutes;
}

export interface HttpTransportBootstrapResult {
  readonly sessions: Map<string, HttpTransportSession>;
  readonly sessionCleanupInterval: NodeJS.Timeout;
  readonly cleanupSessions: () => void;
}

export function bootstrapHttpTransportSessions(
  options: BootstrapHttpTransportSessionsOptions
): HttpTransportBootstrapResult {
  const {
    app,
    enableOAuth,
    oauth,
    legacySseEnabled,
    host,
    port,
    eventStoreRedisUrl,
    eventStoreTtlMs,
    eventStoreMaxEvents,
    sessionTimeoutMs,
    loggingBridge,
    createHttpMcpServerInstance: createHttpMcpServerInstanceImpl = createHttpMcpServerInstance,
    registerHttpTransportRoutes: registerHttpTransportRoutesImpl = registerHttpTransportRoutes,
  } = options;

  const sessions = new Map<string, HttpTransportSession>();
  const createMcpServerInstance = async (
    googleToken?: string,
    googleRefreshToken?: string,
    sessionId?: string
  ) =>
    createHttpMcpServerInstanceImpl({
      googleToken,
      googleRefreshToken,
      sessionId,
      subscribers: loggingBridge.subscribers,
      installLoggingBridge: loggingBridge.installLoggingBridge,
    });

  const { sessionCleanupInterval, cleanupSessions } = registerHttpTransportRoutesImpl({
    app,
    enableOAuth,
    oauth,
    legacySseEnabled,
    host,
    port,
    eventStoreRedisUrl,
    eventStoreTtlMs,
    eventStoreMaxEvents,
    sessionTimeoutMs,
    sessions,
    createMcpServerInstance,
  });

  return {
    sessions,
    sessionCleanupInterval,
    cleanupSessions,
  };
}
