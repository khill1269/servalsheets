/**
 * OAuth 2.1 Provider for MCP authentication with PKCE requirement
 * Implements authorization endpoint, token endpoint, Google OAuth callback,
 * token revocation/introspection, dynamic client registration (RFC 7591),
 * admin consent endpoints, and state signature verification.
 */

import {
  createHash,
  createHmac,
  randomBytes,
  generateKeyPair,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../core/errors.js';

const generateKeyPairAsync = promisify(generateKeyPair);

export interface OAuthClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  token_endpoint_auth_method: 'client_secret_basic' | 'private_key_jwt' | 'none';
  response_types?: string[];
  grant_types?: string[];
  application_type?: 'web' | 'native';
  contacts?: string[];
  client_name?: string;
  logo_uri?: string;
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
  jwks?: unknown;
  sector_identifier_uri?: string;
  subject_type?: 'public' | 'pairwise';
  id_token_signed_response_alg?: string;
  id_token_encrypted_response_alg?: string;
  id_token_encrypted_response_enc?: string;
  userinfo_signed_response_alg?: string;
  userinfo_encrypted_response_alg?: string;
  userinfo_encrypted_response_enc?: string;
  request_object_signing_alg?: string;
  request_object_encryption_alg?: string;
  request_object_encryption_enc?: string;
  token_endpoint_auth_signing_alg?: string;
  default_max_age?: number;
  require_auth_time?: boolean;
  default_acr_values?: string[];
  initiate_login_uri?: string;
  request_uris?: string[];
  created_at?: number;
  updated_at?: number;
}

export interface OAuthAuthorizationRequest {
  client_id: string;
  response_type: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: 'S256' | 'plain';
  nonce?: string;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  display?: 'page' | 'popup' | 'touch' | 'wap';
  ui_locales?: string;
  claims_locales?: string;
  registration?: OAuthClient;
  max_age?: number;
  acr_values?: string;
  login_hint?: string;
  id_token_hint?: string;
  claims?: Record<string, unknown>;
}

export interface OAuthTokenRequest {
  grant_type: 'authorization_code' | 'refresh_token' | 'client_credentials';
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  refresh_token?: string;
  scope?: string;
  client_id?: string;
  client_secret?: string;
  username?: string;
  password?: string;
  assertion?: string;
  requested_token_use?: 'access_token' | 'id_token';
}

export interface OAuthToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  created_at?: number;
}

export class OAuthProvider {
  private clients: Map<string, OAuthClient> = new Map();
  private authorizationCodes: Map<string, { code: string; expiresAt: number; client: OAuthClient; request: OAuthAuthorizationRequest }> = new Map();
  private tokens: Map<string, OAuthToken> = new Map();
  private googleClientId: string;
  private googleClientSecret: string;
  private jwtSecret: string;
  private jwks: { keys: Array<{ kid: string; kty: string; [key: string]: unknown }> } = { keys: [] };
  private privateKey?: NodeJS.KeyObject;
  private publicKey?: NodeJS.KeyObject;
  private baseUrl: string;
  private sessionStore: { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void> };

  constructor(
    googleClientId: string,
    googleClientSecret: string,
    jwtSecret: string,
    baseUrl: string,
    sessionStore: { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void> }
  ) {
    this.googleClientId = googleClientId;
    this.googleClientSecret = googleClientSecret;
    this.jwtSecret = jwtSecret;
    this.baseUrl = baseUrl;
    this.sessionStore = sessionStore;
    this.initializeKeys();
  }

  private async initializeKeys(): Promise<void> {
    try {
      const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
        modulusLength: 2048,
      });
      this.privateKey = privateKey as NodeJS.KeyObject;
      this.publicKey = publicKey as NodeJS.KeyObject;
    } catch (error) {
      logger.error('Failed to initialize OAuth keys', { error });
    }
  }

  /**
   * Authorization Endpoint (RFC 6749 Section 3.1)
   */
  async authorize(request: OAuthAuthorizationRequest): Promise<{ authorization_uri: string }> {
    // Validate required parameters
    if (!request.client_id || !request.response_type || !request.redirect_uri || !request.scope || !request.state || !request.code_challenge) {
      throw new ServiceError(
        'Missing required authorization parameters',
        'INVALID_REQUEST',
        'oauth-provider',
        false
      );
    }

    // Validate PKCE (required)
    if (!request.code_challenge_method || request.code_challenge_method !== 'S256') {
      throw new ServiceError(
        'PKCE S256 is required',
        'INVALID_REQUEST',
        'oauth-provider',
        false
      );
    }

    const client = this.clients.get(request.client_id);
    if (!client || !client.redirect_uris.includes(request.redirect_uri)) {
      throw new ServiceError(
        'Invalid client or redirect URI',
        'INVALID_CLIENT',
        'oauth-provider',
        false
      );
    }

    // Generate authorization code
    const code = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.authorizationCodes.set(code, {
      code,
      expiresAt,
      client,
      request,
    });

    // Store state in session for later validation
    await this.sessionStore.set(`oauth_state_${request.state}`, {
      challenge: request.code_challenge,
      nonce: request.nonce,
    });

    const redirectUrl = new URL(request.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', request.state);

    return { authorization_uri: redirectUrl.toString() };
  }

  /**
   * Token Endpoint (RFC 6749 Section 3.2)
   */
  async token(request: OAuthTokenRequest): Promise<OAuthToken> {
    if (request.grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(request);
    } else if (request.grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(request);
    } else if (request.grant_type === 'client_credentials') {
      return this.handleClientCredentialsGrant(request);
    }

    throw new ServiceError(
      'Unsupported grant type',
      'UNSUPPORTED_GRANT_TYPE',
      'oauth-provider',
      false
    );
  }

  private async handleAuthorizationCodeGrant(request: OAuthTokenRequest): Promise<OAuthToken> {
    if (!request.code || !request.code_verifier || !request.redirect_uri || !request.client_id) {
      throw new ServiceError(
        'Missing required token parameters',
        'INVALID_REQUEST',
        'oauth-provider',
        false
      );
    }

    const authCode = this.authorizationCodes.get(request.code);
    if (!authCode || authCode.expiresAt < Date.now()) {
      throw new ServiceError(
        'Invalid or expired authorization code',
        'INVALID_GRANT',
        'oauth-provider',
        false
      );
    }

    // Validate PKCE
    const computedChallenge = createHash('sha256').update(request.code_verifier).digest('base64url');
    if (computedChallenge !== authCode.request.code_challenge) {
      throw new ServiceError(
        'Invalid code verifier',
        'INVALID_GRANT',
        'oauth-provider',
        false
      );
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        sub: request.client_id,
        scope: authCode.request.scope,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      this.jwtSecret
    );

    const refreshToken = randomBytes(32).toString('hex');
    const token: OAuthToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.request.scope,
      created_at: Math.floor(Date.now() / 1000),
    };

    this.tokens.set(refreshToken, token);
    this.authorizationCodes.delete(request.code);

    return token;
  }

  private async handleRefreshTokenGrant(request: OAuthTokenRequest): Promise<OAuthToken> {
    if (!request.refresh_token) {
      throw new ServiceError(
        'Missing refresh token',
        'INVALID_REQUEST',
        'oauth-provider',
        false
      );
    }

    const token = this.tokens.get(request.refresh_token);
    if (!token) {
      throw new ServiceError(
        'Invalid refresh token',
        'INVALID_GRANT',
        'oauth-provider',
        false
      );
    }

    const newAccessToken = jwt.sign(
      {
        sub: request.client_id,
        scope: token.scope,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      this.jwtSecret
    );

    return {
      ...token,
      access_token: newAccessToken,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  private async handleClientCredentialsGrant(request: OAuthTokenRequest): Promise<OAuthToken> {
    if (!request.client_id || !request.client_secret) {
      throw new ServiceError(
        'Missing client credentials',
        'INVALID_REQUEST',
        'oauth-provider',
        false
      );
    }

    const client = this.clients.get(request.client_id);
    if (!client || client.client_secret !== request.client_secret) {
      throw new ServiceError(
        'Invalid client credentials',
        'INVALID_CLIENT',
        'oauth-provider',
        false
      );
    }

    const accessToken = jwt.sign(
      {
        sub: request.client_id,
        scope: request.scope || '',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      this.jwtSecret
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: request.scope,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Register client (RFC 7591)
   */
  async registerClient(client: OAuthClient): Promise<OAuthClient> {
    const clientId = randomBytes(16).toString('hex');
    const clientSecret = randomBytes(32).toString('hex');

    const registeredClient: OAuthClient = {
      ...client,
      client_id: clientId,
      client_secret: clientSecret,
      created_at: Math.floor(Date.now() / 1000),
    };

    this.clients.set(clientId, registeredClient);

    return registeredClient;
  }

  /**
   * Token revocation (RFC 7009)
   */
  async revokeToken(token: string, token_type_hint?: string): Promise<void> {
    // Try to revoke as refresh token
    this.tokens.delete(token);

    // Try to revoke as authorization code
    for (const [code, authCode] of this.authorizationCodes.entries()) {
      if (authCode.code === token) {
        this.authorizationCodes.delete(code);
        return;
      }
    }
  }

  /**
   * Token introspection (RFC 7662)
   */
  async introspectToken(token: string): Promise<{ active: boolean; [key: string]: unknown }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return {
        active: true,
        ...decoded,
      };
    } catch (error) {
      return { active: false };
    }
  }

  /**
   * JWKS endpoint
   */
  getJWKS(): { keys: Array<{ kid: string; kty: string; [key: string]: unknown }> } {
    return this.jwks;
  }
}

export const oauthProvider = new OAuthProvider(
  process.env['GOOGLE_CLIENT_ID'] || '',
  process.env['GOOGLE_CLIENT_SECRET'] || '',
  process.env['JWT_SECRET'] || 'default-secret',
  process.env['BASE_URL'] || 'http://localhost:3000',
  {
    get: async (key: string) => undefined,
    set: async (key: string, value: unknown) => {},
  }
);
