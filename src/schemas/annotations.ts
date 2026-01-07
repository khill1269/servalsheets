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
export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  sheets_auth: {
    title: 'Authentication',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_spreadsheet: {
    title: 'Spreadsheet Operations',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_sheet: {
    title: 'Sheet/Tab Operations',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete sheets
    idempotentHint: false,  // delete without allowMissing fails on repeat; add/duplicate create new sheets
    openWorldHint: true,
  },
  sheets_values: {
    title: 'Cell Values',
    readOnlyHint: false,
    destructiveHint: true,  // Can overwrite data
    idempotentHint: false,  // Append is not idempotent
    openWorldHint: true,
  },
  sheets_cells: {
    title: 'Cell Operations',
    readOnlyHint: false,
    destructiveHint: true,  // Can clear notes/validation
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_format: {
    title: 'Cell Formatting',
    readOnlyHint: false,
    destructiveHint: false, // Formatting doesn't destroy data
    idempotentHint: true,   // Same format = same result
    openWorldHint: true,
  },
  sheets_dimensions: {
    title: 'Rows & Columns',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete rows/columns
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_rules: {
    title: 'Formatting & Validation Rules',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete rules
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_charts: {
    title: 'Chart Management',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete charts
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_pivot: {
    title: 'Pivot Tables',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete pivots
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_filter_sort: {
    title: 'Filtering & Sorting',
    readOnlyHint: false,
    destructiveHint: true,  // Can clear filters
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_sharing: {
    title: 'Sharing & Permissions',
    readOnlyHint: false,
    destructiveHint: true,  // Can remove permissions
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_comments: {
    title: 'Comments & Replies',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete comments
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_versions: {
    title: 'Version History',
    readOnlyHint: false,
    destructiveHint: true,  // Can restore (overwrites current)
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_analysis: {
    title: 'Data Analysis',
    readOnlyHint: true,     // READ-ONLY tool
    destructiveHint: false,
    idempotentHint: true,   // Same input = same output
    openWorldHint: true,
  },
  sheets_advanced: {
    title: 'Advanced Features',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete named/protected ranges
    idempotentHint: false,
    openWorldHint: true,
  },
  // Enterprise Tools
  sheets_transaction: {
    title: 'Transaction Support',
    readOnlyHint: false,
    destructiveHint: true,  // Commit can modify data
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_validation: {
    title: 'Data Validation',
    readOnlyHint: true,     // Local validation only
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,   // Local processing
  },
  sheets_conflict: {
    title: 'Conflict Detection',
    readOnlyHint: true,     // Detection is read-only
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  sheets_impact: {
    title: 'Impact Analysis',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  sheets_history: {
    title: 'Operation History',
    readOnlyHint: true,     // Read history only
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,   // Local history
  },
  // MCP-Native Tools
  sheets_confirm: {
    title: 'Plan Confirmation',
    readOnlyHint: true,     // Just asks user
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,   // MCP Elicitation
  },
  sheets_analyze: {
    title: 'AI-Powered Analysis',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,  // AI output varies
    openWorldHint: true,    // MCP Sampling
  },
  sheets_fix: {
    title: 'Automated Issue Fixing',
    readOnlyHint: false,
    destructiveHint: true,  // Applies fixes to spreadsheet
    idempotentHint: false,
    openWorldHint: true,
  },
};

// NOTE: Tool descriptions are now in descriptions.ts
// This file contains only TOOL_ANNOTATIONS and ACTION_COUNTS

/**
 * Action counts per tool
 */
export const ACTION_COUNTS: Record<string, number> = {
  sheets_auth: 4,
  sheets_spreadsheet: 6,
  sheets_sheet: 7,
  sheets_values: 9,
  sheets_cells: 12,
  sheets_format: 9,
  sheets_dimensions: 21,
  sheets_rules: 8,
  sheets_charts: 9,
  sheets_pivot: 6,
  sheets_filter_sort: 14,
  sheets_sharing: 8,
  sheets_comments: 10,
  sheets_versions: 10,
  sheets_analysis: 13,  // data_quality, formula_audit, structure_analysis, statistics, correlations, summary, dependencies, compare_ranges, detect_patterns, column_analysis, suggest_templates, generate_formula, suggest_chart
  sheets_advanced: 19,
  // Enterprise Tools
  sheets_transaction: 6,  // begin, queue, commit, rollback, status, list
  sheets_validation: 1,   // validate
  sheets_conflict: 2,     // detect, resolve
  sheets_impact: 1,       // analyze
  sheets_history: 7,      // list, get, stats, undo, redo, revert_to, clear
  // MCP-Native Tools
  sheets_confirm: 2,      // request, get_stats (via Elicitation)
  sheets_analyze: 4,      // analyze, generate_formula, suggest_chart, get_stats (via Sampling)
  sheets_fix: 0,          // No actions - single request mode (automated issue resolution)
};

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
 * Get all tool metadata
 * Note: This function is not currently used. Descriptions are accessed directly from descriptions.ts
 */
export function getToolMetadata(): Record<string, unknown>[] {
  return Object.keys(TOOL_ANNOTATIONS).map(name => ({
    name,
    description: '', // Descriptions should be imported from descriptions.ts instead
    annotations: TOOL_ANNOTATIONS[name]!,
    actionCount: ACTION_COUNTS[name] ?? 0,
  }));
}

/**
 * Constants
 */
export const TOOL_COUNT = Object.keys(TOOL_ANNOTATIONS).length;
export const ACTION_COUNT = Object.values(ACTION_COUNTS).reduce((sum, count) => sum + count, 0);
