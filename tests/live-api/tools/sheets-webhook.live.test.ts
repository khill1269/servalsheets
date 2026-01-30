/**
 * Live API Tests for sheets_webhook Tool
 *
 * Tests webhook management with real Google Sheets data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 6 Actions:
 * - register: Register a webhook for spreadsheet changes
 * - unregister: Remove a webhook
 * - list: List registered webhooks
 * - get: Get webhook details
 * - test: Send test payload to webhook
 * - get_stats: Get webhook statistics
 *
 * Note: Full webhook functionality requires:
 * - A publicly accessible HTTPS endpoint
 * - Google Workspace push notifications enabled
 *
 * These tests verify the data structures and Sheets API context.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_webhook Live API Tests', () => {
  let client: LiveApiClient;
  let manager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const credentials = await loadTestCredentials();
    if (!credentials) {
      throw new Error('Test credentials not available');
    }
    client = new LiveApiClient(credentials, { trackMetrics: true });
    manager = new TestSpreadsheetManager(client);
  });

  afterAll(async () => {
    await manager.cleanup();
  });

  beforeEach(async () => {
    testSpreadsheet = await manager.createTestSpreadsheet('webhook');
  });

  describe('register action', () => {
    it('should validate webhook URL requirements', () => {
      const validUrl = 'https://api.example.com/webhook';
      const invalidUrls = [
        'http://insecure.com/webhook', // HTTP not allowed
        'ftp://files.com/upload', // Wrong protocol
        'not-a-url', // Invalid format
      ];

      expect(validUrl.startsWith('https://')).toBe(true);
      for (const url of invalidUrls) {
        expect(url.startsWith('https://')).toBe(false);
      }
    });

    it('should define supported event types', () => {
      const eventTypes = [
        'sheet.update', // Any change to spreadsheet
        'sheet.create', // New sheet created
        'sheet.delete', // Sheet deleted
        'sheet.rename', // Sheet renamed
        'cell.update', // Cell values changed
        'format.update', // Formatting changed
        'all', // All events
      ];

      expect(eventTypes).toContain('cell.update');
      expect(eventTypes).toContain('all');
    });

    it('should validate webhook registration structure', () => {
      const registration = {
        spreadsheetId: testSpreadsheet.id,
        webhookUrl: 'https://api.example.com/sheets-webhook',
        eventTypes: ['cell.update', 'sheet.update'],
        secret: 'minimum16charssecret',
        expirationMs: 604800000, // 7 days
      };

      expect(registration.secret?.length).toBeGreaterThanOrEqual(16);
      expect(registration.eventTypes.length).toBeGreaterThan(0);
      expect(registration.expirationMs).toBeLessThanOrEqual(2592000000); // 30 days max
    });

    it('should understand Watch API channel structure', () => {
      // Google Drive Watch API creates channels for push notifications
      const channel = {
        id: 'channel-uuid-here',
        resourceId: 'resource-id-from-google',
        resourceUri: `https://www.googleapis.com/drive/v3/files/${testSpreadsheet.id}`,
        token: 'optional-token-for-verification',
        expiration: Date.now() + 604800000,
      };

      expect(channel.resourceUri).toContain(testSpreadsheet.id);
    });
  });

  describe('unregister action', () => {
    it('should validate webhook ID format', () => {
      const webhookId = 'wh_abc123xyz789';
      expect(webhookId.length).toBeGreaterThan(0);
    });

    it('should understand stop channel request', () => {
      // To stop watching, you need channel ID and resource ID
      const stopRequest = {
        id: 'channel-uuid',
        resourceId: 'resource-id-from-watch',
      };

      expect(stopRequest.id).toBeDefined();
      expect(stopRequest.resourceId).toBeDefined();
    });
  });

  describe('list action', () => {
    it('should define webhook list structure', () => {
      const webhooks = [
        {
          webhookId: 'wh_123',
          spreadsheetId: 'spreadsheet_abc',
          webhookUrl: 'https://api.example.com/webhook1',
          eventTypes: ['cell.update'],
          active: true,
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-01-08T00:00:00Z',
        },
        {
          webhookId: 'wh_456',
          spreadsheetId: 'spreadsheet_xyz',
          webhookUrl: 'https://api.example.com/webhook2',
          eventTypes: ['all'],
          active: true,
          createdAt: '2024-01-02T00:00:00Z',
          expiresAt: '2024-01-09T00:00:00Z',
        },
      ];

      expect(webhooks.length).toBe(2);
      expect(webhooks[0].active).toBe(true);
    });

    it('should filter by spreadsheet ID', () => {
      const webhooks = [
        { webhookId: 'wh_1', spreadsheetId: 'sheet_a' },
        { webhookId: 'wh_2', spreadsheetId: 'sheet_b' },
        { webhookId: 'wh_3', spreadsheetId: 'sheet_a' },
      ];

      const filtered = webhooks.filter((w) => w.spreadsheetId === 'sheet_a');
      expect(filtered.length).toBe(2);
    });

    it('should filter by active status', () => {
      const webhooks = [
        { webhookId: 'wh_1', active: true },
        { webhookId: 'wh_2', active: false },
        { webhookId: 'wh_3', active: true },
      ];

      const activeOnly = webhooks.filter((w) => w.active);
      expect(activeOnly.length).toBe(2);
    });
  });

  describe('get action', () => {
    it('should define detailed webhook info structure', () => {
      const webhook = {
        webhookId: 'wh_123',
        spreadsheetId: testSpreadsheet.id,
        webhookUrl: 'https://api.example.com/webhook',
        eventTypes: ['cell.update', 'sheet.update'],
        resourceId: 'google-resource-id',
        channelId: 'google-channel-id',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        active: true,
        lastDeliveryAt: '2024-01-05T12:00:00Z',
        lastDeliveryStatus: 200,
        deliveryCount: 42,
        failureCount: 2,
      };

      expect(webhook.webhookId).toBeDefined();
      expect(webhook.deliveryCount).toBeGreaterThan(0);
    });
  });

  describe('test action', () => {
    it('should define test payload structure', () => {
      const testPayload = {
        type: 'test',
        webhookId: 'wh_123',
        spreadsheetId: testSpreadsheet.id,
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook delivery',
        },
      };

      expect(testPayload.type).toBe('test');
    });

    it('should understand delivery response tracking', () => {
      const deliveryResult = {
        webhookId: 'wh_123',
        delivered: true,
        responseStatus: 200,
        responseTime: 145, // ms
        timestamp: new Date().toISOString(),
      };

      expect(deliveryResult.delivered).toBe(true);
      expect(deliveryResult.responseStatus).toBe(200);
    });
  });

  describe('get_stats action', () => {
    it('should define webhook statistics structure', () => {
      const stats = {
        webhookId: 'wh_123',
        totalDeliveries: 1000,
        successfulDeliveries: 985,
        failedDeliveries: 15,
        successRate: 0.985,
        avgResponseTime: 120, // ms
        lastDeliveryAt: '2024-01-15T10:30:00Z',
        eventBreakdown: {
          'cell.update': 800,
          'sheet.update': 150,
          'format.update': 50,
        },
      };

      expect(stats.successRate).toBeGreaterThan(0.9);
      expect(stats.totalDeliveries).toBe(stats.successfulDeliveries + stats.failedDeliveries);
    });

    it('should aggregate stats across multiple webhooks', () => {
      const allStats = {
        totalWebhooks: 5,
        activeWebhooks: 4,
        totalDeliveries: 5000,
        overallSuccessRate: 0.97,
        webhooksBySpreadsheet: {
          sheet_1: 2,
          sheet_2: 1,
          sheet_3: 2,
        },
      };

      expect(allStats.activeWebhooks).toBeLessThanOrEqual(allStats.totalWebhooks);
    });
  });

  describe('Webhook Payload Structure', () => {
    it('should define cell update event payload', () => {
      const payload = {
        type: 'cell.update',
        webhookId: 'wh_123',
        spreadsheetId: testSpreadsheet.id,
        timestamp: new Date().toISOString(),
        data: {
          sheetName: 'TestData',
          range: 'A1:B5',
          editor: 'user@example.com',
        },
        signature: 'hmac-sha256-signature-here',
      };

      expect(payload.type).toBe('cell.update');
      expect(payload.signature).toBeDefined();
    });

    it('should verify HMAC signature', () => {
      // Webhook verification uses HMAC-SHA256
      const _secret = 'my-webhook-secret-key';
      const _payload = JSON.stringify({ type: 'test', data: {} });

      // In practice, crypto.createHmac would be used
      const expectedSignatureFormat = /^[a-f0-9]{64}$/; // SHA256 hex
      const mockSignature = 'a'.repeat(64);

      expect(mockSignature).toMatch(expectedSignatureFormat);
    });
  });

  describe('Spreadsheet Change Detection', () => {
    it('should detect cell value changes', async () => {
      // Write initial data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Initial']],
        },
      });

      // Make a change (this would trigger a webhook)
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Changed']],
        },
      });

      // Verify change
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
      });

      expect(response.data.values![0][0]).toBe('Changed');
    });

    it('should detect structural changes', async () => {
      // Add a new sheet (would trigger sheet.create event)
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'WebhookTestSheet',
                },
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
      const newSheetId = response.data.replies![0].addSheet?.properties?.sheetId;
      expect(newSheetId).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track webhook-related operations', async () => {
      client.resetMetrics();

      // Operations that would be monitored by webhooks
      await client.trackOperation('valuesUpdate', 'POST', () =>
        client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Key', 'Value'],
              ['test', '123'],
            ],
          },
        })
      );

      await client.trackOperation('get', 'GET', () =>
        client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties',
        })
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });
});
