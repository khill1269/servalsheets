/**
 * OAuth configuration helpers.
 */

export interface OAuthEnvConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  configured: boolean;
}

export function getOAuthEnvConfig(): OAuthEnvConfig {
  const clientId =
    process.env["GOOGLE_CLIENT_ID"] ?? process.env["OAUTH_CLIENT_ID"];
  const clientSecret =
    process.env["GOOGLE_CLIENT_SECRET"] ?? process.env["OAUTH_CLIENT_SECRET"];
  const redirectUri =
    process.env["GOOGLE_REDIRECT_URI"] ?? process.env["OAUTH_REDIRECT_URI"];

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}
