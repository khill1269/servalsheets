import type { Express } from 'express';
import type { OAuthProvider } from '../auth/oauth-provider.js';
import type { HttpLoggingBridge } from './logging-bridge.js';
import { createHttpMcpServerInstance } from './runtime-factory.js';
import { registerHttpTransportRoutes, type HttpTransportSession } from './routes-transport.js';
import {
  bootstrapHttpTransportSessions as bootstrapPackagedHttpTransportSessions,
  type HttpTransportBootstrapResult as PackagedHttpTransportBootstrapResult,
} from '../../packages/mcp-http/dist/transport-bootstrap.js';

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
    createHttpMcpServerInstance: createHttpMcpServerInstanceImpl = createHttpMcpServerInstance,
    registerHttpTransportRoutes: registerHttpTransportRoutesImpl = registerHttpTransportRoutes,
    ...rest
  } = options;

  return bootstrapPackagedHttpTransportSessions({
    ...rest,
    createHttpMcpServerInstance: createHttpMcpServerInstanceImpl as never,
    registerHttpTransportRoutes: registerHttpTransportRoutesImpl as never,
  }) as PackagedHttpTransportBootstrapResult<HttpTransportSession>;
}
