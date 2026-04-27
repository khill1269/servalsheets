/**
 * ServalSheets - OAuth Provider
 *
 * MCP-level OAuth for Claude Connectors Directory
 * Handles OAuth 2.1 flow for authenticating Claude to our server
 * MCP Protocol: 2025-11-25
 *
 * SECURITY: PKCE (Proof Key for Code Exchange) is REQUIRED for all authorization flows.
 * Only S256 code challenge method is supported.
 * This follows OAuth 2.1 security best practices.
 */

import express from 'express';
import { ConfigError, ServiceError } from '../core/errors.js';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { SessionStore, SessionData, createSessionStore } from '../storage/session-store.js';
import { getSessionStoreConfig, getApiSpecificCircuitBreakerConfig, env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import { VERSION, SERVER_ICONS } from '../version.js';
import { registerCleanup } from '../utils/resource-cleanup.js';
import { formatScopesForAuth, getConfiguredScopes } from '../config/oauth-scopes.js';
import { getRequestRecorder } from '../services/request-recorder.js';

// ============================================================================
// SECURITY CONSTANTS
// ============================================================================

/**
 * PKCE (Proof Key for Code Exchange) is REQUIRED for all authorization flows.
 * This is enforced at runtime - all requests must include code_challenge.
 * OAuth 2.1 security best practice.
 */
export const PKCE_REQUIRED = true;

/**
 * Only S256 code challenge method is supported.
 * Plain method is insecure and explicitly rejected.
 */
export const CODE_CHALLENGE_METHOD = 'S256';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface OAuthConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  jwtSecretPrevious?: string; // Previous JWT secret for rotation (optional)
  stateSecret: string; // HMAC secret for state tokens
  allowedRedirectUris: string[]; // Allowlist of redirect URIs
  accessTokenTtl?: number; // seconds
  refreshTokenTtl?: number; // seconds
  googleClientId?: string;
  googleClientSecret?: string;
  sessionStore?: SessionStore; // Optional session store (defaults to in-memory)
  resourceIndicator?: string | undefined; // RFC 8707 audience claim (optional, defaults to clientId)
}

interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string; // Now required (PKCE enforced)
  codeChallengeMethod: string; // Now required (PKCE enforced)
  googleAccessToken: string | undefined;
  googleRefreshToken: string | undefined;
  expiresAt: number;
  /** RFC 8707 resource indicator — bound into aud claim of issued token */
  resource?: string;
}

interface RefreshTokenData {
  userId: string;
  clientId: string;
  scope: string;
  googleRefreshToken?: string;
  expiresAt: number;
  /** RFC 8707: resource URI the refresh token is bound to */
  resource?: string;
}

interface GoogleTokenData {
  accessToken?: string;
  refreshToken?: string;
  /** Backward-compatible keys from older session-store records. */
  googleAccessToken?: string;
  googleRefreshToken?: string;
}

interface StateData {
  originalState: string | undefined;
  redirectUri: string;
  scope: string | undefined;
  codeChallenge: string | undefined;
  codeChallengeMethod: string | undefined;
  // clientId is carried through Google OAuth state so the callback knows which
  // MCP client initiated the request (required for confused deputy prevention).
  clientId: string;
  /** RFC 8707 resource indicator forwarded from the authorization request */
  resource?: string;
}

interface DcrClientData {
  client_id: string;
  client_secret: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
  created_at: string;
}

interface ConsentRecord {
  clientName: string;
  grantedAt: number;
  redirectUris: string[];
}

interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

/**
 * Supported OAuth scopes
 */
const SUPPORTED_SCOPES = ['sheets:read', 'sheets:write', 'sheets:admin'] as const;
type SupportedScope = (typeof SUPPORTED_SCOPES)[number];

/**
 * OAuth 2.1 Provider for MCP authentication
 */
export class OAuthProvider {
  private config: Required<
    Omit<OAuthConfig, 'sessionStore' | 'jwtSecretPrevious' | 'resourceIndicator'>
  > & {
    resourceIndicator?: string;
    sessionStore?: SessionStore;
    jwtSecretPrevious?: string;
  };
  private sessionStore: SessionStore;
  private cleanupInterval: NodeJS.Timeout;
  private jwtSecrets: string[]; // Active JWT secrets (primary + previous)
  private oauthCircuit: CircuitBreaker;

  constructor(config: OAuthConfig) {
    this.config = {
      accessTokenTtl: 3600, // 1 hour
      refreshTokenTtl: 2592000, // 30 days
      googleClientId: '',
      googleClientSecret: '',
      ...config,
    };

    // ✅ SECURITY: Enforce max OAuth token TTL (default 30 minutes)
    const maxTokenTtl = Number(env['OAUTH_MAX_TOKEN_TTL']) as number;
    if (this.config.accessTokenTtl > maxTokenTtl) {
      logger.warn('OAuth access token TTL exceeds max allowed, capping to max', {
        requested: this.config.accessTokenTtl,
        maxAllowed: maxTokenTtl,
        capped: maxTokenTtl,
      });
      this.config.accessTokenTtl = maxTokenTtl as number;
    }

    // Initialize JWT secrets array (primary + previous for rotation)
    this.jwtSecrets = [config.jwtSecret];
    if (config.jwtSecretPrevious) {
      this.jwtSecrets.push(config.jwtSecretPrevious);
      logger.info('JWT secret rotation enabled', {
        activeSecrets: this.jwtSecrets.length,
      });
    }

    // Initialize circuit breaker for OAuth token exchanges
    const oauthConfig = getApiSpecificCircuitBreakerConfig('oauth');
    this.oauthCircuit = new CircuitBreaker({
      failureThreshold: oauthConfig.failureThreshold,
      successThreshold: oauthConfig.successThreshold,
      timeout: oauthConfig.timeout,
      name: 'google-oauth',
    });

    // Register circuit breaker for monitoring
    circuitBreakerRegistry.register(
      'google-oauth',
      this.oauthCircuit,
      'OAuth token exchange circuit breaker'
    );

    // ✅ SECURITY: Validate production requirements
    const isProduction = process.env['NODE_ENV'] === 'production';
    if (isProduction && !config.sessionStore && !process.env['REDIS_URL']) {
      throw new ConfigError(
        'Redis session store required in production (REDIS_URL not set). ' +
          'In-memory session store does not support multiple instances or persist across restarts.',
        'REDIS_URL'
      );
    }

    // Initialize session store based on environment configuration
    if (config.sessionStore) {
      // Use provided session store (for testing or custom implementations)
      this.sessionStore = config.sessionStore;
    } else {
      // Use environment-configured session store
      try {
        const storeConfig = getSessionStoreConfig();
        this.sessionStore = createSessionStore(storeConfig.redisUrl);
      } catch (error) {
        // If config validation fails, fall back to in-memory (development only)
        // Production validation in lifecycle.ts will catch this earlier
        if (isProduction) {
          throw new ServiceError(
            `Failed to initialize session store in production: ${error}`,
            'INTERNAL_ERROR',
            'oauth-provider',
            false
          );
        }
        logger.warn('[OAuthProvider] Session store config error, using in-memory', { error });
        this.sessionStore = createSessionStore();
      }
    }

    if (isProduction && !config.sessionStore) {
      logger.info('Production mode: Using Redis session store', {
        redisConfigured: !!process.env['REDIS_URL'],
      });
    } else if (!isProduction) {
      logger.warn(
        '⚠️  Development mode: Using in-memory session store (not suitable for production)'
      );
    }

    // Start cleanup task for expired entries
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000); // Every minute

    // Register cleanup to prevent memory leak
    registerCleanup(
      'OAuthProvider',
      () => {
        clearInterval(this.cleanupInterval);
      },
      'oauth-cleanup-interval'
    );
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
   * HIGH-002 FIX: Use URL parsing instead of string matching to prevent open redirect
   *
   * Security: Validates origin and pathname separately to prevent:
   * - Fragment injection (e.g., http://localhost:3000/callback#evil.com)
   * - Query parameter injection (e.g., http://localhost:3000/callback?redirect=evil.com)
   * - Path traversal attacks
   */
  private validateRedirectUri(uri: string): boolean {
    try {
      const url = new URL(uri);

      return this.config.allowedRedirectUris.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);

          // Must match origin (protocol + host + port) AND pathname exactly
          // Query parameters are allowed to vary (OAuth state, etc.)
          // Fragments are allowed but origin/pathname must still match
          return url.origin === allowedUrl.origin && url.pathname === allowedUrl.pathname;
        } catch {
          // If allowed URI is invalid, skip it
          return false;
        }
      });
    } catch {
      // If provided URI is invalid URL, reject it
      return false;
    }
  }

  /**
   * Validate and normalize requested scopes
   * Returns normalized scope string or null if invalid
   */
  private validateScope(requestedScope: string | undefined): {
    valid: boolean;
    scope?: string;
    error?: string;
  } {
    // Default to sheets:read if no scope provided
    if (!requestedScope) {
      return { valid: true, scope: 'sheets:read' };
    }

    // Parse requested scopes (space-separated)
    const scopes = requestedScope.split(' ').filter((s) => s.length > 0);

    // Validate each scope
    for (const scope of scopes) {
      if (!SUPPORTED_SCOPES.includes(scope as SupportedScope)) {
        return {
          valid: false,
          error: `Invalid scope '${scope}'. Supported scopes: ${SUPPORTED_SCOPES.join(', ')}`,
        };
      }
    }

    // If multiple scopes requested, use the highest one (most permissive)
    // Admin > Write > Read
    if (scopes.includes('sheets:admin')) {
      return { valid: true, scope: 'sheets:admin' };
    }
    if (scopes.includes('sheets:write')) {
      return { valid: true, scope: 'sheets:write' };
    }
    if (scopes.includes('sheets:read')) {
      return { valid: true, scope: 'sheets:read' };
    }

    // Shouldn't reach here, but fallback to read
    return { valid: true, scope: 'sheets:read' };
  }

  // ============================================================================
  // CONFUSED DEPUTY PROTECTION (MCP Security Best Practices)
  // ============================================================================

  /**
   * Look up a dynamically registered client from the session store.
   * Returns null if the client is not found (unknown / expired registration).
   */
  private async lookupDcrClient(clientId: string): Promise<DcrClientData | null> {
    const data = await this.sessionStore.get(`dcr:${clientId}`);
    return data ? (data as unknown as DcrClientData) : null;
  }

  /**
   * Session store key for per-client consent records.
   * Confused deputy mitigation: every DCR client must have an explicit consent
   * record before it can initiate the authorization flow. This prevents an
   * attacker who registers a malicious client from exploiting an existing
   * consent cookie at the third-party authorization server.
   */
  private consentKey(clientId: string): string {
    return `mcp_consent:${clientId}`;
  }

  private async hasDcrConsent(clientId: string): Promise<boolean> {
    const record = await this.sessionStore.get(this.consentKey(clientId));
    return record !== null && record !== undefined;
  }

  /**
   * Grant consent for a DCR client. Called automatically at registration time.
   * TTL matches the client registration lifetime (1 year).
   */
  private async grantDcrConsent(
    clientId: string,
    clientName: string,
    redirectUris: string[]
  ): Promise<void> {
    const record: ConsentRecord = {
      clientName,
      grantedAt: Date.now(),
      redirectUris,
    };
    await this.sessionStore.set(this.consentKey(clientId), record as unknown as SessionData, {
      ttlMs: 365 * 24 * 60 * 60 * 1000,
    });
    logger.info('DCR client consent granted', { clientId, clientName });
  }

  /**
   * Revoke consent for a DCR client. Can be called by an admin to block a client.
   */
  async revokeDcrConsent(clientId: string): Promise<void> {
    await this.sessionStore.delete(this.consentKey(clientId));
    logger.info('DCR client consent revoked', { clientId });
  }

  private validateDcrRedirectUri(uri: string): { valid: boolean; error?: string } {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      return { valid: false, error: `Invalid redirect_uri: ${uri}` };
    }

    if (url.hash) {
      return { valid: false, error: 'redirect_uri must not contain a fragment' };
    }

    if (url.protocol === 'https:') {
      return { valid: true };
    }

    const hostname = url.hostname.toLowerCase();
    const isLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost');

    if (url.protocol === 'http:' && isLoopback) {
      return { valid: true };
    }

    return {
      valid: false,
      error: 'redirect_uri must use https, except loopback localhost redirect URIs may use http',
    };
  }

  private validateDcrRedirectUris(redirectUris: string[]): { valid: boolean; error?: string } {
    for (const uri of redirectUris) {
      const validation = this.validateDcrRedirectUri(uri);
      if (!validation.valid) {
        return validation;
      }
    }
    return { valid: true };
  }

  /**
   * Validates OAuth token for HTTP transport layer (MCP compatibility)
   * Returns Express middleware that validates bearer tokens
   */
  validateToken(): express.RequestHandler {
    return async (req, res, next) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.setHeader(
          'WWW-Authenticate',
          'Bearer error="invalid_request", error_description="Missing or invalid authorization header"'
        );
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Missing or invalid authorization header',
        });
      }

      const token = authHeader.slice(7); // Remove 'Bearer ' prefix

      try {
        // Verify token is a valid JWT
        let decoded: jwt.JwtPayload | string | null = null;

        for (const secret of this.jwtSecrets) {
          try {
            decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
            break;
          } catch (_err) {
            // Try next secret
          }
        }

        if (!decoded) {
          res.setHeader(
            'WWW-Authenticate',
            'Bearer error="invalid_token", error_description="Token verification failed"'
          );
          return res.status(401).json({
            error: 'invalid_token',
            error_description: 'Token verification failed',
          });
        }

        // Attach decoded token to request for downstream use
        (req as unknown as Record<string, unknown>)['user'] = decoded;
        return next();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Token validation error';
        res.setHeader(
          'WWW-Authenticate',
          `Bearer error="invalid_token", error_description="${msg}"`
        );
        return res.status(401).json({
          error: 'invalid_token',
          error_description: msg,
        });
      }
    };
  }

  private async handleRefreshToken(
    refreshToken: string,
    res: Pick<express.Response, 'status' | 'json'>,
    clientId?: string,
    clientSecret?: string
  ): Promise<void> {
    try {
      const refreshTokenData = (await this.sessionStore.get(
        `refresh:${refreshToken}`
      )) as unknown as RefreshTokenData | null;

      if (!refreshTokenData) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token expired or invalid',
        });
        return;
      }

      const authenticatedClientId = await this.authenticateClient(
        refreshTokenData.clientId,
        clientId,
        clientSecret
      );

      if (!authenticatedClientId) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        });
        return;
      }

      const refreshAudience = refreshTokenData.resource ?? refreshTokenData.clientId;
      const accessToken = jwt.sign(
        {
          sub: refreshTokenData.userId,
          aud: refreshAudience,
          iss: this.config.issuer,
          scope: refreshTokenData.scope,
          ...(refreshTokenData.resource ? { resource: refreshTokenData.resource } : {}),
        },
        this.config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: this.config.accessTokenTtl,
        }
      );

      // Rotate refresh token: invalidate the used token and issue a new one.
      // This prevents replay attacks — a stolen token can only be used once.
      await this.sessionStore.delete(`refresh:${refreshToken}`);

      const newRefreshTokenId = randomUUID();
      const newRefreshTokenData: RefreshTokenData = {
        userId: refreshTokenData.userId,
        clientId: refreshTokenData.clientId,
        scope: refreshTokenData.scope,
        googleRefreshToken: refreshTokenData.googleRefreshToken,
        expiresAt: Date.now() + this.config.refreshTokenTtl * 1000,
        resource: refreshTokenData.resource, // RFC 8707: preserve binding on rotation
      };
      await this.sessionStore.set(
        `refresh:${newRefreshTokenId}`,
        newRefreshTokenData as unknown as SessionData,
        { ttlMs: (this.config.refreshTokenTtl ?? 2592000) * 1000 }
      );
      const googleTokenKey = `google_tokens:${refreshTokenData.userId}`;
      const googleTokenData = await this.sessionStore.get(googleTokenKey);
      if (googleTokenData) {
        await this.sessionStore.set(googleTokenKey, googleTokenData, {
          ttlMs: (this.config.refreshTokenTtl ?? 2592000) * 1000,
        });
      }

      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: this.config.accessTokenTtl,
        scope: refreshTokenData.scope,
        refresh_token: newRefreshTokenId,
      });
    } catch (error) {
      logger.error('Refresh token exchange error', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  }

  /**
   * Retrieves Google refresh token from OAuth session.
   * Returns null if not present (e.g. short-lived access-only grants).
   */
  async getGoogleRefreshToken(req: express.Request): Promise<string | null | undefined> {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
      const token = authHeader.slice(7);
      let decoded: jwt.JwtPayload | string | null = null;
      for (const secret of this.jwtSecrets) {
        try {
          decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
          break;
        } catch (_err) {
          // Try next secret
        }
      }
      if (!decoded || typeof decoded === 'string' || !decoded.sub) return null;
      const googleTokenData = (await this.sessionStore.get(
        `google_tokens:${decoded.sub}`
      )) as GoogleTokenData | null;
      if (!googleTokenData) return null;
      return googleTokenData.refreshToken ?? googleTokenData.googleRefreshToken ?? null;
    } catch (error) {
      logger.error('Failed to retrieve Google refresh token', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Retrieves Google access token from OAuth session (MCP compatibility)
   * Returns null if not found or expired
   */
  async getGoogleToken(req: express.Request): Promise<string | null | undefined> {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.slice(7);
      let decoded: jwt.JwtPayload | string | null = null;

      // Verify token and extract user ID
      for (const secret of this.jwtSecrets) {
        try {
          decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
          break;
        } catch (_err) {
          // Try next secret
        }
      }

      if (!decoded || typeof decoded === 'string' || !decoded.sub) {
        return null;
      }

      // Retrieve Google token from session store
      const googleTokenKey = `google_tokens:${decoded.sub}`;
      const googleTokenData = await this.sessionStore.get(googleTokenKey);

      if (!googleTokenData) {
        return null;
      }

      const { accessToken, googleAccessToken } = googleTokenData as GoogleTokenData;
      return accessToken ?? googleAccessToken ?? null;
    } catch (error) {
      logger.error('Failed to retrieve Google token', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create Express router for OAuth endpoints
   */
  createRouter(): express.Router {
    const router = express.Router();
    const isTestEnv = process.env['NODE_ENV'] === 'test';

    // Rate limiter for OAuth endpoints
    const oauthLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute per IP
      standardHeaders: true,
      legacyHeaders: false,
      // Disable built-in validation — express-rate-limit v8 throws
      // ValidationError for trust proxy configs, crashing the request
      // before our route handler runs. We set trust proxy = 1 in
      // http-server.ts which is correct for Fly.io's single-hop proxy.
      validate: false,
      handler: (req, res) => {
        logger.warn('OAuth rate limit exceeded', {
          ip: req.ip,
          path: req.path,
        });
        res.status(429).json({
          error: 'too_many_requests',
          error_description: 'Too many OAuth requests. Try again in 1 minute.',
        });
      },
    });

    // Apply rate limiting to OAuth endpoints (skip in tests)
    if (!isTestEnv) {
      router.use('/oauth', oauthLimiter);
    }

    // AUDIT-2026-04-23 (finding N5): per-client_id rate limit on DCR
    // management endpoints. The global oauthLimiter above keys on IP,
    // which lets an attacker enumerate valid client IDs by varying the
    // path while staying under the IP cap. Per-client limit makes
    // enumeration visible: the attacker burns rate against each guessed
    // client_id, so a legitimate client sees no interference but the
    // scan is throttled after the first N requests per ID.
    //
    // Simple in-process sliding window (clientId → timestamps). Suitable
    // for single-process deployments; multi-process + Redis should
    // replace this with a shared counter.
    const dcrPerClientWindowMs = 60 * 1000;
    const dcrPerClientMax = 20; // 20 req/min/client_id across all methods
    const dcrPerClientCounters = new Map<string, number[]>();
    const dcrRateLimitByClientId = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ): void => {
      if (isTestEnv) return next();
      const rawClientId = req.params['clientId'];
      const clientId = Array.isArray(rawClientId) ? rawClientId[0] : rawClientId;
      if (!clientId) return next(); // no clientId param → let the route handler 400
      const now = Date.now();
      const timestamps = dcrPerClientCounters.get(clientId) ?? [];
      const fresh = timestamps.filter((t) => now - t < dcrPerClientWindowMs);
      if (fresh.length >= dcrPerClientMax) {
        logger.warn('DCR per-client rate limit exceeded', {
          clientId,
          ip: req.ip,
          path: req.path,
        });
        res.status(429).json({
          error: 'too_many_requests',
          error_description:
            'Too many requests for this client_id. Try again in 1 minute.',
        });
        return;
      }
      fresh.push(now);
      dcrPerClientCounters.set(clientId, fresh);
      // Periodic GC: prune entries whose window has fully expired.
      if (dcrPerClientCounters.size > 10_000) {
        for (const [k, ts] of dcrPerClientCounters) {
          const alive = ts.filter((t) => now - t < dcrPerClientWindowMs);
          if (alive.length === 0) dcrPerClientCounters.delete(k);
          else dcrPerClientCounters.set(k, alive);
        }
      }
      next();
    };
    router.use('/oauth/register/:clientId', dcrRateLimitByClientId);

    // OAuth 2.0 Authorization Server Metadata (RFC 8414)
    router.get('/.well-known/oauth-authorization-server', (_req, res) => {
      res.json({
        issuer: this.config.issuer,
        authorization_endpoint: `${this.config.issuer}/oauth/authorize`,
        token_endpoint: `${this.config.issuer}/oauth/token`,
        revocation_endpoint: `${this.config.issuer}/oauth/revoke`,
        introspection_endpoint: `${this.config.issuer}/oauth/introspect`,
        registration_endpoint: `${this.config.issuer}/oauth/register`, // RFC 7591 DCR
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        scopes_supported: ['sheets:read', 'sheets:write', 'sheets:admin'],
        // RFC 8707 Resource Indicators
        resource_indicators_supported: true,
      });
    });

    // MCP Server Metadata
    router.get('/.well-known/mcp.json', (_req, res) => {
      res.json({
        name: 'servalsheets',
        version: VERSION,
        description: 'Production-grade Google Sheets MCP server',
        icons: SERVER_ICONS,
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
        resource, // RFC 8707 Resource Indicator
      } = req.query as Record<string, string | undefined>;

      // RFC 8707 §2: validate resource is an absolute URI without fragment
      if (resource !== undefined) {
        try {
          const u = new URL(resource);
          if (u.hash) throw new Error('fragment not allowed');
        } catch {
          res.status(400).json({
            error: 'invalid_target',
            error_description: 'resource must be an absolute URI without fragment',
          });
          return;
        }
      }

      // Validate request
      if (response_type !== 'code') {
        res.status(400).json({ error: 'unsupported_response_type' });
        return;
      }

      if (!redirect_uri) {
        res
          .status(400)
          .json({ error: 'invalid_request', error_description: 'redirect_uri required' });
        return;
      }

      // Validate client identity.
      // Static client (configured via clientId): uses the global redirect URI allowlist.
      // DCR clients (dcr_* prefix): must be registered, must have consent, and redirect_uri
      //   must match their registration (confused deputy protection — per MCP Security Best
      //   Practices, all DCR clients require explicit per-client consent before the proxy
      //   forwards them to the third-party authorization server).
      let resolvedClientId = client_id ?? '';
      if (client_id === this.config.clientId) {
        // Static pre-configured client — validate against global allowlist
        if (!this.validateRedirectUri(redirect_uri)) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'redirect_uri not in allowlist',
          });
          return;
        }
      } else if (client_id?.startsWith('dcr_')) {
        // Dynamic client registration (DCR) flow
        resolvedClientId = client_id;
        const dcrClient = await this.lookupDcrClient(client_id);

        if (!dcrClient) {
          res.status(400).json({
            error: 'invalid_client',
            error_description: 'Client not found or registration expired',
          });
          return;
        }

        // Confused deputy protection: verify consent has been granted for this client
        const hasConsent = await this.hasDcrConsent(client_id);
        if (!hasConsent) {
          res.status(403).json({
            error: 'access_denied',
            error_description:
              'Client has no consent. An administrator must grant consent before authorization.',
          });
          return;
        }

        // Validate redirect URI matches the registration
        if (!dcrClient.redirect_uris.includes(redirect_uri)) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'redirect_uri does not match registration',
          });
          return;
        }
      } else {
        // Unknown client
        res.status(400).json({
          error: 'invalid_client',
          error_description: 'Unknown client_id',
        });
        return;
      }

      // Validate PKCE (required for all clients)
      if (!code_challenge) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'code_challenge required (PKCE)',
        });
        return;
      }

      if (!code_challenge_method) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'code_challenge_method required',
        });
        return;
      }

      if (code_challenge_method !== 'S256') {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Only S256 code_challenge_method is supported',
        });
        return;
      }

      // Validate scope
      const scopeValidation = this.validateScope(scope);
      if (!scopeValidation.valid) {
        res.status(400).json({
          error: 'invalid_scope',
          error_description: scopeValidation.error,
        });
        return;
      }

      // Validate that requested scopes are subset of DCR client's registered scopes (if DCR client)
      if (client_id?.startsWith('dcr_')) {
        const dcrClient = await this.lookupDcrClient(client_id);
        if (dcrClient && scopeValidation.scope) {
          const registeredScopes = dcrClient.scope.split(' ');
          if (!registeredScopes.includes(scopeValidation.scope)) {
            res.status(400).json({
              error: 'invalid_scope',
              error_description: `Scope '${scopeValidation.scope}' not in client registration`,
            });
            return;
          }
        }
      }

      // Validate state format (hex string)
      if (state && !/^[a-f0-9]{32,256}$/i.test(state)) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid state format',
        });
        return;
      }

      // ✅ SECURITY: Store authorization state (code, PKCE, redirect_uri)
      const authCode = randomUUID();
      const stateData: StateData = {
        originalState: state,
        redirectUri: redirect_uri,
        scope: scopeValidation.scope,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        clientId: resolvedClientId,
        resource, // RFC 8707
      };

      // Store authorization code with 10-minute TTL
      await this.sessionStore.set(`auth:${authCode}`, stateData as unknown as SessionData, {
        ttlMs: 600 * 1000,
      });

      // Generate Google OAuth state to track the round-trip
      // State format: {authCode}:{clientId}:{nonce}
      // where nonce is for additional security
      const nonce = randomBytes(16).toString('hex');
      const googleOAuthState = `${authCode}:${resolvedClientId}:${nonce}`;

      // Build Google OAuth authorization URL
      // This redirects the user to Google to authenticate
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', this.config.googleClientId);
      googleAuthUrl.searchParams.set('redirect_uri', `${this.config.issuer}/oauth/callback`);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', formatScopesForAuth(getConfiguredScopes()));
      googleAuthUrl.searchParams.set('state', googleOAuthState);
      googleAuthUrl.searchParams.set('access_type', 'offline'); // To get refresh token
      googleAuthUrl.searchParams.set('prompt', 'consent'); // Force consent screen
      googleAuthUrl.searchParams.set('include_granted_scopes', 'true');

      res.redirect(googleAuthUrl.toString());
    });

    // Google OAuth callback
    router.get('/oauth/callback', async (req, res) => {
      const {
        code: googleAuthCode,
        state: googleOAuthState,
        error: googleError,
      } = req.query as Record<string, string | undefined>;

      // Handle OAuth errors from Google
      if (googleError) {
        logger.warn('Google OAuth error', { error: googleError });
        res.status(400).json({
          error: 'access_denied',
          error_description: `Google OAuth error: ${googleError}`,
        });
        return;
      }

      if (!googleAuthCode || !googleOAuthState) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing authorization code or state',
        });
        return;
      }

      try {
        // Parse Google OAuth state
        const [authCode, clientId, nonce] = googleOAuthState.split(':');

        if (!authCode || !clientId || !nonce) {
          res.status(400).json({
            error: 'invalid_state',
            error_description: 'Invalid OAuth state format',
          });
          return;
        }

        // AUDIT-2026-04-23 (finding N6): consume the state atomically.
        // Previous code did get() then later delete(), which left a race
        // window where two concurrent callback requests for the same
        // authCode could both succeed (state fixation / replay). `consume`
        // does an atomic GETDEL (Redis) or sync get+delete (in-memory).
        // If the implementation doesn't expose consume, fall back to
        // the legacy get-then-delete pattern.
        const stateData = (this.sessionStore.consume
          ? ((await this.sessionStore.consume(`auth:${authCode}`)) as StateData | undefined)
          : ((await this.sessionStore.get(`auth:${authCode}`)) as unknown as StateData | null)) as
          | StateData
          | null
          | undefined;

        if (!stateData) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization code expired or invalid',
          });
          return;
        }

        // Verify clientId matches
        if (stateData.clientId !== clientId) {
          logger.error('Client ID mismatch in OAuth callback', {
            expected: stateData.clientId,
            received: clientId,
          });
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Client ID mismatch',
          });
          return;
        }

        // Exchange Google auth code for tokens
        let googleTokens: { access_token: string; refresh_token?: string } | null = null;
        try {
          // Use circuit breaker for Google API call
          googleTokens = await this.oauthCircuit.execute(() =>
            this.exchangeGoogleAuthCode(googleAuthCode)
          );
        } catch (error) {
          logger.error('Failed to exchange Google auth code', {
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Failed to authenticate with Google',
          });
          return;
        }

        // Extract tokens from Google response
        const googleAccessToken = googleTokens?.access_token;
        const googleRefreshToken = googleTokens?.refresh_token;

        // Store authorization code with tokens
        const authCodeData: AuthorizationCode = {
          code: authCode,
          clientId: stateData.clientId,
          redirectUri: stateData.redirectUri,
          scope: stateData.scope || 'sheets:read',
          codeChallenge: stateData.codeChallenge || '',
          codeChallengeMethod: stateData.codeChallengeMethod || '',
          googleAccessToken,
          googleRefreshToken,
          expiresAt: Date.now() + 600000, // 10 minutes
          resource: stateData.resource, // RFC 8707
        };

        // Store authorization code with 10-minute TTL
        await this.sessionStore.set(`code:${authCode}`, authCodeData as unknown as SessionData, {
          ttlMs: 600 * 1000,
        });

        // Redirect back to client with authorization code
        const redirectUrl = new URL(stateData.redirectUri);
        redirectUrl.searchParams.set('code', authCode);
        redirectUrl.searchParams.set('state', stateData.originalState || '');

        res.redirect(redirectUrl.toString());
      } catch (error) {
        logger.error('OAuth callback error', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error during OAuth callback',
        });
      }
    });

    // Token endpoint (RFC 6749)
    router.post('/oauth/token', async (req, res) => {
      const { grant_type, code, code_verifier, refresh_token, client_id, client_secret } =
        req.body as Record<string, string | undefined>;
      const clientCredentials = this.extractClientCredentials(req, client_id, client_secret);

      // Validate grant type
      if (!grant_type) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing grant_type',
        });
        return;
      }

      if (grant_type === 'authorization_code') {
        // Authorization code grant

        // Verify client authentication first (RFC 6749 §3.2.1) — prevents
        // leaking code validity to unauthenticated clients
        const preAuthClientId = await this.authenticateClient(
          '',
          clientCredentials.clientId,
          clientCredentials.clientSecret
        );
        if (!preAuthClientId) {
          res.status(401).json({
            error: 'invalid_client',
            error_description: 'Client authentication failed',
          });
          return;
        }

        if (!code) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing authorization code',
          });
          return;
        }

        if (!code_verifier) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing code_verifier (PKCE)',
          });
          return;
        }

        try {
          // Retrieve authorization code
          const authCodeData = (await this.sessionStore.get(
            `code:${code}`
          )) as unknown as AuthorizationCode | null;

          if (!authCodeData) {
            res.status(400).json({
              error: 'invalid_code',
              error_description: 'Authorization code expired or invalid',
            });
            return;
          }

          // Verify PKCE code challenge
          const codeChallenge = createHash('sha256').update(code_verifier).digest('base64url');

          if (codeChallenge !== authCodeData.codeChallenge) {
            logger.warn('PKCE code challenge mismatch', { clientId: authCodeData.clientId });
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Invalid code_verifier',
            });
            return;
          }

          // Re-verify client matches the code's intended client
          const authenticatedClientId = await this.authenticateClient(
            authCodeData.clientId,
            clientCredentials.clientId,
            clientCredentials.clientSecret
          );

          if (!authenticatedClientId) {
            res.status(401).json({
              error: 'invalid_client',
              error_description: 'Client authentication failed',
            });
            return;
          }

          // Generate tokens
          const userId = `user:${authCodeData.clientId}:${randomUUID()}`;
          // RFC 8707: if a resource indicator was requested, bind it as the audience;
          // otherwise fall back to clientId for backwards compatibility.
          const tokenAudience = authCodeData.resource ?? authCodeData.clientId;
          const accessToken = jwt.sign(
            {
              sub: userId,
              aud: tokenAudience,
              iss: this.config.issuer,
              scope: authCodeData.scope,
              ...(authCodeData.resource ? { resource: authCodeData.resource } : {}),
            },
            this.config.jwtSecret,
            {
              algorithm: 'HS256',
              expiresIn: this.config.accessTokenTtl,
            }
          );

          const refreshTokenId = randomUUID();
          const refreshTokenData: RefreshTokenData = {
            userId,
            clientId: authCodeData.clientId,
            scope: authCodeData.scope,
            googleRefreshToken: authCodeData.googleRefreshToken,
            expiresAt: Date.now() + this.config.refreshTokenTtl * 1000,
            resource: authCodeData.resource, // RFC 8707: carry through to token refresh
          };

          // Store refresh token with TTL
          await this.sessionStore.set(
            `refresh:${refreshTokenId}`,
            refreshTokenData as unknown as SessionData,
            { ttlMs: (this.config.refreshTokenTtl ?? 2592000) * 1000 }
          );

          // Store Google tokens server-side (never in JWT)
          if (authCodeData.googleAccessToken) {
            await this.sessionStore.set(
              `google_tokens:${userId}`,
              {
                accessToken: authCodeData.googleAccessToken,
                refreshToken: authCodeData.googleRefreshToken,
              },
              { ttlMs: (this.config.refreshTokenTtl ?? 2592000) * 1000 }
            );
          }

          // Invalidate authorization code
          await this.sessionStore.delete(`code:${code}`);
          await this.sessionStore.delete(`auth:${code}`);

          res.json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: this.config.accessTokenTtl,
            refresh_token: refreshTokenId,
            scope: authCodeData.scope,
          });
        } catch (error) {
          logger.error('Token exchange error', {
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Internal server error',
          });
        }
      } else if (grant_type === 'refresh_token') {
        // Refresh token grant
        if (!refresh_token) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing refresh_token',
          });
          return;
        }

        await this.handleRefreshToken(
          refresh_token,
          res,
          clientCredentials.clientId,
          clientCredentials.clientSecret
        );
      } else {
        res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: `Unsupported grant_type: ${grant_type}`,
        });
      }
    });

    // Token revocation endpoint (RFC 7009)
    router.post('/oauth/revoke', async (req, res) => {
      const { token, client_id, client_secret } = req.body as Record<string, string | undefined>;
      const clientCredentials = this.extractClientCredentials(req, client_id, client_secret);

      if (!token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing token',
        });
        return;
      }

      // Verify client authentication
      const authenticatedClientId = await this.authenticateClient(
        '', // We don't know the client ID yet
        clientCredentials.clientId,
        clientCredentials.clientSecret
      );

      if (!authenticatedClientId) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        });
        return;
      }

      const refreshTokenData = (await this.sessionStore.get(`refresh:${token}`)) as unknown as
        | RefreshTokenData
        | undefined;

      let userIdToClear = refreshTokenData?.userId;
      if (!userIdToClear) {
        for (const secret of this.jwtSecrets) {
          try {
            const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
            if (decoded && typeof decoded !== 'string' && decoded.sub) {
              userIdToClear = decoded.sub;
              break;
            }
          } catch {
            // Try next secret; revocation still returns success for unknown tokens.
          }
        }
      }

      if (userIdToClear) {
        // Attempt to revoke the upstream Google token before clearing local
        // storage. Use a short timeout and swallow errors — user intent to
        // revoke matters more than a single failed network call. Local deletion
        // always proceeds regardless of Google-side outcome (Fix 2).
        const googleTokenData = (await this.sessionStore.get(
          `google_tokens:${userIdToClear}`
        )) as unknown as GoogleTokenData | undefined;
        const googleRefreshToken =
          googleTokenData?.refreshToken ?? googleTokenData?.googleRefreshToken;
        if (googleRefreshToken) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3_000);
            await fetch(
              `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(googleRefreshToken)}`,
              { method: 'POST', signal: controller.signal }
            ).finally(() => clearTimeout(timeout));
          } catch (revokeErr) {
            logger.warn('Google token revoke call failed (local revocation will still proceed)', {
              userId: userIdToClear,
              error: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
            });
          }
        }
        await this.sessionStore.delete(`google_tokens:${userIdToClear}`);

        // GDPR erasure: purge recorded requests associated with this user
        try {
          getRequestRecorder().deleteByUserId(userIdToClear);
        } catch {
          // Non-fatal: recorder may be disabled or unavailable
        }
      }

      // Try to revoke as refresh token
      await this.sessionStore.delete(`refresh:${token}`);

      // Return 200 OK (RFC 7009 says success even if token not found)
      res.status(200).json({});
    });

    // Token introspection endpoint (RFC 7662)
    router.post('/oauth/introspect', async (req, res) => {
      const { token, client_id, client_secret } = req.body as Record<string, string | undefined>;
      const clientCredentials = this.extractClientCredentials(req, client_id, client_secret);

      if (!token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing token',
        });
        return;
      }

      // Verify client authentication
      const authenticatedClientId = await this.authenticateClient(
        '', // We don't know the client ID yet
        clientCredentials.clientId,
        clientCredentials.clientSecret
      );

      if (!authenticatedClientId) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        });
        return;
      }

      try {
        // Try to verify as JWT
        let decoded: jwt.JwtPayload | string | null = null;

        for (const secret of this.jwtSecrets) {
          try {
            decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
            break; // Success, exit loop
          } catch (_err) {
            // Try next secret
          }
        }

        if (!decoded || typeof decoded === 'string') {
          // Token is not a valid JWT, return introspection response
          res.status(200).json({
            active: false,
          });
          return;
        }

        // Token is valid signature — cast payload for custom fields
        const payload = decoded as jwt.JwtPayload & { scope?: string };

        // Validate issuer and audience claims (RFC 7662 §2.2)
        const expectedAudience = this.config.resourceIndicator ?? this.config.clientId;
        if (payload.iss !== this.config.issuer || payload.aud !== expectedAudience) {
          res.status(200).json({ active: false });
          return;
        }

        res.status(200).json({
          active: true,
          scope: payload.scope || '',
          client_id: payload.aud,
          username: payload.sub,
          token_type: 'Bearer',
          exp: payload.exp,
          iat: payload.iat,
          nbf: payload.iat,
          sub: payload.sub,
          iss: payload.iss,
          aud: payload.aud,
        });
      } catch (error) {
        logger.error('Token introspection error', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error',
        });
      }
    });

    // Dynamic Client Registration (RFC 7591)
    router.post('/oauth/register', async (req, res) => {
      const {
        client_name,
        redirect_uris,
        grant_types,
        response_types,
        scope,
        token_endpoint_auth_method,
      } = req.body as Record<string, string | string[] | undefined>;

      // ✅ SECURITY: Validate DCR inputs
      if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'redirect_uris required',
        });
        return;
      }

      const redirectValidation = this.validateDcrRedirectUris(redirect_uris);
      if (!redirectValidation.valid) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: redirectValidation.error,
        });
        return;
      }

      // Default to authorization_code if not specified
      const requestedGrantTypes = grant_types || ['authorization_code'];

      try {
        // Generate unique client ID and secret
        const clientId = `dcr_${randomUUID()}`;
        const clientSecret = randomBytes(32).toString('hex');
        const clientIdIssuedAt = Math.floor(Date.now() / 1000);

        // Validate requested scopes
        const scopeStr = typeof scope === 'string' ? scope : 'sheets:read';
        const requestedScopes = scopeStr.split(' ');
        const validScopes = requestedScopes.filter((s: string) =>
          SUPPORTED_SCOPES.includes(s as SupportedScope)
        );

        if (validScopes.length === 0) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: `Invalid scope. Supported: ${SUPPORTED_SCOPES.join(', ')}`,
          });
          return;
        }

        // Store client registration (expires in 1 year)
        const clientData = {
          client_id: clientId,
          client_secret: clientSecret,
          client_name:
            (typeof client_name === 'string' ? client_name : null) ||
            `Dynamic Client ${clientId.substring(0, 8)}`,
          redirect_uris,
          grant_types: requestedGrantTypes,
          response_types: response_types || ['code'],
          scope: validScopes.join(' '),
          token_endpoint_auth_method: token_endpoint_auth_method || 'client_secret_basic',
          client_id_issued_at: clientIdIssuedAt,
          created_at: new Date().toISOString(),
        };

        // RFC 7591 §3.2.1: registration_access_token for client management operations
        const registrationAccessToken = randomBytes(32).toString('hex');
        const baseUrl =
          process.env['OAUTH_BASE_URL'] ?? `http://localhost:${process.env['PORT'] ?? 3000}`;
        const registrationClientUri = `${baseUrl}/oauth/register/${clientId}`;

        // Store in session store with 1 year TTL
        await this.sessionStore.set(
          `dcr:${clientId}`,
          { ...clientData, registration_access_token: registrationAccessToken },
          { ttlMs: 365 * 24 * 60 * 60 * 1000 } // 1 year (ms)
        );

        const autoConsent = process.env['OAUTH_DCR_AUTO_CONSENT'] === 'true';
        if (autoConsent) {
          await this.grantDcrConsent(clientId, clientData.client_name, redirect_uris as string[]);
          // Emit a tamper-evident audit record for every auto-consented DCR
          // registration. This gives ops teams a hash-chain audit trail to
          // detect unexpected client registrations (Fix 3).
          try {
            const { getAuditLogger } = await import('../services/audit-logger.js');
            await getAuditLogger().logAuthentication({
              action: 'oauth_grant',
              userId: 'system:dcr-auto-consent',
              ipAddress: req.ip ?? 'unknown',
              requestId: clientId,
              resource: { type: 'config' },
              outcome: 'success',
              method: 'oauth',
              metadata: {
                clientId,
                clientName: clientData.client_name,
                redirectUris: redirect_uris,
                requestTime: new Date().toISOString(),
                remoteIP: req.ip ?? 'unknown',
              },
            });
          } catch (auditErr) {
            logger.warn('DCR auto-consent audit log failed (registration will still proceed)', {
              clientId,
              error: auditErr instanceof Error ? auditErr.message : String(auditErr),
            });
          }
        }

        logger.info('Dynamic client registered', {
          clientId,
          clientName: clientData.client_name,
          redirectUris: redirect_uris,
        });

        // Return client credentials (RFC 7591 §3.2.1 compliant response)
        res.status(201).json({
          client_id: clientId,
          client_secret: clientSecret,
          client_id_issued_at: clientIdIssuedAt,
          client_secret_expires_at: 0, // 0 = never expires (RFC 7591 §3.2.1)
          registration_access_token: registrationAccessToken,
          registration_client_uri: registrationClientUri,
          client_name: clientData.client_name,
          redirect_uris,
          grant_types: requestedGrantTypes,
          response_types: clientData.response_types,
          scope: clientData.scope,
          token_endpoint_auth_method: clientData.token_endpoint_auth_method,
          consent_required: !autoConsent,
        });
      } catch (error) {
        logger.error('DCR registration failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to register client',
        });
      }
    });

    // RFC 7591 §4 — Client Configuration Endpoint (read / update / delete)

    const authenticateDcrRequest = async (
      req: express.Request,
      res: express.Response,
      clientId: string
    ): Promise<Record<string, unknown> | null> => {
      const authHeader = req.headers['authorization'];
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        res
          .status(401)
          .json({ error: 'invalid_token', error_description: 'Bearer token required' });
        return null;
      }
      const stored = (await this.sessionStore.get(`dcr:${clientId}`)) as Record<
        string,
        unknown
      > | null;
      if (!stored) {
        res
          .status(404)
          .json({ error: 'invalid_client_metadata', error_description: 'Client not found' });
        return null;
      }
      if (stored['registration_access_token'] !== token) {
        res
          .status(401)
          .json({ error: 'invalid_token', error_description: 'Invalid registration access token' });
        return null;
      }
      return stored;
    };

    router.post('/oauth/register/:clientId/consent', async (req, res) => {
      const clientId = req.params['clientId'];
      if (!clientId) {
        res.status(400).json({ error: 'invalid_request' });
        return;
      }

      const expectedToken = process.env['OAUTH_DCR_CONSENT_TOKEN'];
      const authHeader = req.headers['authorization'];
      const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!expectedToken || !providedToken) {
        res.status(403).json({
          error: 'access_denied',
          error_description: 'DCR consent requires administrator authorization',
        });
        return;
      }

      try {
        const matches = timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken));
        if (!matches) {
          res.status(403).json({
            error: 'access_denied',
            error_description: 'Invalid DCR consent token',
          });
          return;
        }
      } catch {
        res.status(403).json({
          error: 'access_denied',
          error_description: 'Invalid DCR consent token',
        });
        return;
      }

      const stored = (await this.sessionStore.get(`dcr:${clientId}`)) as Record<
        string,
        unknown
      > | null;
      if (!stored) {
        res.status(404).json({
          error: 'invalid_client_metadata',
          error_description: 'Client not found',
        });
        return;
      }

      await this.grantDcrConsent(
        clientId,
        String(stored['client_name'] ?? clientId),
        Array.isArray(stored['redirect_uris']) ? (stored['redirect_uris'] as string[]) : []
      );
      res.status(204).end();
    });

    router.get('/oauth/register/:clientId', async (req, res) => {
      const clientId = req.params['clientId'];
      if (!clientId) {
        res.status(400).json({ error: 'invalid_request' });
        return;
      }
      const stored = await authenticateDcrRequest(req, res, clientId);
      if (!stored) return;
      const { registration_access_token: _rat, ...publicData } = stored;
      res.json(publicData);
    });

    router.put('/oauth/register/:clientId', async (req, res) => {
      const clientId = req.params['clientId'];
      if (!clientId) {
        res.status(400).json({ error: 'invalid_request' });
        return;
      }
      const stored = await authenticateDcrRequest(req, res, clientId);
      if (!stored) return;

      const { redirect_uris, client_name, scope, token_endpoint_auth_method } = req.body as Record<
        string,
        string | string[] | undefined
      >;

      if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
        res
          .status(400)
          .json({ error: 'invalid_request', error_description: 'redirect_uris required' });
        return;
      }

      const updated: Record<string, unknown> = {
        ...stored,
        redirect_uris,
        client_name: typeof client_name === 'string' ? client_name : stored['client_name'],
        scope: typeof scope === 'string' ? scope : stored['scope'],
        token_endpoint_auth_method:
          typeof token_endpoint_auth_method === 'string'
            ? token_endpoint_auth_method
            : stored['token_endpoint_auth_method'],
        updated_at: new Date().toISOString(),
      };

      await this.sessionStore.set(`dcr:${clientId}`, updated, { ttlMs: 365 * 24 * 60 * 60 * 1000 });
      logger.info('Dynamic client updated', { clientId });
      const { registration_access_token: _rat, ...publicData } = updated;
      res.json(publicData);
    });

    router.delete('/oauth/register/:clientId', async (req, res) => {
      const clientId = req.params['clientId'];
      if (!clientId) {
        res.status(400).json({ error: 'invalid_request' });
        return;
      }
      const stored = await authenticateDcrRequest(req, res, clientId);
      if (!stored) return;
      await this.sessionStore.delete(`dcr:${clientId}`);
      logger.info('Dynamic client deleted', { clientId });
      res.status(204).end();
    });

    return router;
  }

  /**
   * Authenticate client using client credentials (RFC 6749 Section 2.3)
   * Supports: client_secret_post, client_secret_basic
   */
  private extractClientCredentials(
    req: express.Request,
    bodyClientId: string | undefined,
    bodyClientSecret: string | undefined
  ): ClientCredentials {
    const authHeader = req.headers['authorization'];
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (headerValue?.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(headerValue.slice(6), 'base64').toString('utf8');
        const separatorIndex = decoded.indexOf(':');
        if (separatorIndex === -1) {
          return {}; // OK: Explicit empty — malformed Basic auth header, no credentials to extract
        }
        const encodedClientId = decoded.slice(0, separatorIndex);
        const encodedClientSecret = decoded.slice(separatorIndex + 1);
        return {
          clientId: this.decodeBasicCredentialPart(encodedClientId),
          clientSecret: this.decodeBasicCredentialPart(encodedClientSecret),
        };
      } catch {
        return {}; // OK: Explicit empty — decode error, no credentials to extract
      }
    }

    return {
      clientId: bodyClientId,
      clientSecret: bodyClientSecret,
    };
  }

  private decodeBasicCredentialPart(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private async authenticateClient(
    expectedClientId: string,
    providedClientId: string | undefined,
    providedClientSecret: string | undefined
  ): Promise<string | null> {
    // If expectedClientId is set, use it; otherwise use providedClientId
    const clientId = expectedClientId || providedClientId;

    if (!clientId) {
      return null;
    }

    // For static clients, verify against configured credentials
    if (clientId === this.config.clientId) {
      // ✅ SECURITY: Timing-safe comparison to prevent timing attacks
      if (!providedClientSecret) {
        return null;
      }

      try {
        const secretsMatch = timingSafeEqual(
          Buffer.from(providedClientSecret),
          Buffer.from(this.config.clientSecret)
        );
        return secretsMatch ? clientId : null;
      } catch {
        // Buffer lengths don't match
        return null;
      }
    }

    // For DCR clients, look up and verify
    if (clientId.startsWith('dcr_')) {
      const dcrClient = await this.lookupDcrClient(clientId);
      if (!dcrClient) {
        return null;
      }

      if (!providedClientSecret) {
        return null;
      }

      try {
        const secretsMatch = timingSafeEqual(
          Buffer.from(providedClientSecret),
          Buffer.from(dcrClient.client_secret)
        );
        return secretsMatch ? clientId : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Exchange Google authorization code for tokens
   */
  private async exchangeGoogleAuthCode(googleAuthCode: string): Promise<{
    access_token: string;
    refresh_token?: string;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: googleAuthCode,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uri: `${this.config.issuer}/oauth/callback`,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token exchange failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<{ access_token: string; refresh_token?: string }>;
  }
}

/**
 * Create OAuth provider instance from environment configuration
 */
export async function createOAuthProviderFromEnv(): Promise<OAuthProvider> {
  const issuer = process.env['OAUTH_ISSUER'] || 'http://localhost:3000';
  const clientId = process.env['OAUTH_CLIENT_ID'] || 'servalsheets';
  const clientSecret = process.env['OAUTH_CLIENT_SECRET'];
  const jwtSecret = process.env['JWT_SECRET'];
  const stateSecret = process.env['OAUTH_STATE_SECRET'];
  const googleClientId = process.env['GOOGLE_CLIENT_ID'];
  const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

  if (!clientSecret) {
    throw new ConfigError(
      'OAUTH_CLIENT_SECRET environment variable is required',
      'OAUTH_CLIENT_SECRET'
    );
  }

  if (!jwtSecret) {
    throw new ConfigError('JWT_SECRET environment variable is required', 'JWT_SECRET');
  }

  if (!stateSecret) {
    throw new ConfigError(
      'OAUTH_STATE_SECRET environment variable is required',
      'OAUTH_STATE_SECRET'
    );
  }

  if (!googleClientId || !googleClientSecret) {
    throw new ConfigError(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for OAuth flow',
      'GOOGLE_CLIENT_ID'
    );
  }

  return new OAuthProvider({
    issuer,
    clientId,
    clientSecret,
    jwtSecret,
    stateSecret,
    googleClientId,
    googleClientSecret,
    allowedRedirectUris: [
      'http://localhost:3000/callback',
      'http://localhost:8080/callback',
      'https://claude.ai/callback',
      ...(process.env['ALLOWED_REDIRECT_URIS']?.split(',') || []),
    ],
  });
}
