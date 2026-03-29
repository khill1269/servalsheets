import { ConfigError } from '../core/errors.js';
import {
  createHttpServerLifecycle as createPackagedHttpServerLifecycle,
  type CreateHttpServerLifecycleOptions as PackagedCreateHttpServerLifecycleOptions,
} from '#mcp-http/server-lifecycle';
import { logger as defaultLogger } from '../utils/logger.js';
export type CreateHttpServerLifecycleOptions<
  TMetricsExporter = unknown,
  TMetricsServer = unknown,
> = PackagedCreateHttpServerLifecycleOptions<TMetricsExporter, TMetricsServer>;

export function createHttpServerLifecycle<TMetricsExporter = unknown, TMetricsServer = unknown>(
  options: CreateHttpServerLifecycleOptions<TMetricsExporter, TMetricsServer>
): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  return createPackagedHttpServerLifecycle({
    ...options,
    createConfigError: (message: string, field: string) => new ConfigError(message, field),
    log: options.log ?? defaultLogger,
  });
}
