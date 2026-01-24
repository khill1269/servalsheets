/**
 * Response Enhancer - Quick Win #1
 *
 * Generates intelligent suggestions, cost estimates, and metadata
 * for tool responses to improve LLM decision-making.
 */
import type { ToolSuggestion, CostEstimate, ResponseMeta } from '../schemas/shared.js';
/**
 * Context for generating response enhancements
 */
export interface EnhancementContext {
    tool: string;
    action: string;
    input: Record<string, unknown>;
    result?: Record<string, unknown>;
    cellsAffected?: number;
    apiCallsMade?: number;
    duration?: number;
}
/**
 * Generate suggestions based on the tool and action
 */
export declare function generateSuggestions(context: EnhancementContext): ToolSuggestion[];
/**
 * Estimate cost of an operation
 */
export declare function estimateCost(context: EnhancementContext): CostEstimate;
/**
 * Get related tools for a given tool and action
 */
export declare function getRelatedTools(tool: string, action: string): string[];
/**
 * Generate complete response metadata
 */
export declare function enhanceResponse(context: EnhancementContext): ResponseMeta;
//# sourceMappingURL=response-enhancer.d.ts.map