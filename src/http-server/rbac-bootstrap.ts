import type { Env } from '../config/env.js';
import {
  createHttpRbacInitializer as createPackagedHttpRbacInitializer,
  type CreateHttpRbacInitializerOptions as PackagedCreateHttpRbacInitializerOptions,
} from '#mcp-http/rbac-bootstrap';
import { logger as defaultLogger } from '../utils/logger.js';

export type CreateHttpRbacInitializerOptions<
  TEnvConfig extends Pick<Env, 'ENABLE_RBAC'> = Pick<Env, 'ENABLE_RBAC'>,
  TBillingConfig = unknown,
> = PackagedCreateHttpRbacInitializerOptions<TEnvConfig, TBillingConfig> & {
  readonly log?: typeof defaultLogger;
};

export function createHttpRbacInitializer<
  TEnvConfig extends Pick<Env, 'ENABLE_RBAC'>,
  TBillingConfig,
>(options: CreateHttpRbacInitializerOptions<TEnvConfig, TBillingConfig>): () => Promise<void> {
  return createPackagedHttpRbacInitializer({
    ...options,
    log: options.log ?? defaultLogger,
  });
}
