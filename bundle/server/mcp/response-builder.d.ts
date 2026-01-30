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
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
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
export declare const RESPONSE_CONFIG: {
    readonly LARGE_RESPONSE_THRESHOLD: 10000;
    readonly STREAMING_THRESHOLD: 50000;
    readonly MAX_INLINE_CELLS: 1000;
    readonly TRUNCATION_ROWS: 100;
};
export interface ResponseOptions {
    /** Maximum cells to include inline (default: 1000) */
    maxInlineCells?: number;
    /** Maximum rows to include when truncating (default: 100) */
    truncationRows?: number;
    /** Enable streaming for large responses (default: true) */
    enableStreaming?: boolean;
    /** Include resource URI for truncated data (default: true) */
    includeResourceUri?: boolean;
    /** Spreadsheet ID for resource URI */
    spreadsheetId?: string;
    /** Range for resource URI */
    range?: string;
}
export interface LazyResponse {
    /** Get the response as a CallToolResult (triggers serialization) */
    toResult(): CallToolResult;
    /** Get the structured content without serialization */
    getStructuredContent(): Record<string, unknown>;
    /** Check if response represents an error */
    isError(): boolean;
    /** Get estimated size in bytes */
    estimatedSize(): number;
}
export interface StreamingResponse {
    /** Check if there are more chunks */
    hasMore(): boolean;
    /** Get the next chunk */
    nextChunk(): CallToolResult;
    /** Get total chunk count */
    totalChunks(): number;
    /** Get current chunk index */
    currentChunk(): number;
}
/**
 * Create a lazy response that defers serialization until needed
 *
 * This is useful when:
 * - Response might be cached and re-serialized multiple times
 * - Response might be filtered before sending
 * - Large responses that might be truncated
 */
export declare function createLazyResponse(data: Record<string, unknown>, _options?: ResponseOptions): LazyResponse;
/**
 * Build success response with minimal allocations
 */
export declare function buildSuccessResponse<T extends Record<string, unknown>>(action: string, data: T, options?: ResponseOptions): CallToolResult;
/**
 * Build error response with minimal allocations
 */
export declare function buildErrorResponse(code: string, message: string, details?: Record<string, unknown>): CallToolResult;
/**
 * Create a streaming response for very large datasets
 *
 * Splits the response into chunks that can be sent incrementally.
 * Useful for responses > 50k cells.
 */
export declare function createStreamingResponse(action: string, values: unknown[][], options?: ResponseOptions & {
    chunkSize?: number;
    metadata?: Record<string, unknown>;
}): StreamingResponse;
/**
 * Fast JSON serialization for responses
 *
 * Optimizations:
 * - Skip null/undefined values
 * - Inline small arrays
 * - Use faster number serialization
 */
export declare function fastSerialize(data: unknown, indent?: boolean): string;
/**
 * Estimate response size without full serialization
 */
export declare function estimateResponseSize(data: Record<string, unknown>): number;
declare const RESPONSE_TEMPLATES: {
    readSuccess: (values: unknown[][], range: string) => {
        response: {
            success: boolean;
            action: string;
            values: unknown[][];
            range: string;
        };
    };
    writeSuccess: (updatedCells: number, updatedRows: number, updatedColumns: number, updatedRange: string) => {
        response: {
            success: boolean;
            action: string;
            updatedCells: number;
            updatedRows: number;
            updatedColumns: number;
            updatedRange: string;
        };
    };
    notFound: (resourceType: string, resourceId: string) => {
        response: {
            success: boolean;
            error: {
                code: string;
                message: string;
                retryable: boolean;
            };
        };
    };
    permissionDenied: (operation: string) => {
        response: {
            success: boolean;
            error: {
                code: string;
                message: string;
                retryable: boolean;
            };
        };
    };
    rateLimited: (retryAfterMs: number) => {
        response: {
            success: boolean;
            error: {
                code: string;
                message: string;
                retryable: boolean;
                retryAfterMs: number;
            };
        };
    };
};
/**
 * Build response from template
 */
export declare function buildFromTemplate<K extends keyof typeof RESPONSE_TEMPLATES>(template: K, ...args: Parameters<(typeof RESPONSE_TEMPLATES)[K]>): CallToolResult;
export declare const ResponseBuilder: {
    createLazyResponse: typeof createLazyResponse;
    buildSuccessResponse: typeof buildSuccessResponse;
    buildErrorResponse: typeof buildErrorResponse;
    createStreamingResponse: typeof createStreamingResponse;
    fastSerialize: typeof fastSerialize;
    estimateResponseSize: typeof estimateResponseSize;
    buildFromTemplate: typeof buildFromTemplate;
    RESPONSE_TEMPLATES: {
        readSuccess: (values: unknown[][], range: string) => {
            response: {
                success: boolean;
                action: string;
                values: unknown[][];
                range: string;
            };
        };
        writeSuccess: (updatedCells: number, updatedRows: number, updatedColumns: number, updatedRange: string) => {
            response: {
                success: boolean;
                action: string;
                updatedCells: number;
                updatedRows: number;
                updatedColumns: number;
                updatedRange: string;
            };
        };
        notFound: (resourceType: string, resourceId: string) => {
            response: {
                success: boolean;
                error: {
                    code: string;
                    message: string;
                    retryable: boolean;
                };
            };
        };
        permissionDenied: (operation: string) => {
            response: {
                success: boolean;
                error: {
                    code: string;
                    message: string;
                    retryable: boolean;
                };
            };
        };
        rateLimited: (retryAfterMs: number) => {
            response: {
                success: boolean;
                error: {
                    code: string;
                    message: string;
                    retryable: boolean;
                    retryAfterMs: number;
                };
            };
        };
    };
    LARGE_RESPONSE_THRESHOLD: number;
    STREAMING_THRESHOLD: number;
    MAX_INLINE_CELLS: number;
    TRUNCATION_ROWS: number;
    RESPONSE_CONFIG: {
        readonly LARGE_RESPONSE_THRESHOLD: 10000;
        readonly STREAMING_THRESHOLD: 50000;
        readonly MAX_INLINE_CELLS: 1000;
        readonly TRUNCATION_ROWS: 100;
    };
};
export {};
//# sourceMappingURL=response-builder.d.ts.map