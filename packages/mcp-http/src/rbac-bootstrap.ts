export interface HttpRbacBootstrapLogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface CreateHttpRbacInitializerOptions<
  TEnvConfig extends { ENABLE_RBAC: boolean } = { ENABLE_RBAC: boolean },
  TBillingConfig = unknown,
> {
  readonly envConfig: TEnvConfig;
  readonly initializeRbacManager: () => Promise<unknown>;
  readonly initializeBillingIntegration: (config: TBillingConfig) => unknown;
  readonly buildBillingBootstrapConfig: (envConfig: TEnvConfig) => TBillingConfig;
  readonly log?: HttpRbacBootstrapLogger;
}

const defaultLogger: HttpRbacBootstrapLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function createHttpRbacInitializer<
  TEnvConfig extends { ENABLE_RBAC: boolean },
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
