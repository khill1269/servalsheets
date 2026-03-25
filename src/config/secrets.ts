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
import { ConfigError } from '../core/errors.js';

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
 * VaultSecretsProvider: HashiCorp Vault KV v2 integration.
 *
 * Retrieves secrets from Vault's KV v2 engine at path `secret/data/{key}`.
 * Uses Node.js built-in fetch (no external deps). TTL-aware in-memory cache
 * avoids redundant network calls for frequently accessed secrets.
 *
 * Authentication: Token-based (VAULT_TOKEN). For production, use a renewable
 * token issued by AppRole, Kubernetes auth, or JWT auth method.
 *
 * Required env vars: VAULT_URL, VAULT_TOKEN
 * Optional env vars: VAULT_NAMESPACE, VAULT_MOUNT (default: 'secret'), VAULT_CACHE_TTL_MS (default: 300000)
 */
export class VaultSecretsProvider implements SecretsProvider {
  private readonly vaultUrl: string;
  private readonly vaultToken: string;
  private readonly vaultNamespace: string | undefined;
  private readonly mountPath: string;
  private readonly cacheTtlMs: number;
  private readonly cache: Map<string, { value: string; expiresAt: number }> = new Map();

  constructor(vaultUrl: string, vaultToken: string, vaultNamespace?: string) {
    this.vaultUrl = vaultUrl.replace(/\/+$/, ''); // strip trailing slashes
    this.vaultToken = vaultToken;
    this.vaultNamespace = vaultNamespace;
    this.mountPath = process.env['VAULT_MOUNT'] || 'secret';
    this.cacheTtlMs = parseInt(process.env['VAULT_CACHE_TTL_MS'] || '300000', 10);
  }

  async getSecret(key: string): Promise<string | undefined> {
    // Check TTL cache first
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    this.cache.delete(key); // expired or missing

    try {
      const url = `${this.vaultUrl}/v1/${this.mountPath}/data/${encodeURIComponent(key)}`;
      const headers: Record<string, string> = {
        'X-Vault-Token': this.vaultToken,
        Accept: 'application/json',
      };
      if (this.vaultNamespace) {
        headers['X-Vault-Namespace'] = this.vaultNamespace;
      }

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });

      if (response.status === 404) {
        return undefined; // Secret not found — normal flow
      }
      if (!response.ok) {
        logger.error('Vault secret retrieval failed', {
          key,
          status: response.status,
          statusText: response.statusText,
        });
        return undefined;
      }

      const body = (await response.json()) as {
        data?: { data?: Record<string, string> };
      };
      const value = body?.data?.data?.['value'];
      if (value !== undefined) {
        this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
      }
      return value;
    } catch (error) {
      logger.error('Vault request error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async hasSecret(key: string): Promise<boolean> {
    const value = await this.getSecret(key);
    return value !== undefined;
  }
}

/**
 * AwsSecretsManagerProvider: AWS Secrets Manager integration.
 *
 * Uses dynamic import of @aws-sdk/client-secrets-manager to avoid hard dependency.
 * Falls back gracefully if the SDK is not installed. TTL-aware in-memory cache
 * prevents redundant API calls.
 *
 * Authentication: Uses default AWS credential chain (IAM roles, env vars,
 * ~/.aws/credentials, IRSA, ECS task role). No explicit credential config needed.
 *
 * Required env vars: AWS_SECRETS_REGION
 * Optional env vars: AWS_SECRETS_CACHE_TTL_MS (default: 300000)
 */
export class AwsSecretsManagerProvider implements SecretsProvider {
  private readonly region: string;
  private readonly cacheTtlMs: number;
  private readonly cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private client: unknown = null;
  private sdkUnavailable = false;

  constructor(region: string) {
    this.region = region;
    this.cacheTtlMs = parseInt(process.env['AWS_SECRETS_CACHE_TTL_MS'] || '300000', 10);
  }

  /**
   * Lazily initialize the AWS SDK client via dynamic import.
   * Returns null if the SDK is not installed (optional dependency).
   */
  private async getClient(): Promise<unknown> {
    if (this.client) return this.client;
    if (this.sdkUnavailable) return null;

    try {
      // Dynamic import — @aws-sdk/client-secrets-manager is an optional peer dependency
      const sdk = await import('@aws-sdk/client-secrets-manager');
      this.client = new sdk.SecretsManagerClient({ region: this.region });
      return this.client;
    } catch {
      this.sdkUnavailable = true;
      logger.warn(
        'AWS Secrets Manager SDK not available. Install @aws-sdk/client-secrets-manager to enable.',
        { region: this.region }
      );
      return null;
    }
  }

  async getSecret(key: string): Promise<string | undefined> {
    // Check TTL cache first
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    this.cache.delete(key); // expired or missing

    const client = await this.getClient();
    if (!client) return undefined;

    try {
      // Use dynamic import to get the command class
      const sdk = await import('@aws-sdk/client-secrets-manager');
      const command = new sdk.GetSecretValueCommand({ SecretId: key });
      const response = await (client as InstanceType<typeof sdk.SecretsManagerClient>).send(
        command
      );
      const value = response.SecretString;
      if (value !== undefined) {
        this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
      }
      return value;
    } catch (error) {
      // ResourceNotFoundException means the secret doesn't exist — not an error
      if (error instanceof Error && error.name === 'ResourceNotFoundException') {
        return undefined;
      }
      logger.error('AWS Secrets Manager retrieval failed', {
        key,
        region: this.region,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async hasSecret(key: string): Promise<boolean> {
    const value = await this.getSecret(key);
    return value !== undefined;
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
      throw new ConfigError(
        'CompositeSecretsProvider requires at least one provider',
        'SECRETS_PROVIDER'
      );
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
        throw new ConfigError(
          'VaultSecretsProvider requires VAULT_URL and VAULT_TOKEN environment variables',
          'VAULT_URL'
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
        throw new ConfigError(
          'AwsSecretsManagerProvider requires AWS_SECRETS_REGION environment variable',
          'AWS_SECRETS_REGION'
        );
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
          new VaultSecretsProvider(vaultUrl, vaultToken, process.env['VAULT_NAMESPACE'])
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
      throw new ConfigError(
        `Unknown SECRETS_PROVIDER: ${providerType}. Valid options: env, vault, aws, composite`,
        'SECRETS_PROVIDER'
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
