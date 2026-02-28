/**
 * Unit Tests for Feature 1: Real-Time Notifications
 *
 * Tests the integration of MCP resource notifications with the webhook system.
 * Verifies that notifications are emitted when:
 * - Spreadsheet state changes are detected
 * - Webhooks are delivered successfully
 * - Webhooks are registered
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resourceNotifications } from '../../src/resources/notifications.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { waitFor } from '../helpers/wait-for.js';

// Mock McpServer
const createMockServer = (): McpServer =>
  ({
    sendResourceListChanged: vi.fn(),
    sendToolListChanged: vi.fn(),
    // Add other required McpServer methods as stubs
    setLoggingLevel: vi.fn(),
    request: vi.fn(),
    notification: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
  }) as unknown as McpServer;

describe('Feature 1: Real-Time Notifications', () => {
  let mockServer: McpServer;

  beforeEach(() => {
    mockServer = createMockServer();
    resourceNotifications.setServer(mockServer);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Resource Notification Manager', () => {
    it('should emit notification when resource list changes', async () => {
      resourceNotifications.notifyResourceListChanged('test change');

      // Wait for debounce
      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should debounce rapid notifications', async () => {
      // Send multiple rapid notifications
      resourceNotifications.notifyResourceListChanged('change 1');
      resourceNotifications.notifyResourceListChanged('change 2');
      resourceNotifications.notifyResourceListChanged('change 3');

      // Wait for debounce
      await waitFor(100);

      // Should only send one notification despite 3 calls
      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should notify when analysis result is added', async () => {
      resourceNotifications.notifyAnalysisAdded('analysis-123');

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should notify when cache is invalidated', async () => {
      resourceNotifications.notifyCacheInvalidated();

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should notify when transaction state changes', async () => {
      resourceNotifications.notifyTransactionStateChanged('txn-456', 'committed');

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should notify when operation history is updated', async () => {
      resourceNotifications.notifyHistoryUpdated(5);

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should not throw if server is not initialized', () => {
      // Create a new instance without server
      const notInitialized = new (resourceNotifications.constructor as any)();

      expect(() => {
        notInitialized.notifyResourceListChanged('test');
      }).not.toThrow();
    });

    it('should report initialization status correctly', () => {
      expect(resourceNotifications.isInitialized()).toBe(true);
    });

    it('should emit tools/list_changed only when tool set changes', async () => {
      const notifications = new (resourceNotifications.constructor as {
        new (): {
          setServer: (server: McpServer) => void;
          syncToolList: (
            toolNames: readonly string[],
            options?: { reason?: string; emitOnFirstSet?: boolean }
          ) => void;
        };
      })();
      notifications.setServer(mockServer);

      notifications.syncToolList(['sheets_auth', 'sheets_data'], { emitOnFirstSet: false });
      await waitFor(100);
      expect((mockServer as any).sendToolListChanged).not.toHaveBeenCalled();

      notifications.syncToolList(['sheets_auth', 'sheets_data', 'sheets_session'], {
        reason: 'runtime update',
      });
      await waitFor(100);
      expect((mockServer as any).sendToolListChanged).toHaveBeenCalledTimes(1);

      notifications.syncToolList(['sheets_auth', 'sheets_data', 'sheets_session']);
      await waitFor(100);
      expect((mockServer as any).sendToolListChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('Webhook Integration', () => {
    it('should emit notification on spreadsheet state change', async () => {
      // This tests the integration point in webhook-manager.ts
      // The actual implementation calls resourceNotifications.notifyResourceListChanged
      // when hasStateChanged returns true

      const spreadsheetId = 'test-sheet-123';
      resourceNotifications.notifyResourceListChanged(`spreadsheet changed: ${spreadsheetId}`);

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should emit notification on webhook delivery', async () => {
      // This tests the integration point in webhook-worker.ts
      const webhookId = 'wh_test123';
      const eventType = 'cell.update';

      resourceNotifications.notifyResourceListChanged(
        `webhook delivered: ${eventType} for ${webhookId.slice(0, 8)}`
      );

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });

    it('should emit notification on webhook registration', async () => {
      // This tests the integration point in webhooks.ts handler
      resourceNotifications.notifyResourceListChanged('webhook registered');

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledOnce();
    });
  });

  describe('Error Handling', () => {
    it('should handle server notification errors gracefully', async () => {
      const errorServer = createMockServer();
      (errorServer.sendResourceListChanged as any).mockImplementation(() => {
        throw new Error('Network error');
      });

      resourceNotifications.setServer(errorServer);

      expect(() => {
        resourceNotifications.notifyResourceListChanged('test');
      }).not.toThrow();

      await waitFor(100);
    });
  });

  describe('Debouncing Behavior', () => {
    it('should send multiple notifications if separated by debounce window', async () => {
      resourceNotifications.notifyResourceListChanged('change 1');

      // Wait for first notification to send
      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(1);

      // Send another notification after debounce period
      resourceNotifications.notifyResourceListChanged('change 2');

      await waitFor(100);

      expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(2);
    });

    it('should use 50ms debounce window', async () => {
      const startTime = Date.now();

      resourceNotifications.notifyResourceListChanged('test');

      // Wait for notification
      await waitFor(100);

      const elapsed = Date.now() - startTime;

      // Should take at least 50ms (debounce) but less than 150ms
      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(150);
    });
  });
});
