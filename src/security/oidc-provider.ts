/**
 * OIDC (OpenID Connect) Provider — Authorization Code + PKCE flow
 *
 * Supports Okta, Azure AD (Entra ID), Auth0, Google Workspace, PingFederate.
 *
 * Flow:
 *   1. GET /sso/oidc/login?redirect_uri=<uri>
 *      → generate state + nonce + PKCE verifier → redirect to IdP
 *   2. IdP redirects to GET /sso/oidc/callback?code=<code>&state=<state>
 *      → exchange code for tokens → validate id_token → issue JWT
 *   3. (Optional) GET /sso/oidc/logout?id_token_hint=<token>
 *      → redirect to IdP end_session_endpoint
 *
 * Configuration:
 *   ENABLE_OIDC=true
 *   OIDC_DISCOVERY_URL=https://company.okta.com/.well-known/openid-configuration
 *   OIDC_CLIENT_ID=<client_id>
 *   OIDC_CLIENT_SECRET=<client_secret>
 *   OIDC_CALLBACK_URL=https://servalsheets.company.com/sso/oidc/callback
 *   OIDC_SCOPES=openid profile email groups           (default: openid profile email)
 *   SSO_JWT_SECRET=<shared with SAML provider>
 *   SSO_JWT_TTL=3600
 *   OIDC_ALLOWED_REDIRECT_ORIGINS=https://app.company.com
 */

import { Router, Request, Response } from 'express';
import { createVerify, createPublicKey, randomBytes, createHash, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { ConfigError } from '../core/errors.js';

// ============================================================================
// Types
// ============================================================================

interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
}

interface JwkKey {
  kty: string;
  use?: string;
  kid?: string;
  alg?: string;
  n?: string; // RSA modulus (base64url)
  e?: string; // RSA exponent (base64url)
  x?: string; // EC x
  y?: string; // EC y
  crv?: string; // EC curve
}

interface OidcTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

interface PendingOidcState {
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export interface OidcProviderConfig {
  /** OIDC discovery document URL (/.well-known/openid-configuration) */
  discoveryUrl: string;
  /** OAuth2 client ID registered with the IdP */
  clientId: string;
  /** OAuth2 client secret */
  clientSecret: string;
  /** Redirect URI registered with the IdP (must match exactly) */
  callbackUrl: string;
  /**
   * Dedicated SSO JWT secret (separate from OAuth JWT_SECRET).
   * Must match the SAML provider's ssoJwtSecret if both are used.
   */
  ssoJwtSecret: string;
  /** Scopes to request (default: openid profile email) */
  scopes?: string[];
  /** JWT TTL in seconds (default: 3600) */
  jwtTtl?: number;
  /** Allowed origins for redirect_uri (open redirect protection) */
  allowedRedirectOrigins?: string[];
  /** Discovery document cache TTL in ms (default: 300000 = 5 min) */
  discoveryTtlMs?: number;
}

// SSO token payload — same shape as SAML provider for middleware compatibility
interface SsoTokenPayload {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  scope: string;
  email?: string;
  name?: string;
  oidc?: {
    nonce?: string;
    attributes?: Record<string, unknown>;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier(): string {
  return base64urlEncode(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64urlEncode(createHash('sha256').update(verifier).digest());
}

function isAllowedRedirect(url: string, allowedOrigins: string[]): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return (
      allowedOrigins.length === 0 ||
      allowedOrigins.some((origin) => {
        try {
          return parsed.origin === new URL(origin).origin;
        } catch {
          return false;
        }
      })
    );
  } catch {
    return false;
  }
}

/** Parse a JWT without verifying — used to extract header/claims before signature check */
function parseJwtParts(
  token: string
): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    return { header, payload };
  } catch {
    return null;
  }
}

/** Build a Node KeyObject from a JWK for RSA signature verification */
function jwkToPublicKey(jwk: JwkKey): KeyObject | null {
  try {
    // Node 15+ supports JWK input natively; cast via a local shim type to satisfy strict TS
    interface JwkInput {
      key: Record<string, unknown>;
      format: 'jwk';
    }
    const input: JwkInput = { key: jwk as unknown as Record<string, unknown>, format: 'jwk' };
    return createPublicKey(input as Parameters<typeof createPublicKey>[0]);
  } catch {
    return null;
  }
}

/** Verify RS256 / RS512 signature on a JWT using a public key */
function verifyRsaSignature(token: string, publicKey: KeyObject, alg: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2]!, 'base64url');

  const nodeAlg = alg === 'RS512' ? 'RSA-SHA512' : 'RSA-SHA256';
  try {
    const verify = createVerify(nodeAlg);
    verify.update(signingInput);
    return verify.verify(publicKey, signature);
  } catch {
    return false;
  }
}

// ============================================================================
// OidcProvider
// ============================================================================

const PENDING_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class OidcProvider {
  private readonly config: Required<OidcProviderConfig>;
  private discoveryDoc: OidcDiscoveryDocument | null = null;
  private discoveryFetchedAt = 0;
  private jwksCache = new Map<string, KeyObject>(); // kid → KeyObject
  private jwksFetchedAt = 0;
  private pendingStates = new Map<string, PendingOidcState>(); // state → pending

  constructor(config: OidcProviderConfig) {
    this.config = {
      scopes: ['openid', 'profile', 'email'],
      jwtTtl: 3600,
      allowedRedirectOrigins: [],
      discoveryTtlMs: 300_000,
      ...config,
    };
  }

  // --------------------------------------------------------------------------
  // Discovery + JWKS
  // --------------------------------------------------------------------------

  private async getDiscoveryDocument(): Promise<OidcDiscoveryDocument> {
    const now = Date.now();
    if (this.discoveryDoc && now - this.discoveryFetchedAt < this.config.discoveryTtlMs) {
      return this.discoveryDoc;
    }

    const res = await fetch(this.config.discoveryUrl);
    if (!res.ok) {
      throw new Error(`OIDC discovery fetch failed: ${res.status} ${res.statusText}`);
    }

    this.discoveryDoc = (await res.json()) as OidcDiscoveryDocument;
    this.discoveryFetchedAt = now;
    return this.discoveryDoc;
  }

  private async getPublicKey(kid: string | undefined, alg: string): Promise<KeyObject | null> {
    // Try cache first
    const cacheKey = kid ?? `_alg_${alg}`;
    if (
      this.jwksCache.has(cacheKey) &&
      Date.now() - this.jwksFetchedAt < this.config.discoveryTtlMs
    ) {
      return this.jwksCache.get(cacheKey) ?? null;
    }

    const discovery = await this.getDiscoveryDocument();
    const res = await fetch(discovery.jwks_uri);
    if (!res.ok) {
      throw new Error(`JWKS fetch failed: ${res.status}`);
    }

    const jwks = (await res.json()) as { keys: JwkKey[] };
    this.jwksFetchedAt = Date.now();
    this.jwksCache.clear();

    for (const key of jwks.keys) {
      if (key.kty === 'RSA') {
        const keyObj = jwkToPublicKey(key);
        if (keyObj) {
          const k = key.kid ?? `_alg_${key.alg ?? 'RS256'}`;
          this.jwksCache.set(k, keyObj);
        }
      }
    }

    return this.jwksCache.get(cacheKey) ?? null;
  }

  // --------------------------------------------------------------------------
  // id_token validation
  // --------------------------------------------------------------------------

  private async validateIdToken(
    idToken: string,
    expectedNonce: string
  ): Promise<Record<string, unknown> | null> {
    const parsed = parseJwtParts(idToken);
    if (!parsed) return null;

    const { header, payload } = parsed;
    const alg = typeof header['alg'] === 'string' ? header['alg'] : 'RS256';
    const kid = typeof header['kid'] === 'string' ? header['kid'] : undefined;

    // Only RS256 and RS512 supported (no HS256 — symmetric keys from IdP not safe)
    if (alg !== 'RS256' && alg !== 'RS512') {
      logger.warn('OIDC: unsupported id_token algorithm', { alg });
      return null;
    }

    const publicKey = await this.getPublicKey(kid, alg);
    if (!publicKey) {
      logger.warn('OIDC: no matching public key found for id_token', { kid, alg });
      return null;
    }

    if (!verifyRsaSignature(idToken, publicKey, alg)) {
      logger.warn('OIDC: id_token signature verification failed');
      return null;
    }

    // Validate standard claims
    const discovery = await this.getDiscoveryDocument();
    const now = Math.floor(Date.now() / 1000);

    if (payload['iss'] !== discovery.issuer) {
      logger.warn('OIDC: id_token issuer mismatch', {
        expected: discovery.issuer,
        actual: payload['iss'],
      });
      return null;
    }

    const aud = payload['aud'];
    const audList = Array.isArray(aud) ? aud : [aud];
    if (!audList.includes(this.config.clientId)) {
      logger.warn('OIDC: id_token audience mismatch');
      return null;
    }

    if (typeof payload['exp'] !== 'number' || payload['exp'] < now) {
      logger.warn('OIDC: id_token expired');
      return null;
    }

    if (typeof payload['iat'] !== 'number' || payload['iat'] > now + 60) {
      logger.warn('OIDC: id_token issued in future');
      return null;
    }

    if (payload['nonce'] !== expectedNonce) {
      logger.warn('OIDC: id_token nonce mismatch');
      return null;
    }

    return payload;
  }

  // --------------------------------------------------------------------------
  // State management
  // --------------------------------------------------------------------------

  private storePendingState(state: string, pending: PendingOidcState): void {
    // Prune expired states to prevent memory leak
    const now = Date.now();
    for (const [k, v] of this.pendingStates) {
      if (now - v.createdAt > PENDING_STATE_TTL_MS) {
        this.pendingStates.delete(k);
      }
    }
    this.pendingStates.set(state, pending);
  }

  private consumePendingState(state: string): PendingOidcState | null {
    const pending = this.pendingStates.get(state);
    if (!pending) return null;
    this.pendingStates.delete(state); // consume once
    if (Date.now() - pending.createdAt > PENDING_STATE_TTL_MS) return null;
    return pending;
  }

  // --------------------------------------------------------------------------
  // Token issuance
  // --------------------------------------------------------------------------

  issueToken(claims: Record<string, unknown>): string {
    const sub =
      typeof claims['sub'] === 'string' ? claims['sub'] : String(claims['sub'] ?? 'unknown');
    const email = typeof claims['email'] === 'string' ? claims['email'] : undefined;
    const name = typeof claims['name'] === 'string' ? claims['name'] : undefined;
    const nonce = typeof claims['nonce'] === 'string' ? claims['nonce'] : undefined;

    const now = Math.floor(Date.now() / 1000);
    const payload: SsoTokenPayload = {
      sub,
      aud: this.config.clientId,
      iss: this.config.callbackUrl,
      iat: now,
      exp: now + this.config.jwtTtl,
      scope: 'sso',
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      oidc: { ...(nonce ? { nonce } : {}) },
    };

    return jwt.sign(payload, this.config.ssoJwtSecret, { algorithm: 'HS256' });
  }

  /**
   * Validate a JWT issued by this provider (for middleware use).
   */
  verifyToken(token: string): SsoTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.ssoJwtSecret, {
        algorithms: ['HS256'],
        audience: this.config.clientId,
        issuer: this.config.callbackUrl,
      }) as SsoTokenPayload;
      if (decoded.scope !== 'sso') return null;
      return decoded;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Express router
  // --------------------------------------------------------------------------

  createRouter(): Router {
    const router = Router();

    // GET /sso/oidc/login — initiate OIDC authorization code + PKCE flow
    router.get('/sso/oidc/login', async (req: Request, res: Response) => {
      try {
        const discovery = await this.getDiscoveryDocument();

        const state = base64urlEncode(randomBytes(24));
        const nonce = base64urlEncode(randomBytes(24));
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        const redirectUri =
          (req.query['redirect_uri'] as string | undefined) ?? this.config.callbackUrl;

        // Validate redirect_uri against allowlist
        if (
          this.config.allowedRedirectOrigins.length > 0 &&
          !isAllowedRedirect(redirectUri, this.config.allowedRedirectOrigins)
        ) {
          res.status(400).json({
            error: 'OIDC_INVALID_REDIRECT_URI',
            message: 'redirect_uri not in allowed origins',
          });
          return;
        }

        this.storePendingState(state, { nonce, codeVerifier, redirectUri, createdAt: Date.now() });

        const params = new URLSearchParams({
          response_type: 'code',
          client_id: this.config.clientId,
          redirect_uri: this.config.callbackUrl,
          scope: this.config.scopes.join(' '),
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        });

        logger.info('OIDC login initiated', { state: state.slice(0, 8) });
        res.redirect(`${discovery.authorization_endpoint}?${params.toString()}`);
      } catch (error) {
        logger.error('OIDC login initiation failed', { error });
        res
          .status(500)
          .json({ error: 'OIDC_INIT_FAILED', message: 'Failed to initiate OIDC login' });
      }
    });

    // GET /sso/oidc/callback — exchange code for tokens
    router.get('/sso/oidc/callback', async (req: Request, res: Response) => {
      try {
        const errorParam = req.query['error'] as string | undefined;
        if (errorParam) {
          const desc = req.query['error_description'] as string | undefined;
          logger.warn('OIDC callback received error from IdP', {
            error: errorParam,
            description: desc,
          });
          res
            .status(400)
            .json({ error: `OIDC_IDP_ERROR: ${errorParam}`, message: desc ?? errorParam });
          return;
        }

        const code = req.query['code'] as string | undefined;
        const state = req.query['state'] as string | undefined;

        if (!code || !state) {
          res
            .status(400)
            .json({ error: 'OIDC_MISSING_PARAMS', message: 'code and state are required' });
          return;
        }

        const pending = this.consumePendingState(state);
        if (!pending) {
          res.status(400).json({
            error: 'OIDC_INVALID_STATE',
            message: 'State mismatch or expired — possible CSRF',
          });
          return;
        }

        // Exchange code for tokens
        const discovery = await this.getDiscoveryDocument();
        const tokenRes = await fetch(discovery.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.config.callbackUrl,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code_verifier: pending.codeVerifier,
          }).toString(),
        });

        if (!tokenRes.ok) {
          const body = await tokenRes.text();
          logger.error('OIDC token exchange failed', {
            status: tokenRes.status,
            body: body.slice(0, 200),
          });
          res.status(502).json({
            error: 'OIDC_TOKEN_EXCHANGE_FAILED',
            message: 'Token exchange with IdP failed',
          });
          return;
        }

        const tokens = (await tokenRes.json()) as OidcTokenResponse;

        // Validate id_token
        const claims = await this.validateIdToken(tokens.id_token, pending.nonce);
        if (!claims) {
          res
            .status(401)
            .json({ error: 'OIDC_INVALID_ID_TOKEN', message: 'id_token validation failed' });
          return;
        }

        const sub = String(claims['sub'] ?? '');
        const email = typeof claims['email'] === 'string' ? claims['email'] : undefined;

        logger.info('OIDC authentication successful', {
          sub: sub.slice(0, 20) + '...',
          email: email ? email.replace(/(.{2}).*@/, '$1***@') : undefined,
        });

        const ssoToken = this.issueToken(claims);

        // Deliver token via httpOnly cookie + redirect, or JSON for API clients
        const redirectTarget = pending.redirectUri;
        if (redirectTarget && redirectTarget !== this.config.callbackUrl) {
          res.cookie('sso_token', ssoToken, {
            httpOnly: true,
            secure: !redirectTarget.startsWith('http://localhost'),
            sameSite: 'lax',
            maxAge: this.config.jwtTtl * 1000,
            path: '/',
          });
          res.redirect(redirectTarget);
        } else {
          res.json({
            token: ssoToken,
            tokenType: 'Bearer',
            expiresIn: this.config.jwtTtl,
            sub,
            ...(email ? { email } : {}),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('OIDC callback failed', { error: message });
        res.status(500).json({ error: 'OIDC_CALLBACK_FAILED', message });
      }
    });

    // GET /sso/oidc/logout — redirect to IdP end_session_endpoint if available
    router.get('/sso/oidc/logout', async (req: Request, res: Response) => {
      try {
        const idTokenHint = req.query['id_token_hint'] as string | undefined;
        const postLogoutRedirectUri = req.query['post_logout_redirect_uri'] as string | undefined;

        res.clearCookie('sso_token', { path: '/' });

        const discovery = await this.getDiscoveryDocument();
        if (!discovery.end_session_endpoint) {
          res.json({ message: 'Logged out (IdP does not support end_session_endpoint)' });
          return;
        }

        const params = new URLSearchParams();
        if (idTokenHint) params.set('id_token_hint', idTokenHint);
        if (postLogoutRedirectUri) params.set('post_logout_redirect_uri', postLogoutRedirectUri);
        params.set('client_id', this.config.clientId);

        logger.info('OIDC logout initiated');
        res.redirect(`${discovery.end_session_endpoint}?${params.toString()}`);
      } catch (error) {
        logger.error('OIDC logout failed', { error });
        res.status(500).json({ error: 'OIDC_LOGOUT_FAILED' });
      }
    });

    return router;
  }
}

// ============================================================================
// Factory from environment variables
// ============================================================================

export interface OidcEnvConfig {
  OIDC_DISCOVERY_URL?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_CALLBACK_URL?: string;
  OIDC_SCOPES?: string;
  SSO_JWT_SECRET?: string;
  SSO_JWT_TTL?: string;
  OIDC_ALLOWED_REDIRECT_ORIGINS?: string;
}

/**
 * Create an OidcProvider from environment variables.
 * Returns null if OIDC is not configured (missing required vars).
 */
export function createOidcProviderFromEnv(
  env: OidcEnvConfig = process.env as OidcEnvConfig
): OidcProvider | null {
  const {
    OIDC_DISCOVERY_URL,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_CALLBACK_URL,
    SSO_JWT_SECRET,
  } = env;

  if (
    !OIDC_DISCOVERY_URL ||
    !OIDC_CLIENT_ID ||
    !OIDC_CLIENT_SECRET ||
    !OIDC_CALLBACK_URL ||
    !SSO_JWT_SECRET
  ) {
    return null;
  }

  const scopes = env.OIDC_SCOPES
    ? env.OIDC_SCOPES.split(/[\s,]+/).filter(Boolean)
    : ['openid', 'profile', 'email'];

  if (!scopes.includes('openid')) {
    throw new ConfigError('OIDC_SCOPES must include "openid"', 'OIDC_SCOPES');
  }

  return new OidcProvider({
    discoveryUrl: OIDC_DISCOVERY_URL,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    callbackUrl: OIDC_CALLBACK_URL,
    ssoJwtSecret: SSO_JWT_SECRET,
    scopes,
    jwtTtl: env.SSO_JWT_TTL ? parseInt(env.SSO_JWT_TTL, 10) : 3600,
    allowedRedirectOrigins: env.OIDC_ALLOWED_REDIRECT_ORIGINS
      ? env.OIDC_ALLOWED_REDIRECT_ORIGINS.split(',').map((s) => s.trim())
      : [],
  });
}
