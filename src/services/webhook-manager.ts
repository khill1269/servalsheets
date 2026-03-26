/**
 * Webhook Manager
 *
 * Manages webhook lifecycle with Google Drive API watch.
 * Handles registration, renewal, and delivery of file change notifications.
 */

import { getRequestLogger } from '../utils/request-context.js';

export interface WebhookMetadata {
  webhookId: string;
  spreadsheetId: string;
  channelId: string;
  resourceId: string;
  expiration: number; // timestamp
  createdAt: number;
  deliveryStats: {
    eventsReceived: number;
    eventsProcessed: number;
    eventsFailedCount: number;
    lastDeliveryAt?: number;
    avgDeliveryTimeMs: number;
    deliveryTimePercentiles: { p50: number; p95: number; p99: number };
  };
}

export interface WebhookEvent {
  spreadsheetId: string;
  changeType: 'update' | 'delete' | 'create';
  changedRanges?: string[];
  timestamp: number;
}

export class WebhookManager {
  private metadata: Map<string, WebhookMetadata> = new Map();
  private deliveryTimes: Map<string, number[]> = new Map(); // webhookId -> delivery times
  private logger = getRequestLogger();
  private maxWebhooks = 100;
  private renewalWindowMs = 2 * 60 * 60 * 1000; // 2 hours before expiration

  /**
   * Register a webhook for a spreadsheet
   */
  async register(
    spreadsheetId: string,
    notificationUrl: string
  ): Promise<WebhookMetadata> {
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const channelId = `ch_${Date.now()}`;
    const resourceId = `${spreadsheetId}`;
    const expirationMs = 24 * 60 * 60 * 1000; // 24 hours

    const metadata: WebhookMetadata = {
      webhookId,
      spreadsheetId,
      channelId,
      resourceId,
      expiration: Date.now() + expirationMs,
      createdAt: Date.now(),
      deliveryStats: {
        eventsReceived: 0,
        eventsProcessed: 0,
        eventsFailedCount: 0,
        avgDeliveryTimeMs: 0,
        deliveryTimePercentiles: { p50: 0, p95: 0, p99: 0 },
      },
    };

    this.metadata.set(webhookId, metadata);
    this.deliveryTimes.set(webhookId, []);

    this.logger.info('Webhook registered', { webhookId, spreadsheetId });

    if (this.metadata.size > this.maxWebhooks) {
      // LRU eviction
      const oldest = Array.from(this.metadata.values()).sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) {
        this.unregister(oldest.webhookId);
      }
    }

    return metadata;
  }

  /**
   * Unregister a webhook
   */
  unregister(webhookId: string): void {
    const metadata = this.metadata.get(webhookId);
    if (metadata) {
      this.metadata.delete(webhookId);
      this.deliveryTimes.delete(webhookId);
      this.logger.info('Webhook unregistered', { webhookId, spreadsheetId: metadata.spreadsheetId });
    }
  }

  /**
   * Check if webhook needs renewal (within 2-hour window of expiration)
   */
  needsRenewal(webhookId: string): boolean {
    const metadata = this.metadata.get(webhookId);
    if (!metadata) return false;
    return Date.now() > metadata.expiration - this.renewalWindowMs;
  }

  /**
   * Renew webhook expiration
   */
  renew(webhookId: string): void {
    const metadata = this.metadata.get(webhookId);
    if (metadata) {
      metadata.expiration = Date.now() + 24 * 60 * 60 * 1000;
      this.logger.info('Webhook renewed', { webhookId, newExpiration: new Date(metadata.expiration).toISOString() });
    }
  }

  /**
   * Record incoming event
   */
  recordEvent(webhookId: string, event: WebhookEvent): void {
    const metadata = this.metadata.get(webhookId);
    if (!metadata) return;

    metadata.deliveryStats.eventsReceived++;
    metadata.deliveryStats.lastDeliveryAt = Date.now();
  }

  /**
   * Record delivery time for SLA tracking
   */
  recordDeliveryTime(webhookId: string, deliveryTimeMs: number): void {
    const metadata = this.metadata.get(webhookId);
    if (!metadata) return;

    const times = this.deliveryTimes.get(webhookId);
    if (!times) return;

    times.push(deliveryTimeMs);
    if (times.length > 1000) times.shift(); // Keep last 1000

    // Update percentiles
    const sorted = [...times].sort((a, b) => a - b);
    metadata.deliveryStats.p50DurationMs = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    metadata.deliveryStats.deliveryTimePercentiles = {
      p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
    };

    metadata.deliveryStats.avgDeliveryTimeMs =
      times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * Get webhook metadata
   */
  getMetadata(webhookId: string): WebhookMetadata | undefined {
    return this.metadata.get(webhookId);
  }

  /**
   * List all webhooks
   */
  listAll(): WebhookMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get webhooks needing renewal
   */
  listNeedingRenewal(): WebhookMetadata[] {
    return Array.from(this.metadata.values()).filter((m) => Date.now() > m.expiration - this.renewalWindowMs);
  }

  /**
   * Get statistics across all webhooks
   */
  getStats() {
    const all = Array.from(this.metadata.values());
    return {
      totalWebhooks: all.length,
      totalEventsReceived: all.reduce((sum, m) => sum + m.deliveryStats.eventsReceived, 0),
      avgDeliveryTimeMs: all.reduce((sum, m) => sum + m.deliveryStats.avgDeliveryTimeMs, 0) / all.length || 0,
      webhooksNeedingRenewal: all.filter((m) => Date.now() > m.expiration - this.renewalWindowMs).length,
    };
  }
}

/**
 * Singleton instance
 */
let globalWebhookManager: WebhookManager | null = null;

export function getWebhookManager(): WebhookManager {
  if (!globalWebhookManager) {
    globalWebhookManager = new WebhookManager();
  }
  return globalWebhookManager;
}
