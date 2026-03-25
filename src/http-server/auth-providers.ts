import type { Application } from 'express';
import { OAuthProvider } from '../auth/oauth-provider.js';
import { createSamlProviderFromEnv } from '../security/saml-provider.js';
import { logger as defaultLogger } from '../utils/logger.js';
import {
  registerHttpAuthProviders as registerHttpAuthProvidersImpl,
  type HttpAuthProvidersLogger,
  type HttpOAuthServerConfig,
  type OAuthProviderLike,
  type SamlProviderLike,
} from '../../packages/mcp-http/dist/auth-providers.js';

export type { HttpAuthProvidersLogger, HttpOAuthServerConfig, OAuthProviderLike, SamlProviderLike };

interface RegisterHttpAuthProvidersOptionsBase {
  readonly app: Pick<Application, 'use'>;
  readonly enableOAuth?: boolean;
  readonly oauthConfig?: HttpOAuthServerConfig;
  readonly isProduction?: boolean;
  readonly samlAcknowledgedCve?: boolean;
  readonly loadSamlProvider?: () => SamlProviderLike | null;
  readonly log?: typeof defaultLogger;
}

export interface RegisterHttpAuthProvidersOptions extends RegisterHttpAuthProvidersOptionsBase {
  readonly createOAuthProvider?: undefined;
}

export interface RegisterHttpAuthProvidersOptionsWithFactory<
  TOAuthProvider extends OAuthProviderLike,
> extends RegisterHttpAuthProvidersOptionsBase {
  readonly createOAuthProvider: (config: HttpOAuthServerConfig) => TOAuthProvider;
}

/* eslint-disable no-redeclare */
export function registerHttpAuthProviders(options: RegisterHttpAuthProvidersOptions): {
  oauth: OAuthProvider | null;
};
export function registerHttpAuthProviders<TOAuthProvider extends OAuthProviderLike>(
  options: RegisterHttpAuthProvidersOptionsWithFactory<TOAuthProvider>
): { oauth: TOAuthProvider | null };
export function registerHttpAuthProviders<TOAuthProvider extends OAuthProviderLike>(
  options:
    | RegisterHttpAuthProvidersOptions
    | RegisterHttpAuthProvidersOptionsWithFactory<TOAuthProvider>
): { oauth: OAuthProvider | TOAuthProvider | null } {
  /* eslint-enable no-redeclare */
  const createOAuthProvider =
    'createOAuthProvider' in options && options.createOAuthProvider
      ? options.createOAuthProvider
      : (config: HttpOAuthServerConfig): OAuthProvider | TOAuthProvider =>
          new OAuthProvider(config);

  return registerHttpAuthProvidersImpl<OAuthProvider | TOAuthProvider>({
    app: options.app,
    enableOAuth: options.enableOAuth,
    oauthConfig: options.oauthConfig,
    isProduction: options.isProduction,
    samlAcknowledgedCve: options.samlAcknowledgedCve,
    loadSamlProvider: options.loadSamlProvider ?? (() => createSamlProviderFromEnv()),
    createOAuthProvider,
    log: (options.log ?? defaultLogger) as HttpAuthProvidersLogger,
  });
}
