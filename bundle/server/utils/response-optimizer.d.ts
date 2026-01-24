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
/**
 * Verbosity levels for responses
 */
export type VerbosityLevel = 'minimal' | 'standard' | 'verbose';
/**
 * Optimization options
 */
export interface OptimizationOptions {
    /** Verbosity level (default: 'standard') */
    verbosity?: VerbosityLevel;
    /** Maximum array items to include (default: 100) */
    maxArrayItems?: number;
    /** Maximum string length (default: 1000) */
    maxStringLength?: number;
    /** Include metadata (default: true for standard+) */
    includeMetadata?: boolean;
    /** Include suggestions (default: true for verbose only) */
    includeSuggestions?: boolean;
    /** Truncate large values (default: true) */
    truncateLargeValues?: boolean;
    /** Remove null/undefined fields (default: true) */
    removeNulls?: boolean;
}
/**
 * Optimization result
 */
export interface OptimizationResult<T> {
    /** Optimized data */
    data: T;
    /** Original size in bytes (estimated) */
    originalSize: number;
    /** Optimized size in bytes (estimated) */
    optimizedSize: number;
    /** Reduction percentage */
    reductionPercent: number;
    /** Fields removed */
    fieldsRemoved: string[];
    /** Arrays truncated */
    arraysTruncated: string[];
    /** Strings truncated */
    stringsTruncated: string[];
}
/**
 * Response Optimizer
 *
 * Reduces response payload size to minimize token usage.
 */
export declare class ResponseOptimizer {
    private options;
    private stats;
    constructor(options?: OptimizationOptions);
    /**
     * Optimize a response object
     */
    optimize<T>(data: T, options?: OptimizationOptions): OptimizationResult<T>;
    /**
     * Recursively optimize a value
     */
    private optimizeValue;
    /**
     * Optimize an array
     */
    private optimizeArray;
    /**
     * Optimize an object
     */
    private optimizeObject;
    /**
     * Optimize a string
     */
    private optimizeString;
    /**
     * Get fields to remove based on verbosity level
     */
    private getFieldsToRemove;
    /**
     * Estimate size of a value in bytes
     */
    private estimateSize;
    /**
     * Get optimization statistics
     */
    getStats(): {
        totalOptimizations: number;
        totalBytesOriginal: number;
        totalBytesOptimized: number;
        averageReduction: number;
    };
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Get or create the response optimizer singleton
 */
export declare function getResponseOptimizer(options?: OptimizationOptions): ResponseOptimizer;
/**
 * Quick optimize function
 */
export declare function optimizeResponse<T>(data: T, options?: OptimizationOptions): T;
/**
 * Create a minimal response (most compact)
 */
export declare function minimalResponse<T>(data: T): T;
/**
 * Create a standard response (balanced)
 */
export declare function standardResponse<T>(data: T): T;
/**
 * Create a verbose response (full detail)
 */
export declare function verboseResponse<T>(data: T): T;
/**
 * Compact values array format for large datasets
 * Converts 2D array to more compact representation
 */
export declare function compactValuesArray(values: unknown[][], options?: {
    maxRows?: number;
    includeStats?: boolean;
}): {
    values: unknown[][];
    truncated: boolean;
    totalRows: number;
    totalCols: number;
    stats?: {
        nonEmpty: number;
        empty: number;
    };
};
/**
 * Summarize large data for preview
 */
export declare function summarizeData(values: unknown[][], options?: {
    previewRows?: number;
    previewCols?: number;
}): {
    preview: unknown[][];
    shape: {
        rows: number;
        cols: number;
    };
    sample: {
        first: unknown[];
        last: unknown[];
    };
};
//# sourceMappingURL=response-optimizer.d.ts.map