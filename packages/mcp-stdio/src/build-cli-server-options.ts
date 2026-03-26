import type { CliTransportOptions } from './cli-options.js';

export interface CliCredentialEnvironment {
  readonly GOOGLE_APPLICATION_CREDENTIALS?: string;
  readonly GOOGLE_ACCESS_TOKEN?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly OAUTH_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly OAUTH_CLIENT_SECRET?: string;
  readonly GOOGLE_REDIRECT_URI?: string;
  readonly OAUTH_REDIRECT_URI?: string;
  readonly GOOGLE_TOKEN_STORE_PATH?: string;
  readonly ENCRYPTION_KEY?: string;
}

export interface BuiltCliServerOptions {
  readonly googleApiOptions?: {
    readonly serviceAccountKeyPath?: string;
    readonly accessToken?: string;
    readonly credentials?: {
      readonly clientId: string;
      readonly clientSecret: string;
      readonly redirectUri?: string;
    };
    readonly tokenStorePath?: string;
    readonly tokenStoreKey?: string;
  };
}

export function buildCliServerOptions(
  cliOptions: CliTransportOptions,
  env: CliCredentialEnvironment
): BuiltCliServerOptions {
  const serviceAccountPath =
    cliOptions.serviceAccountKeyPath ?? env.GOOGLE_APPLICATION_CREDENTIALS;
  const accessToken = cliOptions.accessToken ?? env.GOOGLE_ACCESS_TOKEN;
  const clientId = env.GOOGLE_CLIENT_ID ?? env.OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET ?? env.OAUTH_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? env.OAUTH_REDIRECT_URI;
  const tokenStorePath = env.GOOGLE_TOKEN_STORE_PATH;
  const tokenStoreKey = env.ENCRYPTION_KEY;

  const sharedGoogleOptions = {
    tokenStorePath,
    tokenStoreKey,
  };

  if (serviceAccountPath) {
    return {
      googleApiOptions: {
        serviceAccountKeyPath: serviceAccountPath,
        ...sharedGoogleOptions,
      },
    };
  }

  if (accessToken) {
    return {
      googleApiOptions: {
        accessToken,
        ...sharedGoogleOptions,
      },
    };
  }

  if (clientId && clientSecret) {
    return {
      googleApiOptions: {
        credentials: { clientId, clientSecret, redirectUri },
        ...sharedGoogleOptions,
      },
    };
  }

  return {};
}
