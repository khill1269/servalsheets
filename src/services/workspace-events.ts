/**
 * ServalSheets - Workspace Events Service (Phase 4)
 *
 * Google Workspace Events API integration for push notification subscriptions.
 * Provides event-driven change detection via Pub/Sub for Google Workspace resources.
 *
 * Note: The Workspace Events API delivers events via Pub/Sub topics (not HTTP endpoints).
 * The notificationEndpoint field requires a Pub/Sub topic in the format:
 * projects/{project}/topics/{topic}
 *
 * @see https://developers.google.com/workspace/events
 */

import { logger } from '../utils/logger.js';
import type { GoogleApiClient } from './google-api.js';

interface ActiveSubscription {
  id: string;
  spreadsheetId: string;
  notificationEndpoint: string;
  expireTime: string;
  renewalTimer?: ReturnType<typeof setTimeout>;
  createdAt: string;
}

export class WorkspaceEventsService {
  private subscriptions = new Map<string, ActiveSubscription>();

  constructor(private googleClient: GoogleApiClient) {}

  /**
   * Create a Workspace Events subscription for a spreadsheet.
   * @param spreadsheetId - Google Sheets file ID to monitor
   * @param pubsubTopic - Pub/Sub topic in format: projects/{project}/topics/{topic}
   */
  async createSubscription(spreadsheetId: string, pubsubTopic: string): Promise<string> {
    const workspaceEventsApi = this.googleClient.workspaceEvents;
    if (!workspaceEventsApi) {
      throw new Error('Workspace Events API not initialized');
    }

    try {
      // The API returns an Operation (long-running) for subscription creation
      const response = await workspaceEventsApi.subscriptions.create({
        requestBody: {
          targetResource: `//drive.googleapis.com/files/${spreadsheetId}`,
          eventTypes: ['google.workspace.drive.file.v1.contentChanged'],
          notificationEndpoint: {
            // Workspace Events API delivers via Pub/Sub topic
            pubsubTopic,
          },
          payloadOptions: { includeResource: false },
        },
      });

      // The create call returns a long-running Operation. The subscription resource name
      // is in operation.response.name (not operation.name which is the operation resource).
      // We use the operation name as a fallback since we don't poll the operation to completion.
      const operationData = response.data as {
        name?: string;
        response?: { name?: string };
        metadata?: { subscription?: { name?: string; expireTime?: string } };
      };
      const subscriptionId =
        operationData?.response?.name ??
        operationData?.metadata?.subscription?.name ??
        operationData?.name ??
        `ws-sub-${Date.now()}`;
      const expireTime =
        operationData?.metadata?.subscription?.expireTime ??
        new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const sub: ActiveSubscription = {
        id: subscriptionId,
        spreadsheetId,
        notificationEndpoint: pubsubTopic,
        expireTime,
        createdAt: new Date().toISOString(),
      };

      this.subscriptions.set(sub.id, sub);
      this.scheduleRenewal(sub);
      logger.info('Workspace Events subscription created', { id: sub.id, spreadsheetId });
      return sub.id;
    } catch (err) {
      throw new Error(
        `Failed to create Workspace Events subscription: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private scheduleRenewal(sub: ActiveSubscription): void {
    const msUntilRenewal = new Date(sub.expireTime).getTime() - Date.now() - 12 * 3600 * 1000;
    if (msUntilRenewal > 0) {
      sub.renewalTimer = setTimeout(() => this.renewSubscription(sub.id), msUntilRenewal);
    }
  }

  async renewSubscription(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;

    const workspaceEventsApi = this.googleClient.workspaceEvents;
    if (!workspaceEventsApi) return;

    try {
      const response = await workspaceEventsApi.subscriptions.patch({
        name: subscriptionId,
        updateMask: 'ttl',
        requestBody: { ttl: '604800s' }, // 7 days
      });

      const patchData = response.data as { expireTime?: string };
      sub.expireTime =
        patchData?.expireTime ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      if (sub.renewalTimer) clearTimeout(sub.renewalTimer);
      this.scheduleRenewal(sub);
      logger.info('Workspace Events subscription renewed', { id: subscriptionId });
    } catch (err) {
      logger.warn('Failed to renew Workspace Events subscription', {
        id: subscriptionId,
        error: String(err),
      });
    }
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub?.renewalTimer) clearTimeout(sub.renewalTimer);

    const workspaceEventsApi = this.googleClient.workspaceEvents;
    if (workspaceEventsApi) {
      try {
        await workspaceEventsApi.subscriptions.delete({ name: subscriptionId });
      } catch {
        // Best effort — remove from local tracking regardless
      }
    }
    this.subscriptions.delete(subscriptionId);
  }

  listSubscriptions(spreadsheetId?: string): ActiveSubscription[] {
    const all = Array.from(this.subscriptions.values());
    return spreadsheetId ? all.filter((s) => s.spreadsheetId === spreadsheetId) : all;
  }
}
