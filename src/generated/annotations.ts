// @generated — Do not edit manually. Run npm run schema:commit to regenerate.
/**
 * ServalSheets - Tool Annotations
 *
 * MCP 2025-11-25 compliant tool annotations
 * Required for Claude Connectors Directory
 */

import type { ToolAnnotations } from '../schemas/shared.js';
import { TOOL_DESCRIPTIONS } from '../schemas/descriptions.js';
import { ACTION_COUNTS } from './action-counts.js';

/**
 * All tool annotations with MCP compliance
 */
export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  sheets_auth: {
    title: 'Authentication & Setup',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_core: {
    title: 'Spreadsheet & Sheet Management',
    readOnlyHint: false,
    destructiveHint: true, // delete_sheet action is destructive
    idempotentHint: false, // create/add create new entities
    openWorldHint: true,
  },
  sheets_data: {
    title: 'Cell Data Operations',
    readOnlyHint: false,
    destructiveHint: true, // Can overwrite data, clear notes/validation
    idempotentHint: false, // Append is not idempotent
    openWorldHint: true,
  },
  sheets_format: {
    title: 'Formatting & Styling',
    readOnlyHint: false,
    destructiveHint: true, // clear_format removes formatting; conditional format rules can be deleted
    idempotentHint: true, // Same format = same result
    openWorldHint: true,
  },
  sheets_dimensions: {
    title: 'Rows, Columns & Sorting',
    readOnlyHint: false,
    destructiveHint: true, // Can delete rows/columns
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_visualize: {
    title: 'Charts &amp; Pivot Tables',
    readOnlyHint: false,
    destructiveHint: true, // Can delete charts and pivots
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_collaborate: {
    title: 'Sharing &amp; Collaboration',
    readOnlyHint: false,
    destructiveHint: true, // Can remove permissions, delete comments, restore versions
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_composite: {
    title: 'Bulk Operations &amp; Import/Export',
    readOnlyHint: false,
    destructiveHint: true, // Can delete duplicate rows, overwrite on import
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_analyze: {
    title: 'Data Analysis &amp; Understanding',
    readOnlyHint: true, // Read-only analysis
    destructiveHint: false,
    idempotentHint: true, // Same input = same analysis
    openWorldHint: false, // Requires sampling server or optional AI analysis
  },
  sheets_fix: {
    title: 'Data Cleaning &amp; Repair',
    readOnlyHint: false,
    destructiveHint: true, // Modifies data structure and values
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_templates: {
    title: 'Template Management',
    readOnlyHint: false,
    destructiveHint: true, // Can delete templates
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_bigquery: {
    title: 'BigQuery Integration',
    readOnlyHint: false,
    destructiveHint: true, // Can overwrite tables, drop connections
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_appsscript: {
    title: 'Google Apps Script',
    readOnlyHint: false,
    destructiveHint: true, // Can deploy, run arbitrary scripts
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_quality: {
    title: 'Data Quality &amp; Validation',
    readOnlyHint: true, // Validation and conflict detection only
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  sheets_history: {
    title: 'Revision History &amp; Undo',
    readOnlyHint: false,
    destructiveHint: true, // restore_cells and revert can modify current state
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_session: {
    title: 'Session Context &amp; Preferences',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false, // Context changes can vary
    openWorldHint: true,
  },
  sheets_transaction: {
    title: 'Atomic Transactions',
    readOnlyHint: false,
    destructiveHint: true, // Transactions can contain destructive operations
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_federation: {
    title: 'Remote MCP Federation',
    readOnlyHint: false,
    destructiveHint: false, // Depends on remote server capabilities
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_webhook: {
    title: 'Webhooks &amp; Event Subscriptions',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_agent: {
    title: 'Autonomous Agent Execution',
    readOnlyHint: false,
    destructiveHint: true, // Agents can execute mutations
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_compute: {
    title: 'Server-Side Calculations',
    readOnlyHint: true, // Read-only computation
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  sheets_connectors: {
    title: 'External Data Connectors',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_dependencies: {
    title: 'Dependency &amp; Impact Analysis',
    readOnlyHint: false,
    destructiveHint: true, // Can create scenario sheets
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_confirm: {
    title: 'Confirmations &amp; Approvals',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false, // Requires elicitation server
  },
  sheets_advanced: {
    title: 'Advanced Sheet Operations',
    readOnlyHint: false,
    destructiveHint: true, // Can add/delete protected ranges, delete tables
    idempotentHint: false,
    openWorldHint: true,
  },
};

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
// ACTION_COUNTS, TOOL_COUNT, ACTION_COUNT are exported from action-counts.ts (via index.ts)