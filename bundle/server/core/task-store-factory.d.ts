/**
 * ServalSheets - Task Store Factory
 *
 * Factory function for creating task stores with environment-based configuration
 * Supports both in-memory (development) and Redis (production) backends
 *
 * MCP Protocol: 2025-11-25 (SEP-1686)
 */
import { TaskStoreAdapter } from './task-store-adapter.js';
export interface TaskStoreConfig {
    /**
     * Force a specific store type (useful for testing)
     * If not specified, determined by environment variables
     */
    type?: 'memory' | 'redis';
    /**
     * Redis connection URL (overrides REDIS_URL env var)
     */
    redisUrl?: string;
    /**
     * Default TTL for tasks in milliseconds
     */
    defaultTtl?: number;
}
/**
 * Create a task store based on environment configuration
 *
 * Decision Logic:
 * 1. If config.type is specified, use that
 * 2. If REDIS_URL is set, use Redis
 * 3. Otherwise, use in-memory store
 *
 * Production Considerations:
 * - In-memory store: Single-process only, data lost on restart
 * - Redis store: Multi-process safe, persistent, requires Redis server
 *
 * @param config Optional configuration overrides
 * @returns TaskStoreAdapter wrapping the appropriate store implementation
 */
export declare function createTaskStore(config?: TaskStoreConfig): Promise<TaskStoreAdapter>;
/**
 * Get recommended task store type for current environment
 *
 * @returns Recommended store type based on environment
 */
export declare function getRecommendedTaskStoreType(): 'memory' | 'redis';
//# sourceMappingURL=task-store-factory.d.ts.map