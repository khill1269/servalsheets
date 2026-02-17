/**
 * ServalSheets - Webhook Manager
 *
 * Manages webhook registrations with Google Sheets Watch API.
 * Handles webhook lifecycle: registration, renewal, and cleanup.
 *
 * Architecture:
 * - Registers via Google Drive API (files.watch) for push notifications
 * - Stores webhook metadata in Redis
 * - Monitors expiration and auto-renews webhooks
 * - Provides CRUD operations for webhook management
 *
 * Google Drive API Watch (files.watch):
 * - POST /v3/files/{fileId}/watch
 * - Sends push notifications to registered webhook URL
 * - Max expiration: 1 day (86400000ms)
 * - Returns: resourceId, channelId, expiration
 *
 * @see https://developers.google.com/workspace/drive/api/guides/push
 * @category Services
 */

import { randomUUID } from 'crypto';
import dns from 'node:dns';
import type { GoogleApiClient } from './google-api.js';
import { logger } from '../utils/logger.js';
import { recordWebhookRenewal, updateActiveWebhookCount } from '../observability/metrics.js';
import { DiffEngine, type SpreadsheetState } from '../core/diff-engine.js';
import { generateWebhookSecret } from '../security/webhook-signature.js';
import { resourceNotifications } from '../resources/notifications.js';
import type {
  WebhookEventType,
  WebhookInfo,
  WebhookRegisterInput,
  WebhookRegisterResponse,
} from '../schemas/webhook.js';

/**
 * Check if an IPv4 address string is in a private/internal range.
 */
function isPrivateIPv4(ip: string): boolean {
  const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
    a === 127 || // 127.0.0.0/8 (loopback)
    a === 0 // 0.0.0.0/8
  );
}

/**
 * Check if an IPv6 address string is private/internal.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/[[\]]/g, '');
  if (
    lower.startsWith('fc') ||
    lower.startsWith('fd') || // Unique local
    lower.startsWith('fe80') || // Link-local
    lower === '::1' // Loopback
  ) {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:x.x.x.x) - extract and check the IPv4 part
  const v4MappedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedMatch) {
    return isPrivateIPv4(v4MappedMatch[1]!);
  }
  return false;
}

/**
 * SSRF protection: Block webhook URLs pointing to private/internal networks.
 * Validates that webhook URLs use HTTPS and don't target internal IP ranges.
 * Includes DNS rebinding protection by resolving hostnames and re-validating.
 */
async function validateWebhookUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid webhook URL: ${urlString}`);
  }

  // Require HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }

  const hostname = parsed.hostname;

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Webhook URL cannot target localhost');
  }

  // Block decimal IP encoding (e.g., 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    throw new Error('Webhook URL cannot use decimal IP encoding');
  }

  // Block hex IP encoding (e.g., 0x7f000001 = 127.0.0.1)
  if (/^0x[0-9a-fA-F]+$/.test(hostname)) {
    throw new Error('Webhook URL cannot use hex IP encoding');
  }

  // Block private IP ranges (IPv4)
  if (isPrivateIPv4(hostname)) {
    throw new Error('Webhook URL cannot target private/internal IP addresses');
  }

  // Block IPv6 private ranges
  if (hostname.startsWith('[') || hostname.includes(':')) {
    if (isPrivateIPv6(hostname)) {
      throw new Error('Webhook URL cannot target private/internal IPv6 addresses');
    }
  }

  // DNS rebinding protection: resolve hostname and re-validate resolved IPs
  try {
    const addresses = await dns.promises.resolve(hostname);
    for (const addr of addresses) {
      if (isPrivateIPv4(addr) || isPrivateIPv6(addr)) {
        throw new Error(
          'Webhook URL hostname resolves to a private/internal IP address (DNS rebinding protection)'
        );
      }
    }
  } catch (error) {
    // Re-throw our own SSRF errors
    if (error instanceof Error && error.message.includes('DNS rebinding')) {
      throw error;
    }
    // DNS resolution failures for non-IP hostnames are suspicious but not blocking
    // (hostname may resolve later, or use AAAA records only)
    logger.warn('DNS resolution failed during SSRF validation', {
      hostname,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Use any for Redis client to avoid type conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

/** Non-blocking SCAN replacement for redis.keys() */
async function scanRedisKeys(redis: RedisClient, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;
    keys.push(...result.keys);
  } while (cursor !== 0);
  return keys;
}

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
  deliveryTimings?: number[]; // Circular buffer of last 100 delivery times (ms)
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
  public diffEngine: DiffEngine; // Phase 4.2A: For event categorization

  constructor(redis: RedisClient | null, googleApi: GoogleApiClient, webhookEndpoint: string) {
    this.redis = redis;
    this.googleApi = googleApi;
    this.webhookEndpoint = webhookEndpoint;
    this.diffEngine = new DiffEngine({
      sheetsApi: googleApi.sheets,
      defaultTier: 'SAMPLE', // Use SAMPLE tier for webhook diffs (good balance)
    });

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

    // SSRF protection: validate webhook URL before registration
    await validateWebhookUrl(input.webhookUrl);

    const webhookId = `webhook_${randomUUID()}`;
    const channelId = `channel_${randomUUID()}`;

    // Generate webhook secret if not provided
    const secret = input.secret || generateWebhookSecret();

    // Clamp expiration to Drive API limit (1 day for files.watch)
    const MAX_EXPIRATION_MS = 86400000; // 1 day
    const requestedExpiration = input.expirationMs;
    const clampedExpiration = Math.min(requestedExpiration, MAX_EXPIRATION_MS);
    const expiresAt = Date.now() + clampedExpiration;

    if (requestedExpiration > MAX_EXPIRATION_MS) {
      logger.warn('Webhook expiration clamped to Drive API limit', {
        requested: requestedExpiration,
        clamped: clampedExpiration,
        requestedDays: requestedExpiration / 86400000,
        clampedDays: clampedExpiration / 86400000,
      });
    }

    try {
      // Register with Google Drive API watch
      // Note: Sheets API v4 doesn't support push notifications, but Drive API v3 does
      // We watch the spreadsheet file for changes via Drive API
      const watchResponse = await this.googleApi.drive.files.watch({
        fileId: input.spreadsheetId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: this.webhookEndpoint,
          token: webhookId, // For correlation in callback
          expiration: expiresAt.toString(),
        },
      });

      if (!watchResponse.data.resourceId) {
        throw new Error('Drive API watch response missing resourceId');
      }

      const resourceId = watchResponse.data.resourceId;

      // Log if API returned shorter expiration than requested
      if (watchResponse.data.expiration) {
        const apiExpiration = parseInt(watchResponse.data.expiration, 10);
        if (apiExpiration < expiresAt) {
          logger.warn('Drive API returned shorter expiration than requested', {
            requestedExpiration: expiresAt,
            apiExpiration,
            requestedDays: (expiresAt - Date.now()) / 86400000,
            apiDays: (apiExpiration - Date.now()) / 86400000,
            difference: (expiresAt - apiExpiration) / 1000 / 60, // minutes
          });
        }
      }

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
        secret, // Use generated or provided secret
        deliveryCount: 0,
        failureCount: 0,
        deliveryTimings: [],
      };

      await this.redis.set(`webhook:${webhookId}`, JSON.stringify(record), {
        EXAT: Math.floor(expiresAt / 1000), // Redis expiration (seconds)
      });

      // Add to spreadsheet index
      await this.redis.sAdd(`webhooks:spreadsheet:${input.spreadsheetId}`, webhookId);

      // Update active webhook count metric
      const allKeys = await scanRedisKeys(this.redis, 'webhook:webhook_*');
      updateActiveWebhookCount(allKeys.length);

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
        secret, // Return the generated or provided secret
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

      // Stop Google Drive API watch channel
      logger.info('Stopping Drive API watch channel', {
        webhookId,
        spreadsheetId: record.spreadsheetId,
        channelId: record.channelId,
        resourceId: record.resourceId,
      });

      try {
        await this.googleApi.drive.channels.stop({
          requestBody: {
            id: record.channelId,
            resourceId: record.resourceId,
          },
        });
        logger.info('Drive API watch channel stopped', { channelId: record.channelId });
      } catch (error) {
        // Channel might already be expired or invalid - log but don't fail
        logger.warn('Failed to stop Drive API watch channel (might be already expired)', {
          channelId: record.channelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Remove from Redis
      await this.redis.del(`webhook:${webhookId}`);
      await this.redis.sRem(`webhooks:spreadsheet:${record.spreadsheetId}`, webhookId);

      // Update active webhook count metric
      const allKeys = await scanRedisKeys(this.redis, 'webhook:webhook_*');
      updateActiveWebhookCount(allKeys.length);

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
        const keys = await scanRedisKeys(this.redis, 'webhook:*');
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
  async recordDelivery(webhookId: string, success: boolean, durationMs?: number): Promise<void> {
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

      // Update delivery timings (circular buffer, last 100)
      if (durationMs !== undefined) {
        if (!record.deliveryTimings) {
          record.deliveryTimings = [];
        }
        record.deliveryTimings.push(durationMs);
        if (record.deliveryTimings.length > 100) {
          record.deliveryTimings.shift();
        }
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
   * Record event type stats for filtering efficiency tracking
   * Phase 4.2A: Track detected vs delivered events per type
   */
  async recordEventStats(
    webhookId: string,
    detectedEvents: Array<import('../schemas/webhook.js').WebhookEventType>,
    deliveredEvents: Array<import('../schemas/webhook.js').WebhookEventType>
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const key = `webhook:events:${webhookId}`;
      const existingStr = await this.redis.get(key);
      const existing = existingStr ? JSON.parse(existingStr as string) : {};

      // Track counts per event type
      for (const eventType of detectedEvents) {
        if (!existing[eventType]) {
          existing[eventType] = { detected: 0, delivered: 0 };
        }
        existing[eventType].detected++;
      }

      for (const eventType of deliveredEvents) {
        if (!existing[eventType]) {
          existing[eventType] = { detected: 0, delivered: 0 };
        }
        existing[eventType].delivered++;
      }

      // Store with 7 day TTL (same as webhook expiration)
      await this.redis.set(key, JSON.stringify(existing), { EX: 604800 });
    } catch (error) {
      logger.error('Failed to record event stats', { webhookId, error });
    }
  }

  /**
   * Get event type statistics for a webhook
   * Phase 4.2A: Returns breakdown of detected vs delivered events
   */
  async getEventStats(
    webhookId: string
  ): Promise<Record<string, { detected: number; delivered: number }> | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const key = `webhook:events:${webhookId}`;
      const statsStr = await this.redis.get(key);
      return statsStr ? JSON.parse(statsStr as string) : null;
    } catch (error) {
      logger.error('Failed to get event stats', { webhookId, error });
      return null;
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
      const keys = await scanRedisKeys(this.redis, 'webhook:*');
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
   * Renew expiring watch channels
   * Phase 1: Proactive channel renewal before expiration
   *
   * Drive API channels expire after max 1 day (files) or 7 days (changes API).
   * This method renews channels that are within the renewal window.
   *
   * @param renewalWindowMs - Renew channels expiring within this window (default: 2 hours)
   * @returns Number of channels renewed
   */
  async renewExpiringChannels(renewalWindowMs: number = 2 * 60 * 60 * 1000): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      const now = Date.now();
      const renewalThreshold = now + renewalWindowMs;
      const keys = await scanRedisKeys(this.redis, 'webhook:*');
      let renewedCount = 0;

      for (const key of keys as string[]) {
        const recordStr = await this.redis.get(key);
        if (!recordStr) {
          continue;
        }

        const record: WebhookRecord = JSON.parse(recordStr as string);

        // Renew if expiring within the renewal window and still active
        if (record.active && record.expiresAt < renewalThreshold && record.expiresAt > now) {
          logger.info('Renewing expiring webhook channel', {
            webhookId: record.webhookId,
            spreadsheetId: record.spreadsheetId,
            expiresAt: new Date(record.expiresAt).toISOString(),
          });

          try {
            // Stop old channel
            await this.googleApi.drive.channels.stop({
              requestBody: {
                id: record.channelId,
                resourceId: record.resourceId,
              },
            });

            // Create new channel with new expiration
            const newChannelId = `channel_${randomUUID()}`;
            const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 1 day (Drive API file watch max)

            const watchResponse = await this.googleApi.drive.files.watch({
              fileId: record.spreadsheetId,
              requestBody: {
                id: newChannelId,
                type: 'web_hook',
                address: this.webhookEndpoint,
                token: record.webhookId,
                expiration: newExpiresAt.toString(),
              },
            });

            if (!watchResponse.data.resourceId) {
              throw new Error('Drive API watch response missing resourceId');
            }

            // Update record with new channel info
            record.channelId = newChannelId;
            record.resourceId = watchResponse.data.resourceId;
            record.expiresAt = newExpiresAt;

            await this.redis.set(`webhook:${record.webhookId}`, JSON.stringify(record), {
              EXAT: Math.floor(newExpiresAt / 1000),
            });

            renewedCount++;
            recordWebhookRenewal('file', 'expiring');
            logger.info('Webhook channel renewed', {
              webhookId: record.webhookId,
              newChannelId,
              newExpiresAt: new Date(newExpiresAt).toISOString(),
            });
          } catch (error) {
            logger.error('Failed to renew webhook channel', {
              webhookId: record.webhookId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Mark webhook as inactive if renewal fails
            record.active = false;
            await this.redis.set(`webhook:${record.webhookId}`, JSON.stringify(record), {
              EXAT: Math.floor(record.expiresAt / 1000),
            });
          }
        }
      }

      if (renewedCount > 0) {
        logger.info('Renewed expiring webhook channels', { count: renewedCount });
      }

      return renewedCount;
    } catch (error) {
      logger.error('Failed to renew expiring channels', { error });
      return 0;
    }
  }

  /**
   * Convert webhook record to info format
   */
  private recordToInfo(record: WebhookRecord): WebhookInfo {
    // Calculate percentiles from delivery timings
    let avgDeliveryTimeMs: number | undefined;
    let p95DeliveryTimeMs: number | undefined;
    let p99DeliveryTimeMs: number | undefined;

    if (record.deliveryTimings && record.deliveryTimings.length > 0) {
      const sorted = [...record.deliveryTimings].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      avgDeliveryTimeMs = sum / sorted.length;

      const p95Index = Math.floor(sorted.length * 0.95);
      p95DeliveryTimeMs = sorted[p95Index] ?? sorted[sorted.length - 1];

      const p99Index = Math.floor(sorted.length * 0.99);
      p99DeliveryTimeMs = sorted[p99Index] ?? sorted[sorted.length - 1];
    }

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
      avgDeliveryTimeMs,
      p95DeliveryTimeMs,
      p99DeliveryTimeMs,
    };
  }

  /**
   * Cache spreadsheet state for diff comparison
   * (Phase 4.2A - Fine-Grained Event Filtering)
   */
  async cacheState(spreadsheetId: string, state: SpreadsheetState): Promise<void> {
    if (!this.redis) {
      logger.debug('State caching skipped: Redis not available');
      return;
    }

    // Retrieve old state for change detection
    const oldState = await this.getCachedState(spreadsheetId);

    const key = `webhook:state:${spreadsheetId}`;
    try {
      await this.redis.set(key, JSON.stringify(state), {
        EX: 3600, // 1 hour TTL
      });
      logger.debug('Spreadsheet state cached', { spreadsheetId, key });

      // Detect changes and notify MCP clients (Feature 1: Real-Time Notifications)
      if (oldState && this.hasStateChanged(oldState, state)) {
        resourceNotifications.notifyResourceListChanged(`spreadsheet changed: ${spreadsheetId}`);
        logger.debug('Resource list changed notification sent for spreadsheet change', {
          spreadsheetId,
        });
      }
    } catch (error) {
      logger.warn('Failed to cache spreadsheet state', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if spreadsheet state has changed
   * (Feature 1: Real-Time Notifications)
   * @private
   */
  private hasStateChanged(old: SpreadsheetState, current: SpreadsheetState): boolean {
    // Compare critical fields: sheet count, cell values, formatting
    if (old.sheets.length !== current.sheets.length) {
      return true;
    }

    // Deep comparison of sheet data
    // Using JSON.stringify for simplicity - in production could use more efficient comparison
    return JSON.stringify(old.sheets) !== JSON.stringify(current.sheets);
  }

  /**
   * Retrieve cached spreadsheet state
   * (Phase 4.2A - Fine-Grained Event Filtering)
   */
  async getCachedState(spreadsheetId: string): Promise<SpreadsheetState | null> {
    if (!this.redis) {
      logger.debug('State retrieval skipped: Redis not available');
      return null;
    }

    const key = `webhook:state:${spreadsheetId}`;
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        logger.debug('No cached state found', { spreadsheetId, key });
        return null;
      }

      const state = JSON.parse(cached) as SpreadsheetState;
      logger.debug('Spreadsheet state retrieved from cache', { spreadsheetId, key });
      return state;
    } catch (error) {
      logger.warn('Failed to retrieve cached spreadsheet state', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cleanup cached state for a spreadsheet
   * (Phase 4.2A - Fine-Grained Event Filtering)
   */
  async cleanupStateCache(spreadsheetId: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const key = `webhook:state:${spreadsheetId}`;
    try {
      await this.redis.del(key);
      logger.debug('Spreadsheet state cache cleaned up', { spreadsheetId, key });
    } catch (error) {
      logger.warn('Failed to cleanup spreadsheet state cache', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
