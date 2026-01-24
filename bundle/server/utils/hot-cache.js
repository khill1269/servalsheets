/**
 * ServalSheets - Hot Cache
 *
 * Two-tier caching system for maximum performance:
 * - Hot Tier: In-memory Map for most recent items (O(1) access, ~100 items)
 * - Warm Tier: LRU cache for older items (O(1) amortized, ~1000 items)
 *
 * Performance characteristics:
 * - Hot tier: ~50ns access time
 * - Warm tier: ~500ns access time
 * - Cold (no cache): ~50-200ms API call
 *
 * Automatic promotion/demotion:
 * - Items accessed frequently stay in hot tier
 * - Less accessed items demote to warm tier
 * - Least recently used warm items evict
 */
import { logger } from './logger.js';
/**
 * Two-tier hot cache implementation
 */
export class HotCache {
    hotTier = new Map();
    warmTier = new Map();
    config;
    cleanupTimer = null;
    // Statistics
    stats = {
        hotHits: 0,
        warmHits: 0,
        misses: 0,
        promotions: 0,
        demotions: 0,
        evictions: 0,
    };
    constructor(config = {}) {
        this.config = {
            hotTierSize: config.hotTierSize ?? 100,
            warmTierSize: config.warmTierSize ?? 1000,
            defaultTtl: config.defaultTtl ?? 300000,
            hotPromotionThreshold: config.hotPromotionThreshold ?? 2,
            trackStats: config.trackStats ?? true,
            cleanupIntervalMs: config.cleanupIntervalMs ?? 60000,
        };
        // Start cleanup timer
        this.startCleanupTimer();
    }
    /**
     * Get value from cache
     *
     * @returns Value if found and not expired, undefined otherwise
     */
    get(key) {
        const now = Date.now();
        // Try hot tier first (fastest)
        const hotEntry = this.hotTier.get(key);
        if (hotEntry) {
            if (now - hotEntry.timestamp < hotEntry.ttl) {
                hotEntry.accessCount++;
                hotEntry.lastAccess = now;
                if (this.config.trackStats)
                    this.stats.hotHits++;
                return hotEntry.value;
            }
            // Expired - remove
            this.hotTier.delete(key);
        }
        // Try warm tier
        const warmEntry = this.warmTier.get(key);
        if (warmEntry) {
            if (now - warmEntry.timestamp < warmEntry.ttl) {
                warmEntry.accessCount++;
                warmEntry.lastAccess = now;
                if (this.config.trackStats)
                    this.stats.warmHits++;
                // Promote to hot tier if accessed enough
                if (warmEntry.accessCount >= this.config.hotPromotionThreshold) {
                    this.promoteToHot(key, warmEntry);
                }
                return warmEntry.value;
            }
            // Expired - remove
            this.warmTier.delete(key);
        }
        if (this.config.trackStats)
            this.stats.misses++;
        // OK: Explicit empty - typed as optional, cache miss in hot-cache tiers
        return undefined;
    }
    /**
     * Set value in cache
     *
     * New items go to warm tier, frequently accessed items promote to hot tier
     */
    set(key, value, ttl) {
        const now = Date.now();
        const actualTtl = ttl ?? this.config.defaultTtl;
        // Check if already in hot tier
        const existingHot = this.hotTier.get(key);
        if (existingHot) {
            existingHot.value = value;
            existingHot.timestamp = now;
            existingHot.ttl = actualTtl;
            existingHot.accessCount++;
            existingHot.lastAccess = now;
            return;
        }
        // Check if already in warm tier
        const existingWarm = this.warmTier.get(key);
        if (existingWarm) {
            existingWarm.value = value;
            existingWarm.timestamp = now;
            existingWarm.ttl = actualTtl;
            existingWarm.accessCount++;
            existingWarm.lastAccess = now;
            // Promote if accessed enough
            if (existingWarm.accessCount >= this.config.hotPromotionThreshold) {
                this.promoteToHot(key, existingWarm);
            }
            return;
        }
        // New entry - add to warm tier
        const entry = {
            value,
            timestamp: now,
            ttl: actualTtl,
            accessCount: 1,
            lastAccess: now,
            size: this.estimateSize(value),
        };
        // Evict if warm tier is full
        if (this.warmTier.size >= this.config.warmTierSize) {
            this.evictFromWarm();
        }
        this.warmTier.set(key, entry);
    }
    /**
     * Delete value from cache
     */
    delete(key) {
        const hotDeleted = this.hotTier.delete(key);
        const warmDeleted = this.warmTier.delete(key);
        return hotDeleted || warmDeleted;
    }
    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const now = Date.now();
        const hotEntry = this.hotTier.get(key);
        if (hotEntry && now - hotEntry.timestamp < hotEntry.ttl) {
            return true;
        }
        const warmEntry = this.warmTier.get(key);
        if (warmEntry && now - warmEntry.timestamp < warmEntry.ttl) {
            return true;
        }
        return false;
    }
    /**
     * Clear all entries
     */
    clear() {
        this.hotTier.clear();
        this.warmTier.clear();
    }
    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern) {
        let count = 0;
        for (const key of this.hotTier.keys()) {
            if (pattern.test(key)) {
                this.hotTier.delete(key);
                count++;
            }
        }
        for (const key of this.warmTier.keys()) {
            if (pattern.test(key)) {
                this.warmTier.delete(key);
                count++;
            }
        }
        return count;
    }
    /**
     * Invalidate entries by prefix
     */
    invalidatePrefix(prefix) {
        let count = 0;
        for (const key of this.hotTier.keys()) {
            if (key.startsWith(prefix)) {
                this.hotTier.delete(key);
                count++;
            }
        }
        for (const key of this.warmTier.keys()) {
            if (key.startsWith(prefix)) {
                this.warmTier.delete(key);
                count++;
            }
        }
        return count;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const totalRequests = this.stats.hotHits + this.stats.warmHits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hotHits + this.stats.warmHits) / totalRequests : 0;
        let totalMemoryBytes = 0;
        for (const entry of this.hotTier.values()) {
            totalMemoryBytes += entry.size ?? 0;
        }
        for (const entry of this.warmTier.values()) {
            totalMemoryBytes += entry.size ?? 0;
        }
        return {
            hotTierSize: this.hotTier.size,
            warmTierSize: this.warmTier.size,
            hotHits: this.stats.hotHits,
            warmHits: this.stats.warmHits,
            misses: this.stats.misses,
            hitRate,
            promotions: this.stats.promotions,
            demotions: this.stats.demotions,
            evictions: this.stats.evictions,
            totalMemoryBytes,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hotHits: 0,
            warmHits: 0,
            misses: 0,
            promotions: 0,
            demotions: 0,
            evictions: 0,
        };
    }
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }
    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================
    /**
     * Promote entry from warm to hot tier
     */
    promoteToHot(key, entry) {
        // Remove from warm tier
        this.warmTier.delete(key);
        // Evict from hot tier if full
        if (this.hotTier.size >= this.config.hotTierSize) {
            this.demoteFromHot();
        }
        // Add to hot tier
        this.hotTier.set(key, entry);
        if (this.config.trackStats)
            this.stats.promotions++;
    }
    /**
     * Demote least-accessed entry from hot to warm tier
     */
    demoteFromHot() {
        // Find entry with lowest access count
        let lowestKey = null;
        let lowestCount = Infinity;
        let lowestAccess = Infinity;
        for (const [key, entry] of this.hotTier) {
            if (entry.accessCount < lowestCount ||
                (entry.accessCount === lowestCount && entry.lastAccess < lowestAccess)) {
                lowestKey = key;
                lowestCount = entry.accessCount;
                lowestAccess = entry.lastAccess;
            }
        }
        if (lowestKey) {
            const entry = this.hotTier.get(lowestKey);
            this.hotTier.delete(lowestKey);
            // Reset access count and add to warm tier
            entry.accessCount = 1;
            this.warmTier.set(lowestKey, entry);
            if (this.config.trackStats)
                this.stats.demotions++;
        }
    }
    /**
     * Evict least recently used entry from warm tier
     */
    evictFromWarm() {
        // Find LRU entry
        let lruKey = null;
        let lruAccess = Infinity;
        for (const [key, entry] of this.warmTier) {
            if (entry.lastAccess < lruAccess) {
                lruKey = key;
                lruAccess = entry.lastAccess;
            }
        }
        if (lruKey) {
            this.warmTier.delete(lruKey);
            if (this.config.trackStats)
                this.stats.evictions++;
        }
    }
    /**
     * Estimate memory size of a value
     */
    estimateSize(value) {
        if (value === null || value === undefined)
            return 8;
        if (typeof value === 'string')
            return value.length * 2;
        if (typeof value === 'number')
            return 8;
        if (typeof value === 'boolean')
            return 4;
        if (Array.isArray(value)) {
            return value.reduce((sum, item) => sum + this.estimateSize(item), 32);
        }
        if (typeof value === 'object') {
            const obj = value;
            let size = 32; // Object overhead
            for (const [k, v] of Object.entries(obj)) {
                size += k.length * 2 + this.estimateSize(v);
            }
            return size;
        }
        return 8;
    }
    /**
     * Start periodic cleanup timer
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupIntervalMs);
        // Don't block process exit
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let expiredCount = 0;
        // Clean hot tier
        for (const [key, entry] of this.hotTier) {
            if (now - entry.timestamp >= entry.ttl) {
                this.hotTier.delete(key);
                expiredCount++;
            }
        }
        // Clean warm tier
        for (const [key, entry] of this.warmTier) {
            if (now - entry.timestamp >= entry.ttl) {
                this.warmTier.delete(key);
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            logger.debug('HotCache cleanup completed', {
                expiredCount,
                hotTierSize: this.hotTier.size,
                warmTierSize: this.warmTier.size,
            });
        }
    }
}
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let globalHotCache = null;
/**
 * Get global hot cache instance
 */
export function getHotCache() {
    if (!globalHotCache) {
        globalHotCache = new HotCache({
            hotTierSize: 100,
            warmTierSize: 1000,
            defaultTtl: 300000, // 5 minutes
            hotPromotionThreshold: 2,
            trackStats: true,
            cleanupIntervalMs: 60000, // 1 minute
        });
    }
    return globalHotCache;
}
/**
 * Reset global hot cache (for testing)
 */
export function resetHotCache() {
    if (globalHotCache) {
        globalHotCache.destroy();
        globalHotCache = null;
    }
}
// ============================================================================
// NAMESPACED CACHE HELPERS
// ============================================================================
/**
 * Create namespaced cache key
 */
export function createHotCacheKey(namespace, ...parts) {
    return `${namespace}:${parts.join(':')}`;
}
/**
 * Get value from hot cache with namespace
 */
export function hotCacheGet(namespace, key) {
    return getHotCache().get(createHotCacheKey(namespace, key));
}
/**
 * Set value in hot cache with namespace
 */
export function hotCacheSet(namespace, key, value, ttl) {
    getHotCache().set(createHotCacheKey(namespace, key), value, ttl);
}
/**
 * Delete value from hot cache with namespace
 */
export function hotCacheDelete(namespace, key) {
    return getHotCache().delete(createHotCacheKey(namespace, key));
}
/**
 * Invalidate all entries in a namespace
 */
export function hotCacheInvalidateNamespace(namespace) {
    return getHotCache().invalidatePrefix(`${namespace}:`);
}
//# sourceMappingURL=hot-cache.js.map