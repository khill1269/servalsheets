import { describe, expect, it } from 'vitest';
import { buildRemoteHttpServerOptions } from '../../src/http-server/remote-options.js';

describe('http remote options helper', () => {
  it('builds OAuth-enabled server options from env config', () => {
    const result = buildRemoteHttpServerOptions({
      envConfig: {
        PORT: 3000,
        HOST: '127.0.0.1',
        JWT_SECRET: 'jwt-secret',
        STATE_SECRET: 'state-secret',
        OAUTH_CLIENT_SECRET: 'oauth-client-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        OAUTH_ISSUER: 'https://issuer.example',
        OAUTH_CLIENT_ID: 'oauth-client-id',
        ALLOWED_REDIRECT_URIS: 'https://a.example/callback,https://b.example/callback',
        ACCESS_TOKEN_TTL: 3600,
        REFRESH_TOKEN_TTL: 86400,
        OAUTH_RESOURCE_INDICATOR: 'https://resource.example',
        CORS_ORIGINS: 'https://claude.ai, https://claude.com',
      },
      portOverride: 4100,
    });

    expect(result).toEqual({
      port: 4100,
      host: '127.0.0.1',
      enableOAuth: true,
      oauthConfig: {
        issuer: 'https://issuer.example',
        clientId: 'oauth-client-id',
        clientSecret: 'oauth-client-secret',
        jwtSecret: 'jwt-secret',
        stateSecret: 'state-secret',
        allowedRedirectUris: ['https://a.example/callback', 'https://b.example/callback'],
        googleClientId: 'google-client-id',
        googleClientSecret: 'google-client-secret',
        accessTokenTtl: 3600,
        refreshTokenTtl: 86400,
        resourceIndicator: 'https://resource.example',
      },
      corsOrigins: ['https://claude.ai', 'https://claude.com'],
    });
  });

  it('throws when required remote OAuth env vars are missing', () => {
    expect(() =>
      buildRemoteHttpServerOptions({
        envConfig: {
          PORT: 3000,
          HOST: '127.0.0.1',
          JWT_SECRET: undefined,
          STATE_SECRET: 'state-secret',
          OAUTH_CLIENT_SECRET: 'oauth-client-secret',
          GOOGLE_CLIENT_ID: 'google-client-id',
          GOOGLE_CLIENT_SECRET: 'google-client-secret',
          OAUTH_ISSUER: 'https://issuer.example',
          OAUTH_CLIENT_ID: 'oauth-client-id',
          ALLOWED_REDIRECT_URIS: 'https://a.example/callback',
          ACCESS_TOKEN_TTL: 3600,
          REFRESH_TOKEN_TTL: 86400,
          OAUTH_RESOURCE_INDICATOR: undefined,
          CORS_ORIGINS: 'https://claude.ai',
        },
      })
    ).toThrow(/JWT_SECRET/);
  });
});
