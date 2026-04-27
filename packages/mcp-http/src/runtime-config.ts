export interface HttpRuntimeConfigLogger {
  warn(message: string): void;
}

export interface HttpServerRuntimeOptionOverrides {
  readonly port?: number;
  readonly host?: string;
  readonly corsOrigins?: string[];
  readonly rateLimitWindowMs?: number;
  readonly rateLimitMax?: number;
  readonly trustProxy?: boolean;
}

export interface HttpServerRuntimeEnvConfig {
  readonly CORS_ORIGINS: string;
  readonly RATE_LIMIT_WINDOW_MS: number;
  readonly RATE_LIMIT_MAX: number;
  readonly ENABLE_LEGACY_SSE: boolean;
  readonly REDIS_URL?: string | undefined;
  readonly STREAMABLE_HTTP_EVENT_TTL_MS: number;
  readonly STREAMABLE_HTTP_EVENT_MAX_EVENTS: number;
}

export interface ResolveHttpServerRuntimeConfigOptions {
  readonly envConfig: HttpServerRuntimeEnvConfig;
  readonly options?: HttpServerRuntimeOptionOverrides;
  readonly defaultPort: number;
  readonly defaultHost: string;
  readonly log?: HttpRuntimeConfigLogger;
}

export interface HttpServerRuntimeConfig {
  readonly port: number;
  readonly host: string;
  readonly corsOrigins: string[];
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  readonly trustProxy: boolean;
  readonly legacySseEnabled: boolean;
  readonly eventStoreRedisUrl: string | undefined;
  readonly eventStoreTtlMs: number;
  readonly eventStoreMaxEvents: number;
}

const REMOTE_CORS_ORIGINS = [
  'https://claude.ai',
  'https://claude.com',
  'https://platform.openai.com',
  'https://copilot.microsoft.com',
  'https://grok.x.ai',
  'https://gemini.google.com',
] as const;

const LOCALHOST_CORS_ORIGINS = [
  'http://localhost:6274',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:6274',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
] as const;

/** Full default list (remote + localhost) — used in non-production environments */
export const DEFAULT_HTTP_CORS_ORIGINS = [
  ...REMOTE_CORS_ORIGINS,
  ...LOCALHOST_CORS_ORIGINS,
] as const;

/** Production default: no localhost origins (require explicit CORS_ORIGINS config) */
export const DEFAULT_PROD_HTTP_CORS_ORIGINS = [...REMOTE_CORS_ORIGINS] as const;

/** Dev default: includes localhost origins for local MCP clients */
export const DEFAULT_DEV_HTTP_CORS_ORIGINS = [...DEFAULT_HTTP_CORS_ORIGINS] as const;

const defaultLogger: HttpRuntimeConfigLogger = {
  warn(message: string) {
    console.warn(message);
  },
};

export function resolveHttpServerRuntimeConfig(
  params: ResolveHttpServerRuntimeConfigOptions
): HttpServerRuntimeConfig {
  const { envConfig, options = {}, defaultPort, defaultHost, log = defaultLogger } = params;

  const configuredCorsOrigins = envConfig.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const defaultOrigins =
    process.env['NODE_ENV'] === 'production'
      ? DEFAULT_PROD_HTTP_CORS_ORIGINS
      : DEFAULT_DEV_HTTP_CORS_ORIGINS;

  const legacySseEnabled = envConfig.ENABLE_LEGACY_SSE;
  if (legacySseEnabled) {
    log.warn(
      'Legacy SSE transport (/sse endpoint) is deprecated per MCP 2025-11-25 and ' +
        'will be removed in v2.0.0 (target: 2026-Q3). ' +
        'Migrate clients to the Streamable HTTP transport at /mcp. ' +
        'Set ENABLE_LEGACY_SSE=false to suppress this warning.'
    );
  }

  return {
    port: options.port ?? defaultPort,
    host: options.host ?? defaultHost,
    corsOrigins:
      options.corsOrigins ??
      (configuredCorsOrigins.length > 0 ? configuredCorsOrigins : [...defaultOrigins]),
    rateLimitWindowMs: options.rateLimitWindowMs ?? envConfig.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: options.rateLimitMax ?? envConfig.RATE_LIMIT_MAX,
    trustProxy: options.trustProxy ?? false,
    legacySseEnabled,
    eventStoreRedisUrl: envConfig.REDIS_URL,
    eventStoreTtlMs: envConfig.STREAMABLE_HTTP_EVENT_TTL_MS,
    eventStoreMaxEvents: envConfig.STREAMABLE_HTTP_EVENT_MAX_EVENTS,
  };
}
