/**
 * ServalSheets - Optimized Cache Integration
 *
 * Integrates hot cache with existing cache manager for 2-tier caching.
 * Hot tier: ~50ns access for frequently accessed data
 * Warm tier: ~500ns access for less frequent data
 * Cold: Cache manager (~5ms) or API call (~50-200ms)
 *
 * @module utils/cache-integration
 */

import { getHotCache } from './hot-cache.js';
import { cacheManager } from './cache-manager.js';

// ============================================================================
// TYPES
// ============================================================================

export interface IntegratedCacheOptions {
  ttl?: number;
  namespace?: string;
  hotTier?: boolean; // Enable hot tier caching (default: true for reads)
}

export interface IntegratedCacheStats {
  hotHits: number;
  warmHits: number;
  coldHits: number;
  misses: number;
  totalLookups: number;
  hitRate: number;
}

// ============================================================================
// INTEGRATED CACHE
// ============================================================================

/**
 * Three-tier cache lookup:
 * 1. Hot cache (in-memory Map, ~50ns)
 * 2. Warm cache (LRU, ~500ns)
 * 3. Cold cache (cache-manager, ~5ms)
 */
export function integratedGet<T>(key: string, namespace: string = 'default'): T | undefined {
  const hotCache = getHotCache();

  // Try hot/warm tiers first (single call handles both)
  const hotResult = hotCache.get(key) as T | undefined;
  if (hotResult !== undefined) {
    return hotResult;
  }

  // Fall back to cold cache (cache-manager)
  const coldResult = cacheManager.get<T>(key, namespace);
  if (coldResult !== undefined) {
    // Promote to hot cache for next access
    hotCache.set(key, coldResult);
    return coldResult;
  }

  // OK: Explicit empty - typed as optional, cache miss across all tiers
  return undefined;
}

/**
 * Three-tier cache set:
 * - Sets in hot cache immediately
 * - Sets in cold cache for persistence
 */
export function integratedSet<T>(
  key: string,
  value: T,
  options: IntegratedCacheOptions = {}
): void {
  const { ttl, namespace = 'default', hotTier = true } = options;
  const hotCache = getHotCache();

  // Set in hot cache for fast access
  if (hotTier) {
    hotCache.set(key, value, ttl);
  }

  // Set in cold cache for persistence
  cacheManager.set(key, value, { ttl, namespace });
}

/**
 * Three-tier cache delete:
 * - Removes from all tiers
 */
export function integratedDelete(key: string, namespace: string = 'default'): void {
  const hotCache = getHotCache();

  // Remove from hot cache
  hotCache.delete(key);

  // Remove from cold cache
  cacheManager.delete(key, namespace);
}

/**
 * Invalidate by prefix across all tiers
 */
export function integratedInvalidatePrefix(prefix: string, namespace?: string): number {
  const hotCache = getHotCache();

  // Invalidate hot cache by prefix
  const hotInvalidated = hotCache.invalidatePrefix(prefix);

  // Invalidate cold cache by pattern
  const coldInvalidated = cacheManager.invalidatePattern
    ? cacheManager.invalidatePattern(new RegExp(`^${prefix}`), namespace)
    : 0;

  return hotInvalidated + coldInvalidated;
}

/**
 * Get combined cache statistics
 */
export function getIntegratedCacheStats(): IntegratedCacheStats {
  const hotCache = getHotCache();
  const hotStats = hotCache.getStats();

  // Cold cache doesn't track hits/misses, so we estimate
  const coldHits = 0; // Would need to instrument cache-manager

  return {
    hotHits: hotStats.hotHits,
    warmHits: hotStats.warmHits,
    coldHits,
    misses: hotStats.misses,
    totalLookups: hotStats.hotHits + hotStats.warmHits + hotStats.misses,
    hitRate: hotStats.hitRate,
  };
}

// ============================================================================
// SPREADSHEET-SPECIFIC CACHE HELPERS
// ============================================================================

/**
 * Create cache key for spreadsheet data
 */
export function createSpreadsheetCacheKey(
  spreadsheetId: string,
  type: 'metadata' | 'values' | 'sheets' | 'named-ranges',
  extra?: string
): string {
  const parts = ['ss', spreadsheetId, type];
  if (extra) parts.push(extra);
  return parts.join(':');
}

/**
 * Create cache key for range data
 */
export function createRangeCacheKey(spreadsheetId: string, range: string): string {
  // Normalize range for consistent caching
  const normalizedRange = range.replace(/\s+/g, '').toUpperCase();
  return `range:${spreadsheetId}:${normalizedRange}`;
}

/**
 * Invalidate all caches for a spreadsheet
 */
export function invalidateSpreadsheet(spreadsheetId: string): number {
  return (
    integratedInvalidatePrefix(`ss:${spreadsheetId}:`) +
    integratedInvalidatePrefix(`range:${spreadsheetId}:`)
  );
}

/**
 * Invalidate caches for a specific sheet
 */
export function invalidateSheet(spreadsheetId: string, sheetName: string): number {
  // Invalidate ranges that include this sheet
  return integratedInvalidatePrefix(`range:${spreadsheetId}:${sheetName.toUpperCase()}`);
}

// ============================================================================
// PREFETCH SYSTEM
// ============================================================================

interface PrefetchRequest {
  key: string;
  fetcher: () => Promise<unknown>;
  priority: number;
}

const prefetchQueue: PrefetchRequest[] = [];
let prefetchRunning = false;

/**
 * Queue a prefetch request
 */
export function queuePrefetch(
  key: string,
  fetcher: () => Promise<unknown>,
  priority: number = 1
): void {
  // Don't prefetch if already cached
  if (integratedGet(key) !== undefined) {
    return;
  }

  // Add to queue (higher priority first)
  const insertIndex = prefetchQueue.findIndex((r) => r.priority < priority);
  if (insertIndex === -1) {
    prefetchQueue.push({ key, fetcher, priority });
  } else {
    prefetchQueue.splice(insertIndex, 0, { key, fetcher, priority });
  }

  // Start processing if not already running
  if (!prefetchRunning) {
    void processPrefetchQueue();
  }
}

/**
 * Process prefetch queue in background
 */
async function processPrefetchQueue(): Promise<void> {
  if (prefetchRunning) return;
  prefetchRunning = true;

  try {
    while (prefetchQueue.length > 0) {
      const request = prefetchQueue.shift();
      if (!request) continue;

      // Skip if already cached
      if (integratedGet(request.key) !== undefined) {
        continue;
      }

      try {
        const value = await request.fetcher();
        integratedSet(request.key, value);
      } catch {
        // Ignore prefetch errors
      }

      // Small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    prefetchRunning = false;
  }
}

/**
 * Predict and prefetch related data based on access patterns
 */
export function predictAndPrefetch(
  spreadsheetId: string,
  currentRange: string,
  fetcher: (range: string) => Promise<unknown>
): void {
  // Simple prediction: adjacent ranges are likely to be accessed
  const match = currentRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) return;

  const [, startCol, startRowStr, endCol, endRowStr] = match;
  const startRow = parseInt(startRowStr!, 10);
  const endRow = parseInt(endRowStr!, 10);
  const rowCount = endRow - startRow + 1;

  // Prefetch next "page" of rows
  const nextStartRow = endRow + 1;
  const nextEndRow = nextStartRow + rowCount - 1;
  const nextRange = `${startCol}${nextStartRow}:${endCol}${nextEndRow}`;

  queuePrefetch(
    createRangeCacheKey(spreadsheetId, nextRange),
    () => fetcher(nextRange),
    1 // Low priority for predictions
  );
}

// ============================================================================
// CACHE WARMING
// ============================================================================

/**
 * Warm cache with frequently accessed spreadsheet data
 */
export async function warmSpreadsheetCache(
  spreadsheetId: string,
  fetchers: {
    metadata?: () => Promise<unknown>;
    sheets?: () => Promise<unknown>;
    namedRanges?: () => Promise<unknown>;
  }
): Promise<void> {
  const warmPromises: Promise<void>[] = [];

  if (fetchers.metadata) {
    const key = createSpreadsheetCacheKey(spreadsheetId, 'metadata');
    if (integratedGet(key) === undefined) {
      warmPromises.push(fetchers.metadata().then((data) => integratedSet(key, data)));
    }
  }

  if (fetchers.sheets) {
    const key = createSpreadsheetCacheKey(spreadsheetId, 'sheets');
    if (integratedGet(key) === undefined) {
      warmPromises.push(fetchers.sheets().then((data) => integratedSet(key, data)));
    }
  }

  if (fetchers.namedRanges) {
    const key = createSpreadsheetCacheKey(spreadsheetId, 'named-ranges');
    if (integratedGet(key) === undefined) {
      warmPromises.push(fetchers.namedRanges().then((data) => integratedSet(key, data)));
    }
  }

  await Promise.all(warmPromises);
}
