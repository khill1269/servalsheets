import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolve } = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

const { getEnvMock } = vi.hoisted(() => ({
  getEnvMock: vi.fn().mockReturnValue({ WEBHOOK_DNS_STRICT: true }),
}));

vi.mock('node:dns', () => ({
  default: {
    promises: {
      resolve,
    },
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  getEnv: getEnvMock,
}));

import { validateWebhookUrl } from '../../src/services/webhook-url-validation.js';

describe('validateWebhookUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue(['93.184.216.34']);
    getEnvMock.mockReturnValue({ WEBHOOK_DNS_STRICT: true });
  });

  it('rejects non-HTTPS URLs', async () => {
    await expect(validateWebhookUrl('http://example.com/webhook')).rejects.toThrow(
      'Webhook URL must use HTTPS'
    );
  });

  it('rejects localhost targets before DNS lookup', async () => {
    await expect(validateWebhookUrl('https://localhost/webhook')).rejects.toThrow(
      'Webhook URL cannot target localhost'
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('rejects DNS rebinding to private IPs', async () => {
    resolve.mockResolvedValue(['10.0.0.5']);

    await expect(validateWebhookUrl('https://example.com/webhook')).rejects.toThrow(
      'DNS rebinding protection'
    );
    expect(resolve).toHaveBeenCalledWith('example.com');
  });

  it('accepts public HTTPS webhook URLs', async () => {
    await expect(validateWebhookUrl('https://example.com/webhook')).resolves.toBeUndefined();
    expect(resolve).toHaveBeenCalledWith('example.com');
  });

  describe('DNS failure policy', () => {
    it('blocks registration when DNS fails and WEBHOOK_DNS_STRICT=true (default)', async () => {
      getEnvMock.mockReturnValue({ WEBHOOK_DNS_STRICT: true });
      resolve.mockRejectedValue(new Error('ENOTFOUND example.com'));

      await expect(validateWebhookUrl('https://example.com/webhook')).rejects.toThrow(
        'DNS resolution failed for example.com'
      );
    });

    it('allows registration when DNS fails and WEBHOOK_DNS_STRICT=false', async () => {
      getEnvMock.mockReturnValue({ WEBHOOK_DNS_STRICT: false });
      resolve.mockRejectedValue(new Error('ENOTFOUND example.com'));

      await expect(validateWebhookUrl('https://example.com/webhook')).resolves.toBeUndefined();
    });

    it('always blocks DNS rebinding regardless of WEBHOOK_DNS_STRICT', async () => {
      getEnvMock.mockReturnValue({ WEBHOOK_DNS_STRICT: false });
      resolve.mockRejectedValue(
        new Error('Webhook URL hostname resolves to a private/internal IP address (DNS rebinding protection)')
      );

      await expect(validateWebhookUrl('https://evil.com/webhook')).rejects.toThrow(
        'DNS rebinding'
      );
    });
  });
});
