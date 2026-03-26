import { describe, expect, it, vi } from 'vitest';
import {
  registerHttpAuthProviders,
  type HttpOAuthServerConfig,
} from '../../src/http-server/auth-providers.js';

const TEST_OAUTH_CONFIG: HttpOAuthServerConfig = {
  issuer: 'https://example.test',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  jwtSecret: 'jwt-secret',
  stateSecret: 'state-secret',
  allowedRedirectUris: ['https://example.test/callback'],
  googleClientId: 'google-client-id',
  googleClientSecret: 'google-client-secret',
  accessTokenTtl: 3600,
  refreshTokenTtl: 86400,
};

function createRouterProvider() {
  const router = vi.fn();
  return {
    router,
    createRouter: vi.fn(() => router),
  };
}

describe('http auth providers helper', () => {
  it('registers OAuth when enabled', () => {
    const app = { use: vi.fn() };
    const oauthProvider = createRouterProvider();
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    const result = registerHttpAuthProviders({
      app,
      enableOAuth: true,
      oauthConfig: TEST_OAUTH_CONFIG,
      createOAuthProvider: vi.fn(() => oauthProvider),
      loadSamlProvider: () => null,
      log: log as never,
    });

    expect(result.oauth).toBe(oauthProvider);
    expect(app.use).toHaveBeenCalledWith(oauthProvider.router);
    expect(log.info).toHaveBeenCalledWith('HTTP Server: OAuth mode enabled', {
      issuer: TEST_OAUTH_CONFIG.issuer,
      clientId: TEST_OAUTH_CONFIG.clientId,
    });
  });

  it('registers SAML when enabled outside the blocked production path', () => {
    const app = { use: vi.fn() };
    const samlProvider = createRouterProvider();
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpAuthProviders({
      app,
      isProduction: false,
      loadSamlProvider: () => samlProvider,
      log: log as never,
    });

    expect(app.use).toHaveBeenCalledWith(samlProvider.router);
    expect(log.info).toHaveBeenCalledWith(
      'HTTP Server: SAML SSO enabled (routes: /sso/login, /sso/callback, /sso/metadata, /sso/logout)'
    );
  });

  it('blocks SAML in production unless explicitly acknowledged', () => {
    const app = { use: vi.fn() };
    const samlProvider = createRouterProvider();
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    registerHttpAuthProviders({
      app,
      isProduction: true,
      samlAcknowledgedCve: false,
      loadSamlProvider: () => samlProvider,
      log: log as never,
    });

    expect(app.use).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledOnce();
  });
});
