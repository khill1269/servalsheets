/**
 * OAuth refresh-token error surface contract.
 *
 * Verifies refresh-token failures return explicit errors (no silent success).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';

// Mock env module before imports
vi.mock('../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env.js')>();
  return {
    ...actual,
    env: {
      OAUTH_MAX_TOKEN_TTL: 1800,
      LOG_LEVEL: 'error',
    },
  };
});

import { OAuthProvider } from '../../src/auth/oauth-provider.js';
import { InMemorySessionStore } from '../../src/storage/session-store.js';
import { requestApp } from '../helpers/request-app.js';

describe('OAuth refresh token errors', () => {
  let app: Express;
  let oauthProvider: OAuthProvider;

  beforeAll(() => {
    oauthProvider = new OAuthProvider({
      issuer: 'https://test.servalsheets.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      jwtSecret: 'jwt-secret',
      stateSecret: 'state-secret',
      allowedRedirectUris: ['https://example.com/callback'],
      sessionStore: new InMemorySessionStore(),
    });

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(oauthProvider.createRouter());
  });

  afterAll(() => {
    oauthProvider.destroy();
  });

  it('returns invalid_grant for missing refresh token', async () => {
    const response = await requestApp(app, {
      method: 'POST',
      path: '/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: {
        grant_type: 'refresh_token',
        refresh_token: 'nonexistent-refresh-token-abc123',
        client_id: 'test-client',
        client_secret: 'test-secret',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'invalid_grant',
    });
  });

  it('returns invalid_grant for non-existent refresh token', async () => {
    const response = await requestApp(app, {
      method: 'POST',
      path: '/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: {
        grant_type: 'refresh_token',
        refresh_token: 'nonexistent-refresh-token-12345',
        client_id: 'test-client',
        client_secret: 'test-secret',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'invalid_grant',
    });
  });
});
