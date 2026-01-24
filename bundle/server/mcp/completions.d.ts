/**
 * ServalSheets - Completions Support
 *
 * Implements MCP completions capability for argument autocompletion.
 * Provides suggestions for spreadsheet IDs, sheet names, and action names.
 *
 * MCP Protocol: 2025-11-25
 */
import type { CompleteResult } from '@modelcontextprotocol/sdk/types.js';
/**
 * Action names for each tool (for autocompletion)
 *
 * IMPORTANT: These must match the z.literal('action') values in the schema files.
 * Source of truth: src/schemas/*.ts
 * Total: 241 actions across 19 tools (Tier 7: templates, bigquery, appsscript)
 */
export declare const TOOL_ACTIONS: Record<string, string[]>;
/**
 * Chart types for autocompletion
 */
export declare const CHART_TYPES: string[];
/**
 * Number format types for autocompletion
 */
export declare const NUMBER_FORMAT_TYPES: string[];
/**
 * Condition types for validation and conditional formatting
 */
export declare const CONDITION_TYPES: string[];
/**
 * Formatting presets for autocompletion
 */
export declare const FORMAT_PRESETS: string[];
/**
 * Permission roles for autocompletion
 */
export declare const PERMISSION_ROLES: string[];
/**
 * Visibility options for autocompletion
 */
export declare const VISIBILITY_OPTIONS: string[];
/**
 * Recent spreadsheet cache for completions
 * In production, this would be populated from user's recent activity
 */
declare class SpreadsheetCache {
    private recentIds;
    private maxSize;
    add(spreadsheetId: string, title: string): void;
    getCompletions(partial: string): string[];
}
export declare const spreadsheetCache: SpreadsheetCache;
/**
 * Complete action names for a tool
 */
export declare function completeAction(toolName: string, partial: string): string[];
/**
 * Complete spreadsheet IDs from cache
 */
export declare function completeSpreadsheetId(partial: string): string[];
/**
 * Complete A1-style ranges
 */
export declare function completeRange(partial: string): string[];
/**
 * Extract spreadsheetId from an input payload
 */
export declare function extractSpreadsheetId(input: unknown): string | null;
/**
 * Record spreadsheet ID usage for completions
 */
export declare function recordSpreadsheetId(input: unknown): void;
/**
 * Complete chart types
 */
export declare function completeChartType(partial: string): string[];
/**
 * Complete number format types
 */
export declare function completeNumberFormatType(partial: string): string[];
/**
 * Complete condition types
 */
export declare function completeConditionType(partial: string): string[];
/**
 * Complete format presets
 */
export declare function completeFormatPreset(partial: string): string[];
/**
 * Complete permission roles
 */
export declare function completePermissionRole(partial: string): string[];
/**
 * Create a completion result
 */
export declare function createCompletionResult(values: string[]): CompleteResult;
/**
 * Empty completion result
 */
export declare const EMPTY_COMPLETION: CompleteResult;
export {};
//# sourceMappingURL=completions.d.ts.map