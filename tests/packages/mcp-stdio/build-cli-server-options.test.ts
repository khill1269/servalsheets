import { describe, expect, it } from 'vitest';

import { buildCliServerOptions } from '../../../packages/mcp-stdio/src/build-cli-server-options.js';

describe('@serval/mcp-stdio buildCliServerOptions', () => {
  it('prefers explicit service account options', () => {
    expect(
      buildCliServerOptions(
        {
          serviceAccountKeyPath: './credentials.json',
          transport: 'stdio',
        },
        {
          GOOGLE_APPLICATION_CREDENTIALS: './ignored.json',
          GOOGLE_TOKEN_STORE_PATH: './tokens.json',
          ENCRYPTION_KEY: 'abc123',
        }
      )
    ).toEqual({
      googleApiOptions: {
        serviceAccountKeyPath: './credentials.json',
        tokenStorePath: './tokens.json',
        tokenStoreKey: 'abc123',
      },
    });
  });

  it('builds oauth credentials when client id and secret are available', () => {
    expect(
      buildCliServerOptions(
        {
          transport: 'http',
        },
        {
          OAUTH_CLIENT_ID: 'client-id',
          OAUTH_CLIENT_SECRET: 'client-secret',
          OAUTH_REDIRECT_URI: 'http://localhost/callback',
          GOOGLE_TOKEN_STORE_PATH: './tokens.json',
          ENCRYPTION_KEY: 'abc123',
        }
      )
    ).toEqual({
      googleApiOptions: {
        credentials: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'http://localhost/callback',
        },
        tokenStorePath: './tokens.json',
        tokenStoreKey: 'abc123',
      },
    });
  });

  it('returns an empty object when no credentials are present', () => {
    expect(buildCliServerOptions({ transport: 'stdio' }, {})).toEqual({});
  });
});
