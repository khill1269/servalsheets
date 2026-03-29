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

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { executeWithRetry } from '../utils/retry.js';
import { AuthenticationError, ServiceError } from '../core/errors.js';
import type { GoogleApiClient } from './google-api.js';

interface ActiveSubscription {
  id: string;
  uid?: string;
  spreadsheetId: string;
  notificationEndpoint: string;
  expireTime: string;
  renewalTimer?: ReturnType<typeof setTimeout>;
  createdAt: string;
  state?: WorkspaceSubscriptionState;
  suspensionReason?: string;
  updateTime?: string;
  reconciling?: boolean;
  etag?: string;
}

type PersistedSubscription = Omit<ActiveSubscription, 'renewalTimer'>;

export interface WorkspaceEventsServiceOptions {
  persistencePath?: string;
  disablePersistence?: boolean;
}

interface WorkspaceEventsSubscriptionResource {
  name?: string;
  uid?: string;
  targetResource?: string;
  notificationEndpoint?: {
    pubsubTopic?: string;
  };
  state?: WorkspaceSubscriptionState;
  suspensionReason?: string;
  expireTime?: string;
  createTime?: string;
  updateTime?: string;
  reconciling?: boolean;
  etag?: string;
}

type WorkspaceSubscriptionState = 'STATE_UNSPECIFIED' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

interface WorkspaceEventsOperation {
  name?: string;
  done?: boolean;
  response?: WorkspaceEventsSubscriptionResource;
  error?: {
    code?: number;
    message?: string;
  };
  metadata?: {
    subscription?: WorkspaceEventsSubscriptionResource;
  };
}

// Google documents Drive-backed Workspace Events subscriptions on the v1beta surface.
const WORKSPACE_EVENTS_BASE_URL = 'https://workspaceevents.googleapis.com/v1beta';
const DRIVE_CONTENT_CHANGED_EVENT = 'google.workspace.drive.file.v3.contentChanged';
const SUBSCRIPTION_TTL = '0s';
const MAX_SUBSCRIPTIONS = 1000;
const OPERATION_POLL_INTERVAL_MS = 500;
const OPERATION_POLL_ATTEMPTS = 20;
const PUBSUB_TOPIC_PATTERN = /^projects\/[^/]+\/topics\/[^/]+$/;

export class WorkspaceEventsService {
  private subscriptions = new Map<string, ActiveSubscription>();
  private readonly persistencePath?: string;
  private destroyed = false;

  constructor(
    private googleClient: GoogleApiClient,
    options: WorkspaceEventsServiceOptions = {}
  ) {
    this.persistencePath = options.disablePersistence
      ? undefined
      : (options.persistencePath ?? this.getDefaultPersistencePath());
    this.loadPersistedSubscriptions();
  }

  private getDefaultPersistencePath(): string {
    return join(getEnv().DATA_DIR, 'workspace-events-subscriptions.json');
  }

  private serializeSubscription(subscription: ActiveSubscription): PersistedSubscription {
    return {
      id: subscription.id,
      uid: subscription.uid,
      spreadsheetId: subscription.spreadsheetId,
      notificationEndpoint: subscription.notificationEndpoint,
      expireTime: subscription.expireTime,
      createdAt: subscription.createdAt,
      state: subscription.state,
      suspensionReason: subscription.suspensionReason,
      updateTime: subscription.updateTime,
      reconciling: subscription.reconciling,
      etag: subscription.etag,
    };
  }

  private extractSpreadsheetId(targetResource?: string): string | undefined {
    if (!targetResource) {
      return undefined;
    }

    const match = targetResource.match(/\/files\/([a-zA-Z0-9_-]+)/);
    return match?.[1];
  }

  private buildSubscriptionRecord(
    subscription: WorkspaceEventsSubscriptionResource,
    fallbackSpreadsheetId: string,
    fallbackNotificationEndpoint: string,
    fallbackCreatedAt = new Date().toISOString()
  ): ActiveSubscription {
    const id = subscription.name;
    if (!id) {
      throw new ServiceError(
        'Workspace Events API returned a subscription without a resource name',
        'INTERNAL_ERROR',
        'WorkspaceEvents',
        true
      );
    }

    return {
      id,
      uid: subscription.uid,
      spreadsheetId:
        this.extractSpreadsheetId(subscription.targetResource) ?? fallbackSpreadsheetId,
      notificationEndpoint:
        subscription.notificationEndpoint?.pubsubTopic ?? fallbackNotificationEndpoint,
      expireTime:
        subscription.expireTime ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      createdAt: subscription.createTime ?? fallbackCreatedAt,
      state: subscription.state,
      suspensionReason: subscription.suspensionReason,
      updateTime: subscription.updateTime,
      reconciling: subscription.reconciling,
      etag: subscription.etag,
    };
  }

  private isNotFoundError(error: unknown): boolean {
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'status' in error.response &&
      error.response.status === 404
    ) {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('404');
  }

  private async waitForOperationCompletion(
    operationName: string
  ): Promise<WorkspaceEventsOperation> {
    let lastSeen: WorkspaceEventsOperation = { name: operationName };

    for (let attempt = 0; attempt < OPERATION_POLL_ATTEMPTS; attempt++) {
      const operation = await this.executeWorkspaceEventsRequest<WorkspaceEventsOperation>(
        `/${operationName}`
      );
      lastSeen = operation;

      if (operation.done !== false) {
        return operation;
      }

      await new Promise((resolve) => setTimeout(resolve, OPERATION_POLL_INTERVAL_MS));
    }

    throw new ServiceError(
      `Workspace Events operation did not complete in time: ${operationName}`,
      'DEADLINE_EXCEEDED',
      'WorkspaceEvents',
      true,
      { operationName, lastSeen }
    );
  }

  private async resolveSubscriptionOperation(
    operation: WorkspaceEventsOperation,
    fallbackSpreadsheetId: string,
    fallbackNotificationEndpoint: string
  ): Promise<ActiveSubscription> {
    let finalOperation = operation;
    const needsPolling =
      finalOperation.name?.startsWith('operations/') &&
      !finalOperation.response?.name &&
      !finalOperation.metadata?.subscription?.name;

    if (needsPolling) {
      finalOperation = await this.waitForOperationCompletion(finalOperation.name as string);
    }

    if (finalOperation.error?.message) {
      throw new ServiceError(
        `Workspace Events operation failed: ${finalOperation.error.message}`,
        'INTERNAL_ERROR',
        'WorkspaceEvents',
        true,
        { operationName: finalOperation.name, errorCode: finalOperation.error.code }
      );
    }

    const resolvedSubscription = {
      ...(finalOperation.metadata?.subscription ?? {}),
      ...(finalOperation.response ?? {}),
    };

    if (!resolvedSubscription.name) {
      throw new ServiceError(
        'Workspace Events operation completed without a subscription resource',
        'INTERNAL_ERROR',
        'WorkspaceEvents',
        true,
        { operationName: finalOperation.name }
      );
    }

    return this.buildSubscriptionRecord(
      resolvedSubscription,
      fallbackSpreadsheetId,
      fallbackNotificationEndpoint
    );
  }

  private loadPersistedSubscriptions(): void {
    if (!this.persistencePath || !existsSync(this.persistencePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.persistencePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedSubscription[];
      let prunedPersistedEntries = false;

      for (const entry of parsed) {
        if (
          !entry?.id ||
          !entry?.spreadsheetId ||
          !entry?.notificationEndpoint ||
          !entry?.expireTime
        ) {
          continue;
        }

        const expiresAt = new Date(entry.expireTime).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          prunedPersistedEntries = true;
          continue;
        }

        if (entry.state === 'DELETED') {
          prunedPersistedEntries = true;
          continue;
        }

        const restored: ActiveSubscription = {
          ...entry,
        };
        this.subscriptions.set(restored.id, restored);
        if (this.isSubscriptionResourceName(restored.id) && this.shouldScheduleRenewal(restored)) {
          this.scheduleRenewal(restored);
        } else if (restored.state === 'SUSPENDED') {
          logger.warn('Workspace Events subscription restored in suspended state', {
            id: restored.id,
            suspensionReason: restored.suspensionReason,
          });
        }
      }

      logger.info('Workspace Events subscriptions restored from disk', {
        count: this.subscriptions.size,
        persistencePath: this.persistencePath,
      });

      if (prunedPersistedEntries) {
        void this.persistSubscriptions().catch((error) => {
          logger.warn('Failed to prune stale Workspace Events subscriptions after restore', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      logger.warn('Failed to restore Workspace Events subscriptions from disk', {
        persistencePath: this.persistencePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistSubscriptions(): Promise<void> {
    if (!this.persistencePath || this.destroyed) {
      return;
    }

    const payload = JSON.stringify(
      Array.from(this.subscriptions.values()).map((subscription) =>
        this.serializeSubscription(subscription)
      ),
      null,
      2
    );
    const dir = dirname(this.persistencePath);
    const tempPath = `${this.persistencePath}.tmp`;

    await mkdir(dir, { recursive: true });
    await writeFile(tempPath, payload, 'utf8');
    await rename(tempPath, this.persistencePath);
  }

  private isSubscriptionResourceName(name: string): boolean {
    return name.startsWith('subscriptions/');
  }

  private shouldScheduleRenewal(subscription: Pick<ActiveSubscription, 'state'>): boolean {
    return subscription.state !== 'SUSPENDED' && subscription.state !== 'DELETED';
  }

  private removeTrackedSubscription(subscriptionId: string): void {
    const existing = this.subscriptions.get(subscriptionId);
    if (existing?.renewalTimer) {
      clearTimeout(existing.renewalTimer);
    }
    this.subscriptions.delete(subscriptionId);
  }

  private validatePubsubTopic(pubsubTopic: string): void {
    if (!PUBSUB_TOPIC_PATTERN.test(pubsubTopic)) {
      throw new ServiceError(
        `Workspace Events notificationEndpoint must be a Pub/Sub topic in the format projects/{project}/topics/{topic}. Received: ${pubsubTopic}`,
        'INVALID_REQUEST',
        'WorkspaceEvents',
        false
      );
    }
  }

  private async getFreshAccessToken(): Promise<string> {
    const credentials = this.googleClient.oauth2.credentials;
    const expiryDate = credentials?.expiry_date as number | undefined;
    const isExpiringSoon = expiryDate !== undefined && expiryDate - Date.now() < 60_000;

    if (isExpiringSoon || !credentials?.access_token) {
      const result = await this.googleClient.oauth2.getAccessToken();
      const token = result?.token ?? credentials?.access_token;
      if (!token) {
        throw new AuthenticationError('Workspace Events API requires an OAuth access token');
      }
      return token;
    }

    return credentials.access_token;
  }

  private async executeWorkspaceEventsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    return executeWithRetry(async (signal) => {
      const token = await this.getFreshAccessToken();
      const response = await fetch(`${WORKSPACE_EVENTS_BASE_URL}${path}`, {
        ...init,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(
          `Workspace Events API ${response.status}: ${body.substring(0, 200)}`
        ) as Error & {
          response?: { status?: number; data?: string };
        };
        error.response = {
          status: response.status,
          data: body,
        };
        throw error;
      }

      if (response.status === 204) {
        return undefined as T; // OK: 204 No Content — subscription successful
      }

      return (await response.json()) as T;
    });
  }

  /**
   * Create a Workspace Events subscription for a spreadsheet.
   * @param spreadsheetId - Google Sheets file ID to monitor
   * @param pubsubTopic - Pub/Sub topic in format: projects/{project}/topics/{topic}
   */
  async createSubscription(
    spreadsheetId: string,
    pubsubTopic: string
  ): Promise<PersistedSubscription> {
    this.validatePubsubTopic(pubsubTopic);

    try {
      const operationData = await this.executeWorkspaceEventsRequest<WorkspaceEventsOperation>(
        '/subscriptions',
        {
          method: 'POST',
          body: JSON.stringify({
            targetResource: `//drive.googleapis.com/files/${spreadsheetId}`,
            eventTypes: [DRIVE_CONTENT_CHANGED_EVENT],
            notificationEndpoint: {
              pubsubTopic,
            },
            payloadOptions: { includeResource: false },
            ttl: SUBSCRIPTION_TTL,
          }),
        }
      );

      const sub = await this.resolveSubscriptionOperation(
        operationData,
        spreadsheetId,
        pubsubTopic
      );

      // Enforce MAX_SUBSCRIPTIONS limit with FIFO eviction
      if (this.subscriptions.size >= MAX_SUBSCRIPTIONS) {
        const oldestEntry = this.subscriptions.entries().next().value;
        if (oldestEntry) {
          this.removeTrackedSubscription(oldestEntry[0]);
        }
      }

      this.subscriptions.set(sub.id, sub);
      if (this.shouldScheduleRenewal(sub)) {
        this.scheduleRenewal(sub);
      }
      await this.persistSubscriptions();
      logger.info('Workspace Events subscription created', { id: sub.id, spreadsheetId });
      return this.serializeSubscription(sub);
    } catch (err) {
      throw new ServiceError(
        `Failed to create Workspace Events subscription: ${err instanceof Error ? err.message : String(err)}`,
        'INTERNAL_ERROR',
        'WorkspaceEvents',
        true
      );
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<PersistedSubscription> {
    if (!this.isSubscriptionResourceName(subscriptionId)) {
      throw new ServiceError(
        `Workspace Events subscriptionId must be formatted as subscriptions/{subscription}. Received: ${subscriptionId}`,
        'INVALID_REQUEST',
        'WorkspaceEvents',
        false
      );
    }

    const existing = this.subscriptions.get(subscriptionId);
    if (!existing) {
      throw new ServiceError(
        `Workspace Events subscription is not tracked locally: ${subscriptionId}`,
        'NOT_FOUND',
        'WorkspaceEvents',
        false
      );
    }

    try {
      const operationData = await this.executeWorkspaceEventsRequest<WorkspaceEventsOperation>(
        `/${subscriptionId}:reactivate`,
        {
          method: 'POST',
        }
      );

      const reactivated = await this.resolveSubscriptionOperation(
        operationData,
        existing.spreadsheetId,
        existing.notificationEndpoint
      );

      if (this.destroyed) {
        return this.serializeSubscription(reactivated);
      }

      existing.uid = reactivated.uid;
      existing.spreadsheetId = reactivated.spreadsheetId;
      existing.notificationEndpoint = reactivated.notificationEndpoint;
      existing.expireTime = reactivated.expireTime;
      existing.createdAt = reactivated.createdAt;
      existing.state = reactivated.state;
      existing.suspensionReason = reactivated.suspensionReason;
      existing.updateTime = reactivated.updateTime;
      existing.reconciling = reactivated.reconciling;
      existing.etag = reactivated.etag;

      if (this.shouldScheduleRenewal(existing)) {
        this.scheduleRenewal(existing);
      } else {
        logger.warn('Workspace Events subscription remains non-renewable after reactivation', {
          id: subscriptionId,
          state: existing.state,
          suspensionReason: existing.suspensionReason,
        });
      }

      await this.persistSubscriptions();
      logger.info('Workspace Events subscription reactivated', {
        id: subscriptionId,
        state: existing.state,
      });

      return this.serializeSubscription(existing);
    } catch (err) {
      if (this.isNotFoundError(err)) {
        logger.info(
          'Workspace Events subscription no longer exists remotely during reactivation; pruning local state',
          {
            id: subscriptionId,
          }
        );
        this.removeTrackedSubscription(subscriptionId);
        await this.persistSubscriptions();
        throw new ServiceError(
          `Workspace Events subscription no longer exists remotely: ${subscriptionId}`,
          'NOT_FOUND',
          'WorkspaceEvents',
          false
        );
      }

      throw new ServiceError(
        `Failed to reactivate Workspace Events subscription: ${err instanceof Error ? err.message : String(err)}`,
        'INTERNAL_ERROR',
        'WorkspaceEvents',
        true
      );
    }
  }

  private scheduleRenewal(sub: ActiveSubscription): void {
    if (this.destroyed) {
      return;
    }

    if (sub.renewalTimer) {
      clearTimeout(sub.renewalTimer);
    }
    const msUntilRenewal = new Date(sub.expireTime).getTime() - Date.now() - 12 * 3600 * 1000;
    const delayMs = msUntilRenewal > 0 ? msUntilRenewal : 0;
    sub.renewalTimer = setTimeout(() => {
      void this.renewSubscription(sub.id);
    }, delayMs);
  }

  async renewSubscription(subscriptionId: string): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;
    if (!this.isSubscriptionResourceName(subscriptionId)) {
      logger.warn('Skipping Workspace Events renewal for unresolved operation name', {
        id: subscriptionId,
      });
      return;
    }

    try {
      const patchData = await this.executeWorkspaceEventsRequest<WorkspaceEventsOperation>(
        `/${subscriptionId}?updateMask=ttl`,
        {
          method: 'PATCH',
          body: JSON.stringify({ ttl: SUBSCRIPTION_TTL }),
        }
      );

      const renewed = await this.resolveSubscriptionOperation(
        patchData,
        sub.spreadsheetId,
        sub.notificationEndpoint
      );
      if (this.destroyed) {
        return;
      }
      sub.uid = renewed.uid;
      sub.expireTime = renewed.expireTime;
      sub.state = renewed.state;
      sub.suspensionReason = renewed.suspensionReason;
      sub.updateTime = renewed.updateTime;
      sub.reconciling = renewed.reconciling;
      sub.etag = renewed.etag;

      if (renewed.state === 'DELETED') {
        logger.info('Workspace Events subscription deleted remotely during renewal', {
          id: subscriptionId,
        });
        this.removeTrackedSubscription(subscriptionId);
        await this.persistSubscriptions();
        return;
      }

      if (this.shouldScheduleRenewal(sub)) {
        this.scheduleRenewal(sub);
      } else {
        logger.warn('Workspace Events subscription requires manual reactivation', {
          id: subscriptionId,
          state: sub.state,
          suspensionReason: sub.suspensionReason,
        });
      }

      if (this.destroyed) {
        return;
      }

      await this.persistSubscriptions();
      logger.info('Workspace Events subscription renewed', { id: subscriptionId });
    } catch (err) {
      if (this.isNotFoundError(err)) {
        logger.info(
          'Workspace Events subscription no longer exists remotely; pruning local state',
          {
            id: subscriptionId,
          }
        );
        this.removeTrackedSubscription(subscriptionId);
        if (this.destroyed) {
          return;
        }
        try {
          await this.persistSubscriptions();
        } catch (persistError) {
          logger.warn('Failed to persist pruned Workspace Events subscription state', {
            id: subscriptionId,
            error: persistError instanceof Error ? persistError.message : String(persistError),
          });
        }
        return;
      }

      logger.warn('Failed to renew Workspace Events subscription', {
        id: subscriptionId,
        error: String(err),
      });
    }
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub?.renewalTimer) clearTimeout(sub.renewalTimer);

    if (this.isSubscriptionResourceName(subscriptionId)) {
      try {
        const operation = await this.executeWorkspaceEventsRequest<WorkspaceEventsOperation>(
          `/${subscriptionId}`,
          {
            method: 'DELETE',
          }
        );
        if (operation.name?.startsWith('operations/') && operation.done !== true) {
          await this.waitForOperationCompletion(operation.name);
        }
      } catch (error) {
        if (!this.isNotFoundError(error)) {
          if (sub) {
            this.scheduleRenewal(sub);
          }
          throw new ServiceError(
            `Failed to delete Workspace Events subscription: ${error instanceof Error ? error.message : String(error)}`,
            'INTERNAL_ERROR',
            'WorkspaceEvents',
            true
          );
        }
      }
    }
    this.removeTrackedSubscription(subscriptionId);
    await this.persistSubscriptions();
  }

  listSubscriptions(spreadsheetId?: string): PersistedSubscription[] {
    const all = Array.from(this.subscriptions.values());
    return (spreadsheetId ? all.filter((s) => s.spreadsheetId === spreadsheetId) : all).map(
      (subscription) => this.serializeSubscription(subscription)
    );
  }

  destroy(): void {
    this.destroyed = true;
    for (const subscription of this.subscriptions.values()) {
      if (subscription.renewalTimer) {
        clearTimeout(subscription.renewalTimer);
      }
    }
  }
}
