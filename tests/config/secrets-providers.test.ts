import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EnvSecretsProvider,
  VaultSecretsProvider,
  AwsSecretsManagerProvider,
  CompositeSecretsProvider,
  createSecretsProvider,
  resetSecretsProvider,
} from '../../src/config/secrets.js';

// Suppress logger output during tests
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('EnvSecretsProvider', () => {
  it('returns value from provided env object', async () => {
    const provider = new EnvSecretsProvider({ MY_SECRET: 'abc123' } as NodeJS.ProcessEnv);
    expect(await provider.getSecret('MY_SECRET')).toBe('abc123');
  });

  it('returns undefined for missing key', async () => {
    const provider = new EnvSecretsProvider({} as NodeJS.ProcessEnv);
    expect(await provider.getSecret('MISSING')).toBeUndefined();
  });

  it('hasSecret returns true for existing key', async () => {
    const provider = new EnvSecretsProvider({ KEY: 'val' } as NodeJS.ProcessEnv);
    expect(await provider.hasSecret('KEY')).toBe(true);
  });

  it('hasSecret returns false for missing key', async () => {
    const provider = new EnvSecretsProvider({} as NodeJS.ProcessEnv);
    expect(await provider.hasSecret('MISSING')).toBe(false);
  });
});

describe('VaultSecretsProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('fetches secret from Vault KV v2 endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { data: { value: 'vault-secret' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com', 'test-token');
    const result = await provider.getSecret('MY_KEY');

    expect(result).toBe('vault-secret');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://vault.example.com/v1/secret/data/MY_KEY',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Vault-Token': 'test-token',
        }),
      })
    );
  });

  it('returns undefined for 404 (secret not found)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('not found', { status: 404 })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com', 'test-token');
    expect(await provider.getSecret('MISSING')).toBeUndefined();
  });

  it('returns undefined on server error', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('internal error', { status: 500, statusText: 'Internal Server Error' })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com', 'test-token');
    expect(await provider.getSecret('KEY')).toBeUndefined();
  });

  it('returns undefined on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const provider = new VaultSecretsProvider('https://vault.example.com', 'test-token');
    expect(await provider.getSecret('KEY')).toBeUndefined();
  });

  it('caches secrets and serves from cache on repeat calls', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { data: { value: 'cached-val' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com', 'test-token');
    await provider.getSecret('KEY');
    const cachedResult = await provider.getSecret('KEY');

    expect(cachedResult).toBe('cached-val');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only one network call
  });

  it('includes X-Vault-Namespace header when namespace is set', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { data: { value: 'ns-val' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com', 'tok', 'my-ns');
    await provider.getSecret('KEY');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Vault-Namespace': 'my-ns',
        }),
      })
    );
  });

  it('strips trailing slashes from vault URL', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { data: { value: 'v' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com///', 'tok');
    await provider.getSecret('K');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://vault.example.com/v1/secret/data/K',
      expect.any(Object)
    );
  });

  it('hasSecret delegates to getSecret', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { data: { value: 'yes' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const provider = new VaultSecretsProvider('https://vault.example.com', 'tok');
    expect(await provider.hasSecret('KEY')).toBe(true);
  });
});

describe('CompositeSecretsProvider', () => {
  it('throws ConfigError when no providers are given', () => {
    expect(() => new CompositeSecretsProvider([])).toThrow(/at least one provider/i);
  });

  it('returns first provider result (short-circuit)', async () => {
    const p1 = new EnvSecretsProvider({ KEY: 'from-p1' } as NodeJS.ProcessEnv);
    const p2 = new EnvSecretsProvider({ KEY: 'from-p2' } as NodeJS.ProcessEnv);
    const composite = new CompositeSecretsProvider([p1, p2]);

    expect(await composite.getSecret('KEY')).toBe('from-p1');
  });

  it('falls through to next provider when first returns undefined', async () => {
    const p1 = new EnvSecretsProvider({} as NodeJS.ProcessEnv);
    const p2 = new EnvSecretsProvider({ KEY: 'from-p2' } as NodeJS.ProcessEnv);
    const composite = new CompositeSecretsProvider([p1, p2]);

    expect(await composite.getSecret('KEY')).toBe('from-p2');
  });

  it('returns undefined when all providers exhausted', async () => {
    const p1 = new EnvSecretsProvider({} as NodeJS.ProcessEnv);
    const p2 = new EnvSecretsProvider({} as NodeJS.ProcessEnv);
    const composite = new CompositeSecretsProvider([p1, p2]);

    expect(await composite.getSecret('NOPE')).toBeUndefined();
  });

  it('hasSecret returns true if any provider has the secret', async () => {
    const p1 = new EnvSecretsProvider({} as NodeJS.ProcessEnv);
    const p2 = new EnvSecretsProvider({ FOUND: '1' } as NodeJS.ProcessEnv);
    const composite = new CompositeSecretsProvider([p1, p2]);

    expect(await composite.hasSecret('FOUND')).toBe(true);
  });
});

describe('createSecretsProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetSecretsProvider();
  });

  it('defaults to EnvSecretsProvider', () => {
    process.env = { ...originalEnv };
    delete process.env['SECRETS_PROVIDER'];
    const provider = createSecretsProvider();
    expect(provider).toBeInstanceOf(EnvSecretsProvider);
  });

  it('creates VaultSecretsProvider when configured', () => {
    process.env = {
      ...originalEnv,
      SECRETS_PROVIDER: 'vault',
      VAULT_URL: 'https://vault.test',
      VAULT_TOKEN: 'tok',
    };
    const provider = createSecretsProvider();
    expect(provider).toBeInstanceOf(VaultSecretsProvider);
  });

  it('throws when vault is selected but VAULT_URL is missing', () => {
    process.env = {
      ...originalEnv,
      SECRETS_PROVIDER: 'vault',
      VAULT_TOKEN: 'tok',
    };
    delete process.env['VAULT_URL'];
    expect(() => createSecretsProvider()).toThrow(/VAULT_URL/);
  });

  it('creates AwsSecretsManagerProvider when configured', () => {
    process.env = {
      ...originalEnv,
      SECRETS_PROVIDER: 'aws',
      AWS_SECRETS_REGION: 'us-east-1',
    };
    const provider = createSecretsProvider();
    expect(provider).toBeInstanceOf(AwsSecretsManagerProvider);
  });

  it('throws when aws is selected but region is missing', () => {
    process.env = {
      ...originalEnv,
      SECRETS_PROVIDER: 'aws',
    };
    delete process.env['AWS_SECRETS_REGION'];
    expect(() => createSecretsProvider()).toThrow(/AWS_SECRETS_REGION/);
  });

  it('creates CompositeSecretsProvider with env as base', () => {
    process.env = {
      ...originalEnv,
      SECRETS_PROVIDER: 'composite',
    };
    const provider = createSecretsProvider();
    expect(provider).toBeInstanceOf(CompositeSecretsProvider);
  });

  it('throws on unknown provider type', () => {
    process.env = {
      ...originalEnv,
      SECRETS_PROVIDER: 'unknown',
    };
    expect(() => createSecretsProvider()).toThrow(/Unknown SECRETS_PROVIDER/);
  });
});
