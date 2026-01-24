/**
 * ServalSheets - Analyze Handler
 *
 * AI-powered data analysis using MCP Sampling (SEP-1577).
 * Instead of implementing custom ML/statistics, we leverage the LLM
 * via the Sampling capability for intelligent analysis.
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Sampling section
 * @see MCP_SEP_SPECIFICATIONS_COMPLETE.md - SEP-1577
 */
import type { sheets_v4 } from 'googleapis';
import { type HandlerContext } from './base.js';
import type { SheetsAnalyzeInput, SheetsAnalyzeOutput } from '../schemas/analyze.js';
export interface AnalyzeHandlerOptions {
    context: HandlerContext;
}
/**
 * Analyze Handler
 *
 * Uses MCP Sampling to provide AI-powered data analysis.
 */
export declare class AnalyzeHandler {
    private context;
    private sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, _options?: AnalyzeHandlerOptions);
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    private convertRangeInput;
    /**
     * Resolve range to A1 notation
     */
    private resolveRange;
    private getSheetNameFromRange;
    private resolveSheetId;
    /**
     * Read data from spreadsheet
     */
    private readData;
    /**
     * Check if client supports MCP Sampling capability
     * @returns null if sampling is available, error response if not
     */
    private checkSamplingCapability;
    /**
     * Handle analysis requests
     */
    handle(input: SheetsAnalyzeInput): Promise<SheetsAnalyzeOutput>;
    /**
     * Check if comprehensive analysis should use task-based execution
     * Based on estimated execution time (>10s for large spreadsheets)
     */
    private shouldUseTaskForComprehensive;
    /**
     * Run comprehensive analysis as a background task
     */
    private runComprehensiveAnalysisTask;
}
//# sourceMappingURL=analyze.d.ts.map