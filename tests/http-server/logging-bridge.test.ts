import { describe, expect, it, vi } from 'vitest';
import { createMcpLogRateLimitState } from '../../src/server/logging-bridge-utils.js';
import { createHttpLoggingBridge } from '../../src/http-server/logging-bridge.js';
import type { HttpLoggingSubscriber } from '../../src/http-server/logging-registration.js';

describe('http logging bridge', () => {
  it('forwards matching logs to subscribed sessions and preserves the original logger result', async () => {
    const originalLog = vi.fn((..._args: unknown[]) => 'original-result' as unknown);
    const log = { log: originalLog };
    const bridge = createHttpLoggingBridge({ log });

    const debugSend = vi.fn().mockResolvedValue(undefined);
    const errorSend = vi.fn().mockResolvedValue(undefined);
    bridge.subscribers.set('debug', {
      requestedMcpLogLevel: 'debug',
      forwardingMcpLog: false,
      rateLimitState: createMcpLogRateLimitState(),
      server: { server: { sendLoggingMessage: debugSend } } as never,
    } satisfies HttpLoggingSubscriber);
    bridge.subscribers.set('error', {
      requestedMcpLogLevel: 'error',
      forwardingMcpLog: false,
      rateLimitState: createMcpLogRateLimitState(),
      server: { server: { sendLoggingMessage: errorSend } } as never,
    } satisfies HttpLoggingSubscriber);

    bridge.installLoggingBridge();
    const installedLog = log.log;
    bridge.installLoggingBridge();

    expect(log.log).toBe(installedLog);

    const result = log.log('info', 'http-bridge-probe', {
      source: 'tests/http-server/logging-bridge.test.ts',
    });

    expect(result).toBe('original-result');
    expect(originalLog).toHaveBeenCalledOnce();

    await vi.waitFor(() => {
      expect(debugSend).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: 'servalsheets',
          level: 'info',
        })
      );
    });
    expect(errorSend).not.toHaveBeenCalled();
  });

  it('swallows notification failures and clears the forwarding flag', async () => {
    const log = {
      log: vi.fn(() => undefined),
    };
    const bridge = createHttpLoggingBridge({ log });

    bridge.subscribers.set('debug', {
      requestedMcpLogLevel: 'debug',
      forwardingMcpLog: false,
      rateLimitState: createMcpLogRateLimitState(),
      server: {
        server: {
          sendLoggingMessage: vi.fn().mockRejectedValue(new Error('notification failed')),
        },
      } as never,
    } satisfies HttpLoggingSubscriber);

    bridge.installLoggingBridge();
    (log.log as (...args: unknown[]) => unknown)('error', 'http-bridge-error-probe');

    await vi.waitFor(() => {
      expect(bridge.subscribers.get('debug')?.forwardingMcpLog).toBe(false);
    });
  });
});
