/**
 * Pluggable Secrets Management
 *
 * Provides a pluggable interface for retrieving secrets from various backends:
 * - Environment variables (default)
 * - HashiCorp Vault
 * - AWS Secrets Manager
 * - Multiple providers chained together (CompositeSecretsProvider)
 *
 * Usage:
 *   const provider = createSecretsProvider();
 *   const apiKey = await provider.getSecret('ANTHROPIC_API_KEY');
 *
 * Backends are selected via SECRETS_PROVIDER env var:
 *   - 'env' (default): read from process.env
 *   - 'vault': HashiCorp Vault
 *   - 'aws': AWS Secrets Manager
 *   - 'composite': chain multiple providers
 */

import { logger } from '../utils/logger.js';

/**
 * Pluggable interface for secrets providers
 */
export interface SecretsProvider {
  /**
   * Retrieve a secret by key
   * @param key Secret key/name (e.g., 'ANTHROPIC_API_KEY')
   * @returns The secret value, or undefined if not found
   */
  getSecret(key: string): Promise<string | undefined>;

  /**
   * Check if a secret exists
   * @param key Secret key/name
   * @returns true if the secret exists and is accessible
   */
  hasSecret(key: string): Promise<boolean>;
}

/**
 * EnvSecretsProvider: reads secrets from process.env
 * This is the default and simplest implementation.
 */
export class EnvSecretsProvider implements SecretsProvider {
  constructor(private env: NodeJS.ProcessEnv = process.env) {}

  async getSecret(key: string): Promise<string | undefined> {
    const value = this.env[key];
    return value !== undefined ? value : undefined;
  }

  async hasSecret(key: string): Promise<boolean> {
    return key in this.env;
  }
}

/**
 * VaultSecretsProvider: scaffold for HashiCorp Vault integration.
 *
 * Future implementation will cover:
 *   - Authentication (token, JWT, AppRole, Kubernetes)
 *   - Path resolution (KV v1/v2, database roles, PKI)
 *   - Token renewal and caching
 *   - TTL-aware caching with refresh
 *
 * Currently returns safe defaults (undefined / false) and logs a warning.
 */
export class VaultSecretsProvider implements SecretsProvider {
  private readonly vaultUrl: string;
  private readonly vaultToken: string;
  private readonly vaultNamespace: string | undefined;

  constructor(vaultUrl: string, vaultToken: string, vaultNamespace?: string) {
    this.vaultUrl = vaultUrl;
    this.vaultToken = vaultToken;
    this.vaultNamespace = vaultNamespace;
  }

  async getSecret(key: string): Promise<string | undefined> {
    // [SCAFFOLD] Vault KV v2 GET /v1/secret/data/{key} — returns undefined until wired
    logger.warn('VaultSecretsProvider.getSecret() not yet implemented', { key, vaultUrl: this.vaultUrl, namespace: this.vaultNamespace, hasToken: !!this.vaultToken });
    return undefined;
  }

  async hasSecret(key: string): Promise<boolean> {
    // [SCAFFOLD] Vault HEAD check or GET with error handling — returns false until wired
    logger.warn('VaultSecretsProvider.hasSecret() not yet implemented', { key });
    return false;
  }
}

/**
 * AwsSecretsManagerProvider: scaffold for AWS Secrets Manager integration.
 *
 * Future implementation will cover:
 *   - Authentication (IAM roles, credentials from env/files)
 *   - Secret retrieval by name
 *   - Rotation support
 *   - Caching with TTL
 *   - Binary secret support
 *
 * Currently returns safe defaults (undefined / false) and logs a warning.
 */
export class AwsSecretsManagerProvider implements SecretsProvider {
  private readonly region: string;

  constructor(region: string) {
    this.region = region;
  }

  async getSecret(key: string): Promise<string | undefined> {
    // [SCAFFOLD] AWS Secrets Manager GetSecretValue — returns undefined until wired
    logger.warn('AwsSecretsManagerProvider.getSecret() not yet implemented', { key, region: this.region });
    return undefined;
  }

  async hasSecret(key: string): Promise<boolean> {
    // [SCAFFOLD] AWS Secrets Manager DescribeSecret — returns false until wired
    logger.warn('AwsSecretsManagerProvider.hasSecret() not yet implemented', { key });
    return false;
  }
}

/**
 * CompositeSecretsProvider: chains multiple providers together
 * Tries each provider in order until one returns a value (short-circuit behavior).
 *
 * Example:
 *   const composite = new CompositeSecretsProvider([
 *     new VaultSecretsProvider(vaultUrl, token),
 *     new EnvSecretsProvider() // fallback
 *   ]);
 *
 * When getSecret('API_KEY') is called:
 *   1. Tries VaultSecretsProvider → if not found, continues
 *   2. Tries EnvSecretsProvider → if found, returns immediately
 *   3. If all return undefined, returns undefined
 */
export class CompositeSecretsProvider implements SecretsProvider {
  constructor(private providers: SecretsProvider[]) {
    if (providers.length === 0) {
      throw new Error('CompositeSecretsProvider requires at least one provider');
    }
  }

  async getSecret(key: string): Promise<string | undefined> {
    for (const provider of this.providers) {
      const secret = await provider.getSecret(key);
      if (secret !== undefined) {
        return secret;
      }
    }
    return undefined; // OK: all providers exhausted — no secret found
  }

  async hasSecret(key: string): Promise<boolean> {
    for (const provider of this.providers) {
      const has = await provider.hasSecret(key);
      if (has) {
        return true;
      }
    }
    return false; // OK: all providers exhausted — secret not found in any
  }
}

/**
 * Factory function to create the appropriate SecretsProvider based on env config
 *
 * Supported providers (via SECRETS_PROVIDER env var):
 *   - 'env' (default): EnvSecretsProvider
 *   - 'vault': VaultSecretsProvider (requires VAULT_URL, VAULT_TOKEN)
 *   - 'aws': AwsSecretsManagerProvider (requires AWS_SECRETS_REGION)
 *   - 'composite': CompositeSecretsProvider (chains all available providers)
 *
 * @returns The configured SecretsProvider instance
 * @throws Error if required env vars are missing for selected provider
 */
export function createSecretsProvider(): SecretsProvider {
  const providerType = process.env['SECRETS_PROVIDER'] || 'env';

  switch (providerType) {
    case 'env':
      logger.info('Using EnvSecretsProvider for secrets management');
      return new EnvSecretsProvider();

    case 'vault': {
      const vaultUrl = process.env['VAULT_URL'];
      const vaultToken = process.env['VAULT_TOKEN'];
      const vaultNamespace = process.env['VAULT_NAMESPACE'];

      if (!vaultUrl || !vaultToken) {
        throw new Error(
          'VaultSecretsProvider requires VAULT_URL and VAULT_TOKEN environment variables'
        );
      }

      logger.info('Using VaultSecretsProvider for secrets management', {
        vaultUrl,
        namespace: vaultNamespace || 'default',
      });
      return new VaultSecretsProvider(vaultUrl, vaultToken, vaultNamespace);
    }

    case 'aws': {
      const region = process.env['AWS_SECRETS_REGION'];

      if (!region) {
        throw new Error('AwsSecretsManagerProvider requires AWS_SECRETS_REGION environment variable');
      }

      logger.info('Using AwsSecretsManagerProvider for secrets management', { region });
      return new AwsSecretsManagerProvider(region);
    }

    case 'composite': {
      // Composite mode: chain env, vault (if configured), and aws (if configured)
      const providers: SecretsProvider[] = [new EnvSecretsProvider()];

      const vaultUrl = process.env['VAULT_URL'];
      const vaultToken = process.env['VAULT_TOKEN'];
      if (vaultUrl && vaultToken) {
        logger.info('Adding VaultSecretsProvider to composite chain');
        providers.push(
          new VaultSecretsProvider(
            vaultUrl,
            vaultToken,
            process.env['VAULT_NAMESPACE']
          )
        );
      }

      const awsRegion = process.env['AWS_SECRETS_REGION'];
      if (awsRegion) {
        logger.info('Adding AwsSecretsManagerProvider to composite chain');
        providers.push(new AwsSecretsManagerProvider(awsRegion));
      }

      logger.info('Using CompositeSecretsProvider (chained)', {
        providerCount: providers.length,
      });
      return new CompositeSecretsProvider(providers);
    }

    default:
      throw new Error(
        `Unknown SECRETS_PROVIDER: ${providerType}. Valid options: env, vault, aws, composite`
      );
  }
}

/**
 * Singleton instance of the configured SecretsProvider
 * Initialized once at startup and reused throughout the application
 */
let secretsProviderInstance: SecretsProvider | null = null;

/**
 * Get the global SecretsProvider instance (lazy-initialized on first call)
 * @returns The configured SecretsProvider
 */
export function getSecretsProvider(): SecretsProvider {
  if (secretsProviderInstance === null) {
    secretsProviderInstance = createSecretsProvider();
  }
  return secretsProviderInstance;
}

/**
 * Reset the global instance (useful for testing)
 */
export function resetSecretsProvider(): void {
  secretsProviderInstance = null;
}
