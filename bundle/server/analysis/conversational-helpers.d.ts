/**
 * Conversational Analysis Helpers - Natural Language Query
 *
 * Enables natural language queries over spreadsheet data using MCP Sampling.
 * Supports multi-turn conversations, context awareness, and intelligent query parsing.
 *
 * Examples:
 * - "What was Q4 revenue by region?"
 * - "Show me the top 5 customers by sales"
 * - "Are there any anomalies in the expense data?"
 * - "Compare this month's metrics to last month"
 *
 * Part of Ultimate Analysis Tool - Natural Language Query capability
 */
import type { SamplingMessage } from '../mcp/sampling.js';
import type { ColumnSchema } from './structure-helpers.js';
export interface ConversationContext {
    spreadsheetId: string;
    sheetName: string;
    schema: ColumnSchema[];
    previousQueries: Array<{
        query: string;
        response: string;
        timestamp: number;
    }>;
    dataSnapshot?: {
        sampleRows: unknown[][];
        rowCount: number;
        columnCount: number;
    };
}
export interface QueryIntent {
    type: 'AGGREGATE' | 'FILTER' | 'COMPARE' | 'TREND' | 'ANOMALY' | 'TOP_N' | 'PIVOT' | 'SEARCH' | 'EXPLAIN';
    confidence: number;
    entities: {
        columns: string[];
        values: string[];
        operations: string[];
        timeframes?: string[];
    };
}
export interface QueryResult {
    success: boolean;
    query: string;
    intent: QueryIntent;
    answer: string;
    data?: {
        headers: string[];
        rows: unknown[][];
    };
    visualizationSuggestion?: {
        chartType: string;
        reasoning: string;
    };
    followUpQuestions: string[];
    executionTime: number;
}
/**
 * Detect the intent of a natural language query
 */
export declare function detectQueryIntent(query: string, schema: ColumnSchema[]): QueryIntent;
/**
 * Build an MCP Sampling request for natural language query
 */
export declare function buildNLQuerySamplingRequest(query: string, context: ConversationContext): {
    messages: SamplingMessage[];
    systemPrompt: string;
    maxTokens: number;
};
/**
 * Add query to conversation context
 */
export declare function addToConversationHistory(context: ConversationContext, query: string, response: string): ConversationContext;
/**
 * Check if query references previous conversation
 */
export declare function referencesHistory(query: string): boolean;
/**
 * Resolve references to previous queries
 */
export declare function resolveHistoryReferences(query: string, context: ConversationContext): string;
/**
 * Validate if query can be answered with available data
 */
export declare function validateQuery(query: string, context: ConversationContext): {
    valid: boolean;
    reason?: string;
};
/**
 * Generate quick insights from data for conversational context
 */
export declare function generateQuickInsights(data: unknown[][], schema: ColumnSchema[]): string[];
//# sourceMappingURL=conversational-helpers.d.ts.map