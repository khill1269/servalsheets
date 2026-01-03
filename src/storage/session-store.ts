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
   * @param ttlSeconds Time-to-live in seconds
   */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;

  /**
   * Retrieve a value by key
   * @param key Unique identifier
   * @returns Value if found and not expired, null otherwise
   */
  get(key: string): Promise<unknown | null>;

  /**
   * Delete a value by key
   * @param key Unique identifier
   */
  delete(key: string): Promise<void>;

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
   */
  cleanup(): Promise<void>;

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
export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, { value: unknown; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60000) {
    // Cleanup expired entries every minute by default
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error);
    }, cleanupIntervalMs);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async get(key: string): Promise<unknown | null> {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());

    if (!pattern) {
      return allKeys;
    }

    // Simple glob pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[SessionStore] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  async stats(): Promise<{ totalKeys: number; memoryUsage?: number }> {
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
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Redis-backed session store
 * Suitable for production and multi-instance deployments
 * Requires Redis to be installed and running
 */
export class RedisSessionStore implements SessionStore {
  private client: any; // Redis client (dynamic import)
  private connected: boolean = false;

  constructor(private redisUrl: string) {
    // We'll initialize lazily to avoid requiring Redis in development
  }

  /**
   * Initialize Redis connection (lazy)
   */
  private async ensureConnected(): Promise<void> {
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

      this.client.on('error', (err: Error) => {
        console.error('[RedisSessionStore] Redis error:', err);
      });

      await this.client.connect();
      this.connected = true;
      console.log('[RedisSessionStore] Connected to Redis');
    } catch (error) {
      throw new Error(
        `Failed to connect to Redis at ${this.redisUrl}. ` +
        `Make sure Redis is installed (npm install redis) and running. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();

    const serialized = JSON.stringify(value);
    await this.client.setEx(key, ttlSeconds, serialized);
  }

  async get(key: string): Promise<unknown | null> {
    await this.ensureConnected();

    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch {
      // If parsing fails, return the raw string
      return data;
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnected();
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async keys(pattern?: string): Promise<string[]> {
    await this.ensureConnected();
    return await this.client.keys(pattern || '*');
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL automatically, no cleanup needed
  }

  async stats(): Promise<{ totalKeys: number }> {
    await this.ensureConnected();
    const dbSize = await this.client.dbSize();

    return {
      totalKeys: dbSize,
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
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
export function createSessionStore(redisUrl?: string): SessionStore {
  if (redisUrl) {
    console.log('[SessionStore] Using Redis session store');
    return new RedisSessionStore(redisUrl);
  }

  console.log('[SessionStore] Using in-memory session store');
  return new InMemorySessionStore();
}
