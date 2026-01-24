/**
 * ServalSheets - Tool Annotations
 *
 * MCP 2025-11-25 compliant tool annotations
 * Required for Claude Connectors Directory
 */

import type { ToolAnnotations } from './shared.js';
import { TOOL_DESCRIPTIONS } from './descriptions.js';

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
  sheets_core: {
    title: 'Core Operations',
    readOnlyHint: false,
    destructiveHint: true, // delete_sheet action is destructive
    idempotentHint: false, // create/add create new entities
    openWorldHint: true,
  },
  sheets_data: {
    title: 'Cell Data',
    readOnlyHint: false,
    destructiveHint: true, // Can overwrite data, clear notes/validation
    idempotentHint: false, // Append is not idempotent
    openWorldHint: true,
  },
  sheets_format: {
    title: 'Cell Formatting',
    readOnlyHint: false,
    destructiveHint: false, // Formatting doesn't destroy data
    idempotentHint: true, // Same format = same result
    openWorldHint: true,
  },
  sheets_dimensions: {
    title: 'Rows & Columns',
    readOnlyHint: false,
    destructiveHint: true, // Can delete rows/columns
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_visualize: {
    title: 'Visualizations (Charts & Pivot Tables)',
    readOnlyHint: false,
    destructiveHint: true, // Can delete charts and pivots
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_collaborate: {
    title: 'Collaboration',
    readOnlyHint: false,
    destructiveHint: true, // Can remove permissions, delete comments, restore versions
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_advanced: {
    title: 'Advanced Features',
    readOnlyHint: false,
    destructiveHint: true, // Can delete named/protected ranges
    idempotentHint: false,
    openWorldHint: true,
  },
  // Enterprise Tools
  sheets_transaction: {
    title: 'Transaction Support',
    readOnlyHint: false,
    destructiveHint: true, // Commit can modify data
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_quality: {
    title: 'Quality Assurance',
    readOnlyHint: true, // Analysis and validation are read-only
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false, // Local processing
  },
  sheets_history: {
    title: 'Operation History',
    readOnlyHint: true, // Read history only
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false, // Local history
  },
  // MCP-Native Tools
  sheets_confirm: {
    title: 'Plan Confirmation',
    readOnlyHint: true, // Just asks user
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false, // MCP Elicitation
  },
  sheets_analyze: {
    title: 'Ultimate Data Analysis',
    readOnlyHint: true, // Reads data + sampling only
    destructiveHint: false, // Analysis only; no destructive actions
    idempotentHint: true, // No side effects (results may vary)
    openWorldHint: true, // MCP Sampling + Google API
  },
  sheets_fix: {
    title: 'Automated Issue Fixing',
    readOnlyHint: false,
    destructiveHint: true, // Applies fixes to spreadsheet
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_composite: {
    title: 'Composite Operations',
    readOnlyHint: false,
    destructiveHint: true, // Can overwrite/modify data
    idempotentHint: false, // Import/append operations are not idempotent
    openWorldHint: true,
  },
  sheets_session: {
    title: 'Session Context',
    readOnlyHint: false, // Can update preferences
    destructiveHint: false, // No data destruction
    idempotentHint: true, // Most operations are idempotent
    openWorldHint: false, // Session-only, no external effects
  },
  // Tier 7 Enterprise Tools
  sheets_templates: {
    title: 'Templates',
    readOnlyHint: false, // Can create/update/delete templates
    destructiveHint: true, // Can delete templates
    idempotentHint: false, // Create generates new resources
    openWorldHint: true, // Google Drive API
  },
  sheets_bigquery: {
    title: 'BigQuery Integration',
    readOnlyHint: false, // Can modify connections, run queries
    destructiveHint: true, // Can delete connections, overwrite data
    idempotentHint: false, // Queries consume quota
    openWorldHint: true, // BigQuery and Sheets APIs
  },
  sheets_appsscript: {
    title: 'Apps Script Automation',
    readOnlyHint: false, // run, update_content, deploy modify state
    destructiveHint: true, // undeploy, run can have side effects
    idempotentHint: false, // run is not idempotent
    openWorldHint: true, // Apps Script API
  },
};

// NOTE: Tool descriptions are now in descriptions.ts
// This file contains only TOOL_ANNOTATIONS and ACTION_COUNTS

/**
 * Action counts per tool
 */
export const ACTION_COUNTS: Record<string, number> = {
  sheets_auth: 4,
  sheets_core: 15, // Consolidated: spreadsheet (8) + sheet (7)
  sheets_data: 18, // v2.0: Was 20, reduced by 2 (validation moved to sheets_format)
  sheets_format: 18, // Wave 2: Added 8 rule actions (conditional format + data validation) + 1 suggest_format
  sheets_dimensions: 39, // Wave 2: Added filter/sort + range utilities + views + slicers
  sheets_visualize: 16, // Consolidated: charts (9) + pivot (7)
  sheets_collaborate: 28, // Consolidated: sharing (8) + comments (10) + versions (10)
  sheets_advanced: 19, // Named ranges, protected ranges, metadata, banding, tables
  // Enterprise Tools
  sheets_transaction: 6, // begin, queue, commit, rollback, status, list
  sheets_quality: 4, // validate, detect_conflicts, resolve_conflict, analyze_impact
  sheets_history: 7, // list, get, stats, undo, redo, revert_to, clear
  // MCP-Native Tools
  sheets_confirm: 2, // request, get_stats (via Elicitation)
  sheets_analyze: 11, // CONSOLIDATED (2026-01-12) - comprehensive, analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, analyze_formulas, query_natural_language, explain_analysis
  sheets_fix: 1, // fix action (automated issue resolution)
  // Composite Operations
  sheets_composite: 4, // import_csv, smart_append, bulk_update, deduplicate
  sheets_session: 13, // set_active, get_active, get_context, record_operation, get_last_operation, get_history, find_by_reference, update_preferences, get_preferences, set_pending, get_pending, clear_pending, reset
  // Tier 7 Enterprise Tools
  sheets_templates: 8, // list, get, create, apply, update, delete, preview, import_builtin
  sheets_bigquery: 12, // connect, disconnect, list_connections, get_connection, query, preview, refresh, list_datasets, list_tables, get_table_schema, export_to_bigquery, import_from_bigquery
  sheets_appsscript: 14, // create, get, get_content, update_content, create_version, list_versions, get_version, deploy, list_deployments, get_deployment, undeploy, run, list_processes, get_metrics
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
 * Get all tool metadata for /info endpoint
 * Returns tool names, descriptions, annotations, and action counts
 */
export function getToolMetadata(): Record<string, unknown>[] {
  return Object.keys(TOOL_ANNOTATIONS).map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name] ?? `${name} operations`,
    annotations: TOOL_ANNOTATIONS[name]!,
    actionCount: ACTION_COUNTS[name] ?? 0,
  }));
}

/**
 * Constants
 */
export const TOOL_COUNT = Object.keys(TOOL_ANNOTATIONS).length;
export const ACTION_COUNT = Object.values(ACTION_COUNTS).reduce((sum, count) => sum + count, 0);
