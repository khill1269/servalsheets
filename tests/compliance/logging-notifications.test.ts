/**
 * MCP logging notification bridge regression tests.
 *
 * Validates server-side bridge wiring without requiring network transport.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ServalSheetsServer } from '../../src/server.js';

describe('MCP Logging Notifications', () => {
  let server: ServalSheetsServer;

  beforeAll(async () => {
    server = new ServalSheetsServer({});
    await server.initialize();
  });

  afterAll(async () => {
    await server.shutdown();
  });

  it('should forward logs via sendLoggingMessage when MCP level is set', async () => {
    const internal = server as unknown as {
      requestedMcpLogLevel?: string;
      forwardLogMessage: (levelOrEntry: unknown, message: unknown, meta: unknown[]) => void;
    };
    internal.requestedMcpLogLevel = 'debug';

    const sendLoggingMessageSpy = vi
      .spyOn(server.server.server, 'sendLoggingMessage')
      .mockResolvedValue(undefined);

    const probeMessage = 'logging-notification-regression-probe';
    internal.forwardLogMessage('info', probeMessage, [
      { source: 'tests/compliance/logging-notifications.test.ts' },
    ]);

    await vi.waitFor(
      () => {
        const found = sendLoggingMessageSpy.mock.calls.some(([payload]) => {
          const record = payload as { logger?: string; data?: unknown };
          return (
            record.logger === 'servalsheets' &&
            record.data !== undefined &&
            JSON.stringify(record.data).includes(probeMessage)
          );
        });
        expect(found).toBe(true);
      },
      { timeout: 3000 }
    );
  });
});
