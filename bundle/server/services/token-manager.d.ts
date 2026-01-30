/**
 * TokenManager
 *
 * @purpose Proactively refreshes OAuth tokens before expiry to prevent interruptions (default: refresh at 80% of token lifetime)
 * @category Infrastructure
 * @usage Use for long-running sessions with OAuth; checks token status every 5min, automatically refreshes when threshold reached
 * @dependencies OAuth2Client, logger
 * @stateful Yes - maintains check interval timer, last refresh timestamp, token status
 * @singleton Yes - one instance per OAuth client to coordinate refresh timing
 *
 * @example
 * const manager = new TokenManager({ oauthClient, refreshThreshold: 0.8, checkIntervalMs: 300000 });
 * manager.start(); // Begins automatic refresh checks
 * const status = manager.getTokenStatus(); // { hasAccessToken: true, needsRefresh: false, timeUntilExpiry: 3540000 }
 */
import type { OAuth2Client } from 'google-auth-library';
export interface TokenStatus {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiryDate?: number;
    timeUntilExpiry?: number;
    needsRefresh: boolean;
}
export interface TokenManagerOptions {
    /** OAuth client for token refresh */
    oauthClient?: OAuth2Client;
    /** Refresh tokens when they reach this percentage of their lifetime (default: 0.8 = 80%) */
    refreshThreshold?: number;
    /** Check interval in milliseconds (default: 5 minutes) */
    checkIntervalMs?: number;
    /** Callback when token is refreshed */
    onTokenRefreshed?: (tokens: import('google-auth-library').Credentials) => void | Promise<void>;
    /** Callback when refresh fails */
    onRefreshError?: (error: Error) => void | Promise<void>;
}
/**
 * Token Manager
 *
 * Monitors OAuth token expiry and proactively refreshes tokens
 * before they expire to prevent authentication interruptions.
 *
 * Features:
 * - Background monitoring with configurable interval
 * - Proactive refresh at 80% of token lifetime
 * - Metrics collection for refresh operations
 * - Error handling with callbacks
 * - Graceful shutdown support
 */
export declare class TokenManager {
    private oauthClient?;
    private refreshThreshold;
    private checkIntervalMs;
    private intervalId?;
    private isRunning;
    private onTokenRefreshed?;
    private onRefreshError?;
    private metrics;
    private refreshHistory;
    private readonly maxHistorySize;
    private readonly anomalyThreshold;
    constructor(options?: TokenManagerOptions);
    /**
     * Set the OAuth client (allows updating after initialization)
     */
    setOAuthClient(client: OAuth2Client): void;
    /**
     * Get current token status
     */
    getTokenStatus(): TokenStatus;
    /**
     * Estimate token lifetime based on current expiry
     * Assumes standard OAuth token lifetime of 1 hour
     */
    private estimateTokenLifetime;
    /**
     * Check if token needs refresh and refresh if necessary
     */
    checkAndRefresh(): Promise<boolean>;
    /**
     * Force refresh the token
     */
    refreshToken(): Promise<boolean>;
    /**
     * Record refresh attempt for security monitoring
     * Phase 1, Task 1.1 enhancement
     */
    private recordRefreshAttempt;
    /**
     * Detect unusual refresh patterns that might indicate compromised tokens
     * Phase 1, Task 1.1 enhancement
     */
    private detectRefreshAnomalies;
    /**
     * Get refresh pattern statistics for security monitoring
     * Phase 1, Task 1.1 enhancement
     */
    getRefreshPatternStats(): {
        refreshesLastHour: number;
        refreshesLastDay: number;
        failureRate: number;
        isAnomalous: boolean;
    };
    /**
     * Start background monitoring
     */
    start(): void;
    /**
     * Stop background monitoring
     */
    stop(): void;
    /**
     * Get metrics for monitoring
     */
    getMetrics(): unknown;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
}
/**
 * Get or create global token manager
 */
export declare function getTokenManager(options?: TokenManagerOptions): TokenManager;
/**
 * Set global token manager
 */
export declare function setTokenManager(manager: TokenManager): void;
/**
 * Reset global token manager (for testing only)
 * @internal
 */
export declare function resetTokenManager(): void;
//# sourceMappingURL=token-manager.d.ts.map