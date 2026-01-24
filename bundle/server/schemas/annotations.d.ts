/**
 * ServalSheets - Tool Annotations
 *
 * MCP 2025-11-25 compliant tool annotations
 * Required for Claude Connectors Directory
 */
import type { ToolAnnotations } from './shared.js';
/**
 * All tool annotations with MCP compliance
 */
export declare const TOOL_ANNOTATIONS: Record<string, ToolAnnotations>;
/**
 * Action counts per tool
 */
export declare const ACTION_COUNTS: Record<string, number>;
/**
 * Tool metadata for MCP registration
 */
export interface ToolMetadata {
    name: string;
    description: string;
    annotations: ToolAnnotations;
    actionCount: number;
}
/**
 * Get all tool metadata for /info endpoint
 * Returns tool names, descriptions, annotations, and action counts
 */
export declare function getToolMetadata(): Record<string, unknown>[];
/**
 * Constants
 */
export declare const TOOL_COUNT: number;
export declare const ACTION_COUNT: number;
//# sourceMappingURL=annotations.d.ts.map