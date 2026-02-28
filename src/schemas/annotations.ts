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
    destructiveHint: true, // clear_format removes formatting; conditional format rules can be deleted
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
    idempotentHint: false, // resolve_conflict modifies data; validate results can vary with data changes
    openWorldHint: true, // resolve_conflict makes Google API calls
  },
  sheets_history: {
    title: 'Operation History',
    readOnlyHint: false, // undo/redo/revert_to are write operations
    destructiveHint: false,
    idempotentHint: false, // undo/redo change state on each call
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
    title: 'Formula Dependencies & Scenario Modeling',
    readOnlyHint: false, // create_scenario_sheet writes a new sheet
    destructiveHint: true, // create_scenario_sheet creates new sheets (side effect)
    idempotentHint: false, // create_scenario_sheet creates new resources
    openWorldHint: true, // Reads formula data from Google Sheets API
  },
  sheets_federation: {
    title: 'MCP Server Federation',
    readOnlyHint: false, // Depends on remote tool behavior
    destructiveHint: false, // Federation itself is not destructive
    idempotentHint: false, // Remote tools may not be idempotent
    openWorldHint: true, // Calls external MCP servers
  },
  sheets_compute: {
    title: 'Computation Engine',
    readOnlyHint: true, // All actions are read-only computations
    destructiveHint: false, // No data modification
    idempotentHint: true, // Same input = same output
    openWorldHint: true, // Reads data from Google Sheets API
  },
  sheets_connectors: {
    title: 'Live Data Connectors',
    readOnlyHint: false, // configure/subscribe mutate connector state
    destructiveHint: false, // no destructive operations
    idempotentHint: false, // live data changes on each call
    openWorldHint: true, // calls external APIs (Finnhub, FRED, Polygon, etc.)
  },
  sheets_agent: {
    title: 'Agentic Execution',
    readOnlyHint: false, // execute/execute_step modify data
    destructiveHint: true, // Multi-step operations can modify data
    idempotentHint: false, // Execution creates new state each time
    openWorldHint: true, // Orchestrates other tools that access Google APIs
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
export const ACTION_ANNOTATIONS: Record<string, ActionAnnotation> = {
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
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
      QUOTA_EXCEEDED: 'Wait 60s, then retry with a smaller range or use batch_read',
      INVALID_RANGE: 'Use bounded range like A1:Z1000, not column-only refs like A:Z',
    },
  },
  'sheets_data.write': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_data.batch_write (for 3+ ranges or dataFilters)',
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Write values to a specific range OR update by dataFilter (dynamic location)',
    whenNotToUse: 'For appending rows use append action; for multiple ranges use batch_write',
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
      QUOTA_EXCEEDED: 'Wait 60s, then retry with a smaller range or use batch_write',
      INVALID_RANGE: 'Use bounded range like A1:Z1000, not column-only refs like A:Z',
      INVALID_VALUE: 'Check values array matches range dimensions',
    },
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
    errorRecovery: {
      QUOTA_EXCEEDED:
        'Wait 60s before retrying. WARNING: Do NOT retry on timeout — append is non-idempotent, retrying duplicates data',
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
    },
  },
  'sheets_data.batch_read': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Reading 3+ ranges in one call (same API cost as single read)',
    commonMistakes: ['Each range must include sheet name: ["Sheet1!A1:D10", "Sheet2!A1:B5"]'],
    errorRecovery: {
      QUOTA_EXCEEDED: 'Reduce number of ranges or add delay between calls',
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets to verify all sheet names in the ranges array',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
    },
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

  // FORMAT TOOL (additional actions)
  'sheets_format.set_format': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_format',
    whenToUse: 'Setting comprehensive formatting (font, color, borders, alignment) at once',
    whenNotToUse: 'For single formatting types — use specific actions like set_background',
    errorRecovery: {
      INVALID_RANGE: 'Use bounded range like Sheet1!A1:Z1000, not column-only refs',
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
    },
  },
  'sheets_format.set_number_format': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_format',
    whenToUse: 'Setting number format (currency, percentage, date, etc.)',
    commonMistakes: [
      'Format code examples: "$#,##0.00" (currency), "0.0%" (percentage), "YYYY-MM-DD" (date)',
    ],
  },
  'sheets_format.set_alignment': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_format',
    whenToUse: 'Setting horizontal/vertical alignment and text wrapping',
  },
  'sheets_format.clear_format': {
    apiCalls: 1,
    idempotent: true,
    batchAlternative: 'sheets_format.batch_clear (for multiple ranges)',
    whenToUse: 'Removing all formatting from a range (values preserved)',
    commonMistakes: ['clears formatting only — use sheets_data.clear to remove values too'],
  },
  'sheets_format.auto_fit': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Auto-fitting row heights or column widths to content',
  },
  'sheets_format.rule_add_conditional_format': {
    apiCalls: 1,
    idempotent: false,
    whenToUse:
      'Adding a conditional formatting rule (deprecated — use add_conditional_format_rule)',
  },
  'sheets_format.rule_update_conditional_format': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating an existing conditional formatting rule',
  },
  'sheets_format.rule_delete_conditional_format': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting a conditional formatting rule by ID',
  },
  'sheets_format.rule_list_conditional_formats': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting list of all conditional formatting rules in a sheet',
  },
  'sheets_format.add_conditional_format_rule': {
    apiCalls: 1,
    idempotent: false,
    whenToUse:
      'Adding a conditional formatting rule with presets (highlight_duplicates, color_scale, etc.)',
    commonMistakes: [
      'Preset names: highlight_duplicates, highlight_blanks, color_scale_green_red, data_bars, top_10_percent',
    ],
  },
  'sheets_format.set_data_validation': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Adding data validation rules (dropdown, number range, date range, etc.)',
  },
  'sheets_format.clear_data_validation': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing data validation from a range',
  },
  'sheets_format.list_data_validations': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all data validation rules in a sheet with pagination',
  },
  'sheets_format.generate_conditional_format': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'AI-powered conditional formatting recommendations based on data patterns',
  },
  'sheets_format.sparkline_add': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a tiny inline chart (sparkline) in a cell',
  },
  'sheets_format.sparkline_get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Retrieving sparkline configuration for a cell',
  },
  'sheets_format.sparkline_clear': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a sparkline from a cell',
  },
  'sheets_format.suggest_format': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'AI-powered formatting suggestions based on column content',
  },
  'sheets_format.set_rich_text': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Setting formatted text with bold/italic/links within a single cell',
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
    errorRecovery: {
      INVALID_RANGE: 'Use bounded range like Sheet1!A1:Z1000, not column-only refs like A:Z',
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify all sheet names in ranges',
    },
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

  // DIMENSIONS TOOL (additional actions)
  'sheets_dimensions.move': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Moving rows or columns to a different position',
  },
  'sheets_dimensions.resize': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Setting specific row height or column width',
  },
  'sheets_dimensions.hide': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Hiding rows or columns (values preserved, not visible)',
  },
  'sheets_dimensions.show': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Unhiding previously hidden rows or columns',
  },
  'sheets_dimensions.append': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding empty rows or columns at the end of the sheet',
  },
  'sheets_dimensions.group': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Grouping rows or columns for collapsible outline',
  },
  'sheets_dimensions.ungroup': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing grouping from rows or columns',
  },
  'sheets_dimensions.trim_whitespace': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing empty leading/trailing rows and columns',
  },
  'sheets_dimensions.text_to_columns': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Splitting cell text into separate columns (delimiter-based)',
  },
  'sheets_dimensions.randomize_range': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Randomly shuffling rows in a range',
  },
  'sheets_dimensions.set_basic_filter': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Creating a basic autofilter on a range (shows filter dropdowns)',
  },
  'sheets_dimensions.clear_basic_filter': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a basic filter from a range',
  },
  'sheets_dimensions.get_basic_filter': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting the current basic filter configuration',
  },
  'sheets_dimensions.create_filter_view': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a named filter view (non-destructive filtering)',
    commonMistakes: [
      'Filter views are like named filters — multiple views can coexist on same range',
    ],
  },
  'sheets_dimensions.update_filter_view': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating filter criteria in an existing filter view',
  },
  'sheets_dimensions.delete_filter_view': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting a filter view by ID',
  },
  'sheets_dimensions.list_filter_views': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all filter views in a sheet with pagination',
  },
  'sheets_dimensions.get_filter_view': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific filter view',
  },
  'sheets_dimensions.create_slicer': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating an interactive slicer control for filtering',
  },
  'sheets_dimensions.update_slicer': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating slicer position, size, or title',
  },
  'sheets_dimensions.delete_slicer': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a slicer from the sheet',
  },
  'sheets_dimensions.list_slicers': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all slicers in a sheet',
  },
  'sheets_dimensions.auto_fill': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Extending patterns (dates, numbers, etc.) to fill additional cells',
  },
  'sheets_dimensions.duplicate_filter_view': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a copy of an existing filter view',
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
    errorRecovery: {
      INVALID_RANGE: 'Use 0-based index (row 1 = index 0, row 5 = index 4)',
    },
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

  // CORE TOOL (additional actions)
  'sheets_core.copy': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Copying an entire spreadsheet',
    commonMistakes: ['Copying includes all sheets, named ranges, and settings from original'],
  },
  'sheets_core.update_properties': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating spreadsheet title, locale, time zone, etc.',
  },
  'sheets_core.get_url': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting the URL for a spreadsheet (no API call required)',
  },
  'sheets_core.batch_get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting multiple spreadsheets in one call',
  },
  'sheets_core.get_comprehensive': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting spreadsheet with all sheets including grid data',
    commonMistakes: [
      'Returns large payload — use includeGridData:false when you only need metadata',
    ],
  },
  'sheets_core.list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting list of spreadsheets from Drive',
  },
  'sheets_core.delete_sheet': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting a sheet from a spreadsheet',
    commonMistakes: [
      'Cannot delete the last remaining sheet — spreadsheet must have at least one sheet',
    ],
  },
  'sheets_core.duplicate_sheet': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Copying a sheet within the same spreadsheet',
    commonMistakes: [
      'New sheet name defaults to "{original} copy" — specify sheetName to customize',
    ],
  },
  'sheets_core.update_sheet': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating sheet properties (name, color, grid settings, etc.)',
  },
  'sheets_core.copy_sheet_to': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Copying a sheet to a different spreadsheet',
  },
  'sheets_core.list_sheets': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting names and IDs of all sheets',
    errorRecovery: {
      SPREADSHEET_NOT_FOUND:
        'Verify spreadsheetId — check URL format docs.google.com/spreadsheets/d/{id}',
    },
  },
  'sheets_core.get_sheet': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting metadata for a specific sheet by name or ID',
  },
  'sheets_core.batch_delete_sheets': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting multiple sheets in one call',
  },
  'sheets_core.batch_update_sheets': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating properties of multiple sheets at once',
  },
  'sheets_core.clear_sheet': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clearing all values and formatting from a sheet',
    commonMistakes: ['This removes all data — use sheets_data.clear for specific ranges instead'],
  },
  'sheets_core.move_sheet': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Moving a sheet to a different position in the tab order',
  },

  // CORE TOOL
  'sheets_core.create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a brand new spreadsheet',
    commonMistakes: ['Returns spreadsheetId — save it for all subsequent operations'],
    errorRecovery: {
      PERMISSION_DENIED: 'Ensure drive.file scope is granted via sheets_auth.login',
    },
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
    errorRecovery: {
      SPREADSHEET_NOT_FOUND: 'Verify spreadsheetId from the spreadsheet URL',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
    },
  },

  // COMPOSITE TOOL (additional actions)
  'sheets_composite.import_xlsx': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Importing data from an Excel file into Sheets',
  },
  'sheets_composite.export_xlsx': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Exporting sheet as an Excel file',
  },
  'sheets_composite.bulk_update': {
    apiCalls: 3,
    idempotent: false,
    whenToUse: 'Batch updating multiple cells with conditions',
    commonMistakes: ['Use preview:true first to verify changes before applying'],
  },
  'sheets_composite.get_form_responses': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Reading responses from a Google Form linked to the sheet',
  },
  'sheets_composite.import_and_format': {
    apiCalls: 3,
    idempotent: false,
    whenToUse: 'Importing data and auto-formatting in one operation',
  },
  'sheets_composite.clone_structure': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Copying sheet structure (headers, formatting) without data',
  },
  'sheets_composite.export_large_dataset': {
    apiCalls: 5,
    idempotent: true,
    whenToUse: 'Exporting large datasets with streaming/pagination',
    commonMistakes: ['For large exports, chunking and streaming are applied automatically'],
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
    errorRecovery: {
      INVALID_VALUE:
        'CSV must have consistent column counts. Check for extra commas or embedded newlines',
    },
  },
  'sheets_composite.deduplicate': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Removing duplicate rows based on key columns',
    commonMistakes: ['Always use preview:true first to see what will be removed before committing'],
  },

  // TRANSACTION TOOL (additional actions)
  'sheets_transaction.rollback': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Canceling a transaction without committing changes',
  },
  'sheets_transaction.status': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting status of the current transaction',
  },
  'sheets_transaction.list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all active transactions',
  },

  // TRANSACTION TOOL
  'sheets_transaction.begin': {
    apiCalls: 0,
    idempotent: false,
    whenToUse: 'When you need 5+ operations to be atomic (all succeed or all fail)',
    whenNotToUse: 'For 1-4 simple operations — transaction overhead exceeds benefit',
    prerequisites: ['sheets_session.set_active'],
    errorRecovery: {
      SESSION_ERROR:
        'Previous transaction may still be open — call sheets_transaction.rollback first',
    },
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

  // ANALYZE TOOL (additional actions)
  'sheets_analyze.analyze_data': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'In-depth analysis of cell values, types, and distributions',
  },
  'sheets_analyze.analyze_formulas': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Parsing and analyzing all formulas in a range',
    commonMistakes: ['Large formula sets may timeout — use range parameter to limit scope'],
  },
  'sheets_analyze.analyze_structure': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Understanding sheet layout (headers, tables, regions)',
  },
  'sheets_analyze.analyze_performance': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Finding slow formulas and optimization opportunities',
  },
  'sheets_analyze.analyze_quality': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Detecting data quality issues (blanks, inconsistencies, outliers)',
  },
  'sheets_analyze.detect_patterns': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Finding repeating patterns, trends, or relationships in data',
  },
  'sheets_analyze.drill_down': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Deep analysis of a specific finding (prerequisite: comprehensive or analyze_*)',
  },
  'sheets_analyze.explain_analysis': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'AI-powered explanation of analysis results in plain English',
  },
  'sheets_analyze.generate_actions': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Converting analysis findings into executable actions',
  },
  'sheets_analyze.generate_formula': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'AI-powered formula generation from natural language description',
    commonMistakes: [
      'Generated formulas should be tested on sample data before applying to production',
    ],
  },
  'sheets_analyze.plan': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Creating a multi-step analysis plan based on goals',
  },
  'sheets_analyze.execute_plan': {
    apiCalls: 5,
    idempotent: false,
    whenToUse: 'Executing a multi-step plan created by sheets_analyze.plan',
    commonMistakes: ['Plan execution may modify data — use dryRun:true first to preview'],
  },
  'sheets_analyze.discover_action': {
    apiCalls: 0,
    idempotent: true,
    whenToUse:
      'When unsure which action or tool to use; performs semantic search across all registered actions',
    whenNotToUse: 'When you already know the exact tool+action to call directly',
    commonMistakes: ['Using discover_action instead of calling a known action directly'],
  },

  // CONFIRM TOOL (all actions)
  'sheets_confirm.request': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Requesting user confirmation before proceeding with action',
  },
  'sheets_confirm.get_stats': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting confirmation statistics (accepted/rejected counts)',
  },
  'sheets_confirm.wizard_start': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Starting a multi-step interactive wizard',
  },
  'sheets_confirm.wizard_step': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Advancing to the next step of a wizard',
  },
  'sheets_confirm.wizard_complete': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Finalizing a wizard session and getting results',
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
    errorRecovery: {
      SPREADSHEET_NOT_FOUND: 'Verify spreadsheetId is correct and accessible',
    },
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

  // COLLABORATE TOOL (additional actions)
  'sheets_collaborate.share_update': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Changing permissions for an existing share (owner → editor, etc.)',
  },
  'sheets_collaborate.share_remove': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Revoking access for a user or group',
  },
  'sheets_collaborate.share_list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting list of all users/groups with access',
  },
  'sheets_collaborate.share_get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting permissions for a specific user/group',
  },
  'sheets_collaborate.share_transfer_ownership': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Transferring ownership to another user (current owner demoted to editor)',
  },
  'sheets_collaborate.share_set_link': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Creating a shareable link with specific permissions',
  },
  'sheets_collaborate.share_get_link': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting or creating the shareable link',
  },
  'sheets_collaborate.comment_update': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating comment text',
  },
  'sheets_collaborate.comment_delete': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting a comment',
  },
  'sheets_collaborate.comment_list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all comments in a range or sheet',
  },
  'sheets_collaborate.comment_get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific comment',
  },
  'sheets_collaborate.comment_resolve': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Marking a comment thread as resolved',
  },
  'sheets_collaborate.comment_reopen': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Reopening a resolved comment thread',
  },
  'sheets_collaborate.comment_add_reply': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a reply to a comment thread',
  },
  'sheets_collaborate.comment_update_reply': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating a reply in a comment thread',
  },
  'sheets_collaborate.comment_delete_reply': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting a reply from a comment thread',
  },
  'sheets_collaborate.version_list_revisions': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Getting version history of the spreadsheet',
  },
  'sheets_collaborate.version_get_revision': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific revision',
  },
  'sheets_collaborate.version_restore_revision': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Restoring entire spreadsheet to a previous revision',
    commonMistakes: [
      'This overwrites current state — use sheets_history.diff_revisions to preview first',
    ],
  },
  'sheets_collaborate.version_keep_revision': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Marking a revision as a named checkpoint',
  },
  'sheets_collaborate.version_create_snapshot': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a named snapshot for restoration later',
  },
  'sheets_collaborate.version_list_snapshots': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all named snapshots',
  },
  'sheets_collaborate.version_restore_snapshot': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Restoring to a specific named snapshot',
  },
  'sheets_collaborate.version_delete_snapshot': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a named snapshot',
  },
  'sheets_collaborate.version_compare': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Cell-by-cell comparison between two revisions',
  },
  'sheets_collaborate.version_export': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Exporting a specific revision as a file',
  },
  'sheets_collaborate.approval_create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating an approval request for changes',
  },
  'sheets_collaborate.approval_approve': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Approving a pending approval request',
  },
  'sheets_collaborate.approval_reject': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Rejecting an approval request',
  },
  'sheets_collaborate.approval_get_status': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting status of an approval request',
  },
  'sheets_collaborate.approval_list_pending': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all pending approvals',
  },
  'sheets_collaborate.approval_delegate': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Delegating approval authority to another user',
  },
  'sheets_collaborate.approval_cancel': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Canceling an approval request',
  },

  // COLLABORATE TOOL
  'sheets_collaborate.share_add': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Granting access to a user',
    commonMistakes: ['Requires Drive API scope — may need re-auth if only Sheets scope is active'],
    errorRecovery: {
      PERMISSION_DENIED: 'Only file owners can change sharing settings',
      INVALID_VALUE: "Role must be 'reader', 'commenter', or 'writer' (not 'editor' or 'viewer')",
    },
  },
  'sheets_collaborate.comment_add': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a comment to a cell or range',
  },

  // SESSION TOOL (additional actions)
  'sheets_session.get_active': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting the currently active spreadsheet ID',
  },
  'sheets_session.get_context': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting full session context (active sheet, preferences, history)',
  },
  'sheets_session.record_operation': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Recording a manual operation for undo/redo tracking',
  },
  'sheets_session.get_last_operation': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting the last recorded operation',
  },
  'sheets_session.get_history': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting operation history with pagination',
  },
  'sheets_session.find_by_reference': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Finding previous operations by cell/range reference',
  },
  'sheets_session.update_preferences': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Saving user preferences (default ranges, formatting, etc.)',
  },
  'sheets_session.get_preferences': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Retrieving saved user preferences',
  },
  'sheets_session.update_profile_preferences': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating profile-level settings',
  },
  'sheets_session.set_pending': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Marking an action as pending (awaiting confirmation)',
  },
  'sheets_session.get_pending': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting pending actions awaiting user confirmation',
  },
  'sheets_session.clear_pending': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Clearing all pending actions',
  },
  'sheets_session.save_checkpoint': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Saving current state as a checkpoint for later restoration',
  },
  'sheets_session.load_checkpoint': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Restoring from a previously saved checkpoint',
  },
  'sheets_session.list_checkpoints': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all saved checkpoints with timestamps',
  },
  'sheets_session.delete_checkpoint': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a saved checkpoint',
  },
  'sheets_session.reset': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clearing all session state and checkpoints',
  },
  'sheets_session.acknowledge_alert': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Marking an alert as read/acknowledged',
  },
  'sheets_session.clear_alerts': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clearing all alerts from the session',
  },
  'sheets_session.get_alerts': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting all active alerts',
  },
  'sheets_session.set_user_id': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Setting the current user ID for attribution',
  },
  'sheets_session.get_profile': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting user profile information',
  },
  'sheets_session.record_successful_formula': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Recording a formula generation success for learning',
  },
  'sheets_session.reject_suggestion': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Recording a rejected suggestion to avoid future repeats',
  },
  'sheets_session.get_top_formulas': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting frequently used formulas from history',
  },
  'sheets_session.execute_pipeline': {
    apiCalls: 5,
    idempotent: false,
    whenToUse: 'Executing a DAG-based cross-tool pipeline from session context',
    commonMistakes: ['Pipelines can contain mutations — use dryRun:true first to preview'],
  },

  // SESSION TOOL
  'sheets_session.set_active': {
    apiCalls: 0,
    idempotent: true,
    whenToUse:
      'ALWAYS call this at the start of a multi-step workflow — sets context so you can use sheet names instead of IDs',
    commonMistakes: ['Must be called before sheets that reference "active spreadsheet" implicitly'],
    errorRecovery: {
      SPREADSHEET_NOT_FOUND: 'Ensure spreadsheetId is valid before setting as active',
    },
  },

  // QUALITY TOOL (additional actions)
  'sheets_quality.detect_conflicts': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Finding concurrent modification conflicts between versions',
  },
  'sheets_quality.resolve_conflict': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Resolving a detected conflict (keep current, use remote, merge)',
  },
  'sheets_quality.analyze_impact': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Predicting impact of changes on dependent cells',
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
    errorRecovery: {
      NOT_FOUND: 'No operation to undo — history may be empty or session was reset',
    },
  },
  'sheets_history.redo': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Re-applying the last undone operation',
    commonMistakes: [
      'redo clears when new operations are performed — once you modify data, redo history is lost',
    ],
  },
  'sheets_history.revert_to': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Revert to a specific checkpoint or revision',
    commonMistakes: [
      'Creates a snapshot before reverting — use sheets_history.undo to revert the revert',
    ],
  },
  'sheets_history.list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Get list of all tracked operations (undo/redo history)',
  },
  'sheets_history.get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Get details of a specific tracked operation',
  },
  'sheets_history.stats': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Get statistics on history (total operations, undo/redo state)',
  },
  'sheets_history.clear': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clear undo/redo history (cannot be undone)',
    commonMistakes: [
      'This operation itself is NOT undoable — use sheets_confirm to require user approval',
    ],
  },

  // F4: SMART SUGGESTIONS (sheets_analyze)
  'sheets_analyze.suggest_next_actions': {
    apiCalls: 2,
    idempotent: true,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Get ranked actionable suggestions for any spreadsheet — returns executable params ready for dispatch',
    whenNotToUse: 'When you already know what action to take',
    commonMistakes: [
      'Suggestions include executable params — verify with user before dispatching destructive ones',
    ],
  },
  'sheets_analyze.auto_enhance': {
    apiCalls: 5,
    idempotent: false,
    prerequisites: ['sheets_auth.login', 'sheets_analyze.suggest_next_actions'],
    whenToUse:
      'Auto-apply safe formatting/structure improvements — always preview first with mode:"preview"',
    whenNotToUse:
      'When you need data modifications — auto_enhance only applies non-destructive improvements',
    commonMistakes: ['Always use mode:"preview" first to see proposed changes before mode:"apply"'],
  },

  // F3: DATA CLEANING (sheets_fix)
  'sheets_fix.fix': {
    apiCalls: 2,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Auto-fix detected issues (deprecated — use clean instead)',
  },
  'sheets_fix.clean': {
    apiCalls: 3,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Auto-detect and fix common data issues (whitespace, types, duplicates, formats)',
    commonMistakes: [
      'Always use mode:"preview" first — clean in apply mode writes directly to cells',
      'Specify rules array to limit which cleaning rules run (default: all auto-detected)',
    ],
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      INVALID_RANGE: 'Use bounded range like Sheet1!A1:Z1000, not column-only refs like A:Z',
    },
  },
  'sheets_fix.standardize_formats': {
    apiCalls: 3,
    idempotent: true,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Normalize inconsistent dates, currencies, phone numbers, or percentages in a column',
    commonMistakes: [
      'Specify targetFormat per column — e.g., columns: [{column: "B", targetFormat: "iso_date"}]',
    ],
  },
  'sheets_fix.fill_missing': {
    apiCalls: 3,
    idempotent: true,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Fill empty cells using statistical strategies (forward, backward, mean, median, mode, constant)',
    commonMistakes: [
      'Mean/median strategies only work on numeric columns — use mode or constant for text',
    ],
  },
  'sheets_fix.detect_anomalies': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Flag statistical outliers in numeric data (IQR, z-score, or modified z-score)',
    whenNotToUse: 'For non-numeric data quality issues — use sheets_fix.suggest_cleaning instead',
  },
  'sheets_fix.suggest_cleaning': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Get AI-powered cleaning recommendations with severity ranking — read-only preview',
    whenNotToUse:
      'When you want to actually fix issues — use sheets_fix.clean after reviewing suggestions',
  },

  // F1: SHEET GENERATOR (sheets_composite)
  'sheets_composite.generate_sheet': {
    apiCalls: 8,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Create a full spreadsheet from a natural language description (structure + formulas + formatting)',
    whenNotToUse: 'When you need precise control over layout — use setup_sheet instead',
    commonMistakes: [
      'Use preview_generation first to verify proposed structure before creating',
      'Requires MCP Sampling capability for AI-powered generation; falls back to templates without it',
    ],
  },
  'sheets_composite.generate_template': {
    apiCalls: 1,
    idempotent: true,
    whenToUse:
      'Generate a reusable template definition from a description (parameterized with {{placeholders}})',
    whenNotToUse: 'When you need actual data — use generate_sheet instead',
  },
  'sheets_composite.preview_generation': {
    apiCalls: 0,
    idempotent: true,
    whenToUse:
      'Dry-run: preview proposed structure (columns, formulas, formatting) without creating anything',
  },

  // F5: TIME-TRAVEL (sheets_history)
  'sheets_history.timeline': {
    apiCalls: 3,
    idempotent: true,
    whenToUse:
      'View chronological per-cell change history with who/what/when — scope with range and since/until',
    commonMistakes: [
      'Large revision ranges are slow — always scope with since/until dates and limit parameter',
    ],
  },
  'sheets_history.diff_revisions': {
    apiCalls: 3,
    idempotent: true,
    whenToUse: 'Cell-level diff between two specific revisions — find exactly what changed',
    commonMistakes: [
      'Drive API metadata-only limitation: content-level diff may not be available for all revisions',
    ],
  },
  'sheets_history.restore_cells': {
    apiCalls: 4,
    idempotent: false,
    prerequisites: ['sheets_history.diff_revisions'],
    whenToUse:
      'Surgical restore of specific cells from a past revision (not full revision restore)',
    commonMistakes: [
      'Creates a snapshot before restoring — use sheets_history.undo to revert if needed',
      'Requires user confirmation via sheets_confirm',
    ],
  },

  // DEPENDENCIES TOOL (additional actions)
  'sheets_dependencies.build': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Building the formula dependency graph for a spreadsheet',
  },
  'sheets_dependencies.analyze_impact': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Analyzing impact of changes on dependent formulas',
    errorRecovery: {
      SHEET_NOT_FOUND: 'Build the dependency graph first with sheets_dependencies.build',
    },
  },
  'sheets_dependencies.detect_cycles': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Finding circular formula references',
  },
  'sheets_dependencies.get_dependencies': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all cells that a formula depends on',
  },
  'sheets_dependencies.get_dependents': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all cells that depend on a given formula',
  },
  'sheets_dependencies.get_stats': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting statistics on formula dependencies (depth, cycles, etc.)',
  },
  'sheets_dependencies.export_dot': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Exporting dependency graph in Graphviz DOT format',
  },

  // F6: SCENARIO MODELING (sheets_dependencies)
  'sheets_dependencies.model_scenario': {
    apiCalls: 4,
    idempotent: true,
    whenToUse:
      'What-if analysis: trace formula cascade when input cells change (e.g., "revenue drops 20%")',
    commonMistakes: [
      'Read-only — does NOT modify the spreadsheet. Use create_scenario_sheet to materialize results.',
    ],
  },
  'sheets_dependencies.compare_scenarios': {
    apiCalls: 8,
    idempotent: true,
    whenToUse: 'Side-by-side comparison of multiple what-if scenarios with delta analysis',
    commonMistakes: [
      'Each scenario runs model_scenario internally — API calls scale with scenario count',
    ],
  },
  'sheets_dependencies.create_scenario_sheet': {
    apiCalls: 6,
    idempotent: false,
    prerequisites: ['sheets_dependencies.model_scenario'],
    whenToUse:
      'Materialize a scenario as a new sheet with highlighted changes and conditional formatting',
    commonMistakes: [
      'Creates a new sheet — cannot be undone via sheets_history.undo (use sheets_core.delete_sheet)',
    ],
  },

  // DATA TOOL (additional actions)
  'sheets_data.add_note': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a note (comment) to a cell',
    whenNotToUse: 'For discussion threads — use sheets_collaborate.comment_add instead',
  },
  'sheets_data.get_note': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Retrieving the note content from a cell',
  },
  'sheets_data.clear_note': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a note from a cell',
  },
  'sheets_data.set_hyperlink': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Adding a hyperlink to a cell (URL, email, sheet reference, etc.)',
  },
  'sheets_data.clear_hyperlink': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a hyperlink from a cell (keeps text)',
  },
  'sheets_data.get_merges': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting list of all merged ranges in a sheet',
  },
  'sheets_data.merge_cells': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Merging a range of cells (keeps top-left value)',
    commonMistakes: [
      'Merging only keeps the top-left value — other cell values are discarded',
      'Cannot merge cells with different data types without conversion',
    ],
  },
  'sheets_data.unmerge_cells': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Unmerging previously merged cells',
  },
  'sheets_data.cut_paste': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Moving data from one location to another (removes from source)',
    commonMistakes: [
      'Source and destination ranges must have same dimensions',
      'Formulas are updated to reference new location',
    ],
  },
  'sheets_data.copy_paste': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Copying data from one location to another (keeps source intact)',
    commonMistakes: ['Relative formulas adjust to new location — use absolute refs ($) to prevent'],
  },
  'sheets_data.detect_spill_ranges': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Finding array formulas and their spill ranges',
    whenNotToUse: 'For simple single-cell formulas — spill detection is for array formulas only',
  },

  // F2: CROSS-SPREADSHEET (sheets_data)
  'sheets_data.cross_read': {
    apiCalls: 4,
    idempotent: true,
    whenToUse:
      'Read and merge data from multiple spreadsheets in one call — supports join by key column',
    commonMistakes: [
      'Each source needs its own spreadsheetId — make sure all are accessible with current auth',
      'For large sources, use specific ranges to avoid fetching entire sheets',
    ],
  },
  'sheets_data.cross_query': {
    apiCalls: 5,
    idempotent: true,
    whenToUse:
      'Natural language query across multiple spreadsheets (e.g., "total revenue from Sales joined with costs from Finance")',
    commonMistakes: [
      'Requires MCP Sampling for NL interpretation; falls back to cross_read without it',
    ],
  },
  'sheets_data.cross_write': {
    apiCalls: 4,
    idempotent: false,
    whenToUse: 'Copy data between spreadsheets — requires confirmation for destination overwrite',
    commonMistakes: [
      'Source and destination ranges must be compatible sizes',
      'Requires sheets_confirm approval before overwriting existing data',
    ],
  },
  'sheets_data.cross_compare': {
    apiCalls: 4,
    idempotent: true,
    whenToUse: 'Diff two ranges across different spreadsheets — find added/removed/changed rows',
    commonMistakes: [
      'Specify compareColumns to align rows by key — without it, comparison is positional',
    ],
  },

  // P14: COMPOSITE WORKFLOWS (sheets_composite)
  'sheets_composite.audit_sheet': {
    apiCalls: 6,
    idempotent: true,
    whenToUse:
      'Full compliance audit of a spreadsheet: data quality, formula consistency, access controls, and change history',
    whenNotToUse: 'When you only need data validation — use sheets_quality.validate instead',
    commonMistakes: [
      'Read-only — produces an audit report but does NOT modify the spreadsheet',
      'For large sheets, scoping to a specific range reduces API calls significantly',
    ],
  },
  'sheets_composite.publish_report': {
    apiCalls: 5,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Export a sheet as a formatted report (PDF/XLSX) and optionally share with recipients',
    commonMistakes: [
      'Sharing requires Drive API permissions — ensure auth includes drive.file scope',
    ],
  },
  'sheets_composite.data_pipeline': {
    apiCalls: 8,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Multi-step data transformation pipeline: read → clean → transform → write in one operation',
    commonMistakes: [
      'Use dryRun mode first to preview transformations before committing',
      'Large datasets should use specific ranges to avoid memory issues',
    ],
  },
  'sheets_composite.instantiate_template': {
    apiCalls: 4,
    idempotent: false,
    prerequisites: ['sheets_templates.create'],
    whenToUse:
      'Create a new spreadsheet from a saved template with variable substitution ({{placeholders}})',
    whenNotToUse: 'When the template has no placeholders — use sheets_core.copy instead',
  },
  'sheets_composite.migrate_spreadsheet': {
    apiCalls: 10,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse:
      'Copy structure and optionally data from one spreadsheet to another with schema transformation',
    commonMistakes: [
      'Creates a snapshot of the destination before writing — use sheets_history.undo to revert',
      'Named ranges and protected ranges are NOT migrated automatically',
    ],
  },
  'sheets_composite.batch_operations': {
    apiCalls: 10,
    idempotent: false,
    whenToUse:
      'Execute 3+ actions in one MCP call — reduces round trips by 60-75% for multi-step workflows',
    whenNotToUse: 'Single action — just call the tool directly',
    commonMistakes: [
      'Max 20 operations per batch — break larger workflows into multiple batches',
      'atomic:true wraps in transaction — requires active session context',
      'spreadsheetId is auto-injected, do not include it in operation params',
    ],
  },

  // TEMPLATES TOOL (all actions)
  'sheets_templates.list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting list of available templates',
  },
  'sheets_templates.get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific template',
  },
  'sheets_templates.create': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Creating a new reusable template from a spreadsheet',
  },
  'sheets_templates.apply': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Creating a new spreadsheet from a template',
  },
  'sheets_templates.update': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating template metadata (name, description)',
  },
  'sheets_templates.delete': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a saved template',
  },
  'sheets_templates.preview': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Previewing what a template will look like when applied',
  },
  'sheets_templates.import_builtin': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Creating a spreadsheet from a built-in template',
  },

  // ADVANCED TOOL (all actions)
  'sheets_advanced.add_named_range': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a named range for reuse in formulas',
  },
  'sheets_advanced.update_named_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Modifying an existing named range',
  },
  'sheets_advanced.delete_named_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a named range',
  },
  'sheets_advanced.list_named_ranges': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all named ranges in a spreadsheet',
  },
  'sheets_advanced.get_named_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific named range',
  },
  'sheets_advanced.add_protected_range': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Protecting a range so users cannot edit (requires drive permissions)',
  },
  'sheets_advanced.update_protected_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Modifying protection settings for a range',
  },
  'sheets_advanced.delete_protected_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing protection from a range',
  },
  'sheets_advanced.list_protected_ranges': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all protected ranges in a sheet',
  },
  'sheets_advanced.set_metadata': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Tagging cells/ranges with developer metadata for dynamic targeting',
  },
  'sheets_advanced.get_metadata': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Retrieving metadata tags from cells/ranges',
  },
  'sheets_advanced.delete_metadata': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing metadata tags',
  },
  'sheets_advanced.add_banding': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding alternating row/column colors',
  },
  'sheets_advanced.update_banding': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Changing banding colors or range',
  },
  'sheets_advanced.delete_banding': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing banding',
  },
  'sheets_advanced.list_banding': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all banding in a sheet',
  },
  'sheets_advanced.create_table': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a formatted table with headers and column filters',
  },
  'sheets_advanced.delete_table': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a table',
  },
  'sheets_advanced.list_tables': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all tables in a sheet',
  },
  'sheets_advanced.update_table': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating table properties (title, style, etc.)',
  },
  'sheets_advanced.rename_table_column': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Changing a table column header name',
  },
  'sheets_advanced.add_person_chip': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a person mention chip to a cell',
  },
  'sheets_advanced.add_drive_chip': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a Drive file link chip to a cell',
  },
  'sheets_advanced.add_rich_link_chip': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a rich link chip (preview) to a cell',
    commonMistakes: [
      'Only Drive file URLs are supported for write operations. YouTube, Calendar, and People chips can only be read (via list_chips), not created via the API.',
    ],
  },
  'sheets_advanced.list_chips': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all chips in a range',
  },
  'sheets_advanced.list_named_functions': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting custom functions defined in Apps Script',
  },
  'sheets_advanced.get_named_function': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific custom function',
  },
  'sheets_advanced.create_named_function': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a custom function via Apps Script',
  },
  'sheets_advanced.update_named_function': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Updating a custom function definition',
  },
  'sheets_advanced.delete_named_function': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a custom function',
  },
  'sheets_advanced.set_table_column_properties': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Setting properties (width, data validation) for table columns',
  },

  // AUTH TOOL (all actions)
  'sheets_auth.status': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Checking current authentication status',
  },
  'sheets_auth.login': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Initiating OAuth flow or token refresh',
    errorRecovery: {
      AUTH_EXPIRED: 'Token expired — run login flow again to refresh',
    },
  },
  'sheets_auth.callback': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Handling OAuth callback after user authorization',
  },
  'sheets_auth.logout': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clearing credentials and logging out',
  },

  // VISUALIZE TOOL (all actions)
  'sheets_visualize.chart_create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a new chart from data range',
    commonMistakes: ['Chart must be placed on a sheet — specify chartId or position'],
    errorRecovery: {
      INVALID_VALUE: 'dataRange must reference sheet data, not be empty',
    },
  },
  'sheets_visualize.chart_update': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Modifying chart title, type, or data range',
  },
  'sheets_visualize.chart_delete': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a chart',
  },
  'sheets_visualize.chart_list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all charts in a sheet',
  },
  'sheets_visualize.chart_get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific chart',
  },
  'sheets_visualize.chart_move': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Changing chart position on the sheet',
  },
  'sheets_visualize.chart_resize': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Adjusting chart height and width',
  },
  'sheets_visualize.chart_update_data_range': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Changing which data the chart visualizes',
  },
  'sheets_visualize.chart_add_trendline': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Adding a trendline to a chart series',
    commonMistakes: [
      'Trendlines are deprecated in some charts — use linear/exponential/polynomial trends where supported',
    ],
  },
  'sheets_visualize.chart_remove_trendline': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a trendline from a chart',
  },
  'sheets_visualize.pivot_create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a new pivot table',
  },
  'sheets_visualize.pivot_update': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Modifying pivot table rows, columns, or values',
  },
  'sheets_visualize.pivot_delete': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting a pivot table',
  },
  'sheets_visualize.pivot_list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all pivot tables in a sheet',
  },
  'sheets_visualize.pivot_get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific pivot table',
  },
  'sheets_visualize.pivot_refresh': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Refreshing pivot table data from source',
  },
  'sheets_visualize.suggest_chart': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'AI-powered chart recommendations based on data',
  },
  'sheets_visualize.suggest_pivot': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'AI-powered pivot table recommendations',
  },

  // BIGQUERY TOOL (all actions)
  'sheets_bigquery.connect': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Connecting sheet to BigQuery dataset',
  },
  'sheets_bigquery.connect_looker': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Linking to Looker reports',
  },
  'sheets_bigquery.disconnect': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing BigQuery connection',
  },
  'sheets_bigquery.list_connections': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all BigQuery connections for sheet',
  },
  'sheets_bigquery.get_connection': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific connection',
  },
  'sheets_bigquery.cancel_refresh': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Stopping a running BigQuery refresh',
  },
  'sheets_bigquery.query': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Running a BigQuery SQL query and returning results',
  },
  'sheets_bigquery.preview': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Preview query results before writing to sheet',
  },
  'sheets_bigquery.refresh': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Updating linked data from BigQuery',
  },
  'sheets_bigquery.list_datasets': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting available BigQuery datasets',
  },
  'sheets_bigquery.list_tables': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting tables in a BigQuery dataset',
  },
  'sheets_bigquery.get_table_schema': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting column structure of a BigQuery table',
  },
  'sheets_bigquery.export_to_bigquery': {
    apiCalls: 2,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Exporting sheet data to BigQuery table',
  },
  'sheets_bigquery.import_from_bigquery': {
    apiCalls: 2,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Importing BigQuery table into sheet',
  },
  'sheets_bigquery.create_scheduled_query': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Setting up automatic refresh schedule',
  },
  'sheets_bigquery.list_scheduled_queries': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all scheduled queries',
  },
  'sheets_bigquery.delete_scheduled_query': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a scheduled query',
  },

  // APPSSCRIPT TOOL (all actions)
  'sheets_appsscript.create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a new Apps Script project for the spreadsheet',
  },
  'sheets_appsscript.get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting Apps Script project metadata',
  },
  'sheets_appsscript.get_content': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Reading Apps Script source code',
  },
  'sheets_appsscript.update_content': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Modifying Apps Script source code',
  },
  'sheets_appsscript.create_version': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Saving current script as a named version',
  },
  'sheets_appsscript.list_versions': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all version history',
  },
  'sheets_appsscript.get_version': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting source code for a specific version',
  },
  'sheets_appsscript.deploy': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Deploying script as a web app or API',
  },
  'sheets_appsscript.list_deployments': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all active deployments',
  },
  'sheets_appsscript.get_deployment': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific deployment',
  },
  'sheets_appsscript.undeploy': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a deployment',
  },
  'sheets_appsscript.run': {
    apiCalls: 1,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Executing a function in the script',
    commonMistakes: [
      'Function must be defined and already deployed — local functions may not be callable',
    ],
  },
  'sheets_appsscript.list_processes': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting running script executions',
  },
  'sheets_appsscript.get_metrics': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting execution metrics (duration, quota used)',
  },
  'sheets_appsscript.create_trigger': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Setting up automated trigger (on edit, on open, timed, etc.)',
  },
  'sheets_appsscript.list_triggers': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all triggers',
  },
  'sheets_appsscript.delete_trigger': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a trigger',
  },
  'sheets_appsscript.update_trigger': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Modifying trigger conditions',
  },

  // FEDERATION TOOL (all actions)
  'sheets_federation.call_remote': {
    apiCalls: 1,
    idempotent: false,
    prerequisites: ['sheets_auth.login'],
    whenToUse: 'Calling a tool on a remote MCP server',
  },
  'sheets_federation.list_servers': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting registered remote MCP servers',
  },
  'sheets_federation.get_server_tools': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting available tools on a remote server',
  },
  'sheets_federation.validate_connection': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Testing connection to a remote server',
  },

  // WEBHOOK TOOL (all actions)
  'sheets_webhook.register': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Setting up a webhook to receive change notifications',
  },
  'sheets_webhook.unregister': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Removing a webhook',
  },
  'sheets_webhook.list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting all registered webhooks',
  },
  'sheets_webhook.get': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting details of a specific webhook',
  },
  'sheets_webhook.test': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Sending a test notification to verify webhook',
  },
  'sheets_webhook.get_stats': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting webhook delivery statistics',
  },
  'sheets_webhook.watch_changes': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Streaming live changes via Server-Sent Events',
  },

  // COMPUTE TOOL (Phase 5 — all read-only)
  'sheets_compute.evaluate': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Evaluating a mathematical expression referencing cell data',
    whenNotToUse: 'For formula dependency analysis use sheets_dependencies',
  },
  'sheets_compute.aggregate': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Computing sum/avg/count/min/max with optional group-by',
    whenNotToUse: 'For pivot tables with formatting use sheets_visualize.pivot_create',
  },
  'sheets_compute.statistical': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Full descriptive statistics, correlations, percentiles',
    whenNotToUse: 'For AI-powered analysis insights use sheets_analyze',
  },
  'sheets_compute.regression': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Fitting regression models (linear, polynomial, exponential, log, power)',
  },
  'sheets_compute.forecast': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Forecasting future values from time-series data',
  },
  'sheets_compute.matrix_op': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Matrix operations (transpose, multiply, inverse, determinant, eigenvalues)',
  },
  'sheets_compute.pivot_compute': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Server-side pivot computation without creating a sheet pivot table',
    whenNotToUse: 'To create an actual pivot table in the sheet use sheets_visualize.pivot_create',
  },
  'sheets_compute.custom_function': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Evaluating a custom expression over every row or cell in a range',
  },
  'sheets_compute.batch_compute': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Running 3+ computations in a single call for efficiency',
    commonMistakes: [
      'Each operation in the batch is independent — they cannot reference each other',
    ],
  },
  'sheets_compute.explain_formula': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Getting a plain-language explanation of what a formula does',
    whenNotToUse: 'For formula generation use sheets_analyze.generate_formula',
  },

  // ============================================================================
  // AGENT LOOP (Phase 6)
  // ============================================================================
  'sheets_agent.plan': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Creating a multi-step execution plan from a natural language description',
    whenNotToUse: 'For single operations — call the target tool directly',
  },
  'sheets_agent.execute': {
    apiCalls: 10,
    idempotent: false,
    whenToUse: 'Executing an entire plan autonomously with automatic checkpointing',
    whenNotToUse: 'For single-step execution — use execute_step instead',
  },
  'sheets_agent.execute_step': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Executing a single step from a plan with manual control',
    whenNotToUse: 'For full autonomous execution — use execute instead',
  },
  'sheets_agent.observe': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Capturing current spreadsheet state as a checkpoint for rollback',
    whenNotToUse: 'Checkpoints are created automatically during execute',
  },
  'sheets_agent.rollback': {
    apiCalls: 5,
    idempotent: false,
    whenToUse: 'Reverting spreadsheet to a previous checkpoint after a failed step',
    commonMistakes: ['Requires a valid checkpointId from a previous observe or execute'],
  },
  'sheets_agent.get_status': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Checking plan status, completed steps, and any errors',
  },
  'sheets_agent.list_plans': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Listing all saved execution plans with their statuses',
  },
  'sheets_agent.resume': {
    apiCalls: 10,
    idempotent: false,
    whenToUse: 'Resuming an interrupted or paused plan from the last checkpoint',
    whenNotToUse: 'For completed or failed plans — create a new plan instead',
  },

  // ============================================================================
  // LIVE DATA CONNECTORS (Wave 6)
  // ============================================================================
  'sheets_connectors.list_connectors': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Discovering available data connectors and their configuration status',
  },
  'sheets_connectors.configure': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Providing API credentials for Finnhub, FRED, Alpha Vantage, or Polygon',
    whenNotToUse:
      'For connectors that already use authType:"none" and are already configured',
  },
  'sheets_connectors.query': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Fetching live data from a single connector endpoint',
    whenNotToUse: 'For 2+ simultaneous queries use batch_query instead',
  },
  'sheets_connectors.batch_query': {
    apiCalls: 5,
    idempotent: true,
    whenToUse: 'Fetching data from multiple connectors or endpoints in a single call',
    whenNotToUse: 'For a single query use query instead (less overhead)',
  },
  'sheets_connectors.subscribe': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Setting up scheduled automatic data refresh into a spreadsheet range',
    commonMistakes: ['Connector must be configured before subscribing'],
  },
  'sheets_connectors.unsubscribe': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Cancelling an active data refresh subscription',
  },
  'sheets_connectors.list_subscriptions': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Listing all active scheduled data refresh subscriptions',
  },
  'sheets_connectors.transform': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Fetching connector data with inline filter/sort/limit transformations',
    whenNotToUse: 'Use query when no transformation is needed',
  },
  'sheets_connectors.status': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Checking connector health, quota usage, and last refresh time',
  },
  'sheets_connectors.discover': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Getting available endpoints and data schemas for a connector',
    whenNotToUse: 'Use query when you already know the endpoint and params',
  },
};

export interface ActionAnnotation {
  apiCalls?: number;
  idempotent?: boolean;
  batchAlternative?: string;
  prerequisites?: string[];
  commonMistakes?: string[];
  whenToUse?: string;
  whenNotToUse?: string;
  errorRecovery?: Record<string, string>;
}

export interface ActionGuidance {
  whenToUse?: string;
  whenNotToUse?: string;
  commonMistakes?: string[];
}

function buildActionAnnotationKey(toolName: string, actionName: string): string {
  return `${toolName}.${actionName}`;
}

export function getActionHints(toolName: string, actionName: string): string[] {
  const annotation = getActionAnnotation(toolName, actionName);
  if (!annotation) return [];

  const hints: string[] = [];

  if (annotation.batchAlternative) {
    hints.push(`For multiple operations, use ${annotation.batchAlternative} to reduce API calls.`);
  }

  if (annotation.idempotent === false) {
    hints.push('This action is non-idempotent; retries can duplicate effects.');
  }

  const topMistake = annotation.commonMistakes?.[0];
  if (topMistake) {
    hints.push(`Common mistake: ${topMistake}`);
  }

  return hints;
}

export function getBatchSuggestion(toolName: string, actionName: string): string | undefined {
  return getActionAnnotation(toolName, actionName)?.batchAlternative;
}

export function isRetryable(toolName: string, actionName: string): boolean {
  return getActionAnnotation(toolName, actionName)?.idempotent ?? false;
}

export function getApiCallCount(toolName: string, actionName: string): number {
  return getActionAnnotation(toolName, actionName)?.apiCalls ?? 1;
}

export function getPrerequisites(toolName: string, actionName: string): string[] {
  return getActionAnnotation(toolName, actionName)?.prerequisites ?? [];
}

export function getActionGuidance(toolName: string, actionName: string): ActionGuidance {
  const annotation = getActionAnnotation(toolName, actionName);
  if (!annotation) return {}; // OK: Explicit empty - unknown action has no guidance metadata

  return {
    whenToUse: annotation.whenToUse,
    whenNotToUse: annotation.whenNotToUse,
    commonMistakes: annotation.commonMistakes,
  };
}

export function shouldWarnAboutIdempotency(toolName: string, actionName: string): boolean {
  return getActionAnnotation(toolName, actionName)?.idempotent === false;
}

export function getActionAnnotationKeysForTool(toolName: string): string[] {
  return Object.keys(ACTION_ANNOTATIONS).filter((key) => key.startsWith(`${toolName}.`));
}

export function hasActionAnnotations(toolName: string, actionName: string): boolean {
  return buildActionAnnotationKey(toolName, actionName) in ACTION_ANNOTATIONS;
}

export function getActionAnnotation(
  toolName: string,
  actionName: string
): ActionAnnotation | undefined {
  return ACTION_ANNOTATIONS[buildActionAnnotationKey(toolName, actionName)];
}

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
