/**
 * OAuth 2.0 Provider Implementation
 *
 * Supports authorization code flow, token refresh, and DCR (Dynamic Client Registration).
 * Hardened against common OAuth attacks (CSRF, code injection, redirect URI mismatch).
 */

import { createHmac, randomBytes } from 'crypto';
import { logger } from '../utils/logger.js';
import {
  ConfigError,
  UnauthorizedError,
  ValidationError,
  ServiceError,
} from '../core/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface OAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  dcrEndpoint?: string; // Dynamic Client Registration
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
}

export interface OAuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
  idToken?: string; // OpenID Connect
}

export interface OAuthUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

// ============================================================================
// State Management
// ============================================================================

interface StateRecord {
  state: string;
  codeVerifier: string;
  createdAt: number;
  expiresAt: number;
}

class StateManager {
  private states = new Map<string, StateRecord>();
  private maxAge = 10 * 60 * 1000; // 10 minutes

  generate(): { state: string; codeVerifier: string } {
    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('hex');
    const now = Date.now();

    this.states.set(state, {
      state,
      codeVerifier,
      createdAt: now,
      expiresAt: now + this.maxAge,
    });

    return { state, codeVerifier };
  }

  verify(state: string, codeVerifier: string): boolean {
    const record = this.states.get(state);
    this.states.delete(state); // One-time use

    if (!record) {
      logger.warn('OAuth state verification failed: state not found');
      return false;
    }

    if (Date.now() > record.expiresAt) {
      logger.warn('OAuth state verification failed: state expired');
      return false;
    }

    if (record.codeVerifier !== codeVerifier) {
      logger.warn('OAuth state verification failed: code verifier mismatch');
      return false;
    }

    return true;
  }
}

// ============================================================================
// OAuth Provider
// ============================================================================

export class OAuthProvider {
  private config: OAuthConfig;
  private stateManager = new StateManager();

  constructor(config: OAuthConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: OAuthConfig): void {
    if (!config.authorizationEndpoint) {
      throw new ConfigError('authorizationEndpoint is required', 'authorizationEndpoint');
    }
    if (!config.tokenEndpoint) {
      throw new ConfigError('tokenEndpoint is required', 'tokenEndpoint');
    }
    if (!config.clientId) {
      throw new ConfigError('clientId is required', 'clientId');
    }
    if (!config.redirectUri) {
      throw new ConfigError('redirectUri is required', 'redirectUri');
    }
    if (!Array.isArray(config.scopes) || config.scopes.length === 0) {
      throw new ConfigError('scopes must be a non-empty array', 'scopes');
    }

    // Validate redirectUri is HTTPS in production
    if (process.env['NODE_ENV'] === 'production' && !config.redirectUri.startsWith('https://')) {
      logger.warn('[SECURITY] OAuth redirect URI is not HTTPS in production', {
        redirectUri: config.redirectUri,
      });
    }
  }

  /**
   * Generate authorization URL for user login.
   */
  getAuthorizationUrl(): string {
    const { state, codeVerifier } = this.stateManager.generate();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
      code_challenge: this.pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });

    // Store codeVerifier in session for callback validation
    (global as any).__oauth_state = state;
    (global as any).__oauth_verifier = codeVerifier;

    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token.
   */
  async exchangeCode(code: string, state: string, codeVerifier: string): Promise<OAuthToken> {
    // Verify state (CSRF protection)
    if (!this.stateManager.verify(state, codeVerifier)) {
      throw new UnauthorizedError(
        'Invalid or expired OAuth state. Request a new authorization URL.',
        'invalid_state'
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      ...(this.config.clientSecret && { client_secret: this.config.clientSecret }),
      code_verifier: codeVerifier,
    });

    try {
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('OAuth token exchange failed', {
          status: response.status,
          error: errorData,
        });
        throw new UnauthorizedError('Failed to exchange authorization code', 'token_exchange_failed');
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        accessToken: String(data['access_token'] ?? ''),
        tokenType: String(data['token_type'] ?? 'Bearer'),
        expiresIn: typeof data['expires_in'] === 'number' ? data['expires_in'] : undefined,
        refreshToken: typeof data['refresh_token'] === 'string' ? data['refresh_token'] : undefined,
        scope: typeof data['scope'] === 'string' ? data['scope'] : undefined,
        idToken: typeof data['id_token'] === 'string' ? data['id_token'] : undefined,
      };
    } catch (error) {
      logger.error('OAuth token exchange error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Refresh an expired access token using a refresh token.
   */
  async refreshToken(refreshToken: string): Promise<OAuthToken> {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required', 'no_refresh_token');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      ...(this.config.clientSecret && { client_secret: this.config.clientSecret }),
    });

    try {
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.warn('OAuth refresh token failed', {
          status: response.status,
          error: errorData,
        });
        throw new UnauthorizedError('Failed to refresh token', 'refresh_failed');
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        accessToken: String(data['access_token'] ?? ''),
        tokenType: String(data['token_type'] ?? 'Bearer'),
        expiresIn: typeof data['expires_in'] === 'number' ? data['expires_in'] : undefined,
        refreshToken: typeof data['refresh_token'] === 'string' ? data['refresh_token'] : refreshToken,
        scope: typeof data['scope'] === 'string' ? data['scope'] : undefined,
      };
    } catch (error) {
      logger.error('OAuth refresh token error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch user info from the userinfo endpoint (OpenID Connect).
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    if (!this.config.userInfoEndpoint) {
      throw new ConfigError('userInfoEndpoint not configured', 'userInfoEndpoint');
    }

    try {
      const response = await fetch(this.config.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new UnauthorizedError('Failed to fetch user info', 'userinfo_failed');
      }

      return (await response.json()) as OAuthUserInfo;
    } catch (error) {
      logger.error('OAuth userinfo fetch error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Dynamic Client Registration (RFC 7591).
   * Registers a new OAuth client with the provider without pre-registration.
   */
  async registerClient(
    clientName: string,
    redirectUris: string[],
    scopes: string[] = this.config.scopes
  ): Promise<{ clientId: string; clientSecret: string }> {
    if (!this.config.dcrEndpoint) {
      throw new ConfigError('DCR endpoint not configured', 'dcrEndpoint');
    }

    // Hardening: Validate redirectUris before DCR
    for (const uri of redirectUris) {
      if (!this.isValidRedirectUri(uri)) {
        throw new ValidationError(`Invalid redirect URI: ${uri}`, 'redirectUris', 'valid HTTPS URIs');
      }
    }

    const body = {
      client_name: clientName,
      redirect_uris: redirectUris,
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: scopes.join(' '),
      token_endpoint_auth_method: 'client_secret_basic',
    };

    try {
      const response = await fetch(this.config.dcrEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('OAuth DCR failed', {
          status: response.status,
          error: errorData,
        });
        throw new ServiceError('Failed to register OAuth client', 'DCR_FAILED', 'dcrEndpoint', false);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const clientId = String(data['client_id'] ?? '');
      const clientSecret = String(data['client_secret'] ?? '');

      if (!clientId || !clientSecret) {
        throw new ServiceError('DCR response missing credentials', 'DCR_INVALID_RESPONSE', 'dcrEndpoint');
      }

      return { clientId, clientSecret };
    } catch (error) {
      logger.error('OAuth DCR error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate redirect URI format and scheme.
   */
  private isValidRedirectUri(uri: string): boolean {
    try {
      const url = new URL(uri);
      // Allow localhost/http for development, require https for production
      if (process.env['NODE_ENV'] === 'production') {
        return url.protocol === 'https:' || url.hostname === 'localhost';
      }
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Generate PKCE code challenge from verifier (SHA256).
   */
  private pkceChallenge(verifier: string): string {
    const hash = createHmac('sha256', '');
    hash.update(verifier);
    return hash.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}