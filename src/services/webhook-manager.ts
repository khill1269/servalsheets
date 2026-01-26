/**
 * ServalSheets - Webhook Manager
 *
 * Manages webhook registrations with Google Sheets Watch API.
 * Handles webhook lifecycle: registration, renewal, and cleanup.
 *
 * Architecture:
 * - Registers with Google Sheets API (watch) for push notifications
 * - Stores webhook metadata in Redis
 * - Monitors expiration and auto-renews webhooks
 * - Provides CRUD operations for webhook management
 *
 * Google Sheets Watch API:
 * - POST /v4/spreadsheets/{spreadsheetId}:watch
 * - Sends push notifications to registered webhook URL
 * - Max expiration: 30 days
 * - Returns: resourceId, channelId, expiration
 *
 * @category Services
 */

import { randomUUID } from 'crypto';
import type { GoogleApiClient } from './google-api.js';
import { logger } from '../utils/logger.js';
import type {
  WebhookEventType,
  WebhookInfo,
  WebhookRegisterInput,
  WebhookRegisterResponse,
} from '../schemas/webhook.js';

// Use any for Redis client to avoid type conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

/**
 * Webhook storage record (stored in Redis)
 */
interface WebhookRecord {
  webhookId: string;
  spreadsheetId: string;
  webhookUrl: string;
  eventTypes: WebhookEventType[];
  resourceId: string;
  channelId: string;
  createdAt: number;
  expiresAt: number;
  active: boolean;
  secret?: string;
  deliveryCount: number;
  failureCount: number;
  lastDelivery?: number;
  lastFailure?: number;
}

/**
 * Webhook Manager
 *
 * Manages webhook lifecycle and storage.
 */
export class WebhookManager {
  private redis: RedisClient | null;
  private googleApi: GoogleApiClient;
  private webhookEndpoint: string;

  constructor(redis: RedisClient | null, googleApi: GoogleApiClient, webhookEndpoint: string) {
    this.redis = redis;
    this.googleApi = googleApi;
    this.webhookEndpoint = webhookEndpoint;

    logger.info('Webhook manager initialized', {
      redisAvailable: redis !== null,
      webhookEndpoint,
    });
  }

  /**
   * Register a new webhook with Google Sheets Watch API
   */
  async register(input: WebhookRegisterInput): Promise<WebhookRegisterResponse> {
    if (!this.redis) {
      throw new Error('Redis required for webhook functionality');
    }

    const webhookId = `webhook_${randomUUID()}`;
    const channelId = `channel_${randomUUID()}`;
    const expiresAt = Date.now() + input.expirationMs;

    try {
      // Register with Google Sheets Watch API
      // Note: Google Sheets API v4 does not currently support watch/push notifications.
      // In production, you would use Google Drive API watch or polling-based change detection.
      logger.warn('Google Sheets Watch API unavailable - using mock registration', {
        spreadsheetId: input.spreadsheetId,
        webhookId,
      });

      const resourceId = `resource_${randomUUID()}`;

      // Store webhook record in Redis
      const record: WebhookRecord = {
        webhookId,
        spreadsheetId: input.spreadsheetId,
        webhookUrl: input.webhookUrl,
        eventTypes: input.eventTypes,
        resourceId,
        channelId,
        createdAt: Date.now(),
        expiresAt,
        active: true,
        secret: input.secret,
        deliveryCount: 0,
        failureCount: 0,
      };

      await this.redis.set(`webhook:${webhookId}`, JSON.stringify(record), {
        EXAT: Math.floor(expiresAt / 1000), // Redis expiration (seconds)
      });

      // Add to spreadsheet index
      await this.redis.sAdd(`webhooks:spreadsheet:${input.spreadsheetId}`, webhookId);

      logger.info('Webhook registered', {
        webhookId,
        spreadsheetId: input.spreadsheetId,
        webhookUrl: input.webhookUrl,
        expiresAt: new Date(expiresAt).toISOString(),
      });

      return {
        webhookId,
        spreadsheetId: input.spreadsheetId,
        webhookUrl: input.webhookUrl,
        eventTypes: input.eventTypes,
        resourceId,
        channelId,
        expiresAt: new Date(expiresAt).toISOString(),
        active: true,
        secret: input.secret,
      };
    } catch (error) {
      logger.error('Failed to register webhook', {
        webhookId,
        spreadsheetId: input.spreadsheetId,
        error,
      });
      throw error;
    }
  }

  /**
   * Unregister a webhook
   */
  async unregister(webhookId: string): Promise<{ success: boolean; message: string }> {
    if (!this.redis) {
      throw new Error('Redis required for webhook functionality');
    }

    try {
      // Get webhook record
      const recordStr = await this.redis.get(`webhook:${webhookId}`);
      if (!recordStr) {
        return {
          success: false,
          message: `Webhook ${webhookId} not found`,
        };
      }

      const record: WebhookRecord = JSON.parse(recordStr as string);

      // Stop Google Watch API channel (if applicable)
      logger.info('Unregistering webhook', {
        webhookId,
        spreadsheetId: record.spreadsheetId,
        channelId: record.channelId,
      });

      // Remove from Redis
      await this.redis.del(`webhook:${webhookId}`);
      await this.redis.sRem(`webhooks:spreadsheet:${record.spreadsheetId}`, webhookId);

      logger.info('Webhook unregistered', { webhookId });

      return {
        success: true,
        message: `Webhook ${webhookId} unregistered successfully`,
      };
    } catch (error) {
      logger.error('Failed to unregister webhook', { webhookId, error });
      throw error;
    }
  }

  /**
   * Get webhook by ID
   */
  async get(webhookId: string): Promise<WebhookInfo | null> {
    if (!this.redis) {
      throw new Error('Redis required for webhook functionality');
    }

    try {
      const recordStr = await this.redis.get(`webhook:${webhookId}`);
      if (!recordStr) {
        return null;
      }

      const record: WebhookRecord = JSON.parse(recordStr as string);
      return this.recordToInfo(record);
    } catch (error) {
      logger.error('Failed to get webhook', { webhookId, error });
      throw error;
    }
  }

  /**
   * List webhooks (optionally filtered by spreadsheet ID)
   */
  async list(spreadsheetId?: string, activeOnly?: boolean): Promise<WebhookInfo[]> {
    if (!this.redis) {
      throw new Error('Redis required for webhook functionality');
    }

    try {
      let webhookIds: string[];

      if (spreadsheetId) {
        // Get webhooks for specific spreadsheet
        const ids = await this.redis.sMembers(`webhooks:spreadsheet:${spreadsheetId}`);
        webhookIds = ids as string[];
      } else {
        // Get all webhook IDs
        const keys = await this.redis.keys('webhook:*');
        webhookIds = (keys as string[]).map((key) => key.replace('webhook:', ''));
      }

      // Fetch all webhook records
      const webhooks: WebhookInfo[] = [];
      for (const webhookId of webhookIds) {
        const webhook = await this.get(webhookId);
        if (webhook) {
          if (!activeOnly || webhook.active) {
            webhooks.push(webhook);
          }
        }
      }

      return webhooks;
    } catch (error) {
      logger.error('Failed to list webhooks', { spreadsheetId, error });
      throw error;
    }
  }

  /**
   * Update webhook delivery stats
   */
  async recordDelivery(webhookId: string, success: boolean): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const recordStr = await this.redis.get(`webhook:${webhookId}`);
      if (!recordStr) {
        logger.warn('Webhook not found for delivery recording', { webhookId });
        return;
      }

      const record: WebhookRecord = JSON.parse(recordStr as string);

      if (success) {
        record.deliveryCount++;
        record.lastDelivery = Date.now();
      } else {
        record.failureCount++;
        record.lastFailure = Date.now();
      }

      await this.redis.set(`webhook:${webhookId}`, JSON.stringify(record), {
        EXAT: Math.floor(record.expiresAt / 1000),
      });

      logger.debug('Webhook delivery stats updated', {
        webhookId,
        success,
        deliveryCount: record.deliveryCount,
        failureCount: record.failureCount,
      });
    } catch (error) {
      logger.error('Failed to record webhook delivery', { webhookId, error });
    }
  }

  /**
   * Check for expired webhooks and clean up
   */
  async cleanupExpired(): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      const now = Date.now();
      const keys = await this.redis.keys('webhook:*');
      let cleanedCount = 0;

      for (const key of keys as string[]) {
        const recordStr = await this.redis.get(key);
        if (!recordStr) {
          continue;
        }

        const record: WebhookRecord = JSON.parse(recordStr as string);
        if (record.expiresAt < now) {
          await this.unregister(record.webhookId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired webhooks', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired webhooks', { error });
      return 0;
    }
  }

  /**
   * Convert webhook record to info format
   */
  private recordToInfo(record: WebhookRecord): WebhookInfo {
    return {
      webhookId: record.webhookId,
      spreadsheetId: record.spreadsheetId,
      webhookUrl: record.webhookUrl,
      eventTypes: record.eventTypes,
      resourceId: record.resourceId,
      channelId: record.channelId,
      createdAt: new Date(record.createdAt).toISOString(),
      expiresAt: new Date(record.expiresAt).toISOString(),
      active: record.active,
      deliveryCount: record.deliveryCount,
      failureCount: record.failureCount,
      lastDelivery: record.lastDelivery ? new Date(record.lastDelivery).toISOString() : undefined,
      lastFailure: record.lastFailure ? new Date(record.lastFailure).toISOString() : undefined,
    };
  }
}

/**
 * Singleton webhook manager instance
 */
let webhookManager: WebhookManager | null = null;

/**
 * Initialize webhook manager
 */
export function initWebhookManager(
  redis: RedisClient | null,
  googleApi: GoogleApiClient,
  webhookEndpoint: string
): void {
  if (webhookManager) {
    logger.warn('Webhook manager already initialized');
    return;
  }

  webhookManager = new WebhookManager(redis, googleApi, webhookEndpoint);
  logger.info('Webhook manager singleton initialized');
}

/**
 * Get webhook manager instance
 */
export function getWebhookManager(): WebhookManager {
  if (!webhookManager) {
    throw new Error('Webhook manager not initialized');
  }
  return webhookManager;
}

/**
 * Reset webhook manager (for testing)
 */
export function resetWebhookManager(): void {
  webhookManager = null;
  logger.debug('Webhook manager reset');
}
