import { createHash } from 'crypto';

export interface HttpTransportHelpersLogger {
  warn(message: string, meta?: unknown): void;
}

export interface SessionSecurityContext {
  ipAddress: string;
  userAgent: string;
  tokenHash: string;
}

const defaultLogger: HttpTransportHelpersLogger = {
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
};

export function createSessionSecurityContext<TRequest extends { headers?: Record<string, unknown> }>(
  req: TRequest,
  token: string,
  options: {
    extractTrustedClientIp: (req: TRequest, fallback?: string) => string;
  }
): SessionSecurityContext {
  const ipAddress = options.extractTrustedClientIp(req, 'unknown');
  const userAgent = (req.headers?.['user-agent'] as string) || 'unknown';
  const tokenHash = createHash('sha256').update(token).digest('hex').substring(0, 16);

  return { ipAddress, userAgent, tokenHash };
}

export function verifySessionSecurityContext(
  stored: SessionSecurityContext,
  current: SessionSecurityContext,
  options: { log?: HttpTransportHelpersLogger } = {}
): { valid: boolean; reason?: string } {
  const log = options.log ?? defaultLogger;

  if (stored.tokenHash !== current.tokenHash) {
    return { valid: false, reason: 'Token mismatch' };
  }
  if (stored.userAgent !== current.userAgent) {
    return { valid: false, reason: 'User-agent mismatch' };
  }
  if (stored.ipAddress !== current.ipAddress) {
    log.warn('Session IP address changed', {
      stored: stored.ipAddress,
      current: current.ipAddress,
    });
  }
  return { valid: true };
}

export function createSessionEventStore<TInMemoryEventStore, TRedisEventStore>(params: {
  sessionId: string;
  eventStoreRedisUrl: string | undefined;
  eventStoreTtlMs: number;
  eventStoreMaxEvents: number;
  createInMemoryEventStore: (options: {
    ttlMs: number;
    maxEvents: number;
    streamId: string;
  }) => TInMemoryEventStore;
  createRedisEventStore: (
    redisUrl: string,
    options: { ttlMs: number; maxEvents: number; streamId: string }
  ) => TRedisEventStore;
}): TInMemoryEventStore | TRedisEventStore {
  const { sessionId, eventStoreRedisUrl, eventStoreTtlMs, eventStoreMaxEvents } = params;
  const options = {
    ttlMs: eventStoreTtlMs,
    maxEvents: eventStoreMaxEvents,
    streamId: sessionId,
  };
  if (eventStoreRedisUrl) {
    return params.createRedisEventStore(eventStoreRedisUrl, options);
  }
  return params.createInMemoryEventStore(options);
}

export function clearSessionEventStore(
  eventStore: { clear: () => void | Promise<void> } | undefined,
  options: { log?: HttpTransportHelpersLogger } = {}
): void {
  const log = options.log ?? defaultLogger;

  if (!eventStore) {
    return;
  }

  void Promise.resolve(eventStore.clear()).catch((error) => {
    log.warn('Failed to clear event store', { error });
  });
}

export function normalizeMcpSessionHeader(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | undefined {
  const existing = coerceHeaderValue(req.headers['mcp-session-id']);
  if (existing) {
    return existing;
  }

  const legacy = coerceHeaderValue(req.headers['x-session-id']);
  if (legacy) {
    req.headers['mcp-session-id'] = legacy;
  }
  return legacy;
}

const coerceHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;
