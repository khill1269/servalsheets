/**
 * ServalSheets - Streaming Analysis
 *
 * Task-based chunked processing for large datasets (>50K rows).
 * Implements AsyncGenerator pattern with progress tracking and cancellation support.
 */
import type { sheets_v4 } from 'googleapis';
import type { TieredRetrieval, SheetMetadata } from './tiered-retrieval.js';
/**
 * Result from a single chunk of analysis
 */
export interface AnalysisChunk {
    chunkIndex: number;
    totalChunks: number;
    rowsProcessed: number;
    totalRows: number;
    partialResults: {
        trends: number;
        anomalies: number;
        correlations: number;
        nullCount: number;
        duplicateCount: number;
    };
}
/**
 * Aggregated results from all chunks
 */
export interface StreamingAnalysisResult {
    totalRowsProcessed: number;
    totalChunks: number;
    aggregatedResults: {
        trends: number;
        anomalies: number;
        correlations: number;
        nullCount: number;
        duplicateCount: number;
    };
    duration: number;
    samplingMethod: 'chunked';
}
/**
 * Streaming analyzer for large datasets
 * Uses AsyncGenerator to process data in chunks with progress tracking
 */
export declare class StreamingAnalyzer {
    private sheetsApi;
    private tieredRetrieval;
    private chunkSize;
    constructor(sheetsApi: sheets_v4.Sheets, tieredRetrieval: TieredRetrieval, chunkSize?: number);
    /**
     * Analyze a large dataset in chunks, yielding progress updates
     */
    analyzeInChunks(spreadsheetId: string, sheetId: number | undefined, metadata: SheetMetadata): AsyncGenerator<AnalysisChunk>;
    /**
     * Execute streaming analysis and aggregate results
     * (Non-generator wrapper for standard async/await usage)
     */
    execute(spreadsheetId: string, sheetId: number | undefined, metadata: SheetMetadata, onProgress?: (chunk: AnalysisChunk) => void | Promise<void>): Promise<StreamingAnalysisResult>;
    /**
     * Cancel streaming analysis (for task cancellation support)
     */
    cancel(): void;
}
//# sourceMappingURL=streaming.d.ts.map