import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggingRegistrationMocks = vi.hoisted(() => ({
  handleLoggingSetLevel: vi.fn(),
}));

vi.mock('../../src/handlers/logging.js', () => ({
  handleLoggingSetLevel: loggingRegistrationMocks.handleLoggingSetLevel,
}));

import {
  registerHttpLoggingSetLevelHandler,
  type HttpLoggingSubscriber,
} from '../../src/http-server/logging-registration.js';

describe('http logging registration helper', () => {
  beforeEach(() => {
    loggingRegistrationMocks.handleLoggingSetLevel.mockReset();
  });

  it('registers logging/setLevel and updates subscriber state', async () => {
    const setRequestHandler = vi.fn();
    const server = {
      server: {
        setRequestHandler,
      },
    };
    const subscribers = new Map<string, HttpLoggingSubscriber>();
    const installLoggingBridge = vi.fn();
    const createRateLimitState = vi.fn(() => ({
      windowStartedAt: 1,
      messagesInWindow: 2,
      droppedInWindow: 3,
    }));
    const log = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    loggingRegistrationMocks.handleLoggingSetLevel.mockResolvedValueOnce({
      previousLevel: 'info',
      newLevel: 'debug',
    });

    registerHttpLoggingSetLevelHandler({
      server: server as never,
      subscriberId: 'http:test',
      subscribers,
      installLoggingBridge,
      createRateLimitState,
      log: log as never,
    });

    expect(setRequestHandler).toHaveBeenCalledTimes(1);
    const handler = setRequestHandler.mock.calls[0]?.[1];
    expect(handler).toBeTypeOf('function');

    await expect(handler({ params: { level: 'debug' } })).resolves.toEqual({});

    expect(subscribers.get('http:test')).toEqual({
      requestedMcpLogLevel: 'debug',
      forwardingMcpLog: false,
      rateLimitState: {
        windowStartedAt: 1,
        messagesInWindow: 2,
        droppedInWindow: 3,
      },
      server,
    });
    expect(installLoggingBridge).toHaveBeenCalledTimes(1);
    expect(loggingRegistrationMocks.handleLoggingSetLevel).toHaveBeenCalledWith({
      level: 'debug',
    });
    expect(log.info).toHaveBeenCalledWith('Log level changed via logging/setLevel', {
      previousLevel: 'info',
      newLevel: 'debug',
    });
  });

  it('reuses existing subscriber rate limit state when updating the level', async () => {
    const setRequestHandler = vi.fn();
    const server = {
      server: {
        setRequestHandler,
      },
    };
    const existingRateLimitState = {
      windowStartedAt: 10,
      messagesInWindow: 4,
      droppedInWindow: 1,
    };
    const subscribers = new Map<string, HttpLoggingSubscriber>([
      [
        'http:test',
        {
          requestedMcpLogLevel: 'info',
          forwardingMcpLog: true,
          rateLimitState: existingRateLimitState,
          server: server as never,
        },
      ],
    ]);

    loggingRegistrationMocks.handleLoggingSetLevel.mockResolvedValueOnce({
      previousLevel: 'info',
      newLevel: 'error',
    });

    registerHttpLoggingSetLevelHandler({
      server: server as never,
      subscriberId: 'http:test',
      subscribers,
      installLoggingBridge: vi.fn(),
      createRateLimitState: vi.fn(() => {
        throw new Error('should not be called');
      }),
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as never,
    });

    const handler = setRequestHandler.mock.calls[0]?.[1];
    await handler({ params: { level: 'error' } });

    expect(subscribers.get('http:test')?.forwardingMcpLog).toBe(true);
    expect(subscribers.get('http:test')?.rateLimitState).toBe(existingRateLimitState);
  });
});
