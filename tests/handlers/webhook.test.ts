/**
 * ServalSheets - Webhook Handler Tests
 *
 * Tests for sheets_webhook handler (11 actions):
 * register, unregister, list, get, test, get_stats,
 * watch_changes, subscribe_workspace, reactivate_workspace,
 * unsubscribe_workspace, list_workspace_subscriptions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebhookHandler, createWebhookHandler } from '../../src/handlers/webhooks.js';
import {
  initWebhookManager,
  resetWebhookManager,
} from '../../src/services/webhook-manager.js';
import { initWebhookQueue, resetWebhookQueue } from '../../src/services/webhook-queue.js';
import type { GoogleApiClient } from '../../src/services/google-api.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/services/webhook-url-validation.js', () => ({
  validateWebhookUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/resources/notifications.js', () => ({
  resourceNotifications: {
    notifyResourceListChanged: vi.fn(),
  },
}));

vi.mock('../../src/mcp/completions.js', () => ({
  recordWebhookId: vi.fn(),
}));

vi.mock('../../src/observability/metrics.js', () => ({
  recordWebhookRenewal: vi.fn(),
  updateActiveWebhookCount: vi.fn(),
}));


const createMockDriveApi = () => ({
  files: {
    watch: vi.fn().mockResolvedValue({
      data: {
        resourceId: 'resource-abc',
        channelId: 'channel-xyz',
        expiration: String(Date.now() + 43200000),
      },
    }),
  },
});

const createMockWorkspaceEventsService = () => ({
  createSubscription: vi.fn().mockResolvedValue({
    id: 'subscriptions/sub-123',
    spreadsheetId: 'spread-id',
    notificationEndpoint: 'projects/proj/topics/topic',
    expireTime: '2026-12-31T00:00:00Z',
    createdAt: '2026-04-26T00:00:00Z',
  }),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  reactivateSubscription: vi.fn().mockResolvedValue({
    id: 'subscriptions/sub-123',
    spreadsheetId: 'spread-id',
    notificationEndpoint: 'projects/proj/topics/topic',
    expireTime: '2026-12-31T00:00:00Z',
    createdAt: '2026-04-26T00:00:00Z',
  }),
  listSubscriptions: vi.fn().mockReturnValue([
    {
      id: 'subscriptions/sub-123',
      spreadsheetId: 'spread-id',
      notificationEndpoint: 'projects/proj/topics/topic',
      expireTime: '2026-12-31T00:00:00Z',
      createdAt: '2026-04-26T00:00:00Z',
    },
  ]),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
const createMockGoogleApi = (): any => ({
  sheets: {},
  drive: {},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Actions that require Redis (the webhook manager store) */
const REDIS_ACTIONS = ['register', 'unregister', 'list', 'get', 'test', 'get_stats'] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebhookHandler', () => {
  let handler: WebhookHandler;
  let handlerWithDrive: WebhookHandler;
  let handlerWithWorkspace: WebhookHandler;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockWorkspaceEventsService: ReturnType<typeof createMockWorkspaceEventsService>;

  beforeEach(() => {
    resetWebhookManager();
    resetWebhookQueue();

    mockDriveApi = createMockDriveApi();
    mockWorkspaceEventsService = createMockWorkspaceEventsService();

    handler = createWebhookHandler();
    handlerWithDrive = createWebhookHandler({ driveApi: mockDriveApi as any });
    handlerWithWorkspace = createWebhookHandler({
      workspaceEventsService: mockWorkspaceEventsService as any,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetWebhookManager();
    resetWebhookQueue();
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register action', () => {
    it('should return CONFIG_ERROR when Redis is not configured', async () => {
      const result = await handler.handle({
        request: {
          action: 'register',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
          eventTypes: ['cell.update'],
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
      expect(result.response.error?.message).toContain('Redis required');
    });

    it('should return CONFIG_ERROR even when manager is initialized without Redis', async () => {
      initWebhookQueue(null);
      initWebhookManager(null, createMockGoogleApi(), 'https://example.com/base');

      const result = await handler.handle({
        request: {
          action: 'register',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
          eventTypes: ['all'],
        },
      });

      // Redis-backed action — still fails without real Redis
      expect(result.response.success).toBe(false);
      expect(result.response.error?.message).toContain('Redis required');
    });
  });

  // -------------------------------------------------------------------------
  // unregister
  // -------------------------------------------------------------------------

  describe('unregister action', () => {
    it('should return CONFIG_ERROR when Redis is not configured', async () => {
      const result = await handler.handle({
        request: {
          action: 'unregister',
          webhookId: 'wh-123',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list action', () => {
    it('should return CONFIG_ERROR when Redis is not configured', async () => {
      const result = await handler.handle({
        request: { action: 'list' },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
      expect(result.response.error?.message).toContain('Redis required');
    });

    it('should return CONFIG_ERROR after manager init without real Redis', async () => {
      initWebhookQueue(null);
      initWebhookManager(null, createMockGoogleApi(), 'https://example.com/base');

      const result = await handler.handle({
        request: { action: 'list' },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.message).not.toContain('not initialized');
    });
  });

  // -------------------------------------------------------------------------
  // get
  // -------------------------------------------------------------------------

  describe('get action', () => {
    it('should return CONFIG_ERROR when Redis is not configured', async () => {
      const result = await handler.handle({
        request: {
          action: 'get',
          webhookId: 'wh-123',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // test
  // -------------------------------------------------------------------------

  describe('test action', () => {
    it('should return CONFIG_ERROR when Redis is not configured', async () => {
      const result = await handler.handle({
        request: {
          action: 'test',
          webhookId: 'wh-123',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // get_stats
  // -------------------------------------------------------------------------

  describe('get_stats action', () => {
    it('should return CONFIG_ERROR when Redis is not configured', async () => {
      const result = await handler.handle({
        request: { action: 'get_stats' },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
    });

    it('should return CONFIG_ERROR for specific webhookId when Redis is not configured', async () => {
      const result = await handler.handle({
        request: { action: 'get_stats', webhookId: 'wh-123' },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // watch_changes — SSRF protection + success path
  // -------------------------------------------------------------------------

  describe('watch_changes action', () => {
    beforeEach(() => {
      // watch_changes calls getWebhookManager()?.storeWatchChannel() after the Drive call.
      // Initialize the manager with null Redis so getWebhookManager() doesn't throw.
      initWebhookQueue(null);
      initWebhookManager(null, createMockGoogleApi(), 'https://example.com/base');
    });

    it('should return CONFIG_ERROR when Drive API is not available', async () => {
      const result = await handler.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
      expect(result.response.error?.message).toContain('Drive API');
    });

    it('should succeed when Drive API is available', async () => {
      const result = await handlerWithDrive.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        const data = result.response.data as any;
        expect(data.channelId).toBeDefined();
        expect(data.spreadsheetId).toBe('spread-id');
        expect(data.webhookUrl).toBe('https://example.com/webhook');
      }
    });

    it('should call Drive files.watch with correct spreadsheetId', async () => {
      await handlerWithDrive.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
        },
      });

      expect(mockDriveApi.files.watch).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'spread-id',
        })
      );
    });

    it('should use custom channelId when provided', async () => {
      const result = await handlerWithDrive.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
          channelId: 'my-custom-channel',
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        const data = result.response.data as any;
        expect(data.channelId).toBe('my-custom-channel');
      }
    });

    it('should reject private IP addresses (SSRF protection)', async () => {
      const { validateWebhookUrl } = await import(
        '../../src/services/webhook-url-validation.js'
      );
      vi.mocked(validateWebhookUrl).mockRejectedValueOnce(
        new Error('Webhook URL cannot target private IP address 192.168.1.1')
      );

      const result = await handlerWithDrive.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://192.168.1.1/evil',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.message).toContain('192.168.1.1');
    });

    it('should reject localhost URLs (SSRF protection)', async () => {
      const { validateWebhookUrl } = await import(
        '../../src/services/webhook-url-validation.js'
      );
      vi.mocked(validateWebhookUrl).mockRejectedValueOnce(
        new Error('Webhook URL cannot target localhost')
      );

      const result = await handlerWithDrive.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://localhost/webhook',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.message).toContain('localhost');
    });
  });

  // -------------------------------------------------------------------------
  // subscribe_workspace
  // -------------------------------------------------------------------------

  describe('subscribe_workspace action', () => {
    it('should return NOT_FOUND when WorkspaceEventsService is not available', async () => {
      const result = await handler.handle({
        request: {
          action: 'subscribe_workspace',
          spreadsheetId: 'spread-id',
          notificationEndpoint: 'projects/my-project/topics/my-topic',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NOT_FOUND');
      expect(result.response.error?.message).toContain('Workspace Events service not available');
    });

    it('should create subscription when service is available', async () => {
      const result = await handlerWithWorkspace.handle({
        request: {
          action: 'subscribe_workspace',
          spreadsheetId: 'spread-id',
          notificationEndpoint: 'projects/my-project/topics/my-topic',
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        const data = result.response.data as any;
        expect(data.subscriptionId).toBe('subscriptions/sub-123');
        expect(data.subscription).toBeDefined();
      }
    });

    it('should call createSubscription with correct args', async () => {
      await handlerWithWorkspace.handle({
        request: {
          action: 'subscribe_workspace',
          spreadsheetId: 'spread-id',
          notificationEndpoint: 'projects/my-project/topics/my-topic',
        },
      });

      expect(mockWorkspaceEventsService.createSubscription).toHaveBeenCalledWith(
        'spread-id',
        'projects/my-project/topics/my-topic'
      );
    });
  });

  // -------------------------------------------------------------------------
  // unsubscribe_workspace
  // -------------------------------------------------------------------------

  describe('unsubscribe_workspace action', () => {
    it('should return NOT_FOUND when WorkspaceEventsService is not available', async () => {
      const result = await handler.handle({
        request: {
          action: 'unsubscribe_workspace',
          subscriptionId: 'subscriptions/sub-123',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NOT_FOUND');
    });

    it('should delete subscription when service is available', async () => {
      const result = await handlerWithWorkspace.handle({
        request: {
          action: 'unsubscribe_workspace',
          subscriptionId: 'subscriptions/sub-123',
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        const data = result.response.data as any;
        expect(data.message).toContain('sub-123');
      }
    });

    it('should call deleteSubscription with subscriptionId', async () => {
      await handlerWithWorkspace.handle({
        request: {
          action: 'unsubscribe_workspace',
          subscriptionId: 'subscriptions/sub-123',
        },
      });

      expect(mockWorkspaceEventsService.deleteSubscription).toHaveBeenCalledWith(
        'subscriptions/sub-123'
      );
    });
  });

  // -------------------------------------------------------------------------
  // reactivate_workspace
  // -------------------------------------------------------------------------

  describe('reactivate_workspace action', () => {
    it('should return NOT_FOUND when WorkspaceEventsService is not available', async () => {
      const result = await handler.handle({
        request: {
          action: 'reactivate_workspace',
          subscriptionId: 'subscriptions/sub-123',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NOT_FOUND');
    });

    it('should reactivate subscription when service is available', async () => {
      const result = await handlerWithWorkspace.handle({
        request: {
          action: 'reactivate_workspace',
          subscriptionId: 'subscriptions/sub-123',
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        const data = result.response.data as any;
        expect(data.subscriptionId).toBe('subscriptions/sub-123');
        expect(data.subscription).toBeDefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // list_workspace_subscriptions
  // -------------------------------------------------------------------------

  describe('list_workspace_subscriptions action', () => {
    it('should return NOT_FOUND when WorkspaceEventsService is not available', async () => {
      const result = await handler.handle({
        request: {
          action: 'list_workspace_subscriptions',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NOT_FOUND');
    });

    it('should return list of subscriptions when service is available', async () => {
      const result = await handlerWithWorkspace.handle({
        request: {
          action: 'list_workspace_subscriptions',
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        const data = result.response.data as any;
        expect(Array.isArray(data.subscriptions)).toBe(true);
        expect(data.subscriptions).toHaveLength(1);
      }
    });

    it('should filter subscriptions by spreadsheetId', async () => {
      await handlerWithWorkspace.handle({
        request: {
          action: 'list_workspace_subscriptions',
          spreadsheetId: 'spread-id',
        },
      });

      expect(mockWorkspaceEventsService.listSubscriptions).toHaveBeenCalledWith('spread-id');
    });

    it('should call listSubscriptions without filter when spreadsheetId is omitted', async () => {
      await handlerWithWorkspace.handle({
        request: {
          action: 'list_workspace_subscriptions',
        },
      });

      expect(mockWorkspaceEventsService.listSubscriptions).toHaveBeenCalledWith(undefined);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling / edge cases
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('should return INVALID_PARAMS for unknown action', async () => {
      initWebhookQueue(null);
      initWebhookManager(null, createMockGoogleApi(), 'https://example.com/base');

      const result = await handler.handle({
        request: {
          // @ts-expect-error — testing invalid action
          action: 'invalid_action',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle Drive API errors gracefully in watch_changes', async () => {
      mockDriveApi.files.watch.mockRejectedValueOnce(new Error('Drive API quota exceeded'));

      const result = await handlerWithDrive.handle({
        request: {
          action: 'watch_changes',
          spreadsheetId: 'spread-id',
          webhookUrl: 'https://example.com/webhook',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error).toBeDefined();
    });

    it('should handle WorkspaceEventsService errors gracefully in subscribe_workspace', async () => {
      mockWorkspaceEventsService.createSubscription.mockRejectedValueOnce(
        new Error('Workspace Events API unavailable')
      );

      const result = await handlerWithWorkspace.handle({
        request: {
          action: 'subscribe_workspace',
          spreadsheetId: 'spread-id',
          notificationEndpoint: 'projects/my-project/topics/my-topic',
        },
      });

      // Error propagates as top-level catch → INTERNAL_ERROR
      expect(result.response.success).toBe(false);
      expect(result.response.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // createWebhookHandler factory
  // -------------------------------------------------------------------------

  describe('createWebhookHandler factory', () => {
    it('should create handler without options', () => {
      const h = createWebhookHandler();
      expect(h).toBeInstanceOf(WebhookHandler);
      expect(h.driveApi).toBeUndefined();
      expect(h.workspaceEventsService).toBeUndefined();
    });

    it('should create handler with Drive API', () => {
      const drive = createMockDriveApi();
      const h = createWebhookHandler({ driveApi: drive as any });
      expect(h.driveApi).toBe(drive);
    });

    it('should create handler with WorkspaceEventsService', () => {
      const service = createMockWorkspaceEventsService();
      const h = createWebhookHandler({ workspaceEventsService: service as any });
      expect(h.workspaceEventsService).toBe(service);
    });
  });
});
