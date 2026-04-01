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

import express, { Request, Response, NextFunction } from 'express';
import { ConfigError, ServiceError } from '../core/errors.js';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { SessionStore, createSessionStore } from '../storage/session-store.js';
import { getSessionStoreConfig, getApiSpecificCircuitBreakerConfig, env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import { VERSION, SERVER_ICONS } from '../version.js';
import { getRecommendedScopes, formatScopesForAuth } from '../config/oauth-scopes.js';
import { registerCleanup } from '../utils/resource-cleanup.js';

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

interface TokenPayload {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  scope: string;
  // SECURITY: Google tokens are NEVER included in JWT payload.
  // They are stored server-side in the session store (see google_tokens:{userId}).
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
  // clientId is carried through Google OAuth state so the callback knows which
  // MCP client initiated the request (required for confused deputy prevention).
  clientId: string;
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
    const maxTokenTtl = env.OAUTH_MAX_TOKEN_TTL;
    if (this.config.accessTokenTtl > maxTokenTtl) {
      logger.warn('OAuth access token TTL exceeds max allowed, capping to max', {
        requested: this.config.accessTokenTtl,
        maxAllowed: maxTokenTtl,
        capped: maxTokenTtl,
      });
      this.config.accessTokenTtl = maxTokenTtl;
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