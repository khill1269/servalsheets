/**
 * RequestMerger
 *
 * @purpose Merges overlapping read requests within 50ms window to reduce API calls by 20-40% (e.g., A1:B10 + A1:C5 → A1:C10)
 * @category Performance
 * @usage Use for read-heavy workloads with overlapping ranges; detects overlaps via A1 notation parsing, merges ranges, splits responses
 * @dependencies logger, A1 notation parser
 * @stateful Yes - maintains pending request queues per spreadsheet, merge timers, metrics (merges performed, API calls saved)
 * @singleton Yes - one instance per process to coordinate request merging across all clients
 *
 * @example
 * const merger = new RequestMerger({ windowMs: 50, maxMergeSize: 10 });
 * // Multiple overlapping reads submitted within 50ms are automatically merged
 * const data1 = await merger.queueRead(spreadsheetId, 'Sheet1!A1:B10');
 * const data2 = await merger.queueRead(spreadsheetId, 'Sheet1!A1:C5'); // Merged into single A1:C10 read
 *
 * Architecture:
 * 1. Collect incoming requests in a time window (default 50ms)
 * 2. Detect overlapping/adjacent ranges
 * 3. Merge into minimal bounding range
 * 4. Execute single API call
 * 5. Split response back to individual requesters
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Parsed A1 range information
 */
export interface RangeInfo {
    /** Sheet name (empty for default sheet) */
    sheetName: string;
    /** Start row (1-indexed, 0 = unbounded) */
    startRow: number;
    /** Start column (1-indexed, 0 = unbounded) */
    startCol: number;
    /** End row (1-indexed, 0 = unbounded) */
    endRow: number;
    /** End column (1-indexed, 0 = unbounded) */
    endCol: number;
    /** Original A1 notation */
    originalA1: string;
}
/**
 * Read request options
 */
export interface ReadOptions {
    valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
    majorDimension?: 'ROWS' | 'COLUMNS';
}
/**
 * Merger statistics
 */
export interface MergerStats {
    enabled: boolean;
    totalRequests: number;
    mergedRequests: number;
    apiCalls: number;
    savingsRate: number;
    averageWindowSize: number;
    windowTimeMs: number;
}
/**
 * Request Merger Configuration
 */
export interface RequestMergerConfig {
    /** Enable request merging */
    enabled?: boolean;
    /** Time window for collecting requests (ms) */
    windowMs?: number;
    /** Maximum requests per window */
    maxWindowSize?: number;
    /** Enable adjacency merging (merge adjacent but non-overlapping ranges) */
    mergeAdjacent?: boolean;
}
/**
 * Request Merger Service
 *
 * Reduces API calls by merging overlapping read requests into single calls.
 *
 * Example:
 * - Request 1: Sheet1!A1:C10
 * - Request 2: Sheet1!B5:D15
 * - Merged:    Sheet1!A1:D15 (single API call)
 * - Split responses back to individual requesters
 */
export declare class RequestMerger {
    private enabled;
    private windowMs;
    private maxWindowSize;
    private mergeAdjacent;
    private pendingGroups;
    private stats;
    constructor(config?: RequestMergerConfig);
    /**
     * Queue a read request for potential merging
     *
     * @param sheetsApi Google Sheets API client
     * @param spreadsheetId Spreadsheet ID
     * @param range A1 notation range
     * @param options Read options
     * @returns Promise resolving to ValueRange
     */
    mergeRead(sheetsApi: sheets_v4.Sheets, spreadsheetId: string, range: string, options?: ReadOptions): Promise<sheets_v4.Schema$ValueRange>;
    /**
     * Flush a request group - merge and execute
     */
    private flushGroup;
    /**
     * Group requests by sheet name and options
     */
    private groupRequestsBySheet;
    /**
     * Process a group of requests for the same sheet
     */
    private processSheetGroup;
    /**
     * Find groups of overlapping/adjacent ranges to merge
     */
    private findMergeableGroups;
    /**
     * Check if two ranges should be merged
     */
    private shouldMerge;
    /**
     * Execute a merged request and split response
     */
    private executeMergedRequest;
    /**
     * Get merger statistics
     */
    getStats(): MergerStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Clean up resources
     */
    destroy(): void;
}
/**
 * Parse A1 notation to structured range info
 *
 * Handles formats:
 * - A1
 * - A1:B10
 * - Sheet1!A1:B10
 * - 'Sheet Name'!A1:B10
 * - A:A (entire column)
 * - 1:1 (entire row)
 */
export declare function parseA1Range(range: string): RangeInfo;
/**
 * Check if two ranges overlap
 */
export declare function rangesOverlap(range1: RangeInfo, range2: RangeInfo): boolean;
/**
 * Check if two ranges overlap or are adjacent
 */
export declare function rangesOverlapOrAdjacent(range1: RangeInfo, range2: RangeInfo): boolean;
/**
 * Merge multiple ranges into minimal bounding box
 */
export declare function mergeRanges(ranges: RangeInfo[]): RangeInfo;
/**
 * Format RangeInfo as A1 notation
 */
export declare function formatA1Range(range: RangeInfo): string;
/**
 * Split merged response back to individual range
 */
export declare function splitResponse(mergedData: sheets_v4.Schema$ValueRange, mergedRange: RangeInfo, targetRange: RangeInfo): sheets_v4.Schema$ValueRange;
//# sourceMappingURL=request-merger.d.ts.map