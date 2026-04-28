/**
 * Sampling Result Cache
 *
 * Caches LLM sampling results (text strings) to avoid redundant API calls when
 * the same prompt + context is used repeatedly within a session.
 *
 * Uses BoundedCache from @serval/core with 5-minute TTL matching sampling-context-cache.
 * A secondary spreadsheetId → cacheKey index enables targeted invalidation on mutations.
 *
 * Best-effort only: all methods are non-throwing. Cache misses degrade to a full LLM call.
 */

import { createHash } from 'node:crypto';
import { BoundedCache } from '@serval/core';
import { logger } from '../utils/logger.js';
import { cacheHitsTotal, cacheMissesTotal } from '../observability/metrics.js';

const CACHE_NAMESPACE = 'sampling_result';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches sampling-context-cache
const CACHE_MAX_SIZE = 200;

interface CacheEntry {
  result: string;
  cachedAt: number;
}

const cache = new BoundedCache<string, CacheEntry>({
  maxSize: CACHE_MAX_SIZE,
  ttl: CACHE_TTL_MS,
});

// Secondary index for targeted invalidation: spreadsheetId → Set<cacheKey>
const idIndex = new Map<string, Set<string>>();

/**
 * Build a stable cache key from sampling request parameters.
 * Parameters that affect the LLM output are included; fixed parameters (maxTokens, role) are not.
 */
export function buildSamplingCacheKey(params: {
  operation: string;
  systemPrompt: string;
  userText: string;
  spreadsheetId?: string;
}): string {
  return createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 32);
}

/**
 * Retrieve a cached sampling result. Returns undefined on cache miss.
 * Updates Prometheus cache hit/miss counters.
 */
export function getSamplingResult(key: string): string | undefined {
  try {
    const entry = cache.get(key);
    if (entry) {
      cacheHitsTotal.inc({ namespace: CACHE_NAMESPACE });
      return entry.result;
    }
    cacheMissesTotal.inc({ namespace: CACHE_NAMESPACE });
    return undefined; // OK: cache miss — caller falls through to full sampling
  } catch {
    return undefined; // OK: cache read failure is non-fatal — caller falls through
  }
}

/**
 * Store a sampling result. If spreadsheetId is provided, the key is indexed
 * so it can be invalidated when that spreadsheet is mutated.
 */
export function setSamplingResult(key: string, result: string, spreadsheetId?: string): void {
  try {
    cache.set(key, { result, cachedAt: Date.now() });
    if (spreadsheetId) {
      if (!idIndex.has(spreadsheetId)) idIndex.set(spreadsheetId, new Set());
      idIndex.get(spreadsheetId)!.add(key);
    }
  } catch {
    // Non-critical — a failed set just means the next call is a cache miss
  }
}

/**
 * Invalidate all cached sampling results for a spreadsheet.
 * Called automatically after any mutation via tool-execution-side-effects.ts.
 */
export function invalidateSamplingResults(spreadsheetId: string): void {
  try {
    const keys = idIndex.get(spreadsheetId);
    if (!keys || keys.size === 0) return;
    let count = 0;
    for (const key of keys) {
      cache.delete(key);
      count++;
    }
    idIndex.delete(spreadsheetId);
    logger.debug('Invalidated sampling result cache entries', { spreadsheetId, count });
  } catch {
    // Non-critical
  }
}
