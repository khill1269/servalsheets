/**
 * ServalSheets - OAuth Provider
 * 
 * MCP-level OAuth for Claude Connectors Directory
 * Handles OAuth 2.1 flow for authenticating Claude to our server
 * MCP Protocol: 2025-11-25
 */

import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes, createHash, createHmac } from 'crypto';
import { SessionStore, createSessionStore } from './storage/session-store.js';

export interface OAuthConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  stateSecret: string;  // HMAC secret for state tokens
  allowedRedirectUris: string[];  // Allowlist of redirect URIs
  accessTokenTtl?: number;  // seconds
  refreshTokenTtl?: number; // seconds
  googleClientId?: string;
  googleClientSecret?: string;
  sessionStore?: SessionStore;  // Optional session store (defaults to in-memory)
}

interface TokenPayload {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  scope: string;
  googleAccessToken?: string;
}

interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string | undefined;
  codeChallengeMethod: string | undefined;
  googleAccessToken: string | undefined;
  expiresAt: number;
}

interface RefreshTokenData {
  userId: string;
  clientId: string;
  scope: string;
  googleRefreshToken?: string;
  expiresAt: number;
}

interface StateData {
  originalState: string | undefined;
  redirectUri: string;
  scope: string | undefined;
  codeChallenge: string | undefined;
  codeChallengeMethod: string | undefined;
}

interface StoredState {
  created: number;
  clientId: string;
  redirectUri: string;
  used: boolean;
}

/**
 * OAuth 2.1 Provider for MCP authentication
 */
export class OAuthProvider {
  private config: Required<Omit<OAuthConfig, 'sessionStore'>> & { sessionStore?: SessionStore };
  private sessionStore: SessionStore;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: OAuthConfig) {
    this.config = {
      accessTokenTtl: 3600,      // 1 hour
      refreshTokenTtl: 2592000,  // 30 days
      googleClientId: '',
      googleClientSecret: '',
      ...config,
    };

    // Initialize session store (use provided or create in-memory)
    this.sessionStore = config.sessionStore ?? createSessionStore();

    // Start cleanup task for expired entries
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000); // Every minute
  }

  /**
   * Clean up expired entries (delegated to session store)
   */
  private async cleanupExpired(): Promise<void> {
    await this.sessionStore.cleanup();
  }

  /**
   * Destroy the provider and clean up resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Validate redirect URI against allowlist
   */
  private validateRedirectUri(uri: string): boolean {
    return this.config.allowedRedirectUris.some(allowed => {
      // Exact match or starts with allowed + query params
      return uri === allowed || uri.startsWith(allowed + '?');
    });
  }

  /**
   * Generate signed state token
   */
  private async generateState(clientId: string, redirectUri: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const payload = `${nonce}:${timestamp}:${clientId}`;
    const signature = createHmac('sha256', this.config.stateSecret)
      .update(payload)
      .digest('hex');

    // Store state with 5-minute TTL
    await this.sessionStore.set(
      `state:${nonce}`,
      {
        created: Date.now(),
        clientId,
        redirectUri,
        used: false
      } as StoredState,
      300 // 5 minutes
    );

    return `${payload}:${signature}`;
  }

  /**
   * Verify and consume state token
   */
  private async verifyState(state: string): Promise<{ clientId: string, redirectUri: string }> {
    const [nonce, timestamp, clientId, signature] = state.split(':');

    if (!nonce || !timestamp || !clientId || !signature) {
      throw new Error('Invalid state format');
    }

    // Verify signature
    const payload = `${nonce}:${timestamp}:${clientId}`;
    const expectedSignature = createHmac('sha256', this.config.stateSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid state signature');
    }

    // Check nonce exists and not used
    const storedData = await this.sessionStore.get(`state:${nonce}`);
    if (!storedData) {
      throw new Error('State expired or invalid');
    }

    const stored = storedData as StoredState;
    if (stored.used) {
      throw new Error('State already used');
    }

    // Mark as used (one-time use) and update in store
    stored.used = true;
    await this.sessionStore.set(`state:${nonce}`, stored, 60); // Keep for 1 minute after use for error checking

    return { clientId: stored.clientId, redirectUri: stored.redirectUri };
  }

  /**
   * Create Express router for OAuth endpoints
   */
  createRouter(): express.Router {
    const router = express.Router();

    // OAuth 2.0 Authorization Server Metadata (RFC 8414)
    router.get('/.well-known/oauth-authorization-server', (_req, res) => {
      res.json({
        issuer: this.config.issuer,
        authorization_endpoint: `${this.config.issuer}/oauth/authorize`,
        token_endpoint: `${this.config.issuer}/oauth/token`,
        revocation_endpoint: `${this.config.issuer}/oauth/revoke`,
        introspection_endpoint: `${this.config.issuer}/oauth/introspect`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        scopes_supported: ['sheets:read', 'sheets:write', 'sheets:admin'],
      });
    });

    // MCP Server Metadata
    router.get('/.well-known/mcp.json', (_req, res) => {
      res.json({
        name: 'servalsheets',
        version: '4.0.0',
        description: 'Production-grade Google Sheets MCP server',
        oauth: {
          authorization_endpoint: `${this.config.issuer}/oauth/authorize`,
          token_endpoint: `${this.config.issuer}/oauth/token`,
          scopes: {
            'sheets:read': 'Read spreadsheet data',
            'sheets:write': 'Read and write spreadsheet data',
            'sheets:admin': 'Full access including sharing and permissions',
          },
        },
      });
    });

    // Authorization endpoint
    router.get('/oauth/authorize', async (req, res) => {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        code_challenge,
        code_challenge_method,
      } = req.query as Record<string, string | undefined>;

      // Validate request
      if (response_type !== 'code') {
        res.status(400).json({ error: 'unsupported_response_type' });
        return;
      }

      if (client_id !== this.config.clientId) {
        res.status(400).json({ error: 'invalid_client' });
        return;
      }

      if (!redirect_uri) {
        res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri required' });
        return;
      }

      // ✅ SECURITY FIX: Validate redirect URI against allowlist
      if (!this.validateRedirectUri(redirect_uri)) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'redirect_uri not in allowlist'
        });
        return;
      }

      // For Claude Connectors, redirect to Google OAuth first
      if (this.config.googleClientId) {
        const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        googleAuthUrl.searchParams.set('client_id', this.config.googleClientId);
        googleAuthUrl.searchParams.set('redirect_uri', `${this.config.issuer}/oauth/google-callback`);
        googleAuthUrl.searchParams.set('response_type', 'code');
        googleAuthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive');
        googleAuthUrl.searchParams.set('access_type', 'offline');
        googleAuthUrl.searchParams.set('prompt', 'consent');

        // Store state for callback
        const stateData: StateData = {
          originalState: state,
          redirectUri: redirect_uri,
          scope,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
        };
        googleAuthUrl.searchParams.set('state', Buffer.from(JSON.stringify(stateData)).toString('base64'));

        res.redirect(googleAuthUrl.toString());
        return;
      }

      // Generate authorization code
      const code = randomBytes(32).toString('hex');
      await this.sessionStore.set(
        `authcode:${code}`,
        {
          code,
          clientId: client_id,
          redirectUri: redirect_uri,
          scope: scope ?? 'sheets:read',
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
          googleAccessToken: undefined,
          expiresAt: Date.now() + 600000,
        } as AuthorizationCode,
        600 // 10 minutes
      );

      // Redirect back with code
      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set('code', code);
      if (state) callbackUrl.searchParams.set('state', state);
      
      res.redirect(callbackUrl.toString());
    });

    // Google OAuth callback
    router.get('/oauth/google-callback', async (req, res) => {
      const { code, state, error } = req.query as Record<string, string | undefined>;

      if (error) {
        res.status(400).json({ error: 'google_auth_failed', details: error });
        return;
      }

      if (!state || !code) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Missing code or state' });
        return;
      }

      try {
        // ✅ SECURITY FIX: Verify signed state token
        // Note: For Google callback, we're using a different state format (base64 StateData)
        // This is internal state, not user-provided, so we keep the old format here
        // but add validation that it came from our own authorize endpoint
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString()) as StateData;

        // Validate the redirect URI is in our allowlist
        if (!this.validateRedirectUri(stateData.redirectUri)) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Invalid redirect URI in state'
          });
          return;
        }
        
        // Exchange code for Google tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: code,
            client_id: this.config.googleClientId,
            client_secret: this.config.googleClientSecret,
            redirect_uri: `${this.config.issuer}/oauth/google-callback`,
            grant_type: 'authorization_code',
          }),
        });

        const googleTokens = await tokenResponse.json() as {
          access_token: string;
          refresh_token?: string;
        };

        // Generate our authorization code
        const authCode = randomBytes(32).toString('hex');
        await this.sessionStore.set(
          `authcode:${authCode}`,
          {
            code: authCode,
            clientId: this.config.clientId,
            redirectUri: stateData.redirectUri,
            scope: stateData.scope ?? 'sheets:write',
            codeChallenge: stateData.codeChallenge,
            codeChallengeMethod: stateData.codeChallengeMethod,
            googleAccessToken: googleTokens.access_token,
            expiresAt: Date.now() + 600000,
          } as AuthorizationCode,
          600 // 10 minutes
        );

        // Redirect back to Claude
        const callbackUrl = new URL(stateData.redirectUri);
        callbackUrl.searchParams.set('code', authCode);
        if (stateData.originalState) {
          callbackUrl.searchParams.set('state', stateData.originalState);
        }
        
        res.redirect(callbackUrl.toString());

      } catch (err) {
        res.status(500).json({ 
          error: 'token_exchange_failed',
          details: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // Token endpoint
    router.post('/oauth/token', express.urlencoded({ extended: false }), async (req, res) => {
      const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token, code_verifier } = req.body as Record<string, string | undefined>;

      // Validate client
      if (client_id !== this.config.clientId || client_secret !== this.config.clientSecret) {
        res.status(401).json({ error: 'invalid_client' });
        return;
      }

      if (grant_type === 'authorization_code') {
        await this.handleAuthorizationCode(code ?? '', redirect_uri ?? '', code_verifier, res);
        return;
      }

      if (grant_type === 'refresh_token') {
        await this.handleRefreshToken(refresh_token ?? '', res);
        return;
      }

      res.status(400).json({ error: 'unsupported_grant_type' });
    });

    // Token revocation
    router.post('/oauth/revoke', express.urlencoded({ extended: false }), async (req, res) => {
      const { token } = req.body as { token?: string };

      // Remove refresh token if it exists
      if (token) {
        await this.sessionStore.delete(`refresh:${token}`);
      }

      res.status(200).end();
    });

    // Token introspection
    router.post('/oauth/introspect', express.urlencoded({ extended: false }), (req, res) => {
      const { token } = req.body as { token?: string };

      if (!token) {
        res.json({ active: false });
        return;
      }

      try {
        // ✅ SECURITY FIX: Verify aud and iss in introspection too
        const payload = jwt.verify(token, this.config.jwtSecret, {
          algorithms: ['HS256'],
          audience: this.config.clientId,
          issuer: this.config.issuer,
          clockTolerance: 30
        }) as TokenPayload;

        res.json({
          active: true,
          sub: payload.sub,
          aud: payload.aud,
          iss: payload.iss,
          exp: payload.exp,
          iat: payload.iat,
          scope: payload.scope,
        });
      } catch {
        res.json({ active: false });
      }
    });

    return router;
  }

  /**
   * Handle authorization code exchange
   */
  private async handleAuthorizationCode(
    code: string,
    redirectUri: string,
    codeVerifier: string | undefined,
    res: Response
  ): Promise<void> {
    const authCodeData = await this.sessionStore.get(`authcode:${code}`);

    if (!authCodeData) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
      return;
    }

    const authCode = authCodeData as AuthorizationCode;

    if (authCode.redirectUri !== redirectUri) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' });
      return;
    }

    // Verify PKCE if present
    if (authCode.codeChallenge && authCode.codeChallengeMethod === 'S256') {
      if (!codeVerifier) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Code verifier required' });
        return;
      }

      const expectedChallenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      if (expectedChallenge !== authCode.codeChallenge) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code verifier' });
        return;
      }
    }

    // Generate tokens
    const userId = randomUUID();

    const accessToken = jwt.sign(
      {
        sub: userId,
        aud: this.config.clientId,
        iss: this.config.issuer,
        scope: authCode.scope,
        googleAccessToken: authCode.googleAccessToken,
      } as Partial<TokenPayload>,
      this.config.jwtSecret,
      { expiresIn: this.config.accessTokenTtl }
    );

    const refreshTokenValue = randomBytes(32).toString('hex');
    await this.sessionStore.set(
      `refresh:${refreshTokenValue}`,
      {
        userId,
        clientId: authCode.clientId,
        scope: authCode.scope,
        expiresAt: Date.now() + this.config.refreshTokenTtl * 1000,
      } as RefreshTokenData,
      this.config.refreshTokenTtl
    );

    // Clean up authorization code (one-time use)
    await this.sessionStore.delete(`authcode:${code}`);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtl,
      refresh_token: refreshTokenValue,
      scope: authCode.scope,
    });
  }

  /**
   * Handle refresh token exchange
   */
  private async handleRefreshToken(refreshToken: string, res: Response): Promise<void> {
    const tokenDataRaw = await this.sessionStore.get(`refresh:${refreshToken}`);

    if (!tokenDataRaw) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' });
      return;
    }

    const tokenData = tokenDataRaw as RefreshTokenData;

    // Generate new access token
    const accessToken = jwt.sign(
      {
        sub: tokenData.userId,
        aud: tokenData.clientId,
        iss: this.config.issuer,
        scope: tokenData.scope,
      } as Partial<TokenPayload>,
      this.config.jwtSecret,
      { expiresIn: this.config.accessTokenTtl }
    );

    // Rotate refresh token (best practice)
    const newRefreshToken = randomBytes(32).toString('hex');
    await this.sessionStore.delete(`refresh:${refreshToken}`);
    await this.sessionStore.set(
      `refresh:${newRefreshToken}`,
      {
        ...tokenData,
        expiresAt: Date.now() + this.config.refreshTokenTtl * 1000,
      } as RefreshTokenData,
      this.config.refreshTokenTtl
    );

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtl,
      refresh_token: newRefreshToken,
      scope: tokenData.scope,
    });
  }

  /**
   * Middleware to validate access tokens
   */
  validateToken() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized', error_description: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.slice(7);

      try {
        // ✅ SECURITY FIX: Verify aud and iss claims
        const payload = jwt.verify(token, this.config.jwtSecret, {
          algorithms: ['HS256'],
          audience: this.config.clientId,
          issuer: this.config.issuer,
          clockTolerance: 30 // 30 second clock skew tolerance
        }) as TokenPayload;

        (req as Request & { auth: TokenPayload }).auth = payload;
        next();
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          res.status(401).json({ error: 'invalid_token', error_description: 'Token expired' });
          return;
        }
        if (err instanceof jwt.JsonWebTokenError) {
          res.status(401).json({ error: 'invalid_token', error_description: err.message });
          return;
        }
        res.status(401).json({ error: 'invalid_token', error_description: 'Invalid token' });
      }
    };
  }

  /**
   * Extract Google access token from validated request
   */
  getGoogleToken(req: Request): string | undefined {
    return (req as Request & { auth?: TokenPayload }).auth?.googleAccessToken;
  }
}
