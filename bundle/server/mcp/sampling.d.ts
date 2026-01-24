/**
 * ServalSheets - SEP-1577 Sampling Support
 *
 * Enables server-to-client LLM requests for intelligent spreadsheet operations.
 * The server can request the client's LLM to analyze data, generate formulas,
 * and perform agentic tasks with tool support.
 *
 * @module mcp/sampling
 * @see https://spec.modelcontextprotocol.io/specification/2025-11-25/client/sampling/
 */
import type { ClientCapabilities, CreateMessageRequest, CreateMessageResult, SamplingMessage, Tool, ModelPreferences } from '@modelcontextprotocol/sdk/types.js';
/**
 * Sampling capability check result
 */
export interface SamplingSupport {
    /** Whether client supports basic sampling */
    supported: boolean;
    /** Whether client supports tool use in sampling (SEP-1577) */
    hasTools: boolean;
    /** Whether client supports context inclusion */
    hasContext: boolean;
}
/**
 * Options for data analysis requests
 */
export interface AnalyzeDataOptions {
    /** System prompt for the analysis */
    systemPrompt?: string;
    /** Maximum tokens for response */
    maxTokens?: number;
    /** Model preferences */
    modelPreferences?: ModelPreferences;
    /** Temperature for creativity (0-1) */
    temperature?: number;
}
/**
 * Options for formula generation
 */
export interface GenerateFormulaOptions {
    /** Include explanation with formula */
    includeExplanation?: boolean;
    /** Maximum tokens */
    maxTokens?: number;
    /** Preferred formula style */
    style?: 'concise' | 'readable' | 'optimized';
}
/**
 * Result from agentic operations
 */
export interface AgenticResult {
    /** Number of actions taken */
    actionsCount: number;
    /** Description of what was done */
    description: string;
    /** Detailed log of actions */
    actions: Array<{
        type: string;
        target: string;
        details: string;
    }>;
    /** Whether the operation completed successfully */
    success: boolean;
}
/**
 * Server interface for sampling (subset of Server methods we need)
 */
export interface SamplingServer {
    getClientCapabilities(): ClientCapabilities | undefined;
    createMessage(params: CreateMessageRequest['params']): Promise<CreateMessageResult>;
}
/**
 * Check if the client supports sampling and its sub-features
 */
export declare function checkSamplingSupport(clientCapabilities: ClientCapabilities | undefined): SamplingSupport;
/**
 * Assert that sampling is supported, throw if not
 */
export declare function assertSamplingSupport(clientCapabilities: ClientCapabilities | undefined): void;
/**
 * Assert that sampling with tools is supported
 */
export declare function assertSamplingToolsSupport(clientCapabilities: ClientCapabilities | undefined): void;
/**
 * Extract text content from sampling result
 */
export declare function extractTextFromResult(result: CreateMessageResult): string;
/**
 * Create a user message for sampling
 */
export declare function createUserMessage(text: string): SamplingMessage;
/**
 * Create an assistant message for multi-turn conversations
 */
export declare function createAssistantMessage(text: string): SamplingMessage;
/**
 * Format spreadsheet data for LLM consumption
 */
export declare function formatDataForLLM(data: unknown[][], options?: {
    maxRows?: number;
    includeRowNumbers?: boolean;
    format?: 'json' | 'csv' | 'markdown';
}): string;
/**
 * System prompts for different use cases
 */
export declare const SAMPLING_PROMPTS: {
    dataAnalysis: string;
    formulaGeneration: string;
    dataCleaning: string;
    chartRecommendation: string;
    formulaExplanation: string;
};
/**
 * Analyze spreadsheet data using the client's LLM
 *
 * @example
 * ```typescript
 * const insights = await analyzeData(server, {
 *   data: [['Product', 'Sales'], ['A', 100], ['B', 200]],
 *   question: 'Which product is performing best?'
 * });
 * ```
 */
export declare function analyzeData(server: SamplingServer, params: {
    data: unknown[][];
    question: string;
    context?: string;
}, options?: AnalyzeDataOptions): Promise<string>;
/**
 * Generate a Google Sheets formula from natural language
 *
 * @example
 * ```typescript
 * const formula = await generateFormula(server, {
 *   description: 'Sum all values in column B where column A equals "Active"',
 *   headers: ['Status', 'Amount', 'Date']
 * });
 * // Returns: =SUMIF(A:A,"Active",B:B)
 * ```
 */
export declare function generateFormula(server: SamplingServer, params: {
    description: string;
    headers?: string[];
    sampleData?: unknown[][];
    existingFormulas?: string[];
}, options?: GenerateFormulaOptions): Promise<string>;
/**
 * Get chart type recommendation for data
 */
export declare function recommendChart(server: SamplingServer, params: {
    data: unknown[][];
    purpose?: string;
    audience?: string;
}): Promise<{
    chartType: string;
    reason: string;
    alternatives: string[];
}>;
/**
 * Explain a complex formula
 */
export declare function explainFormula(server: SamplingServer, formula: string, options?: {
    detailed?: boolean;
}): Promise<string>;
/**
 * Identify data quality issues
 */
export declare function identifyDataIssues(server: SamplingServer, params: {
    data: unknown[][];
    columnTypes?: Record<string, string>;
}): Promise<Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    location: string;
    description: string;
    suggestedFix: string;
}>>;
/**
 * Tools available for agentic data operations
 */
export declare const AGENTIC_TOOLS: Tool[];
/**
 * Check if client supports agentic operations (sampling with tools)
 */
export declare function supportsAgenticOperations(clientCapabilities: ClientCapabilities | undefined): boolean;
/**
 * Create agentic sampling request parameters
 */
export declare function createAgenticRequest(task: string, context: string, tools?: Tool[]): CreateMessageRequest['params'];
/**
 * Progress callback for streaming operations
 */
export type StreamingProgressCallback = (event: {
    phase: 'preparing' | 'sending' | 'receiving' | 'processing' | 'complete';
    progress?: number;
    total?: number;
    partialResult?: string;
    message?: string;
}) => void;
/**
 * Options for streaming sampling operations
 */
export interface StreamingSamplingOptions extends AnalyzeDataOptions {
    /** Callback for progress updates */
    onProgress?: StreamingProgressCallback;
    /** Chunk size for processing large datasets */
    chunkSize?: number;
    /** Maximum concurrent chunks */
    maxConcurrency?: number;
}
/**
 * Chunked result for large dataset analysis
 */
export interface ChunkedAnalysisResult {
    /** Results for each chunk */
    chunks: Array<{
        chunkIndex: number;
        startRow: number;
        endRow: number;
        analysis: string;
    }>;
    /** Aggregated summary across all chunks */
    summary: string;
    /** Total rows analyzed */
    totalRows: number;
    /** Processing time in ms */
    processingTime: number;
}
/**
 * Analyze large datasets in chunks with streaming progress
 *
 * For datasets larger than the chunk size, this function:
 * 1. Splits data into manageable chunks
 * 2. Analyzes each chunk with progress reporting
 * 3. Aggregates results into a summary
 *
 * @example
 * ```typescript
 * const result = await analyzeDataStreaming(server, {
 *   data: largeDataset, // 10,000 rows
 *   question: 'What are the sales trends?'
 * }, {
 *   chunkSize: 500,
 *   onProgress: (event) => console.log(`${event.phase}: ${event.progress}/${event.total}`)
 * });
 * ```
 */
export declare function analyzeDataStreaming(server: SamplingServer, params: {
    data: unknown[][];
    question: string;
    context?: string;
}, options?: StreamingSamplingOptions): Promise<ChunkedAnalysisResult>;
/**
 * Stream tool results incrementally for agentic operations
 *
 * This function allows processing tool results as they arrive,
 * rather than waiting for the complete response.
 */
export declare function streamAgenticOperation(server: SamplingServer, task: string, context: string, toolHandler: (toolName: string, args: Record<string, unknown>) => Promise<{
    result: unknown;
    continue: boolean;
}>): AsyncGenerator<{
    type: 'tool_call' | 'tool_result' | 'text' | 'complete';
    data: unknown;
}, AgenticResult, undefined>;
export type { CreateMessageRequest, CreateMessageResult, SamplingMessage, Tool, ModelPreferences };
//# sourceMappingURL=sampling.d.ts.map