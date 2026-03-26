export interface PrepareStdioBootstrapDependencies<TOptions> {
  readonly warnIfDefaultCredentialsInHttpMode: () => void;
  readonly enforceProductionOAuthConfig: () => void;
  readonly registerSamplingConsentGuard: () => void;
  readonly ensureTaskStoreConfigured: (options: TOptions) => Promise<void>;
  readonly initializeCacheInfrastructure: () => Promise<void>;
}

export async function prepareStdioBootstrap<TOptions>(
  options: TOptions,
  dependencies: PrepareStdioBootstrapDependencies<TOptions>
): Promise<void> {
  dependencies.warnIfDefaultCredentialsInHttpMode();
  dependencies.enforceProductionOAuthConfig();
  dependencies.registerSamplingConsentGuard();
  await dependencies.ensureTaskStoreConfigured(options);
  await dependencies.initializeCacheInfrastructure();
}
