import { z } from 'zod';

const GoogleAuthSchema = z.object({
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3000/auth/callback'),
});

const GoogleCloudSchema = z.object({
  GOOGLE_CLOUD_PROJECT_ID: z.string(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

const RedisSchema = z.object({
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
});

const CircuitBreakerSchema = z.object({
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_TIMEOUT_MS: z.coerce.number().default(30000),
  CIRCUIT_BREAKER_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

const CacheSchema = z.object({
  CACHE_TTL_MS: z.coerce.number().default(300000), // 5 minutes
  CACHE_MAX_SIZE: z.coerce.number().default(1000),
  ENABLE_ETAG_CACHE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

const PerformanceSchema = z.object({
  ENABLE_AGGRESSIVE_FIELD_MASKS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_REQUEST_MERGING: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_PARALLEL_EXECUTOR: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  MAX_PARALLEL_REQUESTS: z.coerce.number().default(20),
});

const OTelSchema = z.object({
  OTEL_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_HONEYCOMB_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OTEL_EXPORTER_HONEYCOMB_API_KEY: z.string().optional(),
});

const PrefetchSchema = z.object({
  ENABLE_SPREADSHEET_PREFETCH: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  PREFETCH_METADATA_ONLY: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ...GoogleAuthSchema.shape,
  ...GoogleCloudSchema.shape,
  ...RedisSchema.shape,
  ...CircuitBreakerSchema.shape,
  ...CacheSchema.shape,
  ...PerformanceSchema.shape,
  ...OTelSchema.shape,
  ...PrefetchSchema.shape,
});

type Env = z.infer<typeof EnvSchema>;

export const DEFAULT_PROFILE_STORAGE_DIR = '~/.serval/profiles';

export function validateEnv(): Env {
  try {
    const result = EnvSchema.parse(process.env);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.issues
        .filter((issue) => issue.code === 'invalid_type' && issue.received === 'undefined')
        .map((issue) => issue.path.join('.'))
        .join(', ');
      if (missingFields) {
        throw new Error(`Missing required environment variables: ${missingFields}`);
      }
    }
    throw error;
  }
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}
