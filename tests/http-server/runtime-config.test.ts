import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_HTTP_CORS_ORIGINS,
  resolveHttpServerRuntimeConfig,
} from '../../src/http-server/runtime-config.js';

describe('http runtime config helper', () => {
  it('uses explicit overrides and env-backed event store settings', () => {
    const result = resolveHttpServerRuntimeConfig({
      envConfig: {
        CORS_ORIGINS: 'https://env.example',
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
        ENABLE_LEGACY_SSE: false,
        REDIS_URL: 'redis://localhost:6379',
        STREAMABLE_HTTP_EVENT_TTL_MS: 120000,
        STREAMABLE_HTTP_EVENT_MAX_EVENTS: 250,
      },
      options: {
        port: 4100,
        host: '0.0.0.0',
        corsOrigins: ['https://override.example'],
        rateLimitWindowMs: 15000,
        rateLimitMax: 25,
        trustProxy: true,
      },
      defaultPort: 3000,
      defaultHost: '127.0.0.1',
    });

    expect(result).toEqual({
      port: 4100,
      host: '0.0.0.0',
      corsOrigins: ['https://override.example'],
      rateLimitWindowMs: 15000,
      rateLimitMax: 25,
      trustProxy: true,
      legacySseEnabled: false,
      eventStoreRedisUrl: 'redis://localhost:6379',
      eventStoreTtlMs: 120000,
      eventStoreMaxEvents: 250,
    });
  });

  it('falls back to env and default CORS origins and warns when legacy SSE is enabled', () => {
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    const result = resolveHttpServerRuntimeConfig({
      envConfig: {
        CORS_ORIGINS: ' , ',
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
        ENABLE_LEGACY_SSE: true,
        REDIS_URL: undefined,
        STREAMABLE_HTTP_EVENT_TTL_MS: 45000,
        STREAMABLE_HTTP_EVENT_MAX_EVENTS: 150,
      },
      defaultPort: 3000,
      defaultHost: '127.0.0.1',
      log: log as never,
    });

    expect(result.port).toBe(3000);
    expect(result.host).toBe('127.0.0.1');
    expect(result.corsOrigins).toEqual([...DEFAULT_HTTP_CORS_ORIGINS]);
    expect(result.rateLimitWindowMs).toBe(60000);
    expect(result.rateLimitMax).toBe(100);
    expect(result.trustProxy).toBe(false);
    expect(result.legacySseEnabled).toBe(true);
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('uses trimmed env CORS origins when explicit overrides are absent', () => {
    const result = resolveHttpServerRuntimeConfig({
      envConfig: {
        CORS_ORIGINS: ' https://a.example ,https://b.example ',
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
        ENABLE_LEGACY_SSE: false,
        REDIS_URL: undefined,
        STREAMABLE_HTTP_EVENT_TTL_MS: 1000,
        STREAMABLE_HTTP_EVENT_MAX_EVENTS: 10,
      },
      defaultPort: 3000,
      defaultHost: '127.0.0.1',
    });

    expect(result.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
  });
});
