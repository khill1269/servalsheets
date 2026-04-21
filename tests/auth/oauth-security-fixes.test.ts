/**
 * Auth security fixes — three independent regression tests.
 *
 * Fix 2: /oauth/revoke calls Google's revoke endpoint with the stored refresh token
 * Fix 3: DCR auto-consent emits an audit event via the hash-chain audit logger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { type Express } from 'express';
import { OAuthProvider } from '../../src/auth/oauth-provider.js';
import { MemorySessionStore } from '../../src/storage/session-store.js';
import { requestApp } from '../helpers/request-app.js';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted so they apply before the real modules load)
// ---------------------------------------------------------------------------

const auditLoggerMock = {
  logAuthentication: vi.fn(),
  logConfiguration: vi.fn(),
  logEvent: vi.fn(),
};

vi.mock('../../src/services/audit-logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/audit-logger.js')>();
  return {
    ...actual,
    getAuditLogger: () => auditLoggerMock,
  };
});

vi.mock('../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env.js')>();
  return {
    ...actual,
    env: {
      OAUTH_MAX_TOKEN_TTL: 86400,
      LOG_LEVEL: 'error',
    },
  };
});

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

function buildApp(sessionStore: MemorySessionStore, opts: { autoConsent?: boolean } = {}): {
  app: Express;
  oauthProvider: OAuthProvider;
} {
  if (opts.autoConsent) {
    process.env['OAUTH_DCR_AUTO_CONSENT'] = 'true';
  } else {
    delete process.env['OAUTH_DCR_AUTO_CONSENT'];
  }

  const oauthProvider = new OAuthProvider({
    issuer: 'https://test.servalsheets.example.com',
    clientId: 'test-client',
    clientSecret: 'test-secret-security-fixes',
    jwtSecret: 'jwt-secret-security-fixes',
    stateSecret: 'state-secret-security-fixes',
    allowedRedirectUris: ['https://example.com/callback'],
    accessTokenTtl: 3600,
    refreshTokenTtl: 86400,
    sessionStore,
  });

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(oauthProvider.createRouter());

  return { app, oauthProvider };
}

// ---------------------------------------------------------------------------
// Fix 2: /oauth/revoke calls Google outbound revoke endpoint
// ---------------------------------------------------------------------------

describe('Fix 2: /oauth/revoke calls Google outbound revoke endpoint', () => {
  let sessionStore: MemorySessionStore;
  let app: Express;
  let oauthProvider: OAuthProvider;

  const clientId = 'test-client';
  const clientSecret = 'test-secret-security-fixes';

  beforeEach(() => {
    sessionStore = new MemorySessionStore();
    ({ app, oauthProvider } = buildApp(sessionStore));
  });

  afterEach(() => {
    oauthProvider.destroy();
    vi.clearAllMocks();
  });

  it('calls Google revoke endpoint with the stored refresh token when revoking a known session', async () => {
    const userId = 'user-fix2-google-revoke';
    const refreshToken = 'fix2-refresh-token';
    const storedGoogleRefreshToken = 'placeholder-google-refresh-token-fix2';

    // Seed: refresh-token row + google_tokens row for the same user
    await sessionStore.set(`refresh:${refreshToken}`, {
      userId,
      clientId,
      scope: 'sheets:read',
      expiresAt: Date.now() + 3_600_000,
    } as unknown as Parameters<typeof sessionStore.set>[1]);

    await sessionStore.set(`google_tokens:${userId}`, {
      accessToken: 'placeholder-access-token-fix2',
      refreshToken: storedGoogleRefreshToken,
      expiresAt: Date.now() + 3_600_000,
    } as unknown as Parameters<typeof sessionStore.set>[1]);

    // Mock the global fetch so we can intercept the Google revoke call
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestApp(app, {
      method: 'POST',
      path: '/oauth/revoke',
      body: { token: refreshToken },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
    });

    expect(response.status).toBe(200);

    // The handler must have called Google's token revocation endpoint with the
    // stored Google refresh token (not the MCP refresh token).
    const googleRevokeCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
      String(url).includes('accounts.google.com') && String(url).includes('revoke')
    );
    expect(googleRevokeCalls.length).toBeGreaterThan(0);
    const revokeUrl: string = googleRevokeCalls[0][0] as string;
    expect(revokeUrl).toContain(storedGoogleRefreshToken);

    vi.unstubAllGlobals();
  });

  it('still deletes local tokens even if Google revoke call fails', async () => {
    const userId = 'user-fix2-google-revoke-fail';
    const refreshToken = 'fix2-refresh-token-fail';

    await sessionStore.set(`refresh:${refreshToken}`, {
      userId,
      clientId,
      scope: 'sheets:read',
      expiresAt: Date.now() + 3_600_000,
    } as unknown as Parameters<typeof sessionStore.set>[1]);

    await sessionStore.set(`google_tokens:${userId}`, {
      accessToken: 'placeholder-access-token-fail',
      refreshToken: 'placeholder-google-refresh-fail',
      expiresAt: Date.now() + 3_600_000,
    } as unknown as Parameters<typeof sessionStore.set>[1]);

    // Simulate Google being unavailable
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestApp(app, {
      method: 'POST',
      path: '/oauth/revoke',
      body: { token: refreshToken },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
    });

    // Local revocation MUST succeed even when Google is unavailable
    expect(response.status).toBe(200);
    expect(await sessionStore.get(`refresh:${refreshToken}`)).toBeUndefined();
    expect(await sessionStore.get(`google_tokens:${userId}`)).toBeUndefined();

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Fix 3: DCR auto-consent emits audit event
// ---------------------------------------------------------------------------

describe('Fix 3: DCR auto-consent emits audit event', () => {
  let sessionStore: MemorySessionStore;
  let app: Express;
  let oauthProvider: OAuthProvider;

  beforeEach(() => {
    sessionStore = new MemorySessionStore();
    auditLoggerMock.logAuthentication.mockReset();
    auditLoggerMock.logConfiguration.mockReset();
  });

  afterEach(() => {
    oauthProvider.destroy();
    delete process.env['OAUTH_DCR_AUTO_CONSENT'];
    vi.clearAllMocks();
  });

  it('emits an audit event when OAUTH_DCR_AUTO_CONSENT=true and registration succeeds', async () => {
    ({ app, oauthProvider } = buildApp(sessionStore, { autoConsent: true }));

    const response = await requestApp(app, {
      method: 'POST',
      path: '/oauth/register',
      body: {
        client_name: 'Auto-Consent Test Client',
        redirect_uris: ['https://example.com/callback'],
        grant_types: ['authorization_code'],
        scope: 'sheets:read',
      } as unknown as Record<string, unknown>,
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.status).toBe(201);

    // The audit logger MUST have been called to create a tamper-evident record
    // of the auto-consented DCR registration.
    const wasAuditCalled =
      auditLoggerMock.logAuthentication.mock.calls.length > 0 ||
      auditLoggerMock.logConfiguration.mock.calls.length > 0;
    expect(wasAuditCalled).toBe(true);

    // The audit call must include the client name (so reviewers can identify
    // which client was auto-consented without needing to join on the clientId).
    const allCalls = [
      ...auditLoggerMock.logAuthentication.mock.calls,
      ...auditLoggerMock.logConfiguration.mock.calls,
    ];
    const auditPayload = allCalls[0][0] as Record<string, unknown>;
    const payloadStr = JSON.stringify(auditPayload);
    expect(payloadStr).toContain('Auto-Consent Test Client');
  });

  it('does NOT emit audit event when OAUTH_DCR_AUTO_CONSENT=false', async () => {
    ({ app, oauthProvider } = buildApp(sessionStore, { autoConsent: false }));

    await requestApp(app, {
      method: 'POST',
      path: '/oauth/register',
      body: {
        client_name: 'No-Auto-Consent Client',
        redirect_uris: ['https://example.com/callback'],
        grant_types: ['authorization_code'],
        scope: 'sheets:read',
      } as unknown as Record<string, unknown>,
      headers: {
        'content-type': 'application/json',
      },
    });

    // No DCR auto-consent audit event should fire when auto-consent is disabled
    expect(auditLoggerMock.logAuthentication.mock.calls.length).toBe(0);
    expect(auditLoggerMock.logConfiguration.mock.calls.length).toBe(0);
  });
});
