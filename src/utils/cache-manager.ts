/**
 * ServalSheets - Cache Manager
 *
 * Core caching service with TTL-based expiration, LRU+TTL hybrid eviction,
 * range dependency tracking, and precise range intersection detection.
 */

import { LRUCache } from './cache.js';
import { parseA1Notation, intersectsRange, normalizeA1Range } from '../validation/a1-helpers.js';
import { logger } from './logger.js';

export interface CacheKey {
  spreadsheetId: string;
  range: string;
  includeFormulas?: boolean;
  includeGridData?: boolean;
  dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING';
  valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  dependencies: Set<string>; // Other cache keys this entry depends on
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
  hitRate: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;
const NAMESPACE_SEPARATOR = ':::';

export class CacheManager {
  private cache: LRUCache<string, CacheEntry<unknown>>;
  private dependencies: Map<string, Set<string>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private namespaces: Map<string, CacheManager> = new Map();

  constructor(maxSize: number = MAX_CACHE_SIZE) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: DEFAULT_TTL_MS,
      updateAgeOnGet: true,
    });
  }

  /**
   * Get value from cache with TTL check
   */
  get<T>(key: CacheKey): T | undefined {
    const serialized = this.serializeKey(key);
    const entry = this.cache.get(serialized);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(serialized);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache with optional dependencies
   */
  set<T>(
    key: CacheKey,
    value: T,
    ttl: number = DEFAULT_TTL_MS,
    dependencies?: Set<string>
  ): void {
    const serialized = this.serializeKey(key);
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      dependencies: dependencies || new Set(),
    };

    this.cache.set(serialized, entry);

    // Track dependencies for inverse lookups
    if (dependencies && dependencies.size > 0) {
      for (const dep of dependencies) {
        if (!this.dependencies.has(dep)) {
          this.dependencies.set(dep, new Set());
        }
        this.dependencies.get(dep)!.add(serialized);
      }
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: CacheKey): void {
    const serialized = this.serializeKey(key);
    this.cache.delete(serialized);
  }

  /**
   * Invalidate all entries that depend on a given range
   */
  invalidateRange(spreadsheetId: string, range: string): void {
    const normalizedRange = normalizeA1Range(spreadsheetId, range);

    for (const [cached, dependents] of this.dependencies.entries()) {
      try {
        const cachedData = JSON.parse(cached);
        if (
          cachedData.spreadsheetId === spreadsheetId &&
          intersectsRange(cachedData.range, normalizedRange)
        ) {
          this.cache.delete(cached);
          dependents.forEach((dep) => this.cache.delete(dep));
        }
      } catch (error) {
        logger.warn('Failed to parse cached key during invalidation', { cached });
      }
    }
  }

  /**
   * Invalidate all entries for a spreadsheet
   */
  invalidateSpreadsheet(spreadsheetId: string): void {
    const toDelete: string[] = [];

    for (const key of this.cache.keys()) {
      try {
        const data = JSON.parse(key);
        if (data.spreadsheetId === spreadsheetId) {
          toDelete.push(key);
        }
      } catch (error) {
        logger.warn('Failed to parse cached key during spreadsheet invalidation', { key });
      }
    }

    toDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.dependencies.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      entries: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Get or create a namespaced cache manager
   */
  namespace(name: string): CacheManager {
    if (!this.namespaces.has(name)) {
      this.namespaces.set(name, new CacheManager());
    }
    return this.namespaces.get(name)!;
  }

  /**
   * Serialize cache key for internal storage
   */
  private serializeKey(key: CacheKey): string {
    return JSON.stringify({
      spreadsheetId: key.spreadsheetId,
      range: normalizeA1Range(key.spreadsheetId, key.range),
      includeFormulas: key.includeFormulas,
      includeGridData: key.includeGridData,
      dateTimeRenderOption: key.dateTimeRenderOption,
      valueRenderOption: key.valueRenderOption,
    });
  }
}

export const cacheManager = new CacheManager();
