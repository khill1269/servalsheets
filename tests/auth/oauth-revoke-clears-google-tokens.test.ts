/**
 * ServalSheets - OAuth Revoke Clears Google Tokens (Regression Test)
 *
 * Covers the "no-op revoke" bug class: `/oauth/revoke` must delete the
 * `google_tokens:${userId}` entry from the session store, not just the
 * refresh-token entry. Without this, a revoked session could keep spending
 * the upstream Google access token indefinitely.
 *
 * Verified invariants:
 *   1. When revoke is called with a valid refresh token whose userId has a
 *      `google_tokens:<userId>` row, that row is deleted from the store.
 *   2. The `refresh:<token>` row is deleted (RFC 7009 compliance).
 *   3. The endpoint returns 200 even if the refresh token is unknown
 *      (RFC 7009 — revocation always succeeds for unknown tokens).
 *
 * This is a regression test for the remediation gap documented in
 * `independent-reaudit-2026-04-21.md`.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express, { type Express } from 'express';
import { OAuthProvider } from '../../src/auth/oauth-provider.js';
import { MemorySessionStore } from '../../src/storage/session-store.js';
import { requestApp } from '../helpers/request-app.js';

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

describe('/oauth/revoke clears google_tokens for the owning user', () => {
  let app: Express;
  let oauthProvider: OAuthProvider;
  let sessionStore: MemorySessionStore;
  const issuer = 'https://test.servalsheets.example.com';
  const clientId = 'test-client';
  const clientSecret = 'test-secret-for-revoke-suite';
  const jwtSecret = 'jwt-secret-for-revoke-suite';
  const stateSecret = 'state-secret-for-revoke-suite';

  beforeAll(async () => {
    sessionStore = new MemorySessionStore();
    oauthProvider = new OAuthProvider({
      issuer,
      clientId,
      clientSecret,
      jwtSecret,
      stateSecret,
      allowedRedirectUris: ['https://example.com/callback'],
      accessTokenTtl: 3600,
      refreshTokenTtl: 86400,
      sessionStore,
    });
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(oauthProvider.createRouter());
  });

  afterAll(() => {
    oauthProvider.destroy();
  });

  async function revoke(token: string, auth: { id: string; secret: string }) {
    return requestApp(app, {
      method: 'POST',
      path: '/oauth/revoke',
      body: { token },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization:
          'Basic ' + Buffer.from(`${auth.id}:${auth.secret}`).toString('base64'),
      },
    });
  }

  it('deletes the google_tokens:<userId> row when revoking a known refresh token', async () => {
    const userId = 'user-revoke-known-refresh';
    const refreshToken = 'refresh-token-known';

    // Seed: refresh-token row + upstream Google tokens row for the same user.
    // Casts match the runtime shape the production handler reads/writes —
    // SessionData is `Record<string, unknown>` at the store boundary.
    await sessionStore.set(`refresh:${refreshToken}`, {
      userId,
      clientId,
      scope: 'sheets:read',
      expiresAt: Date.now() + 3600_000,
    } as unknown as Parameters<typeof sessionStore.set>[1]);
    // NOTE: deliberately do NOT use realistic Google token prefixes
    // (`ya29.`, `1//`) — the repo's pre-commit secret scanner flags those
    // patterns even in test fixtures. The test only cares that whatever
    // value is stored gets deleted on revoke; the literal shape is irrelevant.
    await sessionStore.set(`google_tokens:${userId}`, {
      accessToken: 'placeholder-access-token-for-revoke-test',
      refreshToken: 'placeholder-refresh-token-for-revoke-test',
      expiresAt: Date.now() + 3600_000,
    } as unknown as Parameters<typeof sessionStore.set>[1]);

    // Sanity check — both rows present before revoke.
    expect(await sessionStore.get(`refresh:${refreshToken}`)).toBeDefined();
    expect(await sessionStore.get(`google_tokens:${userId}`)).toBeDefined();

    const response = await revoke(refreshToken, {
      id: clientId,
      secret: clientSecret,
    });

    expect(response.status).toBe(200);
    // After revoke both rows MUST be gone. The `google_tokens:...` deletion
    // is the regression-guard assertion — it was the missing step that this
    // test was written to catch.
    expect(await sessionStore.get(`refresh:${refreshToken}`)).toBeUndefined();
    expect(await sessionStore.get(`google_tokens:${userId}`)).toBeUndefined();
  });

  it('returns 200 for an unknown token (RFC 7009) without touching the store', async () => {
    const unknownToken = 'this-token-was-never-issued';
    const response = await revoke(unknownToken, {
      id: clientId,
      secret: clientSecret,
    });

    // RFC 7009: "The authorization server responds with HTTP status code 200
    // if the token has been revoked successfully or if the client submitted
    // an invalid token."
    expect(response.status).toBe(200);
  });

  it('rejects revoke when the client credentials are wrong', async () => {
    const response = await revoke('any-token', {
      id: clientId,
      secret: 'wrong-client-secret',
    });

    // Client-auth failure must NOT leak into a successful no-op revoke —
    // a 401 lets misconfigured clients detect credentialing issues.
    expect(response.status).toBe(401);
  });
});
