export interface RuntimePreflightEnv {
  readonly ENABLE_COST_TRACKING: boolean;
  readonly ENABLE_BILLING_INTEGRATION: boolean;
}

export interface PrepareRuntimePreflightOptions<TEnv extends RuntimePreflightEnv> {
  readonly loadEnv: () => TEnv;
  readonly validateToolCatalogConfiguration?: () => void;
}

export interface RuntimePreflightResult<TEnv extends RuntimePreflightEnv> {
  readonly envConfig: TEnv;
  readonly costTrackingEnabled: boolean;
}

export function prepareRuntimePreflight<TEnv extends RuntimePreflightEnv>(
  options: PrepareRuntimePreflightOptions<TEnv>
): RuntimePreflightResult<TEnv> {
  const envConfig = options.loadEnv();
  options.validateToolCatalogConfiguration?.();

  return {
    envConfig,
    costTrackingEnabled:
      envConfig.ENABLE_COST_TRACKING || envConfig.ENABLE_BILLING_INTEGRATION,
  };
}
