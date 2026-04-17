import type { Env } from '../config/env.js';
import {
  createHttpRbacInitializer as createPackagedHttpRbacInitializer,
  type CreateHttpRbacInitializerOptions as PackagedCreateHttpRbacInitializerOptions,
} from '../../packages/mcp-http/dist/rbac-bootstrap.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type CreateHttpRbacInitializerOptions<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _TEnvConfig extends any = Pick<Env, 'ENABLE_RBAC'>,
  TBillingConfig = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = PackagedCreateHttpRbacInitializerOptions<any, TBillingConfig> & {
  readonly log?: typeof defaultLogger;
};

export function createHttpRbacInitializer<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _TEnvConfig extends any = Pick<Env, 'ENABLE_RBAC'>,
  TBillingConfig = unknown,
>(options: CreateHttpRbacInitializerOptions<_TEnvConfig, TBillingConfig>): () => Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createPackagedHttpRbacInitializer as any)({
    ...options,
    log: options.log ?? defaultLogger,
  });
}
