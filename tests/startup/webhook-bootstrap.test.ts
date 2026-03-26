import { describe, expect, it, vi } from 'vitest';

const webhookBootstrapMocks = vi.hoisted(() => ({
  initWebhookQueue: vi.fn(),
  resetWebhookQueue: vi.fn(),
  initWebhookManager: vi.fn(),
  resetWebhookManager: vi.fn(),
}));

vi.mock('../../src/services/webhook-queue.js', () => ({
  initWebhookQueue: webhookBootstrapMocks.initWebhookQueue,
  resetWebhookQueue: webhookBootstrapMocks.resetWebhookQueue,
}));

vi.mock('../../src/services/webhook-manager.js', () => ({
  initWebhookManager: webhookBootstrapMocks.initWebhookManager,
  resetWebhookManager: webhookBootstrapMocks.resetWebhookManager,
}));

import {
  DEFAULT_WEBHOOK_ENDPOINT,
  initializeWebhookBootstrap,
} from '../../src/startup/webhook-bootstrap.js';

describe('webhook bootstrap helper', () => {
  it('initializes webhook queue and manager with explicit options', () => {
    const googleClient = { sheets: {}, drive: {} };
    const redisClient = { redis: true };

    const result = initializeWebhookBootstrap({
      googleClient: googleClient as never,
      redisClient,
      webhookEndpoint: 'https://example.com/webhook',
    });

    expect(webhookBootstrapMocks.initWebhookQueue).toHaveBeenCalledWith(redisClient);
    expect(webhookBootstrapMocks.initWebhookManager).toHaveBeenCalledWith(
      redisClient,
      googleClient,
      'https://example.com/webhook'
    );
    expect(result).toEqual({ webhookEndpoint: 'https://example.com/webhook' });
  });

  it('resets existing infrastructure when requested and falls back to the default endpoint', () => {
    const googleClient = { sheets: {}, drive: {} };

    const result = initializeWebhookBootstrap({
      googleClient: googleClient as never,
      resetExisting: true,
    });

    expect(webhookBootstrapMocks.resetWebhookQueue).toHaveBeenCalledTimes(1);
    expect(webhookBootstrapMocks.resetWebhookManager).toHaveBeenCalledTimes(1);
    expect(webhookBootstrapMocks.initWebhookQueue).toHaveBeenCalledWith(null);
    expect(webhookBootstrapMocks.initWebhookManager).toHaveBeenCalledWith(
      null,
      googleClient,
      DEFAULT_WEBHOOK_ENDPOINT
    );
    expect(result).toEqual({ webhookEndpoint: DEFAULT_WEBHOOK_ENDPOINT });
  });
});
