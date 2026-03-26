import { beforeEach, describe, expect, it, vi } from 'vitest';

const startupGoogleClientMocks = vi.hoisted(() => ({
  createGoogleApiClient: vi.fn(),
  shouldAllowDegradedStartup: vi.fn(),
  getProcessBreadcrumbs: vi.fn(() => ['boot']),
  loggerWarn: vi.fn(),
}));

vi.mock('../../src/services/google-api.js', () => ({
  createGoogleApiClient: startupGoogleClientMocks.createGoogleApiClient,
}));

vi.mock('../../src/server/runtime-diagnostics.js', () => ({
  shouldAllowDegradedStartup: startupGoogleClientMocks.shouldAllowDegradedStartup,
  getProcessBreadcrumbs: startupGoogleClientMocks.getProcessBreadcrumbs,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    warn: startupGoogleClientMocks.loggerWarn,
  },
}));

import {
  createOptionalGoogleClient,
  createTokenBackedGoogleClient,
} from '../../src/startup/google-client-bootstrap.js';

describe('google client bootstrap helper', () => {
  beforeEach(() => {
    startupGoogleClientMocks.createGoogleApiClient.mockReset();
    startupGoogleClientMocks.shouldAllowDegradedStartup.mockReset();
    startupGoogleClientMocks.getProcessBreadcrumbs.mockClear();
    startupGoogleClientMocks.loggerWarn.mockReset();
  });

  it('creates a Google client from access and refresh tokens', async () => {
    const client = { sheets: {}, drive: {} };
    startupGoogleClientMocks.createGoogleApiClient.mockResolvedValueOnce(client);

    const result = await createTokenBackedGoogleClient({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(startupGoogleClientMocks.createGoogleApiClient).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(result).toBe(client);
  });

  it('passes through an undefined refresh token', async () => {
    startupGoogleClientMocks.createGoogleApiClient.mockResolvedValueOnce({ client: true });

    await createTokenBackedGoogleClient({
      accessToken: 'access-token',
    });

    expect(startupGoogleClientMocks.createGoogleApiClient).toHaveBeenLastCalledWith({
      accessToken: 'access-token',
      refreshToken: undefined,
    });
  });

  it('returns null when optional Google client config is absent', async () => {
    const result = await createOptionalGoogleClient({});

    expect(result).toBeNull();
    expect(startupGoogleClientMocks.createGoogleApiClient).not.toHaveBeenCalled();
  });

  it('returns null and warns when degraded startup is allowed', async () => {
    const error = new Error('auth failed');
    startupGoogleClientMocks.createGoogleApiClient.mockRejectedValueOnce(error);
    startupGoogleClientMocks.shouldAllowDegradedStartup.mockReturnValueOnce(true);

    const result = await createOptionalGoogleClient({
      googleApiOptions: { accessToken: 'access-token' },
      transport: 'stdio',
      nodeEnv: 'development',
      allowDegradedExplicitly: true,
    });

    expect(result).toBeNull();
    expect(startupGoogleClientMocks.shouldAllowDegradedStartup).toHaveBeenCalledWith(error, {
      transport: 'stdio',
      nodeEnv: 'development',
      allowDegradedExplicitly: true,
      isAuthError: expect.any(Function),
    });
    expect(startupGoogleClientMocks.loggerWarn).toHaveBeenCalledWith(
      'Google client initialization failed; continuing in auth-only mode',
      {
        error: 'auth failed',
        transport: 'stdio',
        breadcrumbs: ['boot'],
      }
    );
  });

  it('rethrows when degraded startup is not allowed', async () => {
    const error = new Error('fatal');
    startupGoogleClientMocks.createGoogleApiClient.mockRejectedValueOnce(error);
    startupGoogleClientMocks.shouldAllowDegradedStartup.mockReturnValueOnce(false);

    await expect(
      createOptionalGoogleClient({
        googleApiOptions: { accessToken: 'access-token' },
        transport: 'http',
      })
    ).rejects.toThrow('fatal');

    expect(startupGoogleClientMocks.loggerWarn).not.toHaveBeenCalled();
  });
});
