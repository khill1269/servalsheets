/**
 * Session Limiter
 *
 * Prevents DoS attacks by limiting the number of concurrent sessions per user/token
 */
export interface SessionLimiterOptions {
    maxSessionsPerUser: number;
    maxTotalSessions: number;
}
export declare class SessionLimiter {
    private options;
    private sessionsByUser;
    private sessionToUser;
    constructor(options?: Partial<SessionLimiterOptions>);
    /**
     * Check if a new session can be created for this user
     */
    canCreateSession(userId: string): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Register a new session
     */
    registerSession(sessionId: string, userId: string): void;
    /**
     * Unregister a session (on disconnect)
     */
    unregisterSession(sessionId: string): void;
    /**
     * Get session statistics
     */
    getStats(): {
        totalSessions: number;
        totalUsers: number;
        sessionsPerUser: Record<string, number>;
        maxSessionsPerUser: number;
        maxTotalSessions: number;
    };
    /**
     * Get sessions for a specific user
     */
    getUserSessions(userId: string): string[];
    /**
     * Force close all sessions for a user (admin function)
     */
    closeUserSessions(userId: string): string[];
}
/**
 * Global session limiter instance
 */
export declare const sessionLimiter: SessionLimiter;
//# sourceMappingURL=session-limiter.d.ts.map