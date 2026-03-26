import { describe, expect, it, vi } from 'vitest';
import {
  clearSessionEventStore,
  createSessionEventStore,
  normalizeMcpSessionHeader,
  verifySessionSecurityContext,
} from '../../src/http-server/transport-helpers.js';

describe('http transport helpers', () => {
  it('prefers Redis event stores when REDIS is configured', () => {
    const store = createSessionEventStore({
      sessionId: 'session-1',
      eventStoreRedisUrl: 'redis://localhost:6379',
      eventStoreTtlMs: 1000,
      eventStoreMaxEvents: 10,
    });

    expect(store.constructor.name).toBe('RedisEventStore');
  });

  it('normalizes the legacy x-session-id header into mcp-session-id', () => {
    const headers: Record<string, string | string[] | undefined> = {
      'x-session-id': 'legacy-session',
    };

    const sessionId = normalizeMcpSessionHeader({ headers } as never);

    expect(sessionId).toBe('legacy-session');
    expect(headers['mcp-session-id']).toBe('legacy-session');
  });

  it('warns but still accepts IP mismatches during session verification', () => {
    const result = verifySessionSecurityContext(
      {
        ipAddress: '10.0.0.1',
        userAgent: 'agent',
        tokenHash: 'abc123',
      },
      {
        ipAddress: '10.0.0.2',
        userAgent: 'agent',
        tokenHash: 'abc123',
      }
    );

    expect(result).toEqual({ valid: true });
  });

  it('swallows async clear failures', async () => {
    const clear = vi.fn(async () => {
      throw new Error('clear failed');
    });

    clearSessionEventStore({ clear });

    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledOnce();
    });
  });
});
