/**
 * Scout Result Cache
 *
 * Provides TTL-based memoization for Scout.scout() results to avoid
 * redundant Google API calls when the same spreadsheet is scanned
 * multiple times within a short window (e.g., scout → comprehensive).
 *
 * @module services/scout-cache
 */

import type { sheets_v4 } from 'googleapis';
import { Scout, type ScoutConfig, type ScoutResult } from '../analysis/scout.js';
import { getCacheAdapter } from '../utils/cache-adapter.js';
import { LRUCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/** Cache entry with timestamp for TTL enforcement */
interface ScoutCacheEntry {
  result: ScoutResult;
  cachedAt: number;
}

/** Default TTL: 60 seconds — scout data is lightweight metadata, safe to cache briefly */
const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_SIZE = 50;

/**
 * Cached wrapper around Scout that deduplicates calls for the same spreadsheetId.
 *
 * Usage:
 * ```typescript
 * const cachedScout = new CachedScout({ sheetsApi });
 * const result = await cachedScout.scout(spreadsheetId); // API call
 * const result2 = await cachedScout.scout(spreadsheetId); // cache hit
 * ```
 */
export class CachedScout {
  private cache: LRUCache<string, ScoutCacheEntry>;
  private ttlMs: number;
  private sheetsApi: sheets_v4.Sheets;
  private scoutConfigOverrides: Partial<ScoutConfig>;

  constructor(options: {
    sheetsApi: sheets_v4.Sheets;
    ttlMs?: number;
    maxSize?: number;
    scoutConfig?: Partial<ScoutConfig>;
  }) {
    this.sheetsApi = options.sheetsApi;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.scoutConfigOverrides = options.scoutConfig ?? {};
    this.cache = new LRUCache<string, ScoutCacheEntry>({
      maxSize: options.maxSize ?? DEFAULT_MAX_SIZE,
      ttl: this.ttlMs,
    });
  }

  /**
   * Get scout results for a spreadsheet, using cache if available.
   */
  async scout(
    spreadsheetId: string,
    options?: {
      includeColumnTypes?: boolean;
      includeQuickIndicators?: boolean;
      detectIntent?: boolean;
    }
  ): Promise<ScoutResult> {
    const cacheKey = spreadsheetId;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      logger.debug('CachedScout: cache hit', { spreadsheetId });
      return cached.result;
    }

    logger.debug('CachedScout: cache miss, running scout', { spreadsheetId });
    const analysisCache = getCacheAdapter('analysis');
    const scoutInstance = new Scout({
      cache: analysisCache,
      sheetsApi: this.sheetsApi,
      includeColumnTypes: options?.includeColumnTypes ?? true,
      includeQuickIndicators: options?.includeQuickIndicators ?? true,
      detectIntent: options?.detectIntent ?? true,
      ...this.scoutConfigOverrides,
    });

    const result = await scoutInstance.scout(spreadsheetId);
    this.cache.set(cacheKey, { result, cachedAt: Date.now() });
    return result;
  }

  /**
   * Invalidate cache for a specific spreadsheet (e.g., after mutation).
   */
  invalidate(spreadsheetId: string): void {
    this.cache.delete(spreadsheetId);
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  stats(): { size: number; hits?: number } {
    return this.cache.getStats();
  }
}
