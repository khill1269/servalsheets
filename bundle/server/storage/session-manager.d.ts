/**
 * Session Manager
 *
 * Manages user sessions with limits and TTL enforcement.
 * Prevents session exhaustion attacks by limiting sessions per user.
 */
import { SessionStore } from './session-store.js';
export interface SessionInfo {
    sessionId: string;
    userId: string;
    created: number;
    expires: number;
    metadata?: Record<string, unknown>;
}
export interface SessionManagerConfig {
    sessionStore: SessionStore;
    maxSessionsPerUser: number;
    defaultTtlSeconds: number;
}
/**
 * Session Manager with per-user limits
 *
 * Features:
 * - Enforces max sessions per user
 * - Automatic cleanup of oldest sessions when limit exceeded
 * - TTL enforcement via SessionStore
 * - Session listing and statistics
 */
export declare class SessionManager {
    private readonly store;
    private readonly maxSessionsPerUser;
    private readonly defaultTtlSeconds;
    constructor(config: SessionManagerConfig);
    /**
     * Create a new session for a user
     * Enforces max sessions per user by removing oldest sessions
     */
    createSession(sessionId: string, userId: string, metadata?: Record<string, unknown>, ttlSeconds?: number): Promise<void>;
    /**
     * Get session info by session ID
     */
    getSession(sessionId: string): Promise<SessionInfo | null>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<void>;
    /**
     * Get all sessions for a user
     */
    getUserSessions(userId: string): Promise<SessionInfo[]>;
    /**
     * Delete all sessions for a user
     */
    deleteUserSessions(userId: string): Promise<number>;
    /**
     * Check if a session exists and is valid
     */
    hasSession(sessionId: string): Promise<boolean>;
    /**
     * Update session TTL (refresh session)
     */
    refreshSession(sessionId: string, ttlSeconds?: number): Promise<boolean>;
    /**
     * Get session statistics
     */
    getStats(): Promise<{
        totalSessions: number;
        storeStats?: {
            totalKeys: number;
            memoryUsage?: number;
        };
    }>;
    /**
     * Cleanup expired sessions
     */
    cleanup(): Promise<void>;
    private getSessionKey;
    private getUserIndexKey;
    private getUserSessionIds;
    private addToUserIndex;
    private removeFromUserIndex;
}
/**
 * Factory function to create SessionManager
 */
export declare function createSessionManager(sessionStore: SessionStore, options?: {
    maxSessionsPerUser?: number;
    defaultTtlSeconds?: number;
}): SessionManager;
//# sourceMappingURL=session-manager.d.ts.map