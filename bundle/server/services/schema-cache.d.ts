/**
 * SchemaCache
 *
 * @purpose Persistent file-based cache for Google API Discovery schemas to reduce Discovery API calls and improve startup (30-day TTL)
 * @category Performance
 * @usage Use for schema validation and API discovery; caches sheets/drive schemas locally, automatic invalidation after 30 days
 * @dependencies fs (node:fs), path, logger, DiscoverySchema
 * @stateful Yes - maintains file-based cache in ~/.servalsheets/cache/, tracks schema age and hit/miss stats
 * @singleton Yes - one instance per process to coordinate cache access
 *
 * @example
 * const cache = new SchemaCache({ cacheDir: '~/.servalsheets/cache', ttlDays: 30 });
 * const schema = cache.get('sheets', 'v4'); // Returns cached or null
 * cache.set('sheets', 'v4', discoveredSchema);
 * cache.cleanup(); // Remove expired schemas
 */
import type { DiscoverySchema } from './discovery-client.js';
/**
 * Cached schema with metadata
 */
export interface CachedSchema {
    api: 'sheets' | 'drive';
    version: string;
    schema: DiscoverySchema;
    fetchedAt: number;
    expiresAt: number;
}
/**
 * Schema Cache Configuration
 */
export interface SchemaCacheConfig {
    cacheDir?: string;
    defaultTTL?: number;
}
/**
 * Schema Cache Layer
 *
 * Provides persistent file-based caching for Discovery API schemas.
 */
export declare class SchemaCache {
    private readonly cacheDir;
    private readonly defaultTTL;
    constructor(config?: SchemaCacheConfig);
    /**
     * Get cached schema if available and not expired
     */
    get(api: string, version: string): Promise<DiscoverySchema | null>;
    /**
     * Store schema in cache
     */
    set(api: string, version: string, schema: DiscoverySchema, ttl?: number): Promise<void>;
    /**
     * Invalidate (delete) a cached schema
     */
    invalidate(api: string, version: string): Promise<void>;
    /**
     * Invalidate all cached schemas
     */
    invalidateAll(): Promise<void>;
    /**
     * Clean up expired cache entries
     */
    cleanupExpired(): Promise<number>;
    /**
     * Get cache statistics
     */
    getCacheStats(): Promise<{
        entries: number;
        totalSize: number;
        oldestEntry: number | null;
        newestEntry: number | null;
        expiredEntries: number;
    }>;
    /**
     * List all cached schemas
     */
    list(): Promise<Array<{
        api: string;
        version: string;
        fetchedAt: number;
        expiresAt: number;
        expired: boolean;
    }>>;
    /**
     * Get cache file path for an API schema
     */
    private getCacheFilePath;
}
/**
 * Get or create global schema cache
 */
export declare function getSchemaCache(): SchemaCache;
/**
 * Reset global schema cache
 */
export declare function resetSchemaCache(): void;
//# sourceMappingURL=schema-cache.d.ts.map