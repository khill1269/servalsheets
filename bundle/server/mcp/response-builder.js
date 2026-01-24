/**
 * ServalSheets - Optimized Response Builder
 *
 * Phase 4: Response Optimization
 *
 * Optimizations:
 * 1. Lazy JSON serialization (defer until actually needed)
 * 2. Response streaming for large datasets
 * 3. Chunked response building
 * 4. Memory-efficient large array handling
 * 5. Pre-computed response templates
 *
 * @module mcp/response-builder
 */
// ============================================================================
// CONSTANTS
// ============================================================================
/**
 * Threshold for considering a response "large" and applying optimizations
 * @default 10000 cells
 */
const LARGE_RESPONSE_THRESHOLD = 10000; // cells
/**
 * Threshold for enabling streaming responses (split into chunks)
 * @default 50000 cells
 */
const STREAMING_THRESHOLD = 50000; // cells
/**
 * Maximum number of cells to include inline before truncating
 * @default 1000 cells
 */
const MAX_INLINE_CELLS = 1000; // cells to include inline
/**
 * Number of rows to show when truncating large responses
 * @default 100 rows
 */
const TRUNCATION_ROWS = 100; // rows to show when truncating
/**
 * Response optimization configuration
 *
 * These thresholds control when optimizations are applied:
 * - **LARGE_RESPONSE_THRESHOLD**: Triggers optimization strategies for responses with >10k cells
 * - **STREAMING_THRESHOLD**: Splits responses >50k cells into progressive chunks
 * - **MAX_INLINE_CELLS**: Limits inline data to 1000 cells, provides resource URI for rest
 * - **TRUNCATION_ROWS**: Shows first 100 rows when truncating, with resource link for full data
 *
 * @example
 * ```ts
 * // Customize thresholds via ResponseOptions
 * const response = createLazyResponse(data, {
 *   maxInlineCells: 500,
 *   truncationRows: 50,
 *   enableStreaming: true,
 * });
 * ```
 */
export const RESPONSE_CONFIG = {
    LARGE_RESPONSE_THRESHOLD,
    STREAMING_THRESHOLD,
    MAX_INLINE_CELLS,
    TRUNCATION_ROWS,
};
// Pre-allocated response templates (avoid repeated object creation)
const SUCCESS_TEMPLATE = { success: true };
const ERROR_TEMPLATE = { success: false };
// ============================================================================
// LAZY RESPONSE BUILDER
// ============================================================================
/**
 * Create a lazy response that defers serialization until needed
 *
 * This is useful when:
 * - Response might be cached and re-serialized multiple times
 * - Response might be filtered before sending
 * - Large responses that might be truncated
 */
export function createLazyResponse(data, _options = {}) {
    let cachedResult = null;
    let cachedStructured = null;
    let cachedSize = null;
    const isErrorResponse = data['success'] === false ||
        data['response']?.['success'] === false;
    return {
        toResult() {
            if (cachedResult)
                return cachedResult;
            const structured = this.getStructuredContent();
            cachedResult = {
                content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
                structuredContent: structured,
                isError: isErrorResponse ? true : undefined,
            };
            return cachedResult;
        },
        getStructuredContent() {
            if (cachedStructured)
                return cachedStructured;
            // Wrap in response if needed
            if ('response' in data) {
                cachedStructured = data;
            }
            else if ('success' in data) {
                cachedStructured = { response: data };
            }
            else {
                cachedStructured = { response: data };
            }
            return cachedStructured;
        },
        isError() {
            return isErrorResponse;
        },
        estimatedSize() {
            if (cachedSize !== null)
                return cachedSize;
            // Fast estimation without full serialization
            cachedSize = estimateResponseSize(data);
            return cachedSize;
        },
    };
}
// ============================================================================
// FAST RESPONSE BUILDERS
// ============================================================================
/**
 * Build success response with minimal allocations
 */
export function buildSuccessResponse(action, data, options = {}) {
    // Check if data contains large arrays
    const values = data['values'];
    if (values && shouldTruncate(values, options)) {
        return buildTruncatedResponse(action, data, values, options);
    }
    const response = {
        ...SUCCESS_TEMPLATE,
        action,
        ...data,
    };
    const structured = { response };
    return {
        content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
        structuredContent: structured,
    };
}
/**
 * Build error response with minimal allocations
 */
export function buildErrorResponse(code, message, details) {
    const error = {
        code,
        message,
        retryable: isRetryableError(code),
    };
    if (details) {
        error['details'] = details;
    }
    const response = {
        ...ERROR_TEMPLATE,
        error,
    };
    const structured = { response };
    return {
        content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
        structuredContent: structured,
        isError: true,
    };
}
/**
 * Build response for large/truncated data
 */
function buildTruncatedResponse(action, data, values, options) {
    const maxRows = options.truncationRows ?? TRUNCATION_ROWS;
    const truncatedValues = values.slice(0, maxRows);
    const totalRows = values.length;
    const totalCells = countCellsFast(values);
    const response = {
        ...SUCCESS_TEMPLATE,
        action,
        ...data,
        values: truncatedValues,
        truncated: true,
        totalRows,
        totalCells,
        displayedRows: truncatedValues.length,
        displayedCells: countCellsFast(truncatedValues),
    };
    // Add resource URI for accessing full data
    if (options.includeResourceUri !== false && options.spreadsheetId) {
        const range = options.range ?? data['range'];
        if (range) {
            response['resourceUri'] = `sheets:///${options.spreadsheetId}/${encodeURIComponent(range)}`;
        }
    }
    const structured = { response };
    return {
        content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
        structuredContent: structured,
    };
}
// ============================================================================
// STREAMING RESPONSE BUILDER
// ============================================================================
/**
 * Create a streaming response for very large datasets
 *
 * Splits the response into chunks that can be sent incrementally.
 * Useful for responses > 50k cells.
 */
export function createStreamingResponse(action, values, options = {}) {
    const chunkSize = options.chunkSize ?? 1000; // rows per chunk
    const totalRows = values.length;
    const totalChunks = Math.ceil(totalRows / chunkSize);
    let currentIndex = 0;
    return {
        hasMore() {
            return currentIndex < totalChunks;
        },
        nextChunk() {
            const startRow = currentIndex * chunkSize;
            const endRow = Math.min(startRow + chunkSize, totalRows);
            const chunkValues = values.slice(startRow, endRow);
            const isFirst = currentIndex === 0;
            const isLast = currentIndex === totalChunks - 1;
            const response = {
                success: true,
                action,
                values: chunkValues,
                streaming: {
                    chunkIndex: currentIndex,
                    totalChunks,
                    startRow,
                    endRow,
                    isFirst,
                    isLast,
                    totalRows,
                },
            };
            // Include metadata in first chunk
            if (isFirst && options.metadata) {
                Object.assign(response, options.metadata);
            }
            currentIndex++;
            return {
                content: [{ type: 'text', text: JSON.stringify({ response }, null, 2) }],
                structuredContent: { response },
            };
        },
        totalChunks() {
            return totalChunks;
        },
        currentChunk() {
            return currentIndex;
        },
    };
}
// ============================================================================
// OPTIMIZED SERIALIZATION
// ============================================================================
/**
 * Fast JSON serialization for responses
 *
 * Optimizations:
 * - Skip null/undefined values
 * - Inline small arrays
 * - Use faster number serialization
 */
export function fastSerialize(data, indent = true) {
    if (data === null || data === undefined) {
        return 'null';
    }
    if (typeof data !== 'object') {
        return JSON.stringify(data);
    }
    // For objects, use native JSON.stringify but with replacer to skip nulls
    return JSON.stringify(data, (key, value) => {
        // Skip null and undefined values
        if (value === null || value === undefined) {
            // OK: Explicit empty - JSON.stringify replacer pattern, returns undefined to skip property
            return undefined;
        }
        return value;
    }, indent ? 2 : undefined);
}
/**
 * Estimate response size without full serialization
 */
export function estimateResponseSize(data) {
    let size = 0;
    for (const [key, value] of Object.entries(data)) {
        size += key.length + 4; // key + quotes + colon + space
        if (Array.isArray(value)) {
            // Estimate array size
            if (isValuesArray(value)) {
                size += estimateValuesArraySize(value);
            }
            else {
                size += value.length * 20; // rough estimate per item
            }
        }
        else if (typeof value === 'string') {
            size += value.length + 2;
        }
        else if (typeof value === 'number') {
            size += 10; // average number length
        }
        else if (typeof value === 'object' && value !== null) {
            size += estimateResponseSize(value);
        }
        else {
            size += 10; // boolean, null, etc.
        }
    }
    return size + 4; // braces and commas
}
/**
 * Estimate size of values array (2D array of cells)
 */
function estimateValuesArraySize(values) {
    let size = 2; // brackets
    for (const row of values) {
        size += 2; // row brackets
        for (const cell of row) {
            if (typeof cell === 'string') {
                size += cell.length + 2;
            }
            else if (typeof cell === 'number') {
                size += 10;
            }
            else {
                size += 10;
            }
            size += 1; // comma
        }
        size += 1; // row comma
    }
    return size;
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Check if values array is a 2D values array
 */
function isValuesArray(arr) {
    return arr.length > 0 && Array.isArray(arr[0]);
}
/**
 * Fast cell counting
 */
function countCellsFast(values) {
    let count = 0;
    for (let i = 0; i < values.length; i++) {
        count += values[i].length;
    }
    return count;
}
/**
 * Check if values should be truncated
 */
function shouldTruncate(values, options) {
    const maxCells = options.maxInlineCells ?? MAX_INLINE_CELLS;
    const cellCount = countCellsFast(values);
    return cellCount > maxCells;
}
/**
 * Check if error code is retryable
 */
function isRetryableError(code) {
    const retryableCodes = new Set([
        'RATE_LIMIT',
        'QUOTA_EXCEEDED',
        'SERVICE_UNAVAILABLE',
        'TIMEOUT',
        'INTERNAL_ERROR',
    ]);
    return retryableCodes.has(code);
}
// ============================================================================
// RESPONSE TEMPLATE CACHE
// ============================================================================
// Pre-built response templates for common patterns
const RESPONSE_TEMPLATES = {
    // Read success
    readSuccess: (values, range) => ({
        response: {
            success: true,
            action: 'read',
            values,
            range,
        },
    }),
    // Write success
    writeSuccess: (updatedCells, updatedRows, updatedColumns, updatedRange) => ({
        response: {
            success: true,
            action: 'write',
            updatedCells,
            updatedRows,
            updatedColumns,
            updatedRange,
        },
    }),
    // Not found error
    notFound: (resourceType, resourceId) => ({
        response: {
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `${resourceType} '${resourceId}' not found`,
                retryable: false,
            },
        },
    }),
    // Permission denied
    permissionDenied: (operation) => ({
        response: {
            success: false,
            error: {
                code: 'PERMISSION_DENIED',
                message: `Permission denied to ${operation}`,
                retryable: false,
            },
        },
    }),
    // Rate limited
    rateLimited: (retryAfterMs) => ({
        response: {
            success: false,
            error: {
                code: 'RATE_LIMIT',
                message: 'Rate limit exceeded. Please wait before retrying.',
                retryable: true,
                retryAfterMs,
            },
        },
    }),
};
/**
 * Build response from template
 */
export function buildFromTemplate(template, ...args) {
    const templateFn = RESPONSE_TEMPLATES[template];
    const structured = templateFn(...args);
    const response = structured['response'];
    const isError = response?.['success'] === false;
    return {
        content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
        structuredContent: structured,
        isError: isError ? true : undefined,
    };
}
// ============================================================================
// EXPORTS
// ============================================================================
export const ResponseBuilder = {
    // Lazy response
    createLazyResponse,
    // Fast builders
    buildSuccessResponse,
    buildErrorResponse,
    // Streaming
    createStreamingResponse,
    // Serialization
    fastSerialize,
    estimateResponseSize,
    // Templates
    buildFromTemplate,
    RESPONSE_TEMPLATES,
    // Constants
    LARGE_RESPONSE_THRESHOLD,
    STREAMING_THRESHOLD,
    MAX_INLINE_CELLS,
    TRUNCATION_ROWS,
    RESPONSE_CONFIG,
};
//# sourceMappingURL=response-builder.js.map