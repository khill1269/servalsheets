import { LRUCache } from 'lru-cache';
import { createClient } from 'redis';

export interface SessionData {
  [key: string]: unknown;
}

export interface SessionStoreStats {
  size: number;
  maxSize: number;
  itemCount: number;
}

export interface SessionStore {
  set(key: string, value: SessionData, options?: { ttlMs?: number }): Promise<void>;
  get(key: string): Promise<SessionData | undefined>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  cleanup(): Promise<number>;
  size(): Promise<number>;
  stats(): Promise<SessionStoreStats>;
}

export class InMemorySessionStore implements SessionStore {
  private cache: LRUCache<string, SessionData>;

  constructor(maxSize: number = 10000, ttlMs: number = 86400000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: ttlMs,
      updateAgeOnGet: true,
    });
  }

  async set(key: string, value: SessionData, options?: { ttlMs?: number }): Promise<void> {
    this.cache.set(key, value, { ttl: options?.ttlMs });
  }

  async get(key: string): Promise<SessionData | undefined> {
    return this.cache.get(key);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async cleanup(): Promise<number> {
    const sizeBefore = this.cache.size;
    this.cache.purgeStale();
    return sizeBefore - this.cache.size;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async stats(): Promise<SessionStoreStats> {
    return {
      size: this.cache.size,
      maxSize: this.cache.max || 10000,
      itemCount: this.cache.size,
    };
  }
}

export class RedisSessionStore implements SessionStore {
  private client: ReturnType<typeof createClient>;
  private prefix = 'session:';
  private ttlSeconds: number;

  constructor(redisUrl: string, ttlSeconds: number = 86400) {
    this.client = createClient({ url: redisUrl });
    this.ttlSeconds = ttlSeconds;
  }

  async set(key: string, value: SessionData, options?: { ttlMs?: number }): Promise<void> {
    const ttlSecs = options?.ttlMs ? Math.ceil(options.ttlMs / 1000) : this.ttlSeconds;
    await this.client.setEx(`${this.prefix}${key}`, ttlSecs, JSON.stringify(value));
  }

  async get(key: string): Promise<SessionData | undefined> {
    const value = await this.client.get(`${this.prefix}${key}`);
    return value ? JSON.parse(value) : undefined;
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(`${this.prefix}${key}`);
    return result > 0;
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(`${this.prefix}${key}`)) > 0;
  }

  async keys(): Promise<string[]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.map((k) => k.replace(this.prefix, ''));
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async cleanup(): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
    return keys.length;
  }

  async size(): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.length;
  }

  async stats(): Promise<SessionStoreStats> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return {
      size: keys.length * 1024, // Estimate
      maxSize: -1, // Unlimited
      itemCount: keys.length,
    };
  }
}

export class MemorySessionStore implements SessionStore {
  private store = new Map<string, SessionData>();
  private expirations = new Map<string, number>();
  private defaultTtlMs: number;
  private maxEntries: number;

  constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 86400000;
    this.maxEntries = options?.maxEntries ?? 10000;
  }

  async set(key: string, value: SessionData, options?: { ttlMs?: number }): Promise<void> {
    // Remove old expiration if exists
    this.expirations.delete(key);

    // Enforce max entries by evicting oldest
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
        this.expirations.delete(firstKey);
      }
    }

    this.store.set(key, value);

    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    if (ttlMs > 0) {
      this.expirations.set(key, Date.now() + ttlMs);
    }
  }

  async get(key: string): Promise<SessionData | undefined> {
    // Check if expired
    const expiryTime = this.expirations.get(key);
    if (expiryTime && Date.now() > expiryTime) {
      this.store.delete(key);
      this.expirations.delete(key);
      return undefined;
    }
    return this.store.get(key);
  }

  async delete(key: string): Promise<boolean> {
    this.expirations.delete(key);
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    // Check if expired
    const expiryTime = this.expirations.get(key);
    if (expiryTime && Date.now() > expiryTime) {
      this.store.delete(key);
      this.expirations.delete(key);
      return false;
    }
    return this.store.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.expirations.clear();
  }

  async cleanup(): Promise<number> {
    let removedCount = 0;
    const now = Date.now();
    for (const [key, expiryTime] of this.expirations.entries()) {
      if (now > expiryTime) {
        this.store.delete(key);
        this.expirations.delete(key);
        removedCount++;
      }
    }
    return removedCount;
  }

  async size(): Promise<number> {
    return this.store.size;
  }

  async stats(): Promise<SessionStoreStats> {
    return {
      size: this.store.size * 1024,
      maxSize: this.maxEntries,
      itemCount: this.store.size,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a SessionStore instance based on configuration.
 * If a Redis URL is provided, returns a RedisSessionStore; otherwise InMemorySessionStore.
 */
export function createSessionStore(redisUrl?: string): SessionStore {
  if (redisUrl) {
    return new RedisSessionStore(redisUrl);
  }
  return new InMemorySessionStore();
}
