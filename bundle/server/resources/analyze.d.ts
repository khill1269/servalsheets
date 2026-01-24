/**
 * ServalSheets - Analyze Resources
 *
 * Exposes AI analysis capabilities as MCP resources for discovery and reference.
 * Uses MCP Sampling (SEP-1577) for AI-powered analysis.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnalyzeResponse } from '../schemas/analyze.js';
/**
 * In-memory store for analysis results
 * P1: Enable MCP Resources for analysis result referencing
 */
interface StoredAnalysisResult {
    id: string;
    spreadsheetId: string;
    timestamp: number;
    result: AnalyzeResponse;
    summary: string;
}
/**
 * Store an analysis result for later retrieval via MCP Resources
 * Returns the analysis ID for referencing
 */
export declare function storeAnalysisResult(spreadsheetId: string, result: AnalyzeResponse): string;
/**
 * Get a stored analysis result by ID
 */
export declare function getAnalysisResult(id: string): StoredAnalysisResult | undefined;
/**
 * List all stored analysis results
 */
export declare function listAnalysisResults(): StoredAnalysisResult[];
/**
 * Register analyze resources with the MCP server
 */
export declare function registerAnalyzeResources(server: McpServer): number;
export {};
//# sourceMappingURL=analyze.d.ts.map