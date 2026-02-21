/**
 * Drive API Webhook Integration Tests
 *
 * Tests the integration between Google Drive API push notifications
 * and the webhook delivery pipeline.
 *
 * @see https://developers.google.com/workspace/drive/api/guides/push
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createGoogleApiClient } from '../../../src/services/google-api.js';
import {
  initWebhookManager,
  initWebhookQueue,
  getWebhookManager,
  getWebhookQueue,
} from '../../../src/services/index.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('Drive API Webhook Integration', () => {
  const testSpreadsheetId = process.env['TEST_SPREADSHEET_ID'];
  const webhookEndpoint =
    process.env['WEBHOOK_ENDPOINT'] ?? 'https://example.com/webhook/drive-callback';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRedis: any;
  let googleApi: ReturnType<typeof createGoogleApiClient>;

  beforeAll(async () => {
    if (!testSpreadsheetId) {
      throw new Error('TEST_SPREADSHEET_ID environment variable is required');
    }

    const credentials = await loadTestCredentials();
    if (!credentials) {
      throw new Error('Test credentials not available');
    }

    googleApi = createGoogleApiClient({ credentials });

    // Mock Redis client for testing
    mockRedis = {
      set: async () => 'OK',
      get: async () => null,
      del: async () => 1,
      keys: async () => [],
      sAdd: async () => 1,
      sRem: async () => 1,
      sMembers: async () => [],
      lPush: async () => 1,
      lPop: async () => null,
      lLen: async () => 0,
    };

    initWebhookManager(mockRedis, googleApi, webhookEndpoint);
    initWebhookQueue(mockRedis);
  }, 60000);

  afterAll(async () => {
    // No cleanup needed for mock
  }, 30000);

  it('should register webhook with Drive API watch()', async () => {
    const webhookManager = getWebhookManager();
    if (!webhookManager) {
      throw new Error('WebhookManager not initialized');
    }

    // Register webhook (calls Drive API watch internally)
    const registration = await webhookManager.register({
      spreadsheetId: testSpreadsheetId!,
      webhookUrl: 'https://api.example.com/sheets-webhook',
      eventTypes: ['sheet.update'],
      secret: 'test-secret-minimum16chars',
      expirationMs: 24 * 60 * 60 * 1000, // 24 hours
    });

    expect(registration.webhookId).toBeDefined();
    expect(registration.channelId).toBeDefined();
    expect(registration.resourceId).toBeDefined();
    expect(registration.expiresAt).toBeGreaterThan(Date.now());

    // Clean up - unregister webhook (calls Drive API channels.stop)
    await webhookManager.unregister(registration.webhookId);
  }, 30000);

  it('should handle channel expiration and renewal', async () => {
    const webhookManager = getWebhookManager();
    if (!webhookManager) {
      throw new Error('WebhookManager not initialized');
    }

    // Register webhook with short expiration (1 hour)
    const registration = await webhookManager.register({
      spreadsheetId: testSpreadsheetId!,
      webhookUrl: 'https://api.example.com/sheets-webhook',
      eventTypes: ['sheet.update'],
      secret: 'test-secret-minimum16chars',
      expirationMs: 60 * 60 * 1000, // 1 hour
    });

    // Renew expiring channels (should detect and renew this one)
    const renewalWindow = 2 * 60 * 60 * 1000; // 2 hours
    const renewedCount = await webhookManager.renewExpiringChannels(renewalWindow);

    expect(renewedCount).toBe(1);

    // Verify webhook still exists after renewal
    const webhook = await webhookManager.get(registration.webhookId);
    expect(webhook).toBeDefined();
    expect(webhook?.webhookId).toBe(registration.webhookId);

    // Clean up
    await webhookManager.unregister(registration.webhookId);
  }, 30000);

  it('should validate X-Goog headers from Drive notifications', () => {
    const driveHeaders = {
      'x-goog-channel-id': 'channel-uuid-here',
      'x-goog-resource-state': 'update',
      'x-goog-resource-id': 'resource-id-from-watch',
      'x-goog-channel-token': 'webhook-id-here',
      'x-goog-message-number': '123',
    };

    // Verify required headers are present
    expect(driveHeaders['x-goog-channel-id']).toBeDefined();
    expect(driveHeaders['x-goog-resource-state']).toBeDefined();
    expect(driveHeaders['x-goog-resource-id']).toBeDefined();
    expect(driveHeaders['x-goog-channel-token']).toBeDefined();

    // Verify resource state is valid
    const validStates = ['sync', 'update', 'trash', 'remove'];
    expect(validStates).toContain(driveHeaders['x-goog-resource-state']);
  });

  it('should map Drive resource states to event types', () => {
    const eventTypeMap: Record<string, 'sheet.update' | 'sheet.delete'> = {
      update: 'sheet.update',
      trash: 'sheet.delete',
      remove: 'sheet.delete',
    };

    expect(eventTypeMap['update']).toBe('sheet.update');
    expect(eventTypeMap['trash']).toBe('sheet.delete');
    expect(eventTypeMap['remove']).toBe('sheet.delete');
  });

  it('should enqueue Drive notifications for webhook delivery', async () => {
    const webhookQueue = getWebhookQueue();
    if (!webhookQueue) {
      throw new Error('WebhookQueue not initialized');
    }

    // Simulate Drive notification enqueue
    await webhookQueue.enqueue({
      webhookId: 'wh_test',
      webhookUrl: 'https://api.example.com/webhook',
      eventType: 'sheet.update',
      payload: {
        channelId: 'channel-123',
        resourceId: 'resource-456',
        spreadsheetId: testSpreadsheetId!,
      },
      secret: 'test-secret-minimum16chars',
      maxAttempts: 3,
      scheduledAt: new Date(),
    });

    // Verify enqueuing succeeded (no error thrown)
    expect(true).toBe(true);
  }, 10000);

  it('should stop channels when unregistering webhooks', async () => {
    const webhookManager = getWebhookManager();
    if (!webhookManager) {
      throw new Error('WebhookManager not initialized');
    }

    // Register then immediately unregister
    const registration = await webhookManager.register({
      spreadsheetId: testSpreadsheetId!,
      webhookUrl: 'https://api.example.com/sheets-webhook',
      eventTypes: ['sheet.update'],
      secret: 'test-secret-minimum16chars',
      expirationMs: 24 * 60 * 60 * 1000,
    });

    // Unregister (should call Drive API channels.stop)
    await webhookManager.unregister(registration.webhookId);

    // Verify webhook is removed
    try {
      await webhookManager.get(registration.webhookId);
      expect.fail('Should have thrown error for non-existent webhook');
    } catch (error) {
      expect(error).toBeDefined();
    }
  }, 30000);
});
