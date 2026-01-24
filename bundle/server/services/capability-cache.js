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
import { logger } from '../utils/logger.js';
const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_KEY_PREFIX = 'servalsheets:capabilities:';
/**
 * Capability Cache Service
 *
 * Caches client capabilities to improve performance by avoiding
 * repeated capability checks within the same session.
 */
export class CapabilityCacheService {
    memoryCache = new Map();
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * Generate cache key for session
     */
    getCacheKey(sessionId) {
        return `${CACHE_KEY_PREFIX}${sessionId}`;
    }
    /**
     * Check if cached capabilities are still valid
     */
    isValid(cached) {
        return Date.now() < cached.expiresAt;
    }
    /**
     * Get cached capabilities for session
     */
    async get(sessionId) {
        // Check memory cache first (fastest)
        const memCached = this.memoryCache.get(sessionId);
        if (memCached && this.isValid(memCached)) {
            logger.debug('Capability cache hit (memory)', { sessionId });
            return memCached.capabilities;
        }
        // Check Redis cache (distributed)
        if (this.redis) {
            try {
                const cacheKey = this.getCacheKey(sessionId);
                const cached = await this.redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (this.isValid(parsed)) {
                        // Update memory cache
                        this.memoryCache.set(sessionId, parsed);
                        logger.debug('Capability cache hit (Redis)', { sessionId });
                        return parsed.capabilities;
                    }
                }
            }
            catch (error) {
                logger.warn('Failed to get capabilities from Redis', {
                    sessionId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        logger.debug('Capability cache miss', { sessionId });
        return null;
    }
    /**
     * Cache capabilities for session
     */
    async set(sessionId, capabilities) {
        const now = Date.now();
        const cached = {
            capabilities,
            cachedAt: now,
            expiresAt: now + CACHE_TTL_SECONDS * 1000,
        };
        // Store in memory cache
        this.memoryCache.set(sessionId, cached);
        // Store in Redis cache (distributed, survives restarts)
        if (this.redis) {
            try {
                const cacheKey = this.getCacheKey(sessionId);
                await this.redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(cached));
                logger.debug('Capabilities cached', {
                    sessionId,
                    ttl: CACHE_TTL_SECONDS,
                });
            }
            catch (error) {
                logger.warn('Failed to cache capabilities in Redis', {
                    sessionId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    /**
     * Clear cached capabilities for session
     */
    async clear(sessionId) {
        this.memoryCache.delete(sessionId);
        if (this.redis) {
            try {
                const cacheKey = this.getCacheKey(sessionId);
                await this.redis.del(cacheKey);
                logger.debug('Capabilities cache cleared', { sessionId });
            }
            catch (error) {
                logger.warn('Failed to clear capabilities from Redis', {
                    sessionId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    /**
     * Clear all cached capabilities (for testing/maintenance)
     */
    async clearAll() {
        this.memoryCache.clear();
        if (this.redis) {
            try {
                const keys = await this.redis.keys(`${CACHE_KEY_PREFIX}*`);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                    logger.info('Cleared all capability caches', { count: keys.length });
                }
            }
            catch (error) {
                logger.warn('Failed to clear all capabilities from Redis', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memoryCacheSize: this.memoryCache.size,
            redisAvailable: !!this.redis,
        };
    }
}
// Global service instance
let capabilityCacheService = null;
/**
 * Initialize capability cache service
 */
export function initCapabilityCacheService(redis) {
    capabilityCacheService = new CapabilityCacheService(redis);
    return capabilityCacheService;
}
/**
 * Get capability cache service instance
 */
export function getCapabilityCacheService() {
    if (!capabilityCacheService) {
        // Auto-initialize without Redis if not set up
        capabilityCacheService = new CapabilityCacheService();
    }
    return capabilityCacheService;
}
/**
 * Reset capability cache service (for testing only)
 * @internal
 */
export function resetCapabilityCacheService() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetCapabilityCacheService() can only be called in test environment');
    }
    capabilityCacheService = null;
}
/**
 * Helper to get capabilities with caching
 *
 * Usage:
 * const capabilities = await getCapabilitiesWithCache(sessionId, server);
 * if (capabilities.elicitation) { ... }
 */
export async function getCapabilitiesWithCache(sessionId, server) {
    const cache = getCapabilityCacheService();
    // Check cache first
    const cached = await cache.get(sessionId);
    if (cached) {
        return cached;
    }
    // Get fresh capabilities from server
    const rawCapabilities = server.getClientCapabilities() ?? {};
    const capabilities = rawCapabilities;
    // Cache for next time
    await cache.set(sessionId, capabilities);
    return capabilities;
}
//# sourceMappingURL=capability-cache.js.map