/**
 * ServalSheets - Resource Notifications
 *
 * Provides utilities for notifying clients when resources change.
 * Uses MCP's notifications/resources/list_changed notification.
 *
 * @module resources/notifications
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../utils/logger.js';

/**
 * Singleton manager for resource change notifications.
 * Call setServer() during initialization to enable notifications.
 */
class ResourceNotificationManager {
  private _server: McpServer | null = null;
  private _notificationsPending = 0;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _debounceMs = 50; // Debounce rapid changes
  private _toolListFingerprint: string | null = null;
  private _toolDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Set the MCP server instance for sending notifications
   */
  setServer(server: McpServer): void {
    this._server = server;
    logger.info('Resource notification manager initialized');
  }

  /**
   * Send a resource list changed notification to the client.
   * Debounces rapid changes to avoid flooding.
   */
  notifyResourceListChanged(reason?: string): void {
    if (!this._server) {
      return;
    }

    this._notificationsPending++;

    // Clear any pending debounce timer
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    // Debounce: wait for rapid changes to settle
    this._debounceTimer = setTimeout(() => {
      if (this._server) {
        try {
          this._server.sendResourceListChanged();
          if (reason) {
            logger.debug('Resource list changed notification sent', { reason });
          }
        } catch (error) {
          // Client may not be connected - ignore
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('Failed to send resource notification', { error: message });
        }
      }
      this._notificationsPending = 0;
      this._debounceTimer = null;
    }, this._debounceMs);
  }

  /**
   * Update known tool list and optionally send notifications/tools/list_changed when it changes.
   */
  syncToolList(
    toolNames: readonly string[],
    options?: { reason?: string; emitOnFirstSet?: boolean }
  ): void {
    const fingerprint = [...toolNames].sort().join('|');
    const firstSet = this._toolListFingerprint === null;
    const changed = this._toolListFingerprint !== fingerprint;
    this._toolListFingerprint = fingerprint;

    if (!changed) {
      return;
    }
    if (firstSet && !options?.emitOnFirstSet) {
      return;
    }
    if (!this._server) {
      return;
    }

    if (this._toolDebounceTimer) {
      clearTimeout(this._toolDebounceTimer);
    }

    this._toolDebounceTimer = setTimeout(() => {
      if (!this._server) {
        return;
      }
      try {
        this._server.sendToolListChanged();
        if (options?.reason) {
          logger.debug('Tool list changed notification sent', { reason: options.reason });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to send tools/list_changed notification', { error: message });
      } finally {
        this._toolDebounceTimer = null;
      }
    }, this._debounceMs);
  }

  /**
   * Notify when an analysis result is added
   */
  notifyAnalysisAdded(analysisId: string): void {
    this.notifyResourceListChanged(`analysis result added: ${analysisId}`);
  }

  /**
   * Notify when cache is invalidated
   */
  notifyCacheInvalidated(): void {
    this.notifyResourceListChanged('cache invalidated');
  }

  /**
   * Notify when transaction state changes
   */
  notifyTransactionStateChanged(transactionId: string, newState: string): void {
    this.notifyResourceListChanged(`transaction ${transactionId} changed to ${newState}`);
  }

  /**
   * Notify when operation history is updated
   */
  notifyHistoryUpdated(operationCount: number): void {
    this.notifyResourceListChanged(`history updated (${operationCount} operations)`);
  }

  /**
   * Check if the notification manager is initialized
   */
  isInitialized(): boolean {
    return this._server !== null;
  }
}

// Singleton instance
export const resourceNotifications = new ResourceNotificationManager();

/**
 * Convenience function to set the server on the singleton
 */
export function initializeResourceNotifications(server: McpServer): void {
  resourceNotifications.setServer(server);
}
