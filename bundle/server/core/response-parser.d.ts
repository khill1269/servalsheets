/**
 * ServalSheets - Response Parser
 *
 * Phase 2.2: Parse Google Sheets API Response Metadata
 * Extracts structured metadata from Google API responses to eliminate
 * the compensatory diff pattern (before/after state captures).
 *
 * Key Benefit:
 * - OLD: 3 API calls per mutation (before capture, mutate, after capture)
 * - NEW: 1 API call per mutation (mutate with metadata extraction)
 *
 * Google Sheets API Response Structure:
 * {
 *   spreadsheetId: string;
 *   replies: [
 *     { addSheet: { properties: {...} } },
 *     { findReplace: { occurrencesChanged: 42 } },
 *     {} // Empty object for operations without specific response data
 *   ];
 *   updatedSpreadsheet: { ... } // Optional, controlled by fields mask
 * }
 *
 * IMPORTANT: Many batchUpdate operations don't return specific response data.
 * The googleapis Schema$Response interface only includes properties for operations
 * that return meaningful data. Operations without response properties return
 * empty objects in the replies array.
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Parsed metadata from a single response reply
 */
export interface ParsedReplyMetadata {
    /** Type of request that generated this reply */
    requestType: string;
    /** Success status */
    success: boolean;
    /** Number of cells affected (best estimate) */
    cellsAffected?: number;
    /** Number of rows affected */
    rowsAffected?: number;
    /** Number of columns affected */
    columnsAffected?: number;
    /** IDs of created/modified objects */
    objectIds?: {
        sheetId?: number;
        chartId?: number;
        filterViewId?: number;
        protectedRangeId?: number;
        namedRangeId?: string;
        slicerId?: number;
        bandingId?: number;
        dimensionGroupDepth?: number;
    };
    /** Descriptive summary of the change */
    summary?: string;
}
/**
 * Aggregated metadata from entire batchUpdate response
 */
export interface ParsedResponseMetadata {
    spreadsheetId: string;
    totalCellsAffected: number;
    totalRowsAffected: number;
    totalColumnsAffected: number;
    replies: ParsedReplyMetadata[];
    summary: string;
}
/**
 * Response Parser
 *
 * Parses Google Sheets API v4 batchUpdate responses to extract structured metadata.
 * This enables elimination of the compensatory diff pattern by providing enough
 * information about what changed without needing before/after state captures.
 *
 * Only parses operations that have specific response types in Schema$Response.
 * Operations without specific responses (e.g., updateSheetProperties, updateCells)
 * return generic success metadata.
 */
export declare class ResponseParser {
    /**
     * Parse a batchUpdate response and extract aggregated metadata
     */
    static parseBatchUpdateResponse(response: sheets_v4.Schema$BatchUpdateSpreadsheetResponse): ParsedResponseMetadata;
    /**
     * Parse a single reply and extract metadata
     *
     * Only handles operations that have specific response properties in Schema$Response.
     * All other operations are treated as generic successful operations.
     */
    private static parseReply;
    /**
     * Determine request type from reply structure
     *
     * Note: Only properties with actual response data appear in Schema$Response.
     * Empty replies (for operations without response data) will return 'unknown'.
     */
    private static getRequestType;
    /**
     * Generate a human-readable summary of all changes
     */
    private static generateSummary;
    private static parseAddSheetReply;
    private static parseDuplicateSheetReply;
    private static parseFindReplaceReply;
    private static parseTrimWhitespaceReply;
    private static parseDeleteDuplicatesReply;
    private static parseUpdateConditionalFormatRuleReply;
    private static parseDeleteConditionalFormatRuleReply;
    private static parseAddFilterViewReply;
    private static parseDuplicateFilterViewReply;
    private static parseAddChartReply;
    private static parseAddSlicerReply;
    private static parseAddNamedRangeReply;
    private static parseAddProtectedRangeReply;
    private static parseCreateDeveloperMetadataReply;
    private static parseUpdateDeveloperMetadataReply;
    private static parseDeleteDeveloperMetadataReply;
    private static parseAddBandingReply;
    private static parseAddDimensionGroupReply;
    private static parseDeleteDimensionGroupReply;
}
//# sourceMappingURL=response-parser.d.ts.map