/**
 * ServalSheets - Tool Annotations
 *
 * MCP 2025-11-25 compliant tool annotations
 * Required for Claude Connectors Directory
 */

import type { ToolAnnotations } from './shared.js';
import { TOOL_DESCRIPTIONS } from './descriptions.js';
import { ACTION_COUNTS } from './action-counts.js';

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
    readOnlyHint: false, // resolve_conflict is a write operation
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true, // resolve_conflict makes Google API calls
  },
  sheets_history: {
    title: 'Operation History',
    readOnlyHint: false, // undo/redo/revert_to are write operations
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true, // undo/redo call Google Sheets API
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
    idempotentHint: false, // Results may vary (sampling, AI analysis)
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
  sheets_federation: {
    title: 'MCP Server Federation',
    readOnlyHint: false, // Depends on remote tool behavior
    destructiveHint: false, // Federation itself is not destructive
    idempotentHint: false, // Remote tools may not be idempotent
    openWorldHint: true, // Calls external MCP servers
  },
};

// NOTE: Tool descriptions are now in descriptions.ts
// This file contains only TOOL_ANNOTATIONS and ACTION_COUNTS

/**
 * Per-action intelligence annotations.
 * Helps Claude understand action cost, idempotency, and best usage patterns.
 *
 * Fields:
 * - apiCalls: Typical number of Google API calls this action makes
 * - idempotent: true if calling twice produces the same result (safe to retry)
 * - batchAlternative: More efficient batch version of this action (if available)
 * - prerequisites: Actions that should run first
 * - commonMistakes: Array of pitfalls Claude should avoid
 * - whenToUse: Short decision guidance
 * - whenNotToUse: When a different action is better
 */
export const ACTION_ANNOTATIONS: Record<
  string,
  {
    apiCalls?: number;
    idempotent?: boolean;
    batchAlternative?: string;
    prerequisites?: string[];
    commonMistakes?: string[];
    whenToUse?: string;
    whenNotToUse?: string;
  }
> = {
  // DATA TOOL
  'sheets_data.read': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_data.batch_read (for 3+ ranges or dataFilters)',
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Read cell values from a specific range OR query by dataFilter (survives insertions/deletions)',
    whenNotToUse: 'For multiple ranges use batch_read; for analysis use sheets_analyze',
    commonMistakes: [
      'Using hard-coded A1 ranges in production (use dataFilter with developerMetadataLookup instead)',
      'Not setting developer metadata before attempting dataFilter queries',
      'Reading very large ranges without pagination (use cursor/pageSize)',
    ],
  },
  'sheets_data.write': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_data.batch_write (for 3+ ranges or dataFilters)',
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Write values to a specific range OR update by dataFilter (dynamic location)',
    whenNotToUse: 'For appending rows use append action; for multiple ranges use batch_write',
    commonMistakes: [
      'Forgetting sheet name in range: use "Sheet1!A1:D10" not "A1:D10"',
      'Using write to add rows at bottom — use append instead (auto-finds last row)',
      'Using hard-coded A1 ranges in production (use dataFilter for resilient updates)',
      'Writing without dataFilter.developerMetadataLookup when target location is dynamic',
      'Forgetting to tag ranges with sheets_advanced.set_metadata before dataFilter writes',
    ],
  },
  'sheets_data.clear': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_data.batch_clear (for multiple ranges or dataFilters)',
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Clear values from a range OR clear by dataFilter (dynamic targeting)',
    whenNotToUse:
      'For formatting changes use sheets_format; for deleting rows use sheets_dimensions',
    commonMistakes: [
      'Clearing hard-coded ranges that shift after insertions (use dataFilter instead)',
      'Not confirming deletion in production (use safety.dryRun first)',
      'Clears values only — formatting is preserved. Use sheets_format.clear_format for formatting',
    ],
  },
  'sheets_data.append': {
    apiCalls: 1,
    idempotent: false, // CRITICAL
    whenToUse: 'Adding new rows at the bottom of existing data',
    whenNotToUse: 'Updating existing rows — use write with specific range instead',
    commonMistakes: [
      'DANGER: append is NOT idempotent — calling twice creates duplicate rows',
      'Provide range as "Sheet1!A:Z" to let Sheets find the insertion point',
    ],
  },
  'sheets_data.batch_read': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Reading 3+ ranges in one call (same API cost as single read)',
    commonMistakes: ['Each range must include sheet name: ["Sheet1!A1:D10", "Sheet2!A1:B5"]'],
  },
  'sheets_data.batch_write': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Writing to 3+ ranges in one call',
  },
  'sheets_data.batch_clear': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clearing multiple ranges in one call',
    commonMistakes: [
      'Clears values only — formatting is preserved. Use sheets_format.clear_format for formatting',
    ],
  },
  'sheets_data.find_replace': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Bulk find-and-replace across a sheet or workbook',
    commonMistakes: [
      'Set allSheets:true carefully — it affects ALL sheets, not just the active one',
    ],
  },

  // FORMAT TOOL
  'sheets_format.set_background': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_format (for 3+ format operations)',
    whenToUse: 'Coloring 1-2 ranges',
    whenNotToUse: 'Formatting 3+ ranges — use batch_format (1 API call for all)',
  },
  'sheets_format.set_text_format': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_format',
    whenToUse: 'Setting bold/italic/font on 1-2 ranges',
  },
  'sheets_format.batch_format': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Applying 3+ format operations (background, text, borders, etc.) in ONE API call',
    whenNotToUse: 'Single format change — just use the specific action (set_background, etc.)',
    commonMistakes: [
      'Max 100 operations per batch',
      'Each operation needs its own range — cannot share ranges across operations',
    ],
  },
  'sheets_format.apply_preset': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Quick professional formatting: header_row, alternating_rows, currency, etc.',
    commonMistakes: [
      'alternating_rows preset works best when applied to the full data range including headers',
    ],
  },
  'sheets_format.set_borders': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_format (type: "borders")',
  },

  // DIMENSIONS TOOL
  'sheets_dimensions.insert': {
    apiCalls: 1,
    idempotent: false, // CRITICAL
    whenToUse: 'Adding empty rows or columns at a specific position',
    commonMistakes: [
      'NOT idempotent: calling insert(count:5) twice = 10 rows, not 5',
      'Use startIndex (0-based), not row number. Row 1 = startIndex 0',
    ],
  },
  'sheets_dimensions.delete': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Removing rows or columns by index',
    commonMistakes: [
      'Deleting shifts indices — delete from bottom to top to avoid index skew',
      'Uses 0-based index: to delete row 5, use startIndex: 4',
    ],
  },
  'sheets_dimensions.sort_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Sorting data by one or more columns',
    commonMistakes: ['Sort range should NOT include header row — exclude it from the range'],
  },
  'sheets_dimensions.freeze': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Freezing header rows or left columns for scrolling',
  },
  'sheets_dimensions.auto_resize': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Auto-fitting column widths to content',
  },

  // CORE TOOL
  'sheets_core.create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a brand new spreadsheet',
    commonMistakes: ['Returns spreadsheetId — save it for all subsequent operations'],
  },
  'sheets_core.get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting spreadsheet metadata (sheet names, IDs, properties)',
    commonMistakes: [
      'Use includeGridData:false (default) unless you need cell data — grid data is large',
    ],
  },
  'sheets_core.add_sheet': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a new tab to an existing spreadsheet',
    commonMistakes: ['Sheet names must be unique — check existing sheets first with list_sheets'],
  },

  // COMPOSITE TOOL
  'sheets_composite.setup_sheet': {
    apiCalls: 2,
    idempotent: false,
    whenToUse:
      'Creating a new formatted sheet with headers, column widths, and optional data in just 2 API calls',
    whenNotToUse: 'Sheet already exists — use individual format/data tools instead',
    commonMistakes: [
      'Sheet name must not already exist — check with sheets_core.list_sheets first',
    ],
  },
  'sheets_composite.smart_append': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Adding rows that auto-match columns by header name (handles column reordering)',
    whenNotToUse: 'Simple append where columns are already aligned — use sheets_data.append',
    commonMistakes: ['Headers must match exactly (case-sensitive) or use matchHeaders option'],
  },
  'sheets_composite.import_csv': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Importing CSV data into a sheet with auto-parsing',
  },
  'sheets_composite.deduplicate': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Removing duplicate rows based on key columns',
    commonMistakes: ['Always use preview:true first to see what will be removed before committing'],
  },

  // TRANSACTION TOOL
  'sheets_transaction.begin': {
    apiCalls: 0,
    idempotent: false,
    whenToUse: 'When you need 5+ operations to be atomic (all succeed or all fail)',
    whenNotToUse: 'For 1-4 simple operations — transaction overhead exceeds benefit',
    prerequisites: ['sheets_session.set_active'],
  },
  'sheets_transaction.queue': {
    apiCalls: 0,
    idempotent: false,
    whenToUse: 'Adding operations to an active transaction (no API calls until commit)',
  },
  'sheets_transaction.commit': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Executing all queued operations in a single batched API call',
    commonMistakes: [
      'If commit fails, use rollback — do NOT retry commit (may duplicate operations)',
    ],
  },

  // ANALYZE TOOL
  'sheets_analyze.comprehensive': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'FIRST action on any spreadsheet — gives complete overview in one call',
    commonMistakes: [
      'Use depth:"sample" (default) for initial analysis — "full" loads ALL data and may be slow for large sheets',
      'If MCP Sampling is unavailable, falls back to statistical analysis without AI insights',
    ],
  },
  'sheets_analyze.scout': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Ultra-fast metadata-only check (sheet names, row counts, column types)',
    whenNotToUse: 'When you need actual data or patterns — use comprehensive instead',
  },
  'sheets_analyze.suggest_visualization': {
    apiCalls: 1,
    idempotent: true,
    prerequisites: ['sheets_analyze.comprehensive or sheets_analyze.analyze_data'],
    whenToUse: 'Getting chart recommendations based on data patterns',
  },
  'sheets_analyze.query_natural_language': {
    apiCalls: 3, // Metadata read + sample read + LLM call
    idempotent: false, // AI responses vary
    batchAlternative: 'For analyzing multiple sheets, use sheets_composite.multi_sheet_analysis',
    prerequisites: ['sheets_auth.login', 'sheets_analyze.scout to understand schema'],
    whenToUse:
      'User asks natural language questions about data they don\'t understand the schema for. Examples: "What are top 5 customers by revenue?", "Show me sales trends last quarter"',
    whenNotToUse:
      'When modification is needed (use sheets_data instead); when data schema is known and simple query suffices (use sheets_data.read with filter)',
    commonMistakes: [
      'Asking LLM to modify data (query_natural_language is read-only analysis)',
      'Using with very large datasets without range specification (causes timeout)',
      'Expecting real-time data when only sample is analyzed',
      'Not providing conversationId for multi-turn queries',
    ],
  },

  // COLLABORATE TOOL
  'sheets_collaborate.share_add': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Granting access to a user',
    commonMistakes: ['Requires Drive API scope — may need re-auth if only Sheets scope is active'],
  },
  'sheets_collaborate.comment_add': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a comment to a cell or range',
  },

  // SESSION TOOL
  'sheets_session.set_active': {
    apiCalls: 0,
    idempotent: true,
    whenToUse:
      'ALWAYS call this at the start of a multi-step workflow — sets context so you can use sheet names instead of IDs',
    commonMistakes: ['Must be called before sheets that reference "active spreadsheet" implicitly'],
  },

  // QUALITY TOOL
  'sheets_quality.validate': {
    apiCalls: 1,
    idempotent: true,
    whenToUse:
      'Before large writes — validates data format and catches errors before they hit the API',
  },

  // HISTORY TOOL
  'sheets_history.undo': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Reverting the last operation',
    commonMistakes: [
      'Only undoes operations tracked by ServalSheets — not manual user edits in the Sheets UI',
    ],
  },
};

/**
 * Action counts per tool (re-exported for convenience)
 */
export { ACTION_COUNTS };

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
// ACTION_COUNTS, TOOL_COUNT, ACTION_COUNT are exported from action-counts.ts (via index.ts)
