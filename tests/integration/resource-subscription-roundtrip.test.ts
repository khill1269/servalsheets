/**
 * E2E Resource Subscription Roundtrip Tests
 *
 * Tests the full MCP 2025-11-25 resource subscription protocol over a real
 * InMemoryTransport client–server pair. Validates that:
 *
 * - resources/subscribe registers the URI on the server
 * - notifications/resources/updated arrives at the client after a mutation
 * - resources/unsubscribe stops further notifications
 * - multiple subscriptions are scoped independently
 * - notifications/resources/list_changed fires when the resource list changes
 * - notifications/tools/list_changed fires when the tool list changes
 *
 * No external infrastructure (Google API, Redis, etc.) is required.
 * All mutations are triggered directly via the `resourceNotifications` singleton.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ResourceUpdatedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { AnyObjectSchema, SchemaOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpTestHarness } from '../helpers/mcp-test-harness.js';
import { createServalSheetsTestHarness } from '../helpers/mcp-test-harness.js';
import { resourceNotifications } from '../../src/resources/notifications.js';
import { waitFor } from '../helpers/wait-for.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register a one-shot notification handler on the client.
 * Resolves with the notification object when it arrives, or rejects on timeout.
 */
function waitForNotification<T extends AnyObjectSchema>(
  client: Client,
  schema: T,
  timeoutMs = 400
): Promise<SchemaOutput<T>> {
  return new Promise<SchemaOutput<T>>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: no notification received within ${timeoutMs}ms`)),
      timeoutMs
    );

    client.setNotificationHandler(schema, (notification) => {
      clearTimeout(timer);
      // Replace with a no-op so later notifications don't raise "handler replaced" errors.
      client.setNotificationHandler(schema, () => undefined);
      resolve(notification);
    });
  });
}

/**
 * Assert that no notification matching the schema arrives within `waitMs`.
 * Rejects if a notification does arrive.
 */
function expectNoNotification<T extends AnyObjectSchema>(
  client: Client,
  schema: T,
  waitMs = 200
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    client.setNotificationHandler(schema, () => {
      reject(new Error('Unexpected notification received'));
    });
    setTimeout(() => {
      client.setNotificationHandler(schema, () => undefined);
      resolve();
    }, waitMs);
  });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Resource Subscription Roundtrip (MCP 2025-11-25)', () => {
  let harness: McpTestHarness;

  beforeEach(async () => {
    harness = await createServalSheetsTestHarness({
      serverOptions: {
        name: 'servalsheets-subscription-test',
        version: '1.0.0-test',
      },
      clientCapabilities: {
        resources: { subscribe: true, listChanged: true },
      },
    });
  });

  afterEach(async () => {
    await harness.close();
  });

  // -------------------------------------------------------------------------
  // Test 1: Subscribe → mutate → notification delivered
  // -------------------------------------------------------------------------
  it('delivers resources/updated notification after subscribing to a URI', async () => {
    const { client } = harness;
    const targetUri = 'cache://stats';

    await client.subscribeResource({ uri: targetUri });

    const notificationPromise = waitForNotification(
      client,
      ResourceUpdatedNotificationSchema,
      400
    );

    resourceNotifications.notifyResourceUpdated(targetUri, 'test mutation');

    const notification = await notificationPromise;

    expect(notification).toBeDefined();
    expect(notification.params.uri).toBe(targetUri);
  });

  // -------------------------------------------------------------------------
  // Test 2: Unsubscribe → no more notifications
  // -------------------------------------------------------------------------
  it('stops delivering notifications after unsubscribing', async () => {
    const { client } = harness;
    const targetUri = 'history://operations';

    await client.subscribeResource({ uri: targetUri });

    // Confirm subscription is active
    const firstNotification = waitForNotification(client, ResourceUpdatedNotificationSchema, 400);
    resourceNotifications.notifyResourceUpdated(targetUri, 'pre-unsubscribe test');
    await firstNotification;

    await client.unsubscribeResource({ uri: targetUri });
    await waitFor(20);

    // Fire another update — must NOT arrive
    const noNotification = expectNoNotification(client, ResourceUpdatedNotificationSchema, 200);
    resourceNotifications.notifyResourceUpdated(targetUri, 'post-unsubscribe test');
    await noNotification;
  });

  // -------------------------------------------------------------------------
  // Test 3: Multiple subscriptions — only the mutated URI fires
  // -------------------------------------------------------------------------
  it('delivers notification only for the mutated URI when multiple subscriptions exist', async () => {
    const { client } = harness;
    const uriA = 'cache://stats';
    const uriB = 'history://operations';
    const uriC = 'transaction://stats';

    await client.subscribeResource({ uri: uriA });
    await client.subscribeResource({ uri: uriB });
    await client.subscribeResource({ uri: uriC });

    const receivedUris: string[] = [];

    // Install a persistent handler to collect all updated URIs
    const notificationPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timeout waiting for uriB notification')),
        400
      );
      client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
        receivedUris.push(notification.params.uri);
        // Resolve after the first notification
        clearTimeout(timer);
        // Keep handler installed for any stray subsequent notifications
        client.setNotificationHandler(ResourceUpdatedNotificationSchema, (extra) => {
          receivedUris.push(extra.params.uri);
        });
        resolve();
      });
    });

    resourceNotifications.notifyResourceUpdated(uriB, 'targeted mutation');
    await notificationPromise;

    // Wait to catch any stray notifications for uriA or uriC
    await waitFor(150);

    expect(receivedUris).toHaveLength(1);
    expect(receivedUris[0]).toBe(uriB);
  });

  // -------------------------------------------------------------------------
  // Test 4: resources/list_changed notification
  // -------------------------------------------------------------------------
  it('delivers notifications/resources/list_changed when the resource list changes', async () => {
    const { client } = harness;

    const notificationPromise = waitForNotification(
      client,
      ResourceListChangedNotificationSchema,
      400
    );

    resourceNotifications.notifyResourceListChanged('test list change');

    // list_changed carries no params — just assert it arrived
    await expect(notificationPromise).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 5: notifications/tools/list_changed fires when tool set changes
  // -------------------------------------------------------------------------
  it('delivers notifications/tools/list_changed when the tool set changes', async () => {
    const { client } = harness;

    const notificationPromise = waitForNotification(client, ToolListChangedNotificationSchema, 400);

    // Use emitOnFirstSet: true so the initial syncToolList call fires the notification
    resourceNotifications.syncToolList(['sheets_auth', 'sheets_data', 'sheets_session'], {
      emitOnFirstSet: true,
      reason: 'roundtrip-test staged update',
    });

    await expect(notificationPromise).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 6: Server capabilities include resources.subscribe
  // -------------------------------------------------------------------------
  it('server declares resources.subscribe capability', async () => {
    const { client } = harness;
    const capabilities = client.getServerCapabilities();

    expect(capabilities?.resources).toBeDefined();
    expect(capabilities?.resources?.subscribe).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 7: Subscribed subtree URI notified on spreadsheet mutation
  // -------------------------------------------------------------------------
  it('delivers notification for subscribed subtree URI when spreadsheet mutates', async () => {
    const { client } = harness;
    const spreadsheetId = 'test-sheet-abc123';
    const treeUri = `sheets:///${spreadsheetId}/Sheet1!A1:B10`;

    await client.subscribeResource({ uri: treeUri });

    const notificationPromise = waitForNotification(
      client,
      ResourceUpdatedNotificationSchema,
      400
    );

    resourceNotifications.notifySpreadsheetMutation(spreadsheetId, 'write operation');

    const notification = await notificationPromise;
    expect(notification.params.uri).toBe(treeUri);
  });
});
