import type { HttpOAuthServerConfig } from './auth-providers.js';

export interface RemoteHttpEnvConfig {
  readonly PORT: number;
  readonly HOST: string;
  readonly JWT_SECRET?: string | undefined;
  readonly STATE_SECRET?: string | undefined;
  readonly OAUTH_CLIENT_SECRET?: string | undefined;
  readonly GOOGLE_CLIENT_ID?: string | undefined;
  readonly GOOGLE_CLIENT_SECRET?: string | undefined;
  readonly OAUTH_ISSUER: string;
  readonly OAUTH_CLIENT_ID: string;
  readonly ALLOWED_REDIRECT_URIS: string;
  readonly ACCESS_TOKEN_TTL: number;
  readonly REFRESH_TOKEN_TTL: number;
  readonly OAUTH_RESOURCE_INDICATOR?: string | undefined;
  readonly CORS_ORIGINS: string;
}

export interface BuildRemoteHttpServerOptionsParams {
  readonly envConfig: RemoteHttpEnvConfig;
  readonly portOverride?: number;
}

export interface RemoteHttpServerOptions {
  readonly port: number;
  readonly host: string;
  readonly enableOAuth: true;
  readonly oauthConfig: HttpOAuthServerConfig;
  readonly corsOrigins: string[];
}

export interface BuildRemoteHttpServerOptionsHelpers {
  readonly createConfigError?: (message: string, configKey: string) => Error;
}

function createDefaultConfigError(message: string, configKey: string): Error {
  return Object.assign(new Error(message), {
    name: 'ConfigError',
    configKey,
  });
}

export function buildRemoteHttpServerOptions(
  params: BuildRemoteHttpServerOptionsParams,
  helpers: BuildRemoteHttpServerOptionsHelpers = {}
): RemoteHttpServerOptions {
  const { envConfig, portOverride } = params;
  const { createConfigError = createDefaultConfigError } = helpers;

  if (
    !envConfig.JWT_SECRET ||
    !envConfig.STATE_SECRET ||
    !envConfig.OAUTH_CLIENT_SECRET ||
    !envConfig.GOOGLE_CLIENT_ID ||
    !envConfig.GOOGLE_CLIENT_SECRET
  ) {
    throw createConfigError(
      'JWT_SECRET, STATE_SECRET, OAUTH_CLIENT_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET must be set when using OAuth mode',
      'JWT_SECRET'
    );
  }

  return {
    port: portOverride ?? envConfig.PORT,
    host: envConfig.HOST,
    enableOAuth: true,
    oauthConfig: {
      issuer: envConfig.OAUTH_ISSUER,
      clientId: envConfig.OAUTH_CLIENT_ID,
      clientSecret: envConfig.OAUTH_CLIENT_SECRET,
      jwtSecret: envConfig.JWT_SECRET,
      stateSecret: envConfig.STATE_SECRET,
      allowedRedirectUris: envConfig.ALLOWED_REDIRECT_URIS.split(','),
      googleClientId: envConfig.GOOGLE_CLIENT_ID,
      googleClientSecret: envConfig.GOOGLE_CLIENT_SECRET,
      accessTokenTtl: envConfig.ACCESS_TOKEN_TTL,
      refreshTokenTtl: envConfig.REFRESH_TOKEN_TTL,
      resourceIndicator: envConfig.OAUTH_RESOURCE_INDICATOR,
    },
    corsOrigins: envConfig.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  };
}
