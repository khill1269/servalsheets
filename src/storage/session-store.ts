import LRUCache from 'lru-cache';
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
  set(key: string, value: SessionData, ttlMs?: number): Promise<void>;
  get(key: string): Promise<SessionData | null>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  cleanup(): Promise<void>;
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

  async set(key: string, value: SessionData, ttlMs?: number): Promise<void> {
    this.cache.set(key, value, { ttl: ttlMs });
  }

  async get(key: string): Promise<SessionData | null> {
    return this.cache.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async cleanup(): Promise<void> {
    this.cache.clear();
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

  async set(key: string, value: SessionData, ttlMs?: number): Promise<void> {
    const ttlSecs = ttlMs ? Math.ceil(ttlMs / 1000) : this.ttlSeconds;
    await this.client.setEx(`${this.prefix}${key}`, ttlSecs, JSON.stringify(value));
  }

  async get(key: string): Promise<SessionData | null> {
    const value = await this.client.get(`${this.prefix}${key}`);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(`${this.prefix}${key}`);
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(`${this.prefix}${key}`)) > 0;
  }

  async keys(): Promise<string[]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    return keys.map((k) => k.replace(this.prefix, ''));
  }

  async cleanup(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
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

  async set(key: string, value: SessionData, ttlMs?: number): Promise<void> {
    this.store.set(key, value);
  }

  async get(key: string): Promise<SessionData | null> {
    return this.store.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async cleanup(): Promise<void> {
    this.store.clear();
  }

  async stats(): Promise<SessionStoreStats> {
    return {
      size: this.store.size * 1024,
      maxSize: -1,
      itemCount: this.store.size,
    };
  }
}
