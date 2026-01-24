/**
 * ServalSheets - Request Builder
 *
 * Phase 2.1: Direct Google API Request Builders
 * Replaces the Intent abstraction with direct, type-safe request construction
 *
 * Benefits:
 * - Direct 1:1 mapping to Google Sheets API documentation
 * - Type safety via googleapis TypeScript definitions
 * - No abstraction layer between ServalSheets and Google API
 * - Easier to adopt new Google API features
 *
 * Architecture:
 * OLD: Handler → Intent → BatchCompiler → intentToRequest() → Google API
 * NEW: Handler → RequestBuilder → BatchCompiler → Google API
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Request metadata for safety rails and quota tracking
 */
export interface RequestMetadata {
    /** Source tool that created this request */
    sourceTool: string;
    /** Source action that created this request */
    sourceAction: string;
    /** Transaction ID for grouping related requests */
    transactionId?: string;
    /** Priority (higher = executed first in batch) */
    priority?: number;
    /** Whether this request is destructive (deletes data/structure) */
    destructive: boolean;
    /** Whether this request is high-risk (requires auto-snapshot) */
    highRisk: boolean;
    /** Estimated number of cells affected */
    estimatedCells?: number;
    /** Spreadsheet ID this request targets */
    spreadsheetId: string;
    /** Sheet ID this request targets (if applicable) */
    sheetId?: number;
    /** Range this request targets (if applicable) */
    range?: string;
}
/**
 * Wrapped request with metadata
 */
export interface WrappedRequest {
    request: sheets_v4.Schema$Request;
    metadata: RequestMetadata;
}
/**
 * Base options for all requests
 */
interface BaseRequestOptions {
    spreadsheetId: string;
    sourceTool: string;
    sourceAction: string;
    transactionId?: string;
    priority?: number;
}
/**
 * Request builder for Google Sheets API v4
 *
 * Provides type-safe, validated request construction for all Google API request types.
 * Each method returns a WrappedRequest with metadata for safety rails and quota tracking.
 */
export declare class RequestBuilder {
    /**
     * Create an updateCells request (for setting cell values, formatting, etc.)
     */
    static updateCells(options: BaseRequestOptions & {
        rows: sheets_v4.Schema$RowData[];
        range?: sheets_v4.Schema$GridRange;
        fields?: string;
    }): WrappedRequest;
    /**
     * Create a repeatCell request (for formatting ranges efficiently)
     */
    static repeatCell(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
        cell: sheets_v4.Schema$CellData;
        fields: string;
    }): WrappedRequest;
    /**
     * Create an addSheet request
     */
    static addSheet(options: BaseRequestOptions & {
        properties: sheets_v4.Schema$SheetProperties;
    }): WrappedRequest;
    /**
     * Create a deleteSheet request
     */
    static deleteSheet(options: BaseRequestOptions & {
        sheetId: number;
    }): WrappedRequest;
    /**
     * Create an updateSheetProperties request
     */
    static updateSheetProperties(options: BaseRequestOptions & {
        properties: sheets_v4.Schema$SheetProperties;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a duplicateSheet request
     */
    static duplicateSheet(options: BaseRequestOptions & {
        sourceSheetId: number;
        insertSheetIndex?: number;
        newSheetId?: number;
        newSheetName?: string;
    }): WrappedRequest;
    /**
     * Create an insertDimension request
     */
    static insertDimension(options: BaseRequestOptions & {
        range: sheets_v4.Schema$DimensionRange;
        inheritFromBefore?: boolean;
    }): WrappedRequest;
    /**
     * Create a deleteDimension request
     */
    static deleteDimension(options: BaseRequestOptions & {
        range: sheets_v4.Schema$DimensionRange;
    }): WrappedRequest;
    /**
     * Create a moveDimension request
     */
    static moveDimension(options: BaseRequestOptions & {
        source: sheets_v4.Schema$DimensionRange;
        destinationIndex: number;
    }): WrappedRequest;
    /**
     * Create an updateDimensionProperties request
     */
    static updateDimensionProperties(options: BaseRequestOptions & {
        range: sheets_v4.Schema$DimensionRange;
        properties: sheets_v4.Schema$DimensionProperties;
        fields: string;
    }): WrappedRequest;
    /**
     * Create an appendDimension request
     */
    static appendDimension(options: BaseRequestOptions & {
        sheetId: number;
        dimension: 'ROWS' | 'COLUMNS';
        length: number;
    }): WrappedRequest;
    /**
     * Create an autoResizeDimensions request
     */
    static autoResizeDimensions(options: BaseRequestOptions & {
        dimensions: sheets_v4.Schema$DimensionRange;
    }): WrappedRequest;
    /**
     * Create an updateBorders request
     */
    static updateBorders(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
        top?: sheets_v4.Schema$Border;
        bottom?: sheets_v4.Schema$Border;
        left?: sheets_v4.Schema$Border;
        right?: sheets_v4.Schema$Border;
        innerHorizontal?: sheets_v4.Schema$Border;
        innerVertical?: sheets_v4.Schema$Border;
    }): WrappedRequest;
    /**
     * Create a mergeCells request
     */
    static mergeCells(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
        mergeType: 'MERGE_ALL' | 'MERGE_COLUMNS' | 'MERGE_ROWS';
    }): WrappedRequest;
    /**
     * Create an unmergeCells request
     */
    static unmergeCells(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
    }): WrappedRequest;
    /**
     * Create a copyPaste request
     */
    static copyPaste(options: BaseRequestOptions & {
        source: sheets_v4.Schema$GridRange;
        destination: sheets_v4.Schema$GridRange;
        pasteType?: 'PASTE_NORMAL' | 'PASTE_VALUES' | 'PASTE_FORMAT' | 'PASTE_NO_BORDERS' | 'PASTE_FORMULA' | 'PASTE_DATA_VALIDATION' | 'PASTE_CONDITIONAL_FORMATTING';
        pasteOrientation?: 'NORMAL' | 'TRANSPOSE';
    }): WrappedRequest;
    /**
     * Create a cutPaste request
     */
    static cutPaste(options: BaseRequestOptions & {
        source: sheets_v4.Schema$GridRange;
        destination: sheets_v4.Schema$GridCoordinate;
        pasteType?: 'PASTE_NORMAL' | 'PASTE_VALUES' | 'PASTE_FORMAT' | 'PASTE_NO_BORDERS' | 'PASTE_FORMULA' | 'PASTE_DATA_VALIDATION' | 'PASTE_CONDITIONAL_FORMATTING';
    }): WrappedRequest;
    /**
     * Create a findReplace request
     */
    static findReplace(options: BaseRequestOptions & {
        find: string;
        replacement: string;
        range?: sheets_v4.Schema$GridRange;
        sheetId?: number;
        allSheets?: boolean;
        matchCase?: boolean;
        matchEntireCell?: boolean;
        searchByRegex?: boolean;
        includeFormulas?: boolean;
    }): WrappedRequest;
    /**
     * Create a setDataValidation request
     */
    static setDataValidation(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
        rule?: sheets_v4.Schema$DataValidationRule;
    }): WrappedRequest;
    /**
     * Create an addConditionalFormatRule request
     */
    static addConditionalFormatRule(options: BaseRequestOptions & {
        rule: sheets_v4.Schema$ConditionalFormatRule;
        index?: number;
    }): WrappedRequest;
    /**
     * Create an updateConditionalFormatRule request
     */
    static updateConditionalFormatRule(options: BaseRequestOptions & {
        index: number;
        sheetId: number;
        rule: sheets_v4.Schema$ConditionalFormatRule;
    }): WrappedRequest;
    /**
     * Create a deleteConditionalFormatRule request
     */
    static deleteConditionalFormatRule(options: BaseRequestOptions & {
        index: number;
        sheetId: number;
    }): WrappedRequest;
    /**
     * Create a sortRange request
     */
    static sortRange(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
        sortSpecs: sheets_v4.Schema$SortSpec[];
    }): WrappedRequest;
    /**
     * Create a setBasicFilter request
     */
    static setBasicFilter(options: BaseRequestOptions & {
        filter: sheets_v4.Schema$BasicFilter;
    }): WrappedRequest;
    /**
     * Create a clearBasicFilter request
     */
    static clearBasicFilter(options: BaseRequestOptions & {
        sheetId: number;
    }): WrappedRequest;
    /**
     * Create an addFilterView request
     */
    static addFilterView(options: BaseRequestOptions & {
        filter: sheets_v4.Schema$FilterView;
    }): WrappedRequest;
    /**
     * Create an updateFilterView request
     */
    static updateFilterView(options: BaseRequestOptions & {
        filter: sheets_v4.Schema$FilterView;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a deleteFilterView request
     */
    static deleteFilterView(options: BaseRequestOptions & {
        filterId: number;
    }): WrappedRequest;
    /**
     * Create an addChart request
     */
    static addChart(options: BaseRequestOptions & {
        chart: sheets_v4.Schema$EmbeddedChart;
    }): WrappedRequest;
    /**
     * Create an updateChartSpec request
     */
    static updateChartSpec(options: BaseRequestOptions & {
        chartId: number;
        spec: sheets_v4.Schema$ChartSpec;
    }): WrappedRequest;
    /**
     * Create a deleteEmbeddedObject request (for charts, slicers)
     */
    static deleteEmbeddedObject(options: BaseRequestOptions & {
        objectId: number;
    }): WrappedRequest;
    /**
     * Create an addSlicer request
     */
    static addSlicer(options: BaseRequestOptions & {
        slicer: sheets_v4.Schema$Slicer;
    }): WrappedRequest;
    /**
     * Create an updateSlicerSpec request
     */
    static updateSlicerSpec(options: BaseRequestOptions & {
        slicerId: number;
        spec: sheets_v4.Schema$SlicerSpec;
        fields: string;
    }): WrappedRequest;
    /**
     * Create an addNamedRange request
     */
    static addNamedRange(options: BaseRequestOptions & {
        namedRange: sheets_v4.Schema$NamedRange;
    }): WrappedRequest;
    /**
     * Create an updateNamedRange request
     */
    static updateNamedRange(options: BaseRequestOptions & {
        namedRange: sheets_v4.Schema$NamedRange;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a deleteNamedRange request
     */
    static deleteNamedRange(options: BaseRequestOptions & {
        namedRangeId: string;
    }): WrappedRequest;
    /**
     * Create an addProtectedRange request
     */
    static addProtectedRange(options: BaseRequestOptions & {
        protectedRange: sheets_v4.Schema$ProtectedRange;
    }): WrappedRequest;
    /**
     * Create an updateProtectedRange request
     */
    static updateProtectedRange(options: BaseRequestOptions & {
        protectedRange: sheets_v4.Schema$ProtectedRange;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a deleteProtectedRange request
     */
    static deleteProtectedRange(options: BaseRequestOptions & {
        protectedRangeId: number;
    }): WrappedRequest;
    /**
     * Create a createDeveloperMetadata request
     */
    static createDeveloperMetadata(options: BaseRequestOptions & {
        developerMetadata: sheets_v4.Schema$DeveloperMetadata;
    }): WrappedRequest;
    /**
     * Create an updateDeveloperMetadata request
     */
    static updateDeveloperMetadata(options: BaseRequestOptions & {
        dataFilters: sheets_v4.Schema$DataFilter[];
        developerMetadata: sheets_v4.Schema$DeveloperMetadata;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a deleteDeveloperMetadata request
     */
    static deleteDeveloperMetadata(options: BaseRequestOptions & {
        dataFilter: sheets_v4.Schema$DataFilter;
    }): WrappedRequest;
    /**
     * Create an addBanding request
     */
    static addBanding(options: BaseRequestOptions & {
        bandedRange: sheets_v4.Schema$BandedRange;
    }): WrappedRequest;
    /**
     * Create an updateBanding request
     */
    static updateBanding(options: BaseRequestOptions & {
        bandedRange: sheets_v4.Schema$BandedRange;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a deleteBanding request
     */
    static deleteBanding(options: BaseRequestOptions & {
        bandedRangeId: number;
    }): WrappedRequest;
    /**
     * Create an addDimensionGroup request
     */
    static addDimensionGroup(options: BaseRequestOptions & {
        range: sheets_v4.Schema$DimensionRange;
    }): WrappedRequest;
    /**
     * Create a deleteDimensionGroup request
     */
    static deleteDimensionGroup(options: BaseRequestOptions & {
        range: sheets_v4.Schema$DimensionRange;
    }): WrappedRequest;
    /**
     * Create an updateDimensionGroup request
     */
    static updateDimensionGroup(options: BaseRequestOptions & {
        dimensionGroup: sheets_v4.Schema$DimensionGroup;
        fields: string;
    }): WrappedRequest;
    /**
     * Create a trimWhitespace request
     */
    static trimWhitespace(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
    }): WrappedRequest;
    /**
     * Create a randomizeRange request
     */
    static randomizeRange(options: BaseRequestOptions & {
        range: sheets_v4.Schema$GridRange;
    }): WrappedRequest;
    /**
     * Create a textToColumns request
     */
    static textToColumns(options: BaseRequestOptions & {
        source: sheets_v4.Schema$GridRange;
        delimiterType?: string;
        delimiter?: string;
    }): WrappedRequest;
    /**
     * Create an autoFill request
     */
    static autoFill(options: BaseRequestOptions & {
        range?: sheets_v4.Schema$GridRange;
        sourceAndDestination?: sheets_v4.Schema$SourceAndDestination;
        useAlternateSeries?: boolean;
    }): WrappedRequest;
}
export {};
//# sourceMappingURL=request-builder.d.ts.map