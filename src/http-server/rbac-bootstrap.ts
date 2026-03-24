import type { Env } from '../config/env.js';
import { logger as defaultLogger } from '../utils/logger.js';

export interface CreateHttpRbacInitializerOptions<
  TEnvConfig extends Pick<Env, 'ENABLE_RBAC'> = Pick<Env, 'ENABLE_RBAC'>,
  TBillingConfig = unknown,
> {
  readonly envConfig: TEnvConfig;
  readonly initializeRbacManager: () => Promise<unknown>;
  readonly initializeBillingIntegration: (config: TBillingConfig) => unknown;
  readonly buildBillingBootstrapConfig: (envConfig: TEnvConfig) => TBillingConfig;
  readonly log?: typeof defaultLogger;
}

export function createHttpRbacInitializer<
  TEnvConfig extends Pick<Env, 'ENABLE_RBAC'>,
  TBillingConfig,
>(
  options: CreateHttpRbacInitializerOptions<TEnvConfig, TBillingConfig>
): () => Promise<void> {
  const {
    envConfig,
    initializeRbacManager,
    initializeBillingIntegration,
    buildBillingBootstrapConfig,
    log = defaultLogger,
  } = options;

  return async () => {
    if (!envConfig.ENABLE_RBAC) {
      return;
    }

    try {
      await initializeRbacManager();
      log.info('RBAC manager initialized');
      initializeBillingIntegration(buildBillingBootstrapConfig(envConfig));
    } catch (error) {
      log.error('Failed to initialize RBAC manager', { error });
      throw error;
    }
  };
}
