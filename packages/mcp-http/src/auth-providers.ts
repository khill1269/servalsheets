import type { Application, RequestHandler } from 'express';

export interface HttpOAuthServerConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  stateSecret: string;
  allowedRedirectUris: string[];
  googleClientId: string;
  googleClientSecret: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
  resourceIndicator?: string;
}

export interface OAuthProviderLike {
  createRouter(): RequestHandler;
}

export interface SamlProviderLike {
  createRouter(): RequestHandler;
}

export interface HttpAuthProvidersLogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface RegisterHttpAuthProvidersOptions<
  TOAuthProvider extends OAuthProviderLike = OAuthProviderLike,
> {
  readonly app: Pick<Application, 'use'>;
  readonly enableOAuth?: boolean;
  readonly oauthConfig?: HttpOAuthServerConfig;
  readonly isProduction?: boolean;
  readonly samlAcknowledgedCve?: boolean;
  readonly loadSamlProvider?: () => SamlProviderLike | null;
  readonly createOAuthProvider?: (config: HttpOAuthServerConfig) => TOAuthProvider;
  readonly log?: HttpAuthProvidersLogger;
}

const defaultLogger: HttpAuthProvidersLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function registerHttpAuthProviders<TOAuthProvider extends OAuthProviderLike>(
  options: RegisterHttpAuthProvidersOptions<TOAuthProvider>
): { oauth: TOAuthProvider | null } {
  const {
    app,
    enableOAuth = false,
    oauthConfig,
    isProduction = process.env['NODE_ENV'] === 'production',
    samlAcknowledgedCve = process.env['SAML_ACKNOWLEDGE_CVE_GHSA_cfm4'] === 'true',
    loadSamlProvider = () => null,
    createOAuthProvider,
    log = defaultLogger,
  } = options;

  let oauth: TOAuthProvider | null = null;
  if (enableOAuth && oauthConfig) {
    if (!createOAuthProvider) {
      throw new Error(
        'createOAuthProvider must be provided when OAuth mode is enabled in mcp-http auth-providers'
      );
    }

    oauth = createOAuthProvider(oauthConfig);
    app.use(oauth.createRouter());
    log.info('HTTP Server: OAuth mode enabled', {
      issuer: oauthConfig.issuer,
      clientId: oauthConfig.clientId,
    });
  }

  const samlProvider = loadSamlProvider();
  if (!samlProvider) {
    return { oauth };
  }

  if (isProduction && !samlAcknowledgedCve) {
    log.error(
      'SAML SSO is disabled in production due to CVE GHSA-cfm4-qjh2-4765 in node-forge ' +
        '(transitive dep via node-saml → xml-encryption). ' +
        'To enable SAML in production, set SAML_ACKNOWLEDGE_CVE_GHSA_cfm4=true after ' +
        'reviewing the CVE and confirming your threat model accepts the risk.'
    );
    return { oauth };
  }

  app.use(samlProvider.createRouter());
  log.info(
    'HTTP Server: SAML SSO enabled (routes: /sso/login, /sso/callback, /sso/metadata, /sso/logout)'
  );
  return { oauth };
}
