/**
 * SamplingAnalysisService
 *
 * @purpose Leverages MCP Sampling (SEP-1577) for AI-powered data analysis instead of custom ML; LLM analyzes patterns, outliers, insights
 * @category Core
 * @usage Use for sheets_analyze tool; sends data samples to LLM via Sampling API, receives structured analysis (trends, recommendations)
 * @dependencies MCP SDK (Sampling capability), logger
 * @stateful No - stateless analysis service; each request is independent
 * @singleton No - can be instantiated per analysis request
 *
 * @example
 * const service = new SamplingAnalysisService(mcpClient);
 * const analysis = await service.analyze({ type: 'pattern_detection', data: values, prompt: 'Find sales trends' });
 * // { patterns: [...], insights: [...], recommendations: [...], confidence: 0.92 }
 */
/**
 * Analysis type options
 */
export type AnalysisType = 'summary' | 'patterns' | 'anomalies' | 'trends' | 'quality' | 'correlations' | 'recommendations';
/**
 * Request for AI-powered analysis
 */
export interface AnalysisRequest {
    /** Spreadsheet ID */
    spreadsheetId: string;
    /** Sheet name (optional) */
    sheetName?: string;
    /** Range in A1 notation (optional) */
    range?: string;
    /** Types of analysis to perform */
    analysisTypes: AnalysisType[];
    /** Additional context for the analysis */
    context?: string;
    /** Maximum tokens for response */
    maxTokens?: number;
}
/**
 * Sampling message for MCP
 */
export interface SamplingMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text';
        text: string;
    };
}
/**
 * Sampling request parameters
 */
export interface SamplingRequest {
    messages: SamplingMessage[];
    systemPrompt?: string;
    modelPreferences?: {
        hints?: Array<{
            name: string;
        }>;
        intelligencePriority?: number;
        speedPriority?: number;
    };
    maxTokens: number;
    includeContext?: 'none' | 'thisServer' | 'allServers';
}
/**
 * Build a sampling request for data analysis
 */
export declare function buildAnalysisSamplingRequest(data: unknown[][], request: AnalysisRequest): SamplingRequest;
/**
 * Build a sampling request for formula generation
 */
export declare function buildFormulaSamplingRequest(description: string, context: {
    headers?: string[];
    sampleData?: unknown[][];
    targetCell?: string;
    sheetName?: string;
}): SamplingRequest;
/**
 * Build a sampling request for chart recommendations
 */
export declare function buildChartSamplingRequest(data: unknown[][], context: {
    goal?: string;
    dataDescription?: string;
    preferredTypes?: string[];
}): SamplingRequest;
/**
 * Parse sampling response into structured analysis result
 */
export declare function parseAnalysisResponse(responseText: string): {
    success: boolean;
    result?: {
        summary: string;
        analyses: Array<{
            type: string;
            confidence: string;
            findings: string[];
            details: string;
            affectedCells?: string[];
            recommendations?: string[];
        }>;
        overallQualityScore: number;
        topInsights: string[];
    };
    error?: string;
};
/**
 * Statistics for sampling analysis
 */
export interface SamplingAnalysisStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
    requestsByType: Record<AnalysisType, number>;
}
/**
 * Sampling Analysis Service
 *
 * Manages AI-powered analysis via MCP Sampling.
 * This service builds requests but does NOT execute them -
 * the handler uses the MCP client's sampling capability.
 */
declare class SamplingAnalysisService {
    private stats;
    private responseTimes;
    private readonly maxResponseTimeHistory;
    /**
     * Record a successful request
     */
    recordSuccess(analysisTypes: AnalysisType[], responseTime: number): void;
    /**
     * Record a failed request
     */
    recordFailure(analysisTypes: AnalysisType[]): void;
    /**
     * Record response time
     */
    private recordResponseTime;
    /**
     * Update success rate
     */
    private updateSuccessRate;
    /**
     * Get statistics
     */
    getStats(): SamplingAnalysisStats;
    /**
     * Reset statistics (for testing)
     */
    resetStats(): void;
}
/**
 * Get the sampling analysis service instance
 */
export declare function getSamplingAnalysisService(): SamplingAnalysisService;
/**
 * Reset the sampling analysis service (for testing only)
 * @internal
 */
export declare function resetSamplingAnalysisService(): void;
export {};
//# sourceMappingURL=sampling-analysis.d.ts.map