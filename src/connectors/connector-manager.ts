/**
 * ServalSheets - Connector Manager
 *
 * Central orchestration layer for all data connectors.
 * Handles registration, auth, quota tracking, caching, and subscriptions.
 */

import { logger } from '../utils/logger.js';
import type {
  SpreadsheetConnector,
  ConnectorCredentials,
  ConnectorRegistryEntry,
  HealthStatus,
  DataResult,
  QueryParams,
  Subscription,
  RefreshSchedule,
  TransformSpec,
  DataEndpoint,
  DataSchema,
} from './types.js';
import { FinnhubConnector } from './finnhub.js';
import { FredConnector } from './fred.js';
import { AlphaVantageConnector } from './alpha-vantage.js';
import { FmpConnector } from './fmp.js';
import { PolygonConnector } from './polygon.js';
import { GenericRestConnector } from './rest-generic.js';

// ============================================================================
// Quota Manager (token bucket per connector)
// ============================================================================

interface QuotaBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  lastRefill: number; // timestamp
}

class QuotaManager {
  private buckets = new Map<string, QuotaBucket>();

  configure(connectorId: string, requestsPerMinute: number): void {
    this.buckets.set(connectorId, {
      tokens: requestsPerMinute,
      maxTokens: requestsPerMinute,
      refillRate: requestsPerMinute / 60,
      lastRefill: Date.now(),
    });
  }

  tryConsume(connectorId: string): boolean {
    const bucket = this.buckets.get(connectorId);
    if (!bucket) return true; // No quota configured — allow

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  getUsage(connectorId: string): { used: number; limit: number } {
    const bucket = this.buckets.get(connectorId);
    if (!bucket) return { used: 0, limit: 0 };
    return {
      used: Math.round(bucket.maxTokens - bucket.tokens),
      limit: bucket.maxTokens,
    };
  }
}

// ============================================================================
// Cache Layer (TTL-based)
// ============================================================================

interface CacheEntry {
  data: DataResult;
  expiresAt: number;
}

class ConnectorCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 30_000; // 30 seconds default
  private maxEntries = 500;

  get(key: string): DataResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: DataResult, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  buildKey(connectorId: string, endpoint: string, params: QueryParams): string {
    const paramStr = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${connectorId}:${endpoint}:${paramStr}`;
  }

  clear(connectorId?: string): void {
    if (!connectorId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${connectorId}:`)) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// Subscription Engine (in-memory, non-persistent)
// ============================================================================

class SubscriptionEngine {
  private subscriptions = new Map<string, Subscription>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private nextId = 1;

  add(
    connectorId: string,
    endpoint: string,
    params: QueryParams,
    schedule: RefreshSchedule,
    destination: { spreadsheetId: string; range: string },
    refreshCallback: (sub: Subscription) => Promise<void>
  ): Subscription {
    const id = `sub_${this.nextId++}`;
    const sub: Subscription = {
      id,
      connectorId,
      endpoint,
      params,
      schedule,
      destination,
      status: 'active',
    };
    this.subscriptions.set(id, sub);

    // Set up timer
    const intervalMs = this.scheduleToMs(schedule);
    const timer = setInterval(async () => {
      try {
        await refreshCallback(sub);
        sub.lastRefresh = new Date().toISOString();
        sub.status = 'active';
        sub.errorMessage = undefined;
      } catch (err) {
        sub.status = 'error';
        sub.errorMessage = err instanceof Error ? err.message : String(err);
      }
    }, intervalMs);
    this.timers.set(id, timer);

    sub.nextRefresh = new Date(Date.now() + intervalMs).toISOString();
    return sub;
  }

  remove(subscriptionId: string): boolean {
    const timer = this.timers.get(subscriptionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(subscriptionId);
    }
    return this.subscriptions.delete(subscriptionId);
  }

  list(): Subscription[] {
    return [...this.subscriptions.values()];
  }

  private scheduleToMs(schedule: RefreshSchedule): number {
    switch (schedule.interval) {
      case 'hourly':
        return 3_600_000;
      case 'daily':
        return 86_400_000;
      case 'weekly':
        return 604_800_000;
      case 'custom':
        return 3_600_000; // Default to hourly for custom cron
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.subscriptions.clear();
  }
}

// ============================================================================
// Transform Engine
// ============================================================================

function applyTransform(data: DataResult, transform: TransformSpec): DataResult {
  let { headers, rows } = data;

  // Filter
  if (transform.filter && transform.filter.length > 0) {
    for (const f of transform.filter) {
      const colIdx = headers.indexOf(f.column);
      if (colIdx === -1) continue;
      rows = rows.filter((row) => {
        const val = row[colIdx];
        switch (f.operator) {
          case 'eq':
            return val === f.value;
          case 'neq':
            return val !== f.value;
          case 'gt':
            return typeof val === 'number' && val > Number(f.value);
          case 'lt':
            return typeof val === 'number' && val < Number(f.value);
          case 'gte':
            return typeof val === 'number' && val >= Number(f.value);
          case 'lte':
            return typeof val === 'number' && val <= Number(f.value);
          case 'contains':
            return String(val).includes(String(f.value));
          case 'starts_with':
            return String(val).startsWith(String(f.value));
          default:
            return true;
        }
      });
    }
  }

  // Sort
  if (transform.sort && transform.sort.length > 0) {
    for (const s of [...transform.sort].reverse()) {
      const colIdx = headers.indexOf(s.column);
      if (colIdx === -1) continue;
      rows.sort((a, b) => {
        const av = a[colIdx];
        const bv = b[colIdx];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : 1;
        return s.direction === 'desc' ? -cmp : cmp;
      });
    }
  }

  // Column selection
  if (transform.columns && transform.columns.length > 0) {
    const indices = transform.columns.map((c) => headers.indexOf(c)).filter((i) => i !== -1);
    headers = indices.map((i) => headers[i]!);
    rows = rows.map((row) => indices.map((i) => row[i] ?? null));
  }

  // Limit
  if (transform.limit && transform.limit > 0) {
    rows = rows.slice(0, transform.limit);
  }

  return {
    ...data,
    headers,
    rows,
    metadata: { ...data.metadata, rowCount: rows.length },
  };
}

// ============================================================================
// Connector Manager
// ============================================================================

export class ConnectorManager {
  private registry = new Map<string, ConnectorRegistryEntry>();
  private quotaManager = new QuotaManager();
  private cache = new ConnectorCache();
  private subscriptionEngine = new SubscriptionEngine();

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  register(connector: SpreadsheetConnector): void {
    this.registry.set(connector.id, {
      connector,
      configured: connector.isConfigured(),
    });

    const limits = connector.getRateLimits();
    this.quotaManager.configure(connector.id, limits.requestsPerMinute);

    logger.info('Connector registered', { id: connector.id, name: connector.name });
  }

  hasConnector(connectorId: string): boolean {
    return this.registry.has(connectorId);
  }

  // ---------------------------------------------------------------------------
  // Actions (map to sheets_connectors actions)
  // ---------------------------------------------------------------------------

  listConnectors(): {
    connectors: {
      id: string;
      name: string;
      description: string;
      authType: string;
      configured: boolean;
      healthy?: boolean;
    }[];
  } {
    const connectors = [...this.registry.values()].map((entry) => ({
      id: entry.connector.id,
      name: entry.connector.name,
      description: entry.connector.description,
      authType: entry.connector.authType,
      configured: entry.configured,
      healthy: entry.lastHealthCheck?.healthy,
    }));
    return { connectors };
  }

  async configure(
    connectorId: string,
    credentials: ConnectorCredentials
  ): Promise<{ success: boolean; message: string }> {
    const entry = this.registry.get(connectorId);
    if (!entry) {
      return {
        success: false,
        message: `Connector '${connectorId}' not found. Use list_connectors to see available connectors.`,
      };
    }

    try {
      await entry.connector.configure(credentials);
      entry.configured = true;

      // Verify with health check
      const health = await entry.connector.healthCheck();
      entry.lastHealthCheck = health;

      return {
        success: health.healthy,
        message: health.healthy
          ? `Connector '${connectorId}' configured and verified (latency: ${health.latencyMs}ms)`
          : `Connector '${connectorId}' configured but health check failed: ${health.message}`,
      };
    } catch (err) {
      entry.configured = false;
      return {
        success: false,
        message: `Failed to configure '${connectorId}': ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async query(
    connectorId: string,
    endpoint: string,
    params: QueryParams,
    transform?: TransformSpec,
    useCache = true
  ): Promise<DataResult> {
    const entry = this.registry.get(connectorId);
    if (!entry) {
      throw new Error(`Connector '${connectorId}' not found`);
    }
    if (!entry.configured) {
      throw new Error(`Connector '${connectorId}' is not configured. Use configure action first.`);
    }

    // Check cache
    const cacheKey = this.cache.buildKey(connectorId, endpoint, params);
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug('Connector cache hit', { connectorId, endpoint });
        const result = { ...cached, metadata: { ...cached.metadata, cached: true } };
        return transform ? applyTransform(result, transform) : result;
      }
    }

    // Check quota
    if (!this.quotaManager.tryConsume(connectorId)) {
      throw new Error(`Rate limit exceeded for '${connectorId}'. Try again later.`);
    }

    // Execute query
    const result = await entry.connector.query(endpoint, params);

    // Cache result
    this.cache.set(cacheKey, result);

    // Apply transform
    return transform ? applyTransform(result, transform) : result;
  }

  async batchQuery(
    queries: {
      connectorId: string;
      endpoint: string;
      params: QueryParams;
      transform?: TransformSpec;
    }[]
  ): Promise<{ results: (DataResult | { error: string })[] }> {
    const results = await Promise.allSettled(
      queries.map((q) => this.query(q.connectorId, q.endpoint, q.params, q.transform))
    );

    return {
      results: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { error: r.reason?.message ?? 'Unknown error' }
      ),
    };
  }

  subscribe(
    connectorId: string,
    endpoint: string,
    params: QueryParams,
    schedule: RefreshSchedule,
    destination: { spreadsheetId: string; range: string }
  ): Subscription {
    const entry = this.registry.get(connectorId);
    if (!entry) throw new Error(`Connector '${connectorId}' not found`);
    if (!entry.configured) throw new Error(`Connector '${connectorId}' is not configured`);

    return this.subscriptionEngine.add(
      connectorId,
      endpoint,
      params,
      schedule,
      destination,
      async (_sub) => {
        await this.query(connectorId, endpoint, params, undefined, false);
        // In a real implementation, write result to destination spreadsheet
      }
    );
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptionEngine.remove(subscriptionId);
  }

  listSubscriptions(): Subscription[] {
    return this.subscriptionEngine.list();
  }

  async status(connectorId: string): Promise<{
    id: string;
    name: string;
    configured: boolean;
    health: HealthStatus | null;
    quota: { used: number; limit: number };
  }> {
    const entry = this.registry.get(connectorId);
    if (!entry) throw new Error(`Connector '${connectorId}' not found`);

    let health: HealthStatus | null = null;
    if (entry.configured) {
      try {
        health = await entry.connector.healthCheck();
        entry.lastHealthCheck = health;
      } catch {
        health = {
          healthy: false,
          latencyMs: 0,
          message: 'Health check failed',
          lastChecked: new Date().toISOString(),
        };
      }
    }

    return {
      id: entry.connector.id,
      name: entry.connector.name,
      configured: entry.configured,
      health,
      quota: this.quotaManager.getUsage(connectorId),
    };
  }

  async discover(connectorId: string): Promise<{ endpoints: DataEndpoint[] }> {
    const entry = this.registry.get(connectorId);
    if (!entry) throw new Error(`Connector '${connectorId}' not found`);
    if (!entry.configured) throw new Error(`Connector '${connectorId}' is not configured`);

    const endpoints = await entry.connector.listEndpoints();
    return { endpoints };
  }

  async getEndpointSchema(connectorId: string, endpoint: string): Promise<DataSchema> {
    const entry = this.registry.get(connectorId);
    if (!entry) throw new Error(`Connector '${connectorId}' not found`);
    return entry.connector.getSchema(endpoint);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async dispose(): Promise<void> {
    this.subscriptionEngine.dispose();
    this.cache.clear();
    for (const entry of this.registry.values()) {
      try {
        await entry.connector.dispose();
      } catch {
        // Intent-based guard: best-effort cleanup
      }
    }
    this.registry.clear();
  }
}

// Export singleton
export const connectorManager = new ConnectorManager();

let builtinsInitialized = false;

function createDefaultRestConnector(): GenericRestConnector {
  return new GenericRestConnector({
    id: 'public_json',
    name: 'Public JSON API',
    description: 'Generic REST/JSON connector for open APIs (no auth)',
    baseUrl: 'https://httpbin.org',
    auth: { type: 'none' },
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerDay: 10_000,
    },
    endpoints: [
      {
        id: 'get',
        name: 'GET Echo',
        description: 'Echo GET request parameters and headers back as JSON',
        category: 'demo',
        method: 'GET',
        path: '/get',
        params: [
          {
            name: 'key',
            type: 'string',
            required: false,
            description: 'Any query parameter to include in echo response',
            in: 'query',
            example: 'value',
          },
        ],
      },
      {
        id: 'json',
        name: 'JSON Slide Show',
        description: 'Returns a sample JSON response with a slide show structure',
        category: 'demo',
        method: 'GET',
        path: '/json',
        params: [],
      },
    ],
  });
}

export function registerBuiltinConnectors(manager: ConnectorManager = connectorManager): {
  registered: number;
  total: number;
} {
  const builtins: SpreadsheetConnector[] = [
    new FinnhubConnector(),
    new FredConnector(),
    new AlphaVantageConnector(),
    new FmpConnector(),
    new PolygonConnector(),
    createDefaultRestConnector(),
  ];

  let registered = 0;
  for (const connector of builtins) {
    if (!manager.hasConnector(connector.id)) {
      manager.register(connector);
      registered++;
    }
  }

  return { registered, total: builtins.length };
}

export function initializeBuiltinConnectors(): void {
  if (builtinsInitialized) {
    return;
  }
  registerBuiltinConnectors(connectorManager);
  builtinsInitialized = true;
}

initializeBuiltinConnectors();

// Re-export transform for testing
export { applyTransform };
