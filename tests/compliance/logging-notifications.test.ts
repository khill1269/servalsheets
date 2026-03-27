/**
 * MCP logging notification bridge regression tests.
 *
 * Validates server-side bridge wiring without requiring network transport.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { ServalSheetsServer } from '../../src/server.js';
import { createMcpLogRateLimitState } from '../../src/server/logging-bridge-utils.js';
import { installServerLoggingBridge } from '../../src/server/logging-bridge.js';
import { logger } from '../../src/utils/logger.js';

describe('MCP Logging Notifications', () => {
  let server: ServalSheetsServer;
  const originalLoggerLog = logger.log;

  beforeAll(async () => {
    server = new ServalSheetsServer({});
    await server.initialize();
  });

  afterAll(async () => {
    await server.shutdown();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.log = originalLoggerLog;
  });

  function installBridge(requestedMcpLogLevel: 'debug' | 'info' | 'warning' | 'error') {
    let loggingBridgeInstalled = false;
    let forwardingMcpLog = false;
    const rateLimitState = createMcpLogRateLimitState();

    installServerLoggingBridge({
      loggingBridgeInstalled,
      setLoggingBridgeInstalled: (value) => {
        loggingBridgeInstalled = value;
      },
      getRequestedMcpLogLevel: () => requestedMcpLogLevel,
      getForwardingMcpLog: () => forwardingMcpLog,
      setForwardingMcpLog: (value) => {
        forwardingMcpLog = value;
      },
      getRateLimitState: () => rateLimitState,
      server: server.server,
    });
  }

  it('should forward logs via sendLoggingMessage when MCP level is set', async () => {
    installBridge('debug');

    const sendLoggingMessageSpy = vi
      .spyOn(server.server.server, 'sendLoggingMessage')
      .mockResolvedValue(undefined);

    const probeMessage = 'logging-notification-regression-probe';
    logger.info(probeMessage, {
      source: 'tests/compliance/logging-notifications.test.ts',
    });

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

  it('redacts sensitive metadata before emitting MCP log notifications', async () => {
    installBridge('debug');

    const sendLoggingMessageSpy = vi
      .spyOn(server.server.server, 'sendLoggingMessage')
      .mockResolvedValue(undefined);

    logger.info('redaction-probe', {
      access_token: 'super-secret-token',
      nested: { apiKey: 'another-secret' },
    });

    await vi.waitFor(() => {
      expect(sendLoggingMessageSpy).toHaveBeenCalled();
    });

    const lastPayload = sendLoggingMessageSpy.mock.calls.at(-1)?.[0];
    const serialized = JSON.stringify(lastPayload);
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('another-secret');
  });
});
