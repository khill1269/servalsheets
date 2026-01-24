/**
 * Session Store Interface
 *
 * Provides abstraction for session/token storage with TTL support.
 * Implementations: in-memory (development), Redis (production)
 */
/**
 * Session store interface for storing temporary data with TTL
 */
export interface SessionStore {
    /**
     * Store a value with TTL (time-to-live)
     * @param key Unique identifier for the value
     * @param value Value to store (will be JSON serialized)
     * @param options TTL options - can be number (seconds) or object with ttlMs
     */
    set(key: string, value: unknown, options?: number | {
        ttlMs: number;
    }): Promise<void>;
    /**
     * Retrieve a value by key
     * @param key Unique identifier
     * @returns Value if found and not expired, undefined otherwise
     */
    get(key: string): Promise<unknown | undefined>;
    /**
     * Delete a value by key
     * @param key Unique identifier
     * @returns true if deleted, false if key didn't exist
     */
    delete(key: string): Promise<boolean>;
    /**
     * Check if a key exists
     * @param key Unique identifier
     * @returns true if key exists and not expired
     */
    has(key: string): Promise<boolean>;
    /**
     * Get all keys matching a pattern (optional, for debugging)
     * @param pattern Optional glob pattern (e.g., "session:*")
     */
    keys?(pattern?: string): Promise<string[]>;
    /**
     * Clean up expired entries (for in-memory implementations)
     * Returns number of entries removed (optional)
     */
    cleanup(): Promise<void | number>;
    /**
     * Get store statistics (optional, for monitoring)
     */
    stats?(): Promise<{
        totalKeys: number;
        memoryUsage?: number;
    }>;
}
/**
 * In-memory session store with TTL
 * Suitable for development and single-instance deployments
 */
export declare class InMemorySessionStore implements SessionStore {
    private store;
    private cleanupInterval;
    constructor(cleanupIntervalMs?: number);
    set(key: string, value: unknown, options?: number | {
        ttlMs: number;
    }): Promise<void>;
    get(key: string): Promise<unknown | undefined>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
    cleanup(): Promise<number>;
    stats(): Promise<{
        totalKeys: number;
        memoryUsage?: number;
    }>;
    /**
     * Destroy the store and clean up resources
     */
    destroy(): void;
}
/**
 * Redis-backed session store
 * Suitable for production and multi-instance deployments
 * Requires Redis to be installed and running
 */
export declare class RedisSessionStore implements SessionStore {
    private redisUrl;
    private client;
    private connected;
    constructor(redisUrl: string);
    /**
     * Initialize Redis connection (lazy)
     */
    private ensureConnected;
    set(key: string, value: unknown, options?: number | {
        ttlMs: number;
    }): Promise<void>;
    get(key: string): Promise<unknown | undefined>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
    cleanup(): Promise<void>;
    stats(): Promise<{
        totalKeys: number;
    }>;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
}
/**
 * Factory function to create appropriate session store
 * @param redisUrl Optional Redis URL. If provided, uses Redis; otherwise in-memory
 */
export declare function createSessionStore(redisUrl?: string): SessionStore;
/**
 * Options for MemorySessionStore (test-compatible interface)
 */
export interface MemorySessionStoreOptions {
    defaultTtlMs?: number;
    maxEntries?: number;
    cleanupIntervalMs?: number;
}
/**
 * Memory-based session store with configurable TTL
 * Compatible with test expectations for defaultTtlMs option
 */
export declare class MemorySessionStore implements SessionStore {
    private store;
    private cleanupInterval;
    private defaultTtlMs;
    private maxEntries;
    constructor(options?: MemorySessionStoreOptions);
    set(key: string, value: unknown, options?: number | {
        ttlMs: number;
    }): Promise<void>;
    get(key: string): Promise<unknown | undefined>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
    cleanup(): Promise<number>;
    stats(): Promise<{
        totalKeys: number;
        memoryUsage?: number;
    }>;
    /**
     * Get size of the store (method for test compatibility)
     */
    size(): Promise<number>;
    /**
     * Clear all entries
     */
    clear(): Promise<void>;
    /**
     * Destroy the store and clean up resources
     */
    destroy(): void;
}
//# sourceMappingURL=session-store.d.ts.map