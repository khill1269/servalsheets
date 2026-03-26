import type { Express } from 'express';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStoreAdapter } from '../core/index.js';
import type { InMemoryEventStore, RedisEventStore } from '../mcp/event-store.js';
import { sessionsTotal } from '../observability/metrics.js';
import type { OAuthProvider } from '../auth/oauth-provider.js';
import { extractIdempotencyKeyFromHeaders } from '../utils/idempotency-key-generator.js';
import {
  createResourceIndicatorValidator,
  optionalResourceIndicatorMiddleware,
} from '../security/index.js';
import { removeSessionContext } from '../services/session-context.js';
import { extractPrincipalIdFromHeaders } from '../server/request-extraction.js';
import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
import { sessionLimiter } from '../utils/session-limiter.js';
import { logger } from '../utils/logger.js';
import {
  clearSessionEventStore,
  createSessionEventStore,
  createSessionSecurityContext,
  normalizeMcpSessionHeader,
  type SessionSecurityContext,
  verifySessionSecurityContext,
} from './transport-helpers.js';
import {
  registerHttpTransportRoutes as registerPackagedHttpTransportRoutes,
  type HttpTransportSession as PackagedHttpTransportSession,
} from '../../packages/mcp-http/dist/routes-transport.js';

export type HttpTransportSession = PackagedHttpTransportSession<
  McpServer,
  TaskStoreAdapter,
  InMemoryEventStore | RedisEventStore,
  SessionSecurityContext
>;

export function registerHttpTransportRoutes(params: {
  app: Express;
  enableOAuth: boolean;
  oauth: OAuthProvider | null;
  legacySseEnabled: boolean;
  host: string;
  port: number;
  eventStoreRedisUrl: string | undefined;
  eventStoreTtlMs: number;
  eventStoreMaxEvents: number;
  sessionTimeoutMs: number;
  sessions: Map<string, HttpTransportSession>;
  createMcpServerInstance: (
    googleToken?: string,
    googleRefreshToken?: string,
    sessionId?: string
  ) => Promise<{ mcpServer: McpServer; taskStore: TaskStoreAdapter; disposeRuntime: () => void }>;
}): {
  sessionCleanupInterval: NodeJS.Timeout;
  cleanupSessions: () => void;
} {
  return registerPackagedHttpTransportRoutes({
    ...params,
    dependencies: {
      sessionsTotal,
      extractIdempotencyKeyFromHeaders,
      createResourceIndicatorValidator,
      optionalResourceIndicatorMiddleware,
      removeSessionContext,
      extractPrincipalIdFromHeaders,
      createRequestContext,
      runWithRequestContext,
      sessionLimiter,
      log: logger,
      clearSessionEventStore,
      createSessionEventStore,
      createSessionSecurityContext,
      normalizeMcpSessionHeader,
      verifySessionSecurityContext,
    },
  });
}
