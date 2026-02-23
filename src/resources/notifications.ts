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
