/**
 * ServalSheets - Optimized Values Handler Mixin
 *
 * Performance optimizations for the values handler hot path.
 *
 * Usage:
 * 1. Import this mixin in values.ts
 * 2. Use optimized methods in hot paths
 *
 * Optimizations:
 * - Pre-built action dispatch map (O(1) vs switch statement)
 * - Inline cache key generation
 * - Fast cell counting
 * - Lazy context tracking
 * - Optimized response building
 *
 * @module handlers/values-optimized
 */
import { spreadsheetCacheKey, countCells, truncateValues, LazyContextTracker, } from './optimization.js';
import { getHotCache } from '../utils/hot-cache.js';
// ============================================================================
// OPTIMIZED CACHE OPERATIONS
// ============================================================================
const hotCache = getHotCache();
/**
 * Fast cache get with hot tier priority
 */
export function fastCacheGet(operation, spreadsheetId, range) {
    const key = spreadsheetCacheKey(operation, spreadsheetId, range);
    // Try hot cache first (50ns)
    const hotResult = hotCache.get(key);
    if (hotResult !== undefined) {
        return hotResult;
    }
    // OK: Explicit empty - typed as optional, hot cache miss
    return undefined;
}
/**
 * Fast cache set with hot tier
 */
export function fastCacheSet(operation, spreadsheetId, range, value, ttl) {
    const key = spreadsheetCacheKey(operation, spreadsheetId, range);
    hotCache.set(key, value, ttl);
}
/**
 * Fast cache invalidation for range
 */
export function fastCacheInvalidate(spreadsheetId, range) {
    if (range) {
        const key = spreadsheetCacheKey('values', spreadsheetId, range);
        hotCache.delete(key);
        return 1;
    }
    // Invalidate all values for spreadsheet
    return hotCache.invalidatePrefix(`values:${spreadsheetId}:`);
}
// ============================================================================
// OPTIMIZED READ PATH
// ============================================================================
/**
 * Optimized values read path
 *
 * Optimizations:
 * - Hot cache lookup first (50ns vs 5ms)
 * - Inline cache key generation
 * - Fast cell counting
 * - Minimal object allocation
 */
export async function optimizedValuesRead(sheetsApi, spreadsheetId, range, options) {
    // Try hot cache first
    const cacheKey = spreadsheetCacheKey('values:read', spreadsheetId, range);
    const cached = hotCache.get(cacheKey);
    if (cached) {
        const values = cached.values ?? [];
        return {
            values,
            range: cached.range ?? range,
            majorDimension: cached.majorDimension ?? undefined,
            fromCache: true,
            cellCount: countCells(values),
        };
    }
    // API call
    const params = {
        spreadsheetId,
        range,
    };
    if (options?.valueRenderOption) {
        params.valueRenderOption = options.valueRenderOption;
    }
    if (options?.majorDimension) {
        params.majorDimension = options.majorDimension;
    }
    const response = await sheetsApi.spreadsheets.values.get(params);
    const data = response.data;
    const values = data.values ?? [];
    // Cache result
    hotCache.set(cacheKey, data, 60000); // 1 minute TTL
    return {
        values,
        range: data.range ?? range,
        majorDimension: data.majorDimension ?? undefined,
        fromCache: false,
        cellCount: countCells(values),
    };
}
// ============================================================================
// OPTIMIZED WRITE PATH
// ============================================================================
/**
 * Optimized values write path
 *
 * Optimizations:
 * - Fast cell counting
 * - Minimal object allocation for response
 * - Cache invalidation
 */
export async function optimizedValuesWrite(sheetsApi, spreadsheetId, range, values, options) {
    const response = await sheetsApi.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: options?.valueInputOption ?? 'USER_ENTERED',
        includeValuesInResponse: options?.includeValuesInResponse ?? false,
        requestBody: { values },
    });
    const data = response.data;
    // Invalidate cache for this range
    fastCacheInvalidate(spreadsheetId, range);
    return {
        updatedCells: data.updatedCells ?? 0,
        updatedRows: data.updatedRows ?? 0,
        updatedColumns: data.updatedColumns ?? 0,
        updatedRange: data.updatedRange ?? range,
    };
}
// ============================================================================
// OPTIMIZED BATCH READ PATH
// ============================================================================
/**
 * Optimized batch values read
 *
 * Optimizations:
 * - Parallel cache lookups
 * - Single API call for cache misses
 * - Fast result aggregation
 */
export async function optimizedBatchRead(sheetsApi, spreadsheetId, ranges, options) {
    const results = [];
    const cacheMisses = [];
    let fromCache = 0;
    // Check cache for each range
    for (const range of ranges) {
        const cacheKey = spreadsheetCacheKey('values:read', spreadsheetId, range);
        const cached = hotCache.get(cacheKey);
        if (cached) {
            results.push({
                range: cached.range ?? range,
                values: cached.values ?? [],
            });
            fromCache++;
        }
        else {
            cacheMisses.push(range);
        }
    }
    // Fetch cache misses in single batch call
    if (cacheMisses.length > 0) {
        const params = {
            spreadsheetId,
            ranges: cacheMisses,
        };
        if (options?.valueRenderOption) {
            params.valueRenderOption = options.valueRenderOption;
        }
        if (options?.majorDimension) {
            params.majorDimension = options.majorDimension;
        }
        const response = await sheetsApi.spreadsheets.values.batchGet(params);
        const valueRanges = response.data.valueRanges ?? [];
        for (const vr of valueRanges) {
            // Cache result
            const cacheKey = spreadsheetCacheKey('values:read', spreadsheetId, vr.range ?? '');
            hotCache.set(cacheKey, vr, 60000);
            results.push({
                range: vr.range ?? '',
                values: vr.values ?? [],
            });
        }
    }
    return {
        valueRanges: results,
        fromCache,
        fromApi: cacheMisses.length,
    };
}
// ============================================================================
// OPTIMIZED CONTEXT TRACKING
// ============================================================================
/**
 * Create lazy context tracker for values handler
 */
export function createValuesContextTracker(updateFn) {
    return new LazyContextTracker(updateFn);
}
// ============================================================================
// OPTIMIZED RESPONSE BUILDERS
// ============================================================================
/**
 * Build optimized read response
 */
export function buildReadResponse(values, range, options) {
    const maxCells = options?.maxCells ?? 10000;
    const maxRows = options?.maxRows ?? 1000;
    // Fast path: small data, no truncation needed
    const cellCount = countCells(values);
    if (cellCount <= maxCells && values.length <= maxRows) {
        const result = {
            success: true,
            action: 'read',
            values,
            range,
        };
        if (options?.majorDimension) {
            result.majorDimension = options.majorDimension;
        }
        return result;
    }
    // Truncation needed
    const truncated = truncateValues(values, maxRows, maxCells);
    return {
        success: true,
        action: 'read',
        values: truncated.values,
        range,
        majorDimension: options?.majorDimension,
        truncated: true,
        resourceUri: options?.spreadsheetId
            ? `sheets:///${options.spreadsheetId}/${encodeURIComponent(range)}`
            : undefined,
        originalRows: truncated.originalRows,
        originalCells: truncated.originalCells,
    };
}
/**
 * Build optimized write response
 */
export function buildWriteResponse(updatedCells, updatedRows, updatedColumns, updatedRange, mutation, dryRun) {
    const result = {
        success: true,
        action: 'write',
        updatedCells,
        updatedRows,
        updatedColumns,
        updatedRange,
    };
    if (mutation)
        result.mutation = mutation;
    if (dryRun !== undefined)
        result.dryRun = dryRun;
    return result;
}
// ============================================================================
// EXPORT MIXIN
// ============================================================================
export const ValuesOptimization = {
    // Cache operations
    fastCacheGet,
    fastCacheSet,
    fastCacheInvalidate,
    // Optimized operations
    optimizedValuesRead,
    optimizedValuesWrite,
    optimizedBatchRead,
    // Context tracking
    createValuesContextTracker,
    // Response builders
    buildReadResponse,
    buildWriteResponse,
};
//# sourceMappingURL=values-optimized.js.map