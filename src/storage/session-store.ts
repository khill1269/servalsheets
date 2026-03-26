/**
 * Session storage abstraction with multiple backend implementations
 * InMemorySessionStore (LRU cache with TTL), RedisSessionStore, MemorySessionStore
 */

import { LRUCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import Redis from 'ioredis';

export interface SessionData {
  id: string;
  userId?: string;
  data: Record<string, unknown>;
  expiresAt: number;
  createdAt: number;
}

export interface SessionStore {
  get(id: string): Promise<SessionData | undefined>;
  set(id: string, data: SessionData): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<SessionData[]>;
}

/**
 * In-memory session store using LRU cache with TTL
 */
export class InMemorySessionStore implements SessionStore {
  private cache: LRUCache<string, SessionData>;

  constructor(maxSize: number = 1000, ttl: number = 24 * 60 * 60 * 1000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl,
      updateAgeOnGet: true,
    });
  }

  async get(id: string): Promise<SessionData | undefined> {
    return this.cache.get(id);
  }

  async set(id: string, data: SessionData): Promise<void> {
    this.cache.set(id, data);
  }

  async delete(id: string): Promise<void> {
    this.cache.delete(id);
  }

  async list(): Promise<SessionData[]> {
    const sessions: SessionData[] = [];
    for (const id of this.cache.keys()) {
      const session = this.cache.get(id);
      if (session) sessions.push(session);
    }
    return sessions;
  }
}

/**
 * Redis-backed session store
 */
export class RedisSessionStore implements SessionStore {
  private redis?: Redis;
  private keyPrefix: string;

  constructor(keyPrefix: string = 'session:') {
    this.keyPrefix = keyPrefix;
  }

  private async initRedis(): Promise<Redis> {
    if (!this.redis) {
      try {
        this.redis = new Redis({
          host: process.env['REDIS_HOST'] || 'localhost',
          port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
          password: process.env['REDIS_PASSWORD'],
          db: parseInt(process.env['REDIS_DB'] || '0', 10),
        });
      } catch (error) {
        logger.error('Failed to initialize Redis connection', { error });
        throw error;
      }
    }
    return this.redis;
  }

  async get(id: string): Promise<SessionData | undefined> {
    try {
      const redis = await this.initRedis();
      const data = await redis.get(`${this.keyPrefix}${id}`);
      return data ? JSON.parse(data) : undefined;
    } catch (error) {
      logger.error('Failed to get session from Redis', { error });
      return undefined;
    }
  }

  async set(id: string, data: SessionData): Promise<void> {
    try {
      const redis = await this.initRedis();
      const ttl = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
      if (ttl > 0) {
        await redis.setex(`${this.keyPrefix}${id}`, ttl, JSON.stringify(data));
      }
    } catch (error) {
      logger.error('Failed to set session in Redis', { error });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const redis = await this.initRedis();
      await redis.del(`${this.keyPrefix}${id}`);
    } catch (error) {
      logger.error('Failed to delete session from Redis', { error });
    }
  }

  async list(): Promise<SessionData[]> {
    try {
      const redis = await this.initRedis();
      const keys = await redis.keys(`${this.keyPrefix}*`);
      const sessions: SessionData[] = [];

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) sessions.push(JSON.parse(data));
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to list sessions from Redis', { error });
      return [];
    }
  }
}

/**
 * Simple in-memory session store
 */
export class MemorySessionStore implements SessionStore {
  private sessions: Map<string, SessionData> = new Map();
  private maxEntries: number;
  private defaultTtl: number;

  constructor(maxEntries: number = 1000, defaultTtl: number = 24 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtl = defaultTtl;
  }

  async get(id: string): Promise<SessionData | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return undefined;
    }

    return session;
  }

  async set(id: string, data: SessionData): Promise<void> {
    // Enforce max entries
    if (this.sessions.size >= this.maxEntries) {
      const first = this.sessions.keys().next().value;
      this.sessions.delete(first);
    }

    this.sessions.set(id, data);
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async list(): Promise<SessionData[]> {
    const sessions: SessionData[] = [];
    for (const session of this.sessions.values()) {
      if (Date.now() <= session.expiresAt) {
        sessions.push(session);
      }
    }
    return sessions;
  }
}

/**
 * Factory for creating session stores
 */
export function createSessionStore(): SessionStore {
  const storeType = process.env['SESSION_STORE_TYPE'] || 'memory';

  switch (storeType) {
    case 'redis':
      return new RedisSessionStore();
    case 'memory':
      return new MemorySessionStore();
    case 'in-memory':
    default:
      return new InMemorySessionStore();
  }
}
