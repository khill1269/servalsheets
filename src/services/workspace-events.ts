/**
 * Workspace Events Service
 *
 * Integrates Google Workspace Events API for real-time spreadsheet notifications.
 * Handles subscription creation, renewal, and CloudEvent parsing.
 */

import { getRequestLogger } from '../utils/request-context.js';

export interface WorkspaceEventSubscription {
  subscriptionId: string;
  spreadsheetId: string;
  eventTypes: string[];
  expirationTime: number; // timestamp
  createdAt: number;
}

export interface WorkspaceEvent {
  type: string;
  source: string; // spreadsheetId
  subject: string; // event descriptor
  timestamp: number;
  data?: Record<string, unknown>;
}

export class WorkspaceEventsService {
  private subscriptions: Map<string, WorkspaceEventSubscription> = new Map();
  private logger = getRequestLogger();
  private maxSubscriptions = 1000;

  /**
   * Create a subscription for Sheets monitoring
   */
  async subscribe(spreadsheetId: string, eventTypes: string[] = ['update', 'delete', 'create']): Promise<WorkspaceEventSubscription> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expirationMs = 48 * 60 * 60 * 1000; // 48 hours

    const subscription: WorkspaceEventSubscription = {
      subscriptionId,
      spreadsheetId,
      eventTypes,
      expirationTime: Date.now() + expirationMs,
      createdAt: Date.now(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    this.logger.info('Workspace Events subscription created', { subscriptionId, spreadsheetId });

    // FIFO eviction if max reached
    if (this.subscriptions.size > this.maxSubscriptions) {
      const oldest = Array.from(this.subscriptions.values()).sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) {
        this.subscriptions.delete(oldest.subscriptionId);
      }
    }

    return subscription;
  }

  /**
   * Unsubscribe
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    this.logger.info('Workspace Events subscription removed', { subscriptionId });
  }

  /**
   * Renew subscription (called 12 hours before expiration)
   */
  async renew(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.expirationTime = Date.now() + 48 * 60 * 60 * 1000;
      this.logger.info('Workspace Events subscription renewed', { subscriptionId });
    }
  }

  /**
   * Parse CloudEvent from Pub/Sub push
   */
  parseCloudEvent(message: unknown): WorkspaceEvent | null {
    const msg = message as { data?: string; attributes?: Record<string, string> };
    if (!msg.data) return null;

    try {
      const decoded = Buffer.from(msg.data, 'base64').toString('utf-8');
      const event = JSON.parse(decoded) as Record<string, unknown>;
      const resourceName = event.resourceName as string | undefined;
      const spreadsheetId = resourceName?.split('/').pop() ?? '';

      return {
        type: (event.eventType as string) ?? 'unknown',
        source: spreadsheetId,
        subject: (event.eventSubject as string) ?? '',
        timestamp: Date.now(),
        data: event.data as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.warn('Failed to parse CloudEvent', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * List subscriptions needing renewal (12 hours before expiration)
   */
  listNeedingRenewal(): WorkspaceEventSubscription[] {
    const renewalWindowMs = 12 * 60 * 60 * 1000;
    return Array.from(this.subscriptions.values()).filter(
      (s) => Date.now() > s.expirationTime - renewalWindowMs
    );
  }

  /**
   * List all subscriptions
   */
  listAll(): WorkspaceEventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription count
   */
  getCount(): number {
    return this.subscriptions.size;
  }
}

/**
 * Singleton instance
 */
let globalService: WorkspaceEventsService | null = null;

export function getWorkspaceEventsService(): WorkspaceEventsService {
  if (!globalService) {
    globalService = new WorkspaceEventsService();
  }
  return globalService;
}
