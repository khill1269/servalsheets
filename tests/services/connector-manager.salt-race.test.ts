import { afterEach, describe, expect, it, vi } from 'vitest';

class StubConnector {
  readonly id = 'stub';
  readonly name = 'Stub';
  readonly description = 'Stub connector for tests';
  readonly authType = 'api_key' as const;

  isConfigured(): boolean {
    return true;
  }

  async configure(): Promise<void> {}
  async healthCheck() {
    return {
      healthy: true,
      latencyMs: 1,
      message: 'ok',
      lastChecked: new Date().toISOString(),
    };
  }
  async dispose(): Promise<void> {}
  async listEndpoints() {
    return [];
  }
  async getSchema() {
    return { endpoint: 'stub', columns: [] };
  }
  async query() {
    return {
      headers: [],
      rows: [],
      metadata: {
        source: 'stub',
        endpoint: 'stub',
        fetchedAt: new Date().toISOString(),
        rowCount: 0,
        cached: false,
        quotaUsed: 0,
      },
    };
  }
  getQuotaUsage() {
    return {
      used: 0,
      limit: 1,
      resetAt: new Date().toISOString(),
      unit: 'requests',
    };
  }
  getRateLimits() {
    return { requestsPerMinute: 1 };
  }
}

describe('ConnectorManager salt persistence', () => {
  afterEach(() => {
    delete process.env['CONNECTOR_ENCRYPTION_KEY'];
    delete process.env['CONNECTOR_CONFIG_DIR'];
    vi.resetModules();
    vi.doUnmock('fs');
  });

  it('reuses the persisted salt when another process wins the salt-file race', async () => {
    process.env['CONNECTOR_ENCRYPTION_KEY'] = 'unit-test-secret';
    process.env['CONNECTOR_CONFIG_DIR'] = '/virtual/connectors';

    let persistedConfig = '';
    const existingSalt = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
    const missingSaltError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const saltExistsError = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    let saltReadCount = 0;

    vi.doMock('fs', () => ({
      readFileSync: vi.fn(() => {
        saltReadCount++;
        if (saltReadCount === 1) {
          throw missingSaltError;
        }
        return existingSalt;
      }),
      writeFileSync: vi.fn(() => {
        throw saltExistsError;
      }),
      mkdirSync: vi.fn(),
      promises: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn(async (_filePath: string, content: string) => {
          persistedConfig = content;
        }),
        readdir: vi.fn().mockResolvedValue(['stub.json']),
        readFile: vi.fn().mockImplementation(async () => persistedConfig),
        unlink: vi.fn().mockResolvedValue(undefined),
      },
    }));

    const { ConnectorManager } = await import('../../src/connectors/connector-manager.js');

    const manager = new ConnectorManager('/virtual/connectors');
    manager.register(new StubConnector() as any);

    const configureResult = await manager.configure('stub', {
      apiKey: 'secret-api-key',
    });
    expect(configureResult.success).toBe(true);

    const restoredManager = new ConnectorManager('/virtual/connectors');
    const restoredConnector = new StubConnector();
    const configureSpy = vi.spyOn(restoredConnector, 'configure');
    restoredManager.register(restoredConnector as any);

    const restoredCount = await restoredManager.restorePersistedConfigs();

    expect(restoredCount).toBe(1);
    expect(configureSpy).toHaveBeenCalledWith({ apiKey: 'secret-api-key' });
  });
});
