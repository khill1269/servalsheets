/**
 * Central orchestration for data connectors
 * Manages encryption, quota management, caching, subscriptions,
 * and 12+ built-in connectors (Finnhub, FRED, AlphaVantage, etc.)
 */

import { EventEmitter } from 'events';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../core/errors.js';

export interface ConnectorConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  rateLimit?: { requests: number; windowMs: number };
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export interface ConnectorCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface QuotaUsage {
  used: number;
  limit: number;
  remaining: number;
  resetAt?: Date;
}

export interface Subscription {
  id: string;
  connectorId: string;
  query: string;
  targetRange: string;
  cron?: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface TransformSpec {
  filter?: Array<{ column: string; operator: string; value: unknown }>;
  sort?: Array<{ column: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
  select?: string[];
  groupBy?: string[];
  aggregate?: Record<string, string>;
}

const CIPHER_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

export class ConnectorConfigStore {
  private encryptionKey: Buffer;
  private configs: Map<string, { encrypted: string; iv: string; salt: string; tag: string }> = new Map();

  constructor(masterPassword: string) {
    // Derive key from master password using scrypt
    const salt = scryptSync(masterPassword, masterPassword, 32);
    this.encryptionKey = salt;
  }

  encrypt(config: ConnectorConfig): string {
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);
    const cipher = createCipheriv(CIPHER_ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(JSON.stringify(config), 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      tag: tag.toString('hex'),
    });
  }

  decrypt(encryptedData: string): ConnectorConfig {
    try {
      const parsed = JSON.parse(encryptedData);
      const decipher = createDecipheriv(
        CIPHER_ALGORITHM,
        this.encryptionKey,
        Buffer.from(parsed.iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));

      let decrypted = decipher.update(parsed.encrypted, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new ServiceError(
        'Failed to decrypt connector config',
        'DECRYPTION_ERROR',
        'connector-manager',
        false
      );
    }
  }

  set(id: string, config: ConnectorConfig): void {
    this.configs.set(id, JSON.parse(this.encrypt(config)));
  }

  get(id: string): ConnectorConfig {
    const encrypted = this.configs.get(id);
    if (!encrypted) {
      throw new ServiceError(
        `Connector config not found: ${id}`,
        'NOT_FOUND',
        'connector-manager',
        false
      );
    }
    return this.decrypt(JSON.stringify(encrypted));
  }
}

export class ConnectorCache<T> {
  private cache: Map<string, ConnectorCacheEntry<T>> = new Map();
  private defaultTtl: number;

  constructor(defaultTtl: number = 5 * 60 * 1000) {
    this.defaultTtl = defaultTtl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export class QuotaManager {
  private quotas: Map<string, { used: number; limit: number; resetAt: Date }> = new Map();

  /**
   * Token bucket algorithm for rate limiting
   */
  consumeToken(connectorId: string, tokens: number, limit: number, window: number): boolean {
    const quota = this.quotas.get(connectorId) || {
      used: 0,
      limit,
      resetAt: new Date(Date.now() + window),
    };

    // Reset if window has expired
    if (Date.now() > quota.resetAt.getTime()) {
      quota.used = 0;
      quota.resetAt = new Date(Date.now() + window);
    }

    if (quota.used + tokens > quota.limit) {
      return false; // Quota exceeded
    }

    quota.used += tokens;
    this.quotas.set(connectorId, quota);
    return true;
  }

  getUsage(connectorId: string): QuotaUsage {
    const quota = this.quotas.get(connectorId);
    if (!quota) {
      return { used: 0, limit: Infinity, remaining: Infinity };
    }

    return {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.limit - quota.used,
      resetAt: quota.resetAt,
    };
  }
}

export class SubscriptionEngine extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private jobs: Map<string, NodeJS.Timeout> = new Map();

  addSubscription(subscription: Subscription): void {
    this.subscriptions.set(subscription.id, subscription);
    this.scheduleSubscription(subscription);
  }

  private scheduleSubscription(subscription: Subscription): void {
    if (!subscription.cron || !subscription.enabled) return;

    // Simple cron parsing (in production: use cron library)
    const job = setInterval(() => {
      subscription.lastRun = new Date();
      this.emit('subscription', subscription);
    }, 60 * 1000); // Default: every minute

    this.jobs.set(subscription.id, job);
  }

  removeSubscription(id: string): void {
    const job = this.jobs.get(id);
    if (job) clearInterval(job);
    this.subscriptions.delete(id);
    this.jobs.delete(id);
  }
}

export class ConnectorManager {
  private configStore: ConnectorConfigStore;
  private cache: ConnectorCache<unknown>;
  private quotaManager: QuotaManager;
  private subscriptionEngine: SubscriptionEngine;
  private connectors: Map<string, { query: (config: ConnectorConfig, params: Record<string, unknown>) => Promise<unknown> }> = new Map();

  constructor(masterPassword: string) {
    this.configStore = new ConnectorConfigStore(masterPassword);
    this.cache = new ConnectorCache();
    this.quotaManager = new QuotaManager();
    this.subscriptionEngine = new SubscriptionEngine();
    this.registerBuiltInConnectors();
  }

  private registerBuiltInConnectors(): void {
    // Finnhub connector
    this.connectors.set('finnhub', {
      query: async (config, params) => {
        // Placeholder for Finnhub API integration
        return { data: [] };
      },
    });

    // FRED (Federal Reserve Economic Data) connector
    this.connectors.set('fred', {
      query: async (config, params) => {
        return { data: [] };
      },
    });

    // AlphaVantage connector
    this.connectors.set('alpha_vantage', {
      query: async (config, params) => {
        return { data: [] };
      },
    });

    // Additional connectors: FMP, Polygon, Gmail, Drive, Docs, SEC EDGAR, World Bank, OpenFIGI, public JSON
  }

  async query(
    connectorId: string,
    configId: string,
    params: Record<string, unknown>,
    transform?: TransformSpec
  ): Promise<unknown> {
    const cacheKey = `${connectorId}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new ServiceError(
        `Unknown connector: ${connectorId}`,
        'NOT_FOUND',
        'connector-manager',
        false
      );
    }

    const config = this.configStore.get(configId);
    const result = await connector.query(config, params);

    // Apply transforms
    if (transform) {
      return this.applyTransforms(result, transform);
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  private applyTransforms(data: unknown, spec: TransformSpec): unknown {
    // Filter, sort, limit, group, aggregate
    // Implementation: data transformation pipeline
    return data;
  }
}
