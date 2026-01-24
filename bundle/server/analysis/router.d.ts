/**
 * ServalSheets - Analysis Router
 *
 * Decision engine for selecting optimal analysis execution path:
 * - Fast path: Traditional statistics for <10K rows (0.5-2s)
 * - AI path: LLM-powered insights via MCP Sampling (3-15s)
 * - Streaming path: Task-enabled chunked processing for >50K rows (async)
 *
 * The router optimizes for latency, cost, and accuracy based on:
 * - Data size (cell count, row count)
 * - User preferences (useAI flag)
 * - Action complexity
 * - Available capabilities (sampling, tasks)
 */
import type { SheetsAnalyzeInput } from '../schemas/analyze.js';
/**
 * Sheet metadata for routing decisions
 */
export interface SheetMetadata {
    spreadsheetId: string;
    title: string;
    sheets: Array<{
        sheetId: number;
        title: string;
        rowCount: number;
        columnCount: number;
    }>;
}
/**
 * Routing decision result
 */
export interface RoutingDecision {
    path: 'fast' | 'ai' | 'streaming';
    reason: string;
    estimatedDuration: number;
    cacheable: boolean;
    requiresSampling: boolean;
    requiresTasks: boolean;
}
/**
 * Router capabilities (from handler context)
 */
export interface RouterCapabilities {
    hasSampling: boolean;
    hasTasks: boolean;
}
/**
 * Analysis Router
 *
 * Makes intelligent routing decisions based on request characteristics
 * and available infrastructure capabilities.
 */
export declare class AnalysisRouter {
    private capabilities;
    constructor(capabilities: RouterCapabilities);
    /**
     * Route an analysis request to the optimal execution path
     */
    route(request: SheetsAnalyzeInput, metadata: SheetMetadata): RoutingDecision;
    /**
     * Route analyze_data action
     * - Small datasets (<10K cells): fast path with traditional stats
     * - Medium datasets (10K-50K): AI path for insights
     * - Large datasets (>50K): streaming path
     */
    private routeAnalyzeData;
    /**
     * Route suggest_visualization action
     * Always uses AI for intelligent chart/pivot recommendations
     */
    private routeSuggestVisualization;
    /**
     * Route generate_formula action
     * Always uses AI for natural language → formula conversion
     */
    private routeGenerateFormula;
    /**
     * Route detect_patterns action
     * - Small datasets: fast path with traditional correlation analysis
     * - Large datasets: AI path for enhanced pattern detection
     */
    private routeDetectPatterns;
    /**
     * Route analyze_structure action
     * Fast path - structure analysis is metadata-heavy, not compute-heavy
     */
    private routeAnalyzeStructure;
    /**
     * Route analyze_quality action
     * - Small datasets: fast path
     * - Large datasets with AI: AI path for issue identification
     */
    private routeAnalyzeQuality;
    /**
     * Route analyze_performance action
     * Fast path - performance analysis is structural, not data-heavy
     */
    private routeAnalyzePerformance;
    /**
     * Route create actions
     * Fast path - creation is API calls, not analysis
     */
    private routeCreateAction;
    /**
     * Route explain_analysis action
     * Always uses AI for conversational explanations
     */
    private routeExplainAnalysis;
    /**
     * Find the target sheet for analysis
     */
    private findTargetSheet;
    /**
     * Check if request asks for deep insights
     */
    private requestsDeepInsights;
    /**
     * Estimate fast path duration based on cell count
     */
    private estimateFastDuration;
    /**
     * Estimate AI path duration based on cell count
     */
    private estimateAIDuration;
}
/**
 * Create router with capabilities from handler context
 */
export declare function createRouter(capabilities: RouterCapabilities): AnalysisRouter;
//# sourceMappingURL=router.d.ts.map