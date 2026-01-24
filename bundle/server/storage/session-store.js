/**
 * Session Store Interface
 *
 * Provides abstraction for session/token storage with TTL support.
 * Implementations: in-memory (development), Redis (production)
 */
import { logger } from '../utils/logger.js';
/**
 * In-memory session store with TTL
 * Suitable for development and single-instance deployments
 */
export class InMemorySessionStore {
    store = new Map();
    cleanupInterval;
    constructor(cleanupIntervalMs = 60000) {
        // Cleanup expired entries every minute by default
        this.cleanupInterval = setInterval(() => {
            this.cleanup().catch(console.error);
        }, cleanupIntervalMs);
    }
    async set(key, value, options) {
        // Handle both number (seconds) and object ({ ttlMs }) formats
        let ttlMs;
        if (typeof options === 'number') {
            ttlMs = options * 1000; // Convert seconds to milliseconds
        }
        else if (options && typeof options === 'object' && 'ttlMs' in options) {
            ttlMs = options.ttlMs;
        }
        else {
            ttlMs = 3600000; // 1 hour default
        }
        this.store.set(key, {
            value,
            expires: Date.now() + ttlMs,
        });
    }
    async get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            // OK: Explicit empty - typed as optional, cache miss
            return undefined;
        }
        // Check if expired
        if (Date.now() > entry.expires) {
            this.store.delete(key);
            // OK: Explicit empty - typed as optional, expired entry
            return undefined;
        }
        return entry.value;
    }
    async delete(key) {
        const existed = this.store.has(key);
        this.store.delete(key);
        return existed;
    }
    async has(key) {
        const value = await this.get(key);
        return value !== undefined;
    }
    async keys(pattern) {
        const allKeys = Array.from(this.store.keys());
        if (!pattern) {
            return allKeys;
        }
        // Simple glob pattern matching (supports * wildcard)
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return allKeys.filter((key) => regex.test(key));
    }
    async cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expires) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.store.delete(key);
        }
        if (keysToDelete.length > 0) {
            logger.info('Session store cleanup completed', {
                expiredEntries: keysToDelete.length,
                remainingKeys: this.store.size,
                cleanupTimestamp: new Date().toISOString(),
            });
        }
        return keysToDelete.length;
    }
    async stats() {
        // Rough estimate of memory usage
        let memoryBytes = 0;
        for (const [key, entry] of this.store.entries()) {
            memoryBytes += key.length * 2; // UTF-16 characters
            memoryBytes += JSON.stringify(entry.value).length * 2;
            memoryBytes += 24; // Overhead for Map entry and metadata
        }
        return {
            totalKeys: this.store.size,
            memoryUsage: memoryBytes,
        };
    }
    /**
     * Destroy the store and clean up resources
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}
/**
 * Redis-backed session store
 * Suitable for production and multi-instance deployments
 * Requires Redis to be installed and running
 */
export class RedisSessionStore {
    redisUrl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client; // Redis client (dynamic import, type not available at compile time)
    connected = false;
    constructor(redisUrl) {
        this.redisUrl = redisUrl;
        // We'll initialize lazily to avoid requiring Redis in development
    }
    /**
     * Initialize Redis connection (lazy)
     */
    async ensureConnected() {
        if (this.connected) {
            return;
        }
        try {
            // Dynamic import to make Redis optional
            // @ts-ignore - Redis is an optional peer dependency
            const { createClient } = await import('redis');
            this.client = createClient({
                url: this.redisUrl,
            });
            this.client.on('error', (err) => {
                console.error('[RedisSessionStore] Redis error:', err);
            });
            await this.client.connect();
            this.connected = true;
            console.error('[RedisSessionStore] Connected to Redis');
        }
        catch (error) {
            throw new Error(`Failed to connect to Redis at ${this.redisUrl}. ` +
                `Make sure Redis is installed (npm install redis) and running. ` +
                `Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async set(key, value, options) {
        await this.ensureConnected();
        // Handle both number (seconds) and object ({ ttlMs }) formats
        let ttlSeconds;
        if (typeof options === 'number') {
            ttlSeconds = options;
        }
        else if (options && typeof options === 'object' && 'ttlMs' in options) {
            ttlSeconds = Math.floor(options.ttlMs / 1000);
        }
        else {
            ttlSeconds = 3600; // 1 hour default
        }
        const serialized = JSON.stringify(value);
        await this.client.setEx(key, ttlSeconds, serialized);
    }
    async get(key) {
        await this.ensureConnected();
        const data = await this.client.get(key);
        if (!data) {
            // OK: Explicit empty - typed as optional, cache miss (Redis)
            return undefined;
        }
        try {
            return JSON.parse(data);
        }
        catch {
            // If parsing fails, return the raw string
            return data;
        }
    }
    async delete(key) {
        await this.ensureConnected();
        const result = await this.client.del(key);
        return result > 0; // Redis returns number of keys deleted
    }
    async has(key) {
        await this.ensureConnected();
        const exists = await this.client.exists(key);
        return exists === 1;
    }
    async keys(pattern) {
        await this.ensureConnected();
        return await this.client.keys(pattern || '*');
    }
    async cleanup() {
        // Redis handles TTL automatically, no cleanup needed
    }
    async stats() {
        await this.ensureConnected();
        const dbSize = await this.client.dbSize();
        return {
            totalKeys: dbSize,
        };
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        if (this.connected && this.client) {
            await this.client.quit();
            this.connected = false;
        }
    }
}
/**
 * Factory function to create appropriate session store
 * @param redisUrl Optional Redis URL. If provided, uses Redis; otherwise in-memory
 */
export function createSessionStore(redisUrl) {
    if (redisUrl) {
        console.error('[SessionStore] Using Redis session store');
        return new RedisSessionStore(redisUrl);
    }
    console.error('[SessionStore] Using in-memory session store');
    return new InMemorySessionStore();
}
/**
 * Memory-based session store with configurable TTL
 * Compatible with test expectations for defaultTtlMs option
 */
export class MemorySessionStore {
    store = new Map();
    cleanupInterval = null;
    defaultTtlMs;
    maxEntries;
    constructor(options = {}) {
        this.defaultTtlMs = options.defaultTtlMs ?? 3600000; // 1 hour default
        this.maxEntries = options.maxEntries ?? 10000;
        const cleanupIntervalMs = options.cleanupIntervalMs ?? 60000;
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanup().catch(console.error);
        }, cleanupIntervalMs);
    }
    async set(key, value, options) {
        // Enforce max entries limit
        if (this.store.size >= this.maxEntries && !this.store.has(key)) {
            // Remove oldest entry
            const oldestKey = this.store.keys().next().value;
            if (oldestKey) {
                this.store.delete(oldestKey);
            }
        }
        // Handle both number (seconds) and object ({ ttlMs }) formats
        let ttlMs;
        if (typeof options === 'number') {
            ttlMs = options * 1000; // Convert seconds to milliseconds
        }
        else if (options && typeof options === 'object' && 'ttlMs' in options) {
            ttlMs = options.ttlMs;
        }
        else {
            ttlMs = this.defaultTtlMs;
        }
        this.store.set(key, {
            value,
            expires: Date.now() + ttlMs,
        });
    }
    async get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            // OK: Explicit empty - typed as optional, cache miss
            return undefined;
        }
        // Check if expired
        if (Date.now() > entry.expires) {
            this.store.delete(key);
            // OK: Explicit empty - typed as optional, expired entry
            return undefined;
        }
        return entry.value;
    }
    async delete(key) {
        const existed = this.store.has(key);
        this.store.delete(key);
        return existed;
    }
    async has(key) {
        const value = await this.get(key);
        return value !== undefined;
    }
    async keys(pattern) {
        const allKeys = Array.from(this.store.keys());
        if (!pattern) {
            return allKeys;
        }
        // Simple glob pattern matching (supports * wildcard)
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return allKeys.filter((key) => regex.test(key));
    }
    async cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expires) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.store.delete(key);
        }
        return keysToDelete.length;
    }
    async stats() {
        let memoryBytes = 0;
        for (const [key, entry] of this.store.entries()) {
            memoryBytes += key.length * 2;
            memoryBytes += JSON.stringify(entry.value).length * 2;
            memoryBytes += 24;
        }
        return {
            totalKeys: this.store.size,
            memoryUsage: memoryBytes,
        };
    }
    /**
     * Get size of the store (method for test compatibility)
     */
    async size() {
        return this.store.size;
    }
    /**
     * Clear all entries
     */
    async clear() {
        this.store.clear();
    }
    /**
     * Destroy the store and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
    }
}
//# sourceMappingURL=session-store.js.map