import { afterEach, describe, expect, it, vi } from 'vitest';

import { SecEdgarConnector } from '../../src/connectors/sec-edgar-connector.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('SecEdgarConnector', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a project contact in the default SEC user agent header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    const connector = new SecEdgarConnector();
    const health = await connector.healthCheck();

    expect(health.healthy).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('data.sec.gov'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'ServalSheets security@servalsheets.dev',
        }),
      })
    );
  });

  it('allows callers to override the SEC user agent header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    const connector = new SecEdgarConnector();
    await connector.configure({
      type: 'api_key',
      custom: { userAgent: 'ServalSheets test-contact@example.com' },
    });
    await connector.healthCheck();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'ServalSheets test-contact@example.com',
        }),
      })
    );
  });
});
