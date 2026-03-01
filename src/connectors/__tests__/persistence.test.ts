/**
 * Tests for P5.1 (Persistent Connector Configuration) & P5.2 (Persistent Subscriptions)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectorManager } from '../connector-manager.js';
import type { SpreadsheetConnector, ConnectorCredentials } from '../types.js';

// Mock connector for testing
class MockConnector implements SpreadsheetConnector {
  id = 'test_mock';
  name = 'Mock Test Connector';
  description = 'Test connector';
  authType = 'api_key';
  private isConfig = false;

  isConfigured(): boolean {
    return this.isConfig;
  }

  getRateLimits() {
    return { requestsPerMinute: 60, requestsPerDay: 10000 };
  }

  async configure(credentials: ConnectorCredentials): Promise<void> {
    if (!credentials.apiKey) {
      throw new Error('API key required');
    }
    this.isConfig = true;
  }

  async query() {
    return { headers: ['col1'], rows: [['val1']], metadata: { rowCount: 1 } };
  }

  async listEndpoints() {
    return [];
  }

  async getSchema() {
    return { fields: [] };
  }

  async healthCheck() {
    return {
      healthy: true,
      latencyMs: 10,
      message: 'OK',
      lastChecked: new Date().toISOString(),
    };
  }

  async dispose(): Promise<void> {
    // no-op
  }
}

describe('P5.1: Persistent Connector Configuration', () => {
  let configDir: string;
  let manager: ConnectorManager;

  beforeEach(() => {
    // Use temp directory for testing
    configDir = path.join(process.cwd(), '.serval', 'test-connectors');
  });

  afterEach(async () => {
    // Clean up
    if (manager) {
      await manager.dispose();
    }
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('should persist connector configuration to disk', async () => {
    manager = new ConnectorManager(configDir);
    const connector = new MockConnector();
    manager.register(connector);

    const credentials: ConnectorCredentials = { apiKey: 'test-key-123' };
    const result = await manager.configure('test_mock', credentials);

    expect(result.success).toBe(true);

    // Verify file was created
    const configFile = path.join(configDir, 'test_mock.json');
    expect(fs.existsSync(configFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    expect(content.connectorId).toBe('test_mock');
    expect(content.credentials.apiKey).toBe('test-key-123');
    expect(content.configuredAt).toBeDefined();
  });

  it('should restore persisted configurations on initialize', async () => {
    // First manager: configure and save
    manager = new ConnectorManager(configDir);
    const connector1 = new MockConnector();
    manager.register(connector1);

    await manager.configure('test_mock', { apiKey: 'persisted-key' });
    await manager.dispose();

    // Second manager: should restore
    manager = new ConnectorManager(configDir);
    const connector2 = new MockConnector();
    manager.register(connector2);

    const before = manager.listConnectors();
    expect(before[0].configured).toBe(false); // Not yet restored

    await manager.initialize();

    const after = manager.listConnectors();
    expect(after[0].configured).toBe(true); // Restored!
  });

  it('should handle missing configuration directory', async () => {
    manager = new ConnectorManager(configDir);
    const connector = new MockConnector();
    manager.register(connector);

    // Directory doesn't exist yet
    expect(fs.existsSync(configDir)).toBe(false);

    // Should create directory and save config
    await manager.configure('test_mock', { apiKey: 'key' });

    expect(fs.existsSync(configDir)).toBe(true);
  });
});

describe('P5.2: Persistent Subscriptions', () => {
  let configDir: string;
  let manager: ConnectorManager;

  beforeEach(() => {
    configDir = path.join(process.cwd(), '.serval', 'test-subscriptions');
  });

  afterEach(async () => {
    if (manager) {
      await manager.dispose();
    }
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('should persist subscriptions to disk', async () => {
    manager = new ConnectorManager(configDir);
    const connector = new MockConnector();
    manager.register(connector);
    await manager.configure('test_mock', { apiKey: 'key' });

    const sub = manager.subscribe(
      'test_mock',
      'endpoint',
      { param: 'value' },
      { interval: 'hourly' },
      {
        spreadsheetId: 'ss-123',
        range: 'A1:B10',
      }
    );

    // Verify file was created
    const subFile = path.join(configDir, `${sub.id}.json`);
    expect(fs.existsSync(subFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(subFile, 'utf-8'));
    expect(content.id).toBe(sub.id);
    expect(content.endpoint).toBe('endpoint');
    expect(content.createdAt).toBeDefined();
  });

  it('should restore subscriptions on initialize', async () => {
    // First manager: create subscription
    manager = new ConnectorManager(configDir);
    const connector1 = new MockConnector();
    manager.register(connector1);
    await manager.configure('test_mock', { apiKey: 'key' });

    const subId = manager.subscribe(
      'test_mock',
      'endpoint',
      { param: 'value' },
      { interval: 'hourly' },
      {
        spreadsheetId: 'ss-123',
        range: 'A1:B10',
      }
    ).id;

    await manager.dispose();

    // Second manager: should restore
    manager = new ConnectorManager(configDir);
    const connector2 = new MockConnector();
    manager.register(connector2);
    await manager.configure('test_mock', { apiKey: 'key' });

    const before = manager.listSubscriptions();
    expect(before).toHaveLength(0); // Not yet restored

    await manager.initialize();

    const after = manager.listSubscriptions();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(subId);
    expect(after[0].endpoint).toBe('endpoint');
    expect(after[0].status).toBe('active');
  });

  it('should delete persisted subscription when unsubscribed', async () => {
    manager = new ConnectorManager(configDir);
    const connector = new MockConnector();
    manager.register(connector);
    await manager.configure('test_mock', { apiKey: 'key' });

    const sub = manager.subscribe(
      'test_mock',
      'endpoint',
      { param: 'value' },
      { interval: 'hourly' },
      {
        spreadsheetId: 'ss-123',
        range: 'A1:B10',
      }
    );

    const subFile = path.join(configDir, `${sub.id}.json`);
    expect(fs.existsSync(subFile)).toBe(true);

    manager.unsubscribe(sub.id);

    // File should be deleted
    expect(fs.existsSync(subFile)).toBe(false);
  });

  it('should preserve nextId to prevent subscription ID collisions', async () => {
    manager = new ConnectorManager(configDir);
    const connector = new MockConnector();
    manager.register(connector);
    await manager.configure('test_mock', { apiKey: 'key' });

    // Create first subscription
    const sub1 = manager.subscribe(
      'test_mock',
      'endpoint',
      { param: 'value' },
      { interval: 'hourly' },
      {
        spreadsheetId: 'ss-123',
        range: 'A1:B10',
      }
    );
    expect(sub1.id).toBe('sub_1');

    await manager.dispose();

    // Restore and create new subscription
    manager = new ConnectorManager(configDir);
    manager.register(new MockConnector());
    await manager.configure('test_mock', { apiKey: 'key' });
    await manager.initialize();

    const sub2 = manager.subscribe(
      'test_mock',
      'endpoint',
      { param: 'value2' },
      { interval: 'daily' },
      {
        spreadsheetId: 'ss-456',
        range: 'C1:D10',
      }
    );

    // Should be sub_2, not sub_1 (which would be a collision)
    expect(sub2.id).toBe('sub_2');
  });
});

describe('Integration: Config + Subscriptions together', () => {
  let configDir: string;
  let manager: ConnectorManager;

  beforeEach(() => {
    configDir = path.join(process.cwd(), '.serval', 'test-integration');
  });

  afterEach(async () => {
    if (manager) {
      await manager.dispose();
    }
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('should restore both configs and subscriptions on startup', async () => {
    // Session 1: Set up connector with subscription
    manager = new ConnectorManager(configDir);
    const connector1 = new MockConnector();
    manager.register(connector1);
    await manager.configure('test_mock', { apiKey: 'production-key' });

    const sub1 = manager.subscribe(
      'test_mock',
      'market_data',
      { symbol: 'AAPL' },
      { interval: 'hourly' },
      {
        spreadsheetId: 'ss-production',
        range: 'Sheet1!A1:C100',
      }
    );

    expect(manager.listSubscriptions()).toHaveLength(1);
    await manager.dispose();

    // Session 2: Verify everything is restored
    manager = new ConnectorManager(configDir);
    const connector2 = new MockConnector();
    manager.register(connector2);

    // Before initialize: nothing restored
    expect(manager.listConnectors()[0].configured).toBe(false);
    expect(manager.listSubscriptions()).toHaveLength(0);

    // After initialize: everything restored
    await manager.initialize();

    expect(manager.listConnectors()[0].configured).toBe(true);
    const subs = manager.listSubscriptions();
    expect(subs).toHaveLength(1);
    expect(subs[0].id).toBe(sub1.id);
    expect(subs[0].destination.range).toBe('Sheet1!A1:C100');
  });
});
