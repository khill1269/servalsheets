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
import { SessionStore } from './storage/session-store.js';
/**
 * PKCE (Proof Key for Code Exchange) is REQUIRED for all authorization flows.
 * This is enforced at runtime - all requests must include code_challenge.
 * OAuth 2.1 security best practice.
 */
export declare const PKCE_REQUIRED = true;
/**
 * Only S256 code challenge method is supported.
 * Plain method is insecure and explicitly rejected.
 */
export declare const CODE_CHALLENGE_METHOD = "S256";
export interface OAuthConfig {
    issuer: string;
    clientId: string;
    clientSecret: string;
    jwtSecret: string;
    jwtSecretPrevious?: string;
    stateSecret: string;
    allowedRedirectUris: string[];
    accessTokenTtl?: number;
    refreshTokenTtl?: number;
    googleClientId?: string;
    googleClientSecret?: string;
    sessionStore?: SessionStore;
}
/**
 * OAuth 2.1 Provider for MCP authentication
 */
export declare class OAuthProvider {
    private config;
    private sessionStore;
    private cleanupInterval;
    private jwtSecrets;
    private oauthCircuit;
    constructor(config: OAuthConfig);
    /**
     * Clean up expired entries (delegated to session store)
     */
    private cleanupExpired;
    /**
     * Destroy the provider and clean up resources
     */
    destroy(): void;
    /**
     * Validate redirect URI against allowlist
     * HIGH-002 FIX: Use URL parsing instead of string matching to prevent open redirect
     *
     * Security: Validates origin and pathname separately to prevent:
     * - Fragment injection (e.g., http://localhost:3000/callback#evil.com)
     * - Query parameter injection (e.g., http://localhost:3000/callback?redirect=evil.com)
     * - Path traversal attacks
     */
    private validateRedirectUri;
    /**
     * Validate and normalize requested scopes
     * Returns normalized scope string or null if invalid
     */
    private validateScope;
    /**
     * Check if a given scope includes another scope
     * Example: sheets:admin includes sheets:write and sheets:read
     */
    private scopeIncludes;
    /**
     * Generate signed state token
     */
    private generateState;
    /**
     * Verify and consume state token
     */
    private verifyState;
    /**
     * Create Express router for OAuth endpoints
     */
    createRouter(): express.Router;
    /**
     * Handle authorization code exchange
     */
    private handleAuthorizationCode;
    /**
     * Handle refresh token exchange
     */
    private handleRefreshToken;
    /**
     * Middleware to validate access tokens
     */
    validateToken(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Extract Google access token from validated request
     */
    getGoogleToken(req: Request): string | undefined;
    /**
     * Extract Google refresh token from validated request
     */
    getGoogleRefreshToken(req: Request): string | undefined;
}
//# sourceMappingURL=oauth-provider.d.ts.map