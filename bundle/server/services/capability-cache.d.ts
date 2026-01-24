/**
 * CapabilityCache
 *
 * @purpose Caches MCP client capabilities (Sampling, Elicitation, Logging, Tasks) to avoid repeated checks; uses Redis for distributed cache
 * @category Performance
 * @usage Use before calling advanced MCP features; checks cache first, falls back to capability detection, 5min TTL
 * @dependencies logger, Redis (optional)
 * @stateful Yes - maintains in-memory cache + optional Redis cache, TTL per capability (default 300s)
 * @singleton Yes - one instance per process to share capability cache
 *
 * @example
 * const cache = new CapabilityCache({ redis, ttl: 300 });
 * const hasSampling = await cache.has(clientId, 'sampling'); // Checks cache first
 * cache.set(clientId, 'elicitation', true, 300); // Cache for 5 minutes
 */
type RedisClient = any;
export interface ClientCapabilities {
    elicitation?: {
        form?: {
            applyDefaults?: boolean;
        };
        url?: object;
    } | boolean;
    sampling?: {
        context?: object;
        tools?: object;
    } | boolean;
    roots?: {
        listChanged?: boolean;
    } | boolean;
    experimental?: Record<string, object>;
}
export interface CachedCapabilities {
    capabilities: ClientCapabilities;
    cachedAt: number;
    expiresAt: number;
}
/**
 * Capability Cache Service
 *
 * Caches client capabilities to improve performance by avoiding
 * repeated capability checks within the same session.
 */
export declare class CapabilityCacheService {
    private memoryCache;
    private redis?;
    constructor(redis?: RedisClient);
    /**
     * Generate cache key for session
     */
    private getCacheKey;
    /**
     * Check if cached capabilities are still valid
     */
    private isValid;
    /**
     * Get cached capabilities for session
     */
    get(sessionId: string): Promise<ClientCapabilities | null>;
    /**
     * Cache capabilities for session
     */
    set(sessionId: string, capabilities: ClientCapabilities): Promise<void>;
    /**
     * Clear cached capabilities for session
     */
    clear(sessionId: string): Promise<void>;
    /**
     * Clear all cached capabilities (for testing/maintenance)
     */
    clearAll(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): {
        memoryCacheSize: number;
        redisAvailable: boolean;
    };
}
/**
 * Initialize capability cache service
 */
export declare function initCapabilityCacheService(redis?: RedisClient): CapabilityCacheService;
/**
 * Get capability cache service instance
 */
export declare function getCapabilityCacheService(): CapabilityCacheService;
/**
 * Reset capability cache service (for testing only)
 * @internal
 */
export declare function resetCapabilityCacheService(): void;
/**
 * Helper to get capabilities with caching
 *
 * Usage:
 * const capabilities = await getCapabilitiesWithCache(sessionId, server);
 * if (capabilities.elicitation) { ... }
 */
export declare function getCapabilitiesWithCache(sessionId: string, server: {
    getClientCapabilities: () => unknown;
}): Promise<ClientCapabilities>;
export {};
//# sourceMappingURL=capability-cache.d.ts.map