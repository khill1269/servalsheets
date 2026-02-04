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
  sheets_webhook: {
    title: 'Webhooks',
    readOnlyHint: false, // Can register/unregister webhooks
    destructiveHint: true, // unregister is destructive
    idempotentHint: false, // register creates new resources
    openWorldHint: true, // Google Sheets Watch API
  },
  sheets_dependencies: {
    title: 'Formula Dependencies',
    readOnlyHint: true, // Analysis only
    destructiveHint: false, // No data modification
    idempotentHint: true, // Same input = same output
    openWorldHint: false, // Local graph analysis
  },
};

// NOTE: Tool descriptions are now in descriptions.ts
// This file contains only TOOL_ANNOTATIONS and ACTION_COUNTS

/**
 * Action counts per tool
 */
export const ACTION_COUNTS: Record<string, number> = {
  sheets_advanced: 26,
  sheets_analyze: 16,
  sheets_appsscript: 14,
  sheets_auth: 4,
  sheets_bigquery: 14,
  sheets_collaborate: 35,
  sheets_composite: 10,
  sheets_confirm: 5,
  sheets_core: 19,
  sheets_data: 18,
  sheets_dependencies: 7,
  sheets_dimensions: 28,
  sheets_fix: 1,
  sheets_format: 21,
  sheets_history: 7,
  sheets_quality: 4,
  sheets_session: 26,
  sheets_templates: 8,
  sheets_transaction: 6,
  sheets_visualize: 18,
  sheets_webhook: 6,
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
