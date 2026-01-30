/**
 * GoogleApiClient
 *
 * @purpose Primary interface to Google Sheets and Drive APIs with connection pooling and circuit breaker
 * @category Core
 * @usage Use this service for all Google API operations (sheets, drive); handles auth, retries, and rate limiting
 * @dependencies OAuth2Client, googleapis, TokenStore, CircuitBreaker, TokenManager
 * @stateful Yes - maintains OAuth client, circuit breaker state, token store, HTTP/2 connection pools
 * @singleton Yes - one instance per process to share connection pools and circuit breaker state
 *
 * @example
 * const client = new GoogleApiClient({ credentials, tokenStore });
 * await client.initialize();
 * const sheets = await client.getSheetsClient();
 * const response = await sheets.spreadsheets.get({ spreadsheetId });
 */
import { sheets_v4, drive_v3, bigquery_v2 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { type RetryOptions } from '../utils/retry.js';
import { type TokenStore } from './token-store.js';
export interface GoogleApiClientOptions {
    credentials?: {
        clientId: string;
        clientSecret: string;
        redirectUri?: string;
    };
    accessToken?: string;
    refreshToken?: string;
    serviceAccountKeyPath?: string;
    scopes?: string[];
    /** Use elevated scopes (full drive access) - required for sharing/permissions */
    elevatedAccess?: boolean;
    /** Retry/backoff options for API calls */
    retryOptions?: RetryOptions;
    /** Per-request timeout for Google API calls (ms) */
    timeoutMs?: number;
    /** Encrypted token store path */
    tokenStorePath?: string;
    /** Encryption key (hex) for token store */
    tokenStoreKey?: string;
    /** Custom token store implementation */
    tokenStore?: TokenStore;
}
export type GoogleAuthType = 'service_account' | 'oauth' | 'access_token' | 'application_default';
/**
 * Default scopes - minimal permissions (drive.file only)
 * Use this for most operations
 */
export declare const DEFAULT_SCOPES: string[];
/**
 * Elevated scopes - full drive access
 * Required for: sharing, permissions, listing all files, ownership transfer
 */
export declare const ELEVATED_SCOPES: string[];
/**
 * Read-only scopes for analysis operations
 */
export declare const READONLY_SCOPES: string[];
/**
 * BigQuery scopes for Connected Sheets and direct BigQuery operations
 * Required for: sheets_bigquery tool operations
 */
export declare const BIGQUERY_SCOPES: string[];
/**
 * Google API client wrapper
 */
export declare class GoogleApiClient {
    private auth;
    private _sheets;
    private _drive;
    private _bigquery;
    private options;
    private _scopes;
    private retryOptions?;
    private timeoutMs?;
    private tokenStore?;
    private circuit;
    private tokenRefreshQueue;
    private tokenListener?;
    private httpAgents;
    private _authType;
    private tokenManager?;
    private poolMonitorInterval?;
    constructor(options?: GoogleApiClientOptions);
    /**
     * Initialize authentication
     */
    initialize(): Promise<void>;
    /**
     * Validate API schemas using Discovery API (optional)
     * Only runs if DISCOVERY_API_ENABLED environment variable is true
     */
    private validateSchemasWithDiscovery;
    private loadStoredTokens;
    private attachTokenListener;
    private sanitizeTokens;
    private mergeTokens;
    private safeSaveTokens;
    /**
     * Initialize proactive token refresh manager
     */
    private initializeTokenManager;
    /**
     * Get Sheets API client
     */
    get sheets(): sheets_v4.Sheets;
    /**
     * Get Drive API client
     */
    get drive(): drive_v3.Drive;
    /**
     * Get BigQuery API client
     * Returns null if BigQuery is not configured (optional API)
     */
    get bigquery(): bigquery_v2.Bigquery | null;
    /**
     * Get OAuth2 client for token management
     */
    get oauth2(): OAuth2Client;
    /**
     * Get current scopes
     */
    get scopes(): string[];
    /**
     * Get authentication type
     */
    get authType(): GoogleAuthType;
    /**
     * Get token status for OAuth-based auth
     */
    getTokenStatus(): {
        hasAccessToken: boolean;
        hasRefreshToken: boolean;
        expiryDate?: number;
        scope?: string;
    };
    /**
     * Validate that OAuth tokens are valid by making a lightweight API call
     * Returns both validity status and any error message
     */
    validateToken(): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Check if elevated access is available
     */
    get hasElevatedAccess(): boolean;
    /**
     * Generate OAuth2 authorization URL
     */
    getAuthUrl(additionalScopes?: string[]): string;
    /**
     * Exchange authorization code for tokens
     */
    getToken(code: string): Promise<{
        accessToken: string;
        refreshToken?: string;
    }>;
    /**
     * Update credentials
     */
    setCredentials(accessToken: string, refreshToken?: string): void;
    /**
     * Check if authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Get circuit breaker statistics
     */
    getCircuitStats(): unknown;
    /**
     * Set up HTTP/2 connection pool monitoring
     * Logs connection pool statistics at regular intervals
     * Controlled by ENABLE_HTTP2_POOL_MONITORING environment variable
     */
    private setupConnectionPoolMonitoring;
    /**
     * Log HTTP/2 connection pool statistics
     * Provides visibility into connection reuse and pool utilization
     */
    private logConnectionPoolStats;
    /**
     * Get current HTTP/2 connection pool statistics
     * Returns current state without logging
     */
    getConnectionPoolStats(): {
        activeSockets: number;
        freeSockets: number;
        pendingRequests: number;
        maxSockets: number;
        utilizationPercent: number;
    };
    /**
     * Log scope usage for audit trail
     * Particularly important for elevated scope operations
     */
    logScopeUsage(operation: string, resourceId?: string): void;
    /**
     * Revoke access tokens
     */
    revokeAccess(): Promise<void>;
    /**
     * Clear stored tokens and in-memory credentials
     */
    clearStoredTokens(): Promise<void>;
    /**
     * Cleanup resources and remove event listeners
     * Prevents memory leaks from accumulating listeners
     */
    destroy(): void;
}
/**
 * Create and initialize a Google API client
 */
export declare function createGoogleApiClient(options?: GoogleApiClientOptions): Promise<GoogleApiClient>;
//# sourceMappingURL=google-api.d.ts.map