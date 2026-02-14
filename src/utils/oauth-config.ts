/**
 * OAuth configuration helpers.
 *
 * Resolution order for OAuth credentials:
 * 1. Environment variables (GOOGLE_CLIENT_ID / OAUTH_CLIENT_ID) — for advanced users / service accounts
 * 2. Embedded credentials (published app) — for standard 1-click install users
 *
 * This ensures backward compatibility: existing users with env vars are unaffected,
 * while new users get a zero-config experience.
 */

import { EMBEDDED_OAUTH, isEmbeddedOAuthConfigured } from '../config/embedded-oauth.js';

export interface OAuthEnvConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  configured: boolean;
  source: 'environment' | 'embedded' | 'none';
}

export function getOAuthEnvConfig(): OAuthEnvConfig {
  // 1. Check environment variables first (advanced users / service accounts)
  const envClientId = process.env['GOOGLE_CLIENT_ID'] ?? process.env['OAUTH_CLIENT_ID'];
  const envClientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? process.env['OAUTH_CLIENT_SECRET'];
  const envRedirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? process.env['OAUTH_REDIRECT_URI'];

  if (envClientId && envClientSecret) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      redirectUri: envRedirectUri,
      configured: true,
      source: 'environment',
    };
  }

  // 2. Fall back to embedded credentials (published app — standard install)
  if (isEmbeddedOAuthConfigured()) {
    return {
      clientId: EMBEDDED_OAUTH.clientId,
      clientSecret: EMBEDDED_OAUTH.clientSecret,
      redirectUri: envRedirectUri ?? EMBEDDED_OAUTH.redirectUri,
      configured: true,
      source: 'embedded',
    };
  }

  // 3. No credentials available
  return {
    clientId: undefined,
    clientSecret: undefined,
    redirectUri: envRedirectUri,
    configured: false,
    source: 'none',
  };
}
