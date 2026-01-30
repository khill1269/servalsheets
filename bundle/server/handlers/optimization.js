/**
 * ServalSheets - Handler Optimization Utilities
 *
 * Performance utilities for handler hot paths.
 *
 * Optimizations:
 * 1. Pre-computed action dispatch tables (O(1) lookup vs switch)
 * 2. Inline cache key generation (no object allocation)
 * 3. Lazy context tracking (only when needed)
 * 4. Fast parameter presence checks
 * 5. Optimized response building
 *
 * @module handlers/optimization
 */
import { ValidationError } from '../core/errors.js';
// ============================================================================
// ACTION DISPATCH OPTIMIZATION
// ============================================================================
/**
 * Create a fast action dispatcher using a Map
 * Avoids switch statement overhead for frequent actions
 */
export function createActionDispatcher(handlers) {
    const dispatchMap = new Map(Object.entries(handlers));
    return async (input) => {
        const handler = dispatchMap.get(input.action);
        if (!handler) {
            throw new ValidationError(`Unknown action: ${input.action}`, 'action');
        }
        return handler(input);
    };
}
// ============================================================================
// CACHE KEY OPTIMIZATION
// ============================================================================
// Pre-allocated string builder buffer (avoid allocations in hot path)
const keyBuffer = [];
/**
 * Fast cache key generation without object allocation
 * Uses a simple string join instead of JSON.stringify
 */
export function fastCacheKey(prefix, ...parts) {
    keyBuffer.length = 0;
    keyBuffer.push(prefix);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part !== undefined) {
            keyBuffer.push(String(part));
        }
    }
    return keyBuffer.join(':');
}
/**
 * Fast cache key for spreadsheet operations
 */
export function spreadsheetCacheKey(operation, spreadsheetId, range, extra) {
    if (extra) {
        return range
            ? `${operation}:${spreadsheetId}:${range}:${extra}`
            : `${operation}:${spreadsheetId}:${extra}`;
    }
    return range ? `${operation}:${spreadsheetId}:${range}` : `${operation}:${spreadsheetId}`;
}
// ============================================================================
// PARAMETER OPTIMIZATION
// ============================================================================
/**
 * Check if all required parameters are present (avoid inference overhead)
 */
export function hasRequiredParams(input, ...required) {
    for (let i = 0; i < required.length; i++) {
        if (input[required[i]] === undefined) {
            return false;
        }
    }
    return true;
}
/**
 * Fast spreadsheet ID extraction (avoids type narrowing overhead)
 */
export function getSpreadsheetId(input) {
    const id = input['spreadsheetId'];
    return typeof id === 'string' ? id : undefined;
}
/**
 * Fast action extraction
 */
export function getAction(input) {
    const action = input['action'];
    return typeof action === 'string' ? action : undefined;
}
// ============================================================================
// RESPONSE OPTIMIZATION
// ============================================================================
// Pre-allocated response templates to reduce object creation
const SUCCESS_BASE = { success: true };
const ERROR_BASE = { success: false };
/**
 * Fast success response builder
 * Minimizes object allocation by reusing base and only adding needed fields
 */
export function fastSuccess(action, data) {
    return {
        ...SUCCESS_BASE,
        action,
        ...data,
    };
}
/**
 * Fast error response builder
 */
export function fastError(code, message, retryable = false) {
    return {
        ...ERROR_BASE,
        error: { code, message, retryable },
    };
}
// ============================================================================
// ASYNC OPTIMIZATION
// ============================================================================
/**
 * Execute multiple async operations in parallel with early bailout
 * Returns as soon as first operation fails
 */
export async function parallelWithBailout(operations) {
    const results = [];
    const promises = operations.map(async (op, index) => {
        const result = await op();
        results[index] = result;
        return result;
    });
    await Promise.all(promises);
    return results;
}
/**
 * Batch async operations with concurrency limit
 */
export async function batchAsync(items, operation, concurrency = 5) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(operation));
        results.push(...batchResults);
    }
    return results;
}
// ============================================================================
// CONTEXT OPTIMIZATION
// ============================================================================
/**
 * Lazy context tracker - only updates context when values change
 */
export class LazyContextTracker {
    updateFn;
    lastSpreadsheetId;
    lastSheetId;
    lastRange;
    constructor(updateFn) {
        this.updateFn = updateFn;
    }
    /**
     * Track context only if values have changed
     */
    track(params) {
        const { spreadsheetId, sheetId, range } = params;
        // Only update if values have changed
        if (spreadsheetId !== this.lastSpreadsheetId ||
            sheetId !== this.lastSheetId ||
            range !== this.lastRange) {
            this.updateFn(params);
            this.lastSpreadsheetId = spreadsheetId;
            this.lastSheetId = sheetId;
            this.lastRange = range;
        }
    }
    /**
     * Reset tracking state
     */
    reset() {
        this.lastSpreadsheetId = undefined;
        this.lastSheetId = undefined;
        this.lastRange = undefined;
    }
}
// ============================================================================
// VALUES ARRAY OPTIMIZATION
// ============================================================================
/**
 * Fast cell count for values array (avoids reduce overhead)
 */
export function countCells(values) {
    let count = 0;
    for (let i = 0; i < values.length; i++) {
        count += values[i].length;
    }
    return count;
}
/**
 * Fast row count
 */
export function countRows(values) {
    return values.length;
}
/**
 * Fast column count (from first row)
 */
export function countColumns(values) {
    return values.length > 0 ? values[0].length : 0;
}
/**
 * Truncate values array efficiently
 */
export function truncateValues(values, maxRows, maxCells) {
    const originalRows = values.length;
    let originalCells = 0;
    let cellCount = 0;
    let rowIndex = 0;
    // Count total cells and find truncation point
    for (let i = 0; i < values.length; i++) {
        const rowCells = values[i].length;
        originalCells += rowCells;
        if (rowIndex < maxRows && cellCount + rowCells <= maxCells) {
            cellCount += rowCells;
            rowIndex = i + 1;
        }
    }
    const truncated = originalRows > maxRows || originalCells > maxCells;
    return {
        values: truncated ? values.slice(0, rowIndex) : values,
        truncated,
        originalRows,
        originalCells,
    };
}
// ============================================================================
// RANGE OPTIMIZATION
// ============================================================================
// Pre-compiled regex for range parsing
const A1_RANGE_REGEX = /^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i;
/**
 * Fast A1 range parsing (avoids regex when possible)
 * Named fastParseA1Range to avoid conflict with services/parseA1Range
 */
export function fastParseA1Range(range) {
    const match = A1_RANGE_REGEX.exec(range);
    if (!match)
        return null;
    return {
        sheet: match[1],
        startCol: match[2].toUpperCase(),
        startRow: parseInt(match[3], 10),
        endCol: match[4]?.toUpperCase(),
        endRow: match[5] ? parseInt(match[5], 10) : undefined,
    };
}
/**
 * Fast range cell count estimation
 */
export function estimateRangeCells(range) {
    const parsed = fastParseA1Range(range);
    if (!parsed)
        return 0;
    if (!parsed.endCol || !parsed.endRow) {
        return 1; // Single cell
    }
    const startColIndex = columnLetterToIndex(parsed.startCol);
    const endColIndex = columnLetterToIndex(parsed.endCol);
    const rows = parsed.endRow - parsed.startRow + 1;
    const cols = endColIndex - startColIndex + 1;
    return rows * cols;
}
// Pre-computed column index cache (A-ZZ = 702 columns)
const COLUMN_INDEX_CACHE = new Map();
/**
 * Fast column letter to index conversion with caching
 */
export function columnLetterToIndex(letter) {
    const cached = COLUMN_INDEX_CACHE.get(letter);
    if (cached !== undefined)
        return cached;
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    index -= 1; // Convert to 0-based
    COLUMN_INDEX_CACHE.set(letter, index);
    return index;
}
// ============================================================================
// EXPORTS
// ============================================================================
export const HandlerOptimization = {
    // Action dispatch
    createActionDispatcher,
    // Cache keys
    fastCacheKey,
    spreadsheetCacheKey,
    // Parameters
    hasRequiredParams,
    getSpreadsheetId,
    getAction,
    // Responses
    fastSuccess,
    fastError,
    // Async
    parallelWithBailout,
    batchAsync,
    // Context
    LazyContextTracker,
    // Values
    countCells,
    countRows,
    countColumns,
    truncateValues,
    // Range
    fastParseA1Range,
    estimateRangeCells,
    columnLetterToIndex,
};
//# sourceMappingURL=optimization.js.map