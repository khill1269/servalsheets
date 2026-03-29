import type { Request } from 'express';
import {
  clearSessionEventStore as clearPackagedSessionEventStore,
  createSessionEventStore as createPackagedSessionEventStore,
  createSessionSecurityContext as createPackagedSessionSecurityContext,
  normalizeMcpSessionHeader as normalizePackagedMcpSessionHeader,
  verifySessionSecurityContext as verifyPackagedSessionSecurityContext,
  type SessionSecurityContext,
} from '#mcp-http/transport-helpers';
import { InMemoryEventStore, RedisEventStore } from '../mcp/event-store.js';
import { logger } from '../utils/logger.js';
import { extractTrustedClientIp } from './client-ip.js';

export type { SessionSecurityContext };

/**
 * Create security context for session binding.
 */
export function createSessionSecurityContext(req: Request, token: string): SessionSecurityContext {
  return createPackagedSessionSecurityContext(req, token, {
    extractTrustedClientIp,
  });
}

/**
 * Verify security context matches for reconnection.
 */
export function verifySessionSecurityContext(
  stored: SessionSecurityContext,
  current: SessionSecurityContext
): { valid: boolean; reason?: string } {
  return verifyPackagedSessionSecurityContext(stored, current, { log: logger });
}

export function createSessionEventStore(params: {
  sessionId: string;
  eventStoreRedisUrl: string | undefined;
  eventStoreTtlMs: number;
  eventStoreMaxEvents: number;
}): InMemoryEventStore | RedisEventStore {
  return createPackagedSessionEventStore({
    ...params,
    createInMemoryEventStore: (options) => new InMemoryEventStore(options),
    createRedisEventStore: (redisUrl, options) => new RedisEventStore(redisUrl, options),
  });
}

export function clearSessionEventStore(eventStore?: { clear: () => void | Promise<void> }): void {
  clearPackagedSessionEventStore(eventStore, { log: logger });
}

export function normalizeMcpSessionHeader(req: Request): string | undefined {
  return normalizePackagedMcpSessionHeader(
    req as Request & {
      headers: Record<string, string | string[] | undefined>;
    }
  );
}
