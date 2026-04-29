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
  initialize?(): Promise<void>;
  set(key: string, value: SessionData, options?: { ttlMs?: number }): Promise<void>;
  get(key: string): Promise<SessionData | undefined>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  cleanup(): Promise<number>;
  size(): Promise<number>;
  stats(): Promise<SessionStoreStats>;
  /**
   * AUDIT-2026-04-23 (finding N6): atomically read-and-delete a key.
   * Used for single-use tokens — OAuth state nonces, authorization
   * codes — where a race between `get()` and `delete()` could let two
   * concurrent callback requests succeed on the same code, enabling a
   * code-reuse / fixation attack. Implementations must guarantee that
   * only one caller receives the value; subsequent callers see
   * undefined even if they executed `consume` mid-flight.
   *
   * Default implementation (get + delete non-atomic) remains acceptable
   * for the in-memory stores in single-process mode since there's no
   * cross-process race.
   */
  consume?(key: string): Promise<SessionData | undefined>;
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

  /**
   * AUDIT-2026-04-23 (finding N6): atomic single-use read-and-delete.
   * LRUCache operations are synchronous + single-threaded under Node's
   * event loop, so this is genuinely atomic without a lock.
   */
  async consume(key: string): Promise<SessionData | undefined> {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
    }
    return value;
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

  // node-redis v4 requires an explicit connect() before any commands.
  async initialize(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  // This lazy guard remains for direct store usage outside managed startup.
  private async ensureConnected(): Promise<void> {
    await this.initialize();
  }

  // Non-blocking SCAN replacement for redis.keys() (O(1) amortized per iteration
  // vs O(N) blocking). redis.keys() blocks the Redis event loop for the full
  // duration — at 10k+ sessions this causes hundreds-of-ms stalls.
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;
    do {
      // node-redis v4 scan() expects RedisArgument (string | Buffer) for cursor.
      const result = await this.client.scan(String(cursor), { MATCH: pattern, COUNT: 100 });
      cursor = Number(result.cursor);
      keys.push(...result.keys);
    } while (cursor !== 0);
    return keys;
  }

  async set(key: string, value: SessionData, options?: { ttlMs?: number }): Promise<void> {
    await this.ensureConnected();
    const ttlSecs = options?.ttlMs ? Math.ceil(options.ttlMs / 1000) : this.ttlSeconds;
    await this.client.setEx(`${this.prefix}${key}`, ttlSecs, JSON.stringify(value));
  }

  async get(key: string): Promise<SessionData | undefined> {
    await this.ensureConnected();
    const value = await this.client.get(`${this.prefix}${key}`);
    return value ? JSON.parse(value) : undefined;
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.del(`${this.prefix}${key}`);
    return result > 0;
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnected();
    return (await this.client.exists(`${this.prefix}${key}`)) > 0;
  }

  async keys(): Promise<string[]> {
    await this.ensureConnected();
    const keys = await this.scanKeys(`${this.prefix}*`);
    return keys.map((k) => k.replace(this.prefix, ''));
  }

  async clear(): Promise<void> {
    await this.ensureConnected();
    const keys = await this.scanKeys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async cleanup(): Promise<number> {
    await this.ensureConnected();
    const keys = await this.scanKeys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
    return keys.length;
  }

  async size(): Promise<number> {
    await this.ensureConnected();
    const keys = await this.scanKeys(`${this.prefix}*`);
    return keys.length;
  }

  async stats(): Promise<SessionStoreStats> {
    await this.ensureConnected();
    const keys = await this.scanKeys(`${this.prefix}*`);
    return {
      size: keys.length * 1024, // Estimate
      maxSize: -1, // Unlimited
      itemCount: keys.length,
    };
  }

  /**
   * AUDIT-2026-04-23 (finding N6): atomic single-use read-and-delete.
   * Uses Redis GETDEL (available since 6.2) which atomically returns
   * and removes the key in a single round-trip. Falls back to a MULTI
   * block on older servers (kept for defense in depth; client auto-detects).
   */
  async consume(key: string): Promise<SessionData | undefined> {
    await this.ensureConnected();
    const fullKey = `${this.prefix}${key}`;
    try {
      // node-redis v4 exposes GETDEL directly when available.
      const maybeGetDel = (
        this.client as unknown as {
          getDel?: (k: string) => Promise<string | null>;
        }
      ).getDel;
      if (typeof maybeGetDel === 'function') {
        const value = await maybeGetDel.call(this.client, fullKey);
        return value ? JSON.parse(value) : undefined;
      }
    } catch {
      // fall through to MULTI fallback
    }
    // Fallback: pipelined GET+DEL in a MULTI block. Not a true atomic
    // operation on a cluster without Lua, but reduces the race window
    // to a single round-trip.
    const multi = this.client.multi();
    multi.get(fullKey);
    multi.del(fullKey);
    const results = (await multi.exec()) as unknown as Array<string | null | number>;
    const rawValue = results?.[0];
    return typeof rawValue === 'string' ? JSON.parse(rawValue) : undefined;
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
      return undefined; // OK: TTL expiration — expired entries return undefined by contract
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

  /**
   * AUDIT-2026-04-23 (finding N6): atomic single-use read-and-delete.
   * Map operations are synchronous under Node's event loop, so this is
   * genuinely atomic without needing a lock.
   */
  async consume(key: string): Promise<SessionData | undefined> {
    const expiryTime = this.expirations.get(key);
    if (expiryTime && Date.now() > expiryTime) {
      this.store.delete(key);
      this.expirations.delete(key);
      return undefined;
    }
    const value = this.store.get(key);
    if (value !== undefined) {
      this.store.delete(key);
      this.expirations.delete(key);
    }
    return value;
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
