/**
 * ServalSheets - Response Optimizer
 *
 * Optimizes response payloads to reduce token usage while
 * maintaining essential information.
 *
 * MCP Protocol: 2025-11-25
 *
 * @module utils/response-optimizer
 */
import { logger } from './logger.js';
// ============================================================================
// Default Configuration
// ============================================================================
const DEFAULT_OPTIONS = {
    verbosity: 'standard',
    maxArrayItems: 100,
    maxStringLength: 1000,
    includeMetadata: true,
    includeSuggestions: false,
    truncateLargeValues: true,
    removeNulls: true,
};
/**
 * Fields to always remove (internal/debug only)
 */
const INTERNAL_FIELDS = new Set(['_internal', '_debug', '_trace', '_raw', '__proto__']);
/**
 * Fields to remove in minimal mode
 */
const MINIMAL_REMOVE_FIELDS = new Set([
    '_meta',
    'metadata',
    'suggestions',
    'alternatives',
    'resolution',
    'warnings',
    'hints',
    'debug',
    'timing',
    'cache',
    'requestId',
]);
/**
 * Fields to remove in standard mode
 */
const STANDARD_REMOVE_FIELDS = new Set(['debug', 'timing', 'cache', '_internal']);
// ============================================================================
// Response Optimizer
// ============================================================================
/**
 * Response Optimizer
 *
 * Reduces response payload size to minimize token usage.
 */
export class ResponseOptimizer {
    options;
    stats = {
        totalOptimizations: 0,
        totalBytesOriginal: 0,
        totalBytesOptimized: 0,
    };
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Optimize a response object
     */
    optimize(data, options) {
        const opts = { ...this.options, ...options };
        const originalSize = this.estimateSize(data);
        const fieldsRemoved = [];
        const arraysTruncated = [];
        const stringsTruncated = [];
        const optimized = this.optimizeValue(data, opts, '', fieldsRemoved, arraysTruncated, stringsTruncated);
        const optimizedSize = this.estimateSize(optimized);
        const reductionPercent = originalSize > 0 ? Math.round(((originalSize - optimizedSize) / originalSize) * 100) : 0;
        // Update stats
        this.stats.totalOptimizations++;
        this.stats.totalBytesOriginal += originalSize;
        this.stats.totalBytesOptimized += optimizedSize;
        if (reductionPercent > 10) {
            logger.debug('Response optimized', {
                originalSize,
                optimizedSize,
                reductionPercent,
                fieldsRemoved: fieldsRemoved.length,
                arraysTruncated: arraysTruncated.length,
            });
        }
        return {
            data: optimized,
            originalSize,
            optimizedSize,
            reductionPercent,
            fieldsRemoved,
            arraysTruncated,
            stringsTruncated,
        };
    }
    /**
     * Recursively optimize a value
     */
    optimizeValue(value, opts, path, fieldsRemoved, arraysTruncated, stringsTruncated) {
        // Handle null/undefined
        if (value === null || value === undefined) {
            return opts.removeNulls ? undefined : value;
        }
        // Handle arrays
        if (Array.isArray(value)) {
            return this.optimizeArray(value, opts, path, fieldsRemoved, arraysTruncated, stringsTruncated);
        }
        // Handle objects
        if (typeof value === 'object') {
            return this.optimizeObject(value, opts, path, fieldsRemoved, arraysTruncated, stringsTruncated);
        }
        // Handle strings
        if (typeof value === 'string') {
            return this.optimizeString(value, opts, path, stringsTruncated);
        }
        // Primitives pass through
        return value;
    }
    /**
     * Optimize an array
     */
    optimizeArray(arr, opts, path, fieldsRemoved, arraysTruncated, stringsTruncated) {
        let result = arr;
        // Truncate large arrays
        if (opts.truncateLargeValues && arr.length > opts.maxArrayItems) {
            result = arr.slice(0, opts.maxArrayItems);
            arraysTruncated.push(`${path}[${arr.length} → ${opts.maxArrayItems}]`);
        }
        // Optimize each element
        return result
            .map((item, i) => this.optimizeValue(item, opts, `${path}[${i}]`, fieldsRemoved, arraysTruncated, stringsTruncated))
            .filter((item) => item !== undefined);
    }
    /**
     * Optimize an object
     */
    optimizeObject(obj, opts, path, fieldsRemoved, arraysTruncated, stringsTruncated) {
        const result = {};
        // Determine which fields to remove based on verbosity
        const removeFields = this.getFieldsToRemove(opts.verbosity);
        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = path ? `${path}.${key}` : key;
            // Skip internal fields
            if (INTERNAL_FIELDS.has(key)) {
                fieldsRemoved.push(fieldPath);
                continue;
            }
            // Skip based on verbosity
            if (removeFields.has(key)) {
                fieldsRemoved.push(fieldPath);
                continue;
            }
            // Skip metadata if not included
            if (!opts.includeMetadata && key === '_meta') {
                fieldsRemoved.push(fieldPath);
                continue;
            }
            // Skip suggestions if not included
            if (!opts.includeSuggestions && key === 'suggestions') {
                fieldsRemoved.push(fieldPath);
                continue;
            }
            const optimizedValue = this.optimizeValue(value, opts, fieldPath, fieldsRemoved, arraysTruncated, stringsTruncated);
            if (optimizedValue !== undefined) {
                result[key] = optimizedValue;
            }
        }
        return result;
    }
    /**
     * Optimize a string
     */
    optimizeString(str, opts, path, stringsTruncated) {
        if (!opts.truncateLargeValues || str.length <= opts.maxStringLength) {
            return str;
        }
        stringsTruncated.push(`${path}[${str.length} → ${opts.maxStringLength}]`);
        return str.slice(0, opts.maxStringLength) + '...';
    }
    /**
     * Get fields to remove based on verbosity level
     */
    getFieldsToRemove(verbosity) {
        switch (verbosity) {
            case 'minimal':
                return MINIMAL_REMOVE_FIELDS;
            case 'standard':
                return STANDARD_REMOVE_FIELDS;
            case 'verbose':
                return new Set(); // Keep everything
            default:
                return STANDARD_REMOVE_FIELDS;
        }
    }
    /**
     * Estimate size of a value in bytes
     */
    estimateSize(value) {
        try {
            return JSON.stringify(value)?.length ?? 0;
        }
        catch {
            return 0;
        }
    }
    /**
     * Get optimization statistics
     */
    getStats() {
        const avgReduction = this.stats.totalBytesOriginal > 0
            ? Math.round(((this.stats.totalBytesOriginal - this.stats.totalBytesOptimized) /
                this.stats.totalBytesOriginal) *
                100)
            : 0;
        return {
            ...this.stats,
            averageReduction: avgReduction,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalOptimizations: 0,
            totalBytesOriginal: 0,
            totalBytesOptimized: 0,
        };
    }
}
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Singleton instance
 */
let optimizerInstance = null;
/**
 * Get or create the response optimizer singleton
 */
export function getResponseOptimizer(options) {
    if (!optimizerInstance) {
        optimizerInstance = new ResponseOptimizer(options);
    }
    return optimizerInstance;
}
/**
 * Quick optimize function
 */
export function optimizeResponse(data, options) {
    return getResponseOptimizer().optimize(data, options).data;
}
/**
 * Create a minimal response (most compact)
 */
export function minimalResponse(data) {
    return optimizeResponse(data, { verbosity: 'minimal' });
}
/**
 * Create a standard response (balanced)
 */
export function standardResponse(data) {
    return optimizeResponse(data, { verbosity: 'standard' });
}
/**
 * Create a verbose response (full detail)
 */
export function verboseResponse(data) {
    return optimizeResponse(data, {
        verbosity: 'verbose',
        includeMetadata: true,
        includeSuggestions: true,
        truncateLargeValues: false,
    });
}
// ============================================================================
// Compact Formats
// ============================================================================
/**
 * Compact values array format for large datasets
 * Converts 2D array to more compact representation
 */
export function compactValuesArray(values, options) {
    const maxRows = options?.maxRows ?? 1000;
    const truncated = values.length > maxRows;
    let nonEmpty = 0;
    let empty = 0;
    if (options?.includeStats) {
        for (const row of values) {
            for (const cell of row) {
                if (cell !== null && cell !== undefined && cell !== '') {
                    nonEmpty++;
                }
                else {
                    empty++;
                }
            }
        }
    }
    return {
        values: truncated ? values.slice(0, maxRows) : values,
        truncated,
        totalRows: values.length,
        totalCols: Math.max(...values.map((r) => r.length), 0),
        stats: options?.includeStats ? { nonEmpty, empty } : undefined,
    };
}
/**
 * Summarize large data for preview
 */
export function summarizeData(values, options) {
    const previewRows = options?.previewRows ?? 5;
    const previewCols = options?.previewCols ?? 10;
    const rows = values.length;
    const cols = Math.max(...values.map((r) => r.length), 0);
    const preview = values.slice(0, previewRows).map((row) => row.slice(0, previewCols));
    return {
        preview,
        shape: { rows, cols },
        sample: {
            first: values[0]?.slice(0, previewCols) ?? [],
            last: values[values.length - 1]?.slice(0, previewCols) ?? [],
        },
    };
}
//# sourceMappingURL=response-optimizer.js.map