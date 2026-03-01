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
      alternativeActions: [
        {
          tool: 'sheets_analyze',
          action: 'scout',
          when: 'when you need structure info before reading',
        },
        {
          tool: 'sheets_data',
          action: 'batch_read',
          when: 'when reading 3+ ranges to save API calls',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet ID is valid by calling sheets_core.get',
        'Confirm the sheet name and range exist with sheets_core.list_sheets',
        'Check read access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This reads cell values from your spreadsheet. If it fails, verify the spreadsheet ID and sheet name are correct, and that you have read access.',
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
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'append',
          when: 'when adding new rows at the end instead of overwriting',
        },
        { tool: 'sheets_data', action: 'batch_write', when: 'when writing to 3+ ranges at once' },
      ],
      diagnosticSteps: [
        'Verify the target range exists and dimensions match your values array',
        'Check write access with sheets_collaborate.share_get',
        'Ensure the spreadsheet and sheet name are correct',
      ],
      userGuidance:
        'This modifies cell values in your spreadsheet. Before retrying, verify the target range is correct and that the values array dimensions match.',
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
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
      QUOTA_EXCEEDED: 'Wait 60s, then retry with a smaller range',
      INVALID_RANGE: 'Use bounded range like A1:Z1000, not column-only refs like A:Z',
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'write',
          when: 'when replacing cells with specific values instead of clearing',
        },
        {
          tool: 'sheets_format',
          action: 'clear_format',
          when: 'when clearing only formatting, not values',
        },
      ],
      diagnosticSteps: [
        'Verify the target range exists with sheets_core.list_sheets',
        'Confirm write access with sheets_collaborate.share_get',
        'Check the range dimensions are correct before clearing',
      ],
      userGuidance:
        'This clears cell values from your spreadsheet (formatting is preserved). Before retrying, verify the range is correct.',
    },
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
      alternativeActions: [
        { tool: 'sheets_data', action: 'write', when: 'when appending to a known specific range' },
        {
          tool: 'sheets_composite',
          action: 'smart_append',
          when: 'when columns might be reordered or misaligned',
        },
      ],
      diagnosticSteps: [
        'Confirm the sheet exists with sheets_core.list_sheets',
        'Check write access with sheets_collaborate.share_get',
        'Verify the values array matches the number of columns in the sheet',
      ],
      userGuidance:
        'Append adds new rows at the end of your data (not idempotent). If it fails, verify the sheet exists and has write access. Do not retry on timeout as it may create duplicates.',
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
      alternativeActions: [
        { tool: 'sheets_data', action: 'read', when: 'when reading a single range only' },
        {
          tool: 'sheets_analyze',
          action: 'scout',
          when: 'when you need metadata before batch reading',
        },
      ],
      diagnosticSteps: [
        'Verify all sheet names in the ranges array with sheets_core.list_sheets',
        'Confirm each range is properly formatted with sheet name (e.g., "Sheet1!A1:D10")',
        'Check read access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This reads multiple ranges at once. Before retrying, verify all sheet names exist and each range is properly formatted with the sheet name included.',
    },
  },
  'sheets_data.batch_write': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Writing to 3+ ranges in one call',
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet names',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
      QUOTA_EXCEEDED: 'Reduce the number of ranges or use multiple batch_write calls',
      INVALID_RANGE: 'Ensure each range is properly formatted with sheet name',
      alternativeActions: [
        { tool: 'sheets_data', action: 'write', when: 'when writing to only 1-2 ranges' },
      ],
      diagnosticSteps: [
        'Verify all sheet names exist with sheets_core.list_sheets',
        'Check that each range includes the sheet name',
        'Confirm write access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This writes values to multiple ranges at once. Before retrying, verify all sheet names exist and each range is properly formatted.',
    },
  },
  'sheets_data.batch_clear': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Clearing multiple ranges in one call',
    commonMistakes: [
      'Clears values only — formatting is preserved. Use sheets_format.clear_format for formatting',
    ],
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet names',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
      QUOTA_EXCEEDED: 'Reduce the number of ranges or split into multiple calls',
      alternativeActions: [
        { tool: 'sheets_data', action: 'clear', when: 'when clearing only 1-2 ranges' },
        { tool: 'sheets_format', action: 'clear_format', when: 'when clearing only formatting' },
      ],
      diagnosticSteps: [
        'Verify all sheet names exist with sheets_core.list_sheets',
        'Confirm write access with sheets_collaborate.share_get',
        'Check that each range is properly formatted',
      ],
      userGuidance:
        'This clears values from multiple ranges at once (formatting is preserved). Before retrying, verify all ranges are correct and you have write access.',
    },
  },
  'sheets_data.find_replace': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Bulk find-and-replace across a sheet or workbook',
    commonMistakes: [
      'Set allSheets:true carefully — it affects ALL sheets, not just the active one',
    ],
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
      QUOTA_EXCEEDED: 'Try again with a smaller range or fewer replacements',
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'write',
          when: 'when replacing cells with specific values at known locations',
        },
      ],
      diagnosticSteps: [
        'Verify the sheet exists with sheets_core.list_sheets',
        'Confirm write access with sheets_collaborate.share_get',
        'Test the find pattern with a smaller range first (use range parameter)',
      ],
      userGuidance:
        'Find and replace modifies multiple cells at once (not idempotent). Before retrying, verify you have write access. Consider using a smaller range to test first.',
    },
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
      alternativeActions: [
        {
          tool: 'sheets_format',
          action: 'apply_preset',
          when: 'when you want quick professional formatting',
        },
        {
          tool: 'sheets_format',
          action: 'batch_format',
          when: 'when formatting 3+ distinct ranges',
        },
      ],
      diagnosticSteps: [
        'Verify the range exists with sheets_core.list_sheets',
        'Check that the range is bounded (A1:Z1000 format, not full column refs)',
        'Confirm write access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This applies formatting to your cells (does not modify values). Before retrying, verify the range is bounded and properly formatted.',
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
      alternativeActions: [
        {
          tool: 'sheets_format',
          action: 'set_background',
          when: 'when changing background color only',
        },
        {
          tool: 'sheets_format',
          action: 'set_text_format',
          when: 'when changing font formatting only',
        },
      ],
      diagnosticSteps: [
        'Verify all sheet names exist with sheets_core.list_sheets',
        'Confirm each range is bounded (A1:Z1000 format, not column refs)',
        'Check that your operations array has 100 or fewer items',
      ],
      userGuidance:
        'This applies multiple formatting operations at once. Before retrying, verify all ranges are properly formatted and you have 100 or fewer operations.',
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
      alternativeActions: [
        {
          tool: 'sheets_core',
          action: 'get_sheet',
          when: 'when you need to verify sheet properties first',
        },
        {
          tool: 'sheets_dimensions',
          action: 'append',
          when: 'when adding rows at the end is acceptable',
        },
      ],
      diagnosticSteps: [
        'Verify the sheet exists with sheets_core.get_sheet',
        'Confirm the startIndex is 0-based (row 1 = 0, row 5 = 4)',
        'Check write access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This inserts rows or columns into your spreadsheet (not idempotent). Before retrying, verify the startIndex is correct (0-based) and you have write access.',
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
    errorRecovery: {
      INVALID_RANGE: 'Ensure the range exists and does not include the header row',
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets to verify the sheet exists',
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'read',
          when: 'when you need to fetch and sort client-side instead',
        },
        {
          tool: 'sheets_dimensions',
          action: 'create_filter_view',
          when: 'when you want non-destructive sorting',
        },
      ],
      diagnosticSteps: [
        'Verify the sheet exists with sheets_core.list_sheets',
        'Confirm the range excludes the header row',
        'Check that the sortSpecs reference valid column names',
      ],
      userGuidance:
        'This sorts your data by column values. Before retrying, verify the range excludes headers and references valid columns.',
    },
  },
  'sheets_dimensions.freeze': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Freezing header rows or left columns for scrolling',
    errorRecovery: {
      INVALID_RANGE: 'Use valid row/column indices for the freeze point',
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets to verify the sheet exists',
      alternativeActions: [
        {
          tool: 'sheets_core',
          action: 'get_sheet',
          when: 'when you need to verify sheet exists first',
        },
      ],
      diagnosticSteps: [
        'Verify the sheet exists with sheets_core.list_sheets',
        'Confirm you have write access with sheets_collaborate.share_get',
        'Check the freeze row and column indices are within the sheet bounds',
      ],
      userGuidance:
        'This freezes rows and columns for scrolling (formatting only, no data change). Before retrying, verify the freeze indices are within the sheet bounds.',
    },
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
      alternativeActions: [
        {
          tool: 'sheets_core',
          action: 'get',
          when: 'when you need full spreadsheet metadata instead',
        },
        {
          tool: 'sheets_analyze',
          action: 'scout',
          when: 'when you need a quick structural overview',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet ID by checking the Google Sheets URL (format: docs.google.com/spreadsheets/d/{id})',
        'Confirm read access with sheets_collaborate.share_get',
        'Test the ID by calling sheets_core.get',
      ],
      userGuidance:
        'This lists all sheets in your spreadsheet. Before retrying, verify the spreadsheet ID is correct (from the URL) and you have read access.',
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
      alternativeActions: [
        {
          tool: 'sheets_composite',
          action: 'generate_sheet',
          when: 'when you want AI to populate structure and formulas',
        },
        { tool: 'sheets_templates', action: 'apply', when: 'when you want to use a template' },
      ],
      diagnosticSteps: [
        'Verify you have drive.file permission by calling sheets_auth.login',
        'Check if you have quota remaining in Google Drive',
        'Confirm the title parameter is a valid string',
      ],
      userGuidance:
        'This creates a new spreadsheet in your Google Drive. Before retrying, ensure you have logged in with drive.file permission.',
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
      alternativeActions: [
        {
          tool: 'sheets_core',
          action: 'list_sheets',
          when: 'when you need to check for existing sheet names first',
        },
        {
          tool: 'sheets_core',
          action: 'duplicate_sheet',
          when: 'when you want to copy an existing sheet',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet ID is correct with sheets_core.list_sheets',
        'Check that the sheet name is unique (not already in use)',
        'Confirm write access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This adds a new sheet to your spreadsheet. Before retrying, verify the spreadsheet ID is correct and the sheet name is unique.',
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
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'write',
          when: 'when manually inserting CSV rows after parsing',
        },
        {
          tool: 'sheets_composite',
          action: 'import_and_format',
          when: 'when you want auto-formatting applied',
        },
      ],
      diagnosticSteps: [
        'Verify the CSV has consistent column counts in each row',
        'Check for embedded newlines or extra commas in field values',
        'Ensure the target sheet exists with sheets_core.list_sheets',
      ],
      userGuidance:
        'This imports CSV data into your sheet. Before retrying, verify the CSV has consistent columns and the target sheet is correct.',
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
      alternativeActions: [
        {
          tool: 'sheets_session',
          action: 'set_active',
          when: 'when you need to set session context first',
        },
      ],
      diagnosticSteps: [
        'Check if an active transaction exists with sheets_transaction.status',
        'If one exists, call sheets_transaction.rollback to close it',
        'Verify you have write access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This starts a transaction for batching multiple operations. Before retrying, check if an active transaction still exists and roll it back if needed.',
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
      alternativeActions: [
        {
          tool: 'sheets_analyze',
          action: 'comprehensive',
          when: 'when you need full data analysis',
        },
        { tool: 'sheets_core', action: 'get', when: 'when you only need spreadsheet metadata' },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet ID is correct by checking the Google Sheets URL',
        'Confirm read access with sheets_collaborate.share_get',
        'Test with sheets_core.get to verify basic access',
      ],
      userGuidance:
        'This gives a quick overview of your spreadsheet structure (sheet names, row counts, column types). Before retrying, verify the spreadsheet ID is correct.',
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
  'sheets_collaborate.list_access_proposals': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'View pending access requests from users who want permission to this spreadsheet.',
    commonMistakes: [
      'Confusing with share_list which shows existing permissions, not pending requests.',
    ],
    errorRecovery: {
      PERMISSION_DENIED: 'You must be an owner or editor to view access proposals.',
      alternativeActions: [
        {
          tool: 'sheets_collaborate',
          action: 'share_list',
          when: 'when you want to see current permissions instead',
        },
      ],
      diagnosticSteps: [
        'Verify you are an owner or editor of the spreadsheet',
        'Confirm you have read access with sheets_collaborate.share_get',
        'Check that the spreadsheet ID is correct',
      ],
      userGuidance:
        'This lists pending access requests for your spreadsheet. Before retrying, verify you are an owner or editor of the spreadsheet.',
    },
  },
  'sheets_collaborate.resolve_access_proposal': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Approve or deny a pending access request by its proposal ID.',
    commonMistakes: ['Call list_access_proposals first to get the proposalId.'],
    errorRecovery: {
      NOT_FOUND: 'Proposal may have expired or already been resolved.',
      alternativeActions: [
        {
          tool: 'sheets_collaborate',
          action: 'list_access_proposals',
          when: 'when you need fresh list of proposals',
        },
        {
          tool: 'sheets_collaborate',
          action: 'share_add',
          when: 'when you want to manually grant access instead',
        },
      ],
      diagnosticSteps: [
        'Verify the proposal ID is valid by calling sheets_collaborate.list_access_proposals',
        'Check that the proposal has not already been resolved or expired',
        'Confirm you are an owner or editor of the spreadsheet',
      ],
      userGuidance:
        'This approves or denies an access request. Before retrying, verify the proposal ID is valid and has not expired (check list_access_proposals).',
    },
  },
  'sheets_collaborate.label_list': {
    apiCalls: 1,
    idempotent: true,
    whenToUse:
      'Retrieve all Drive labels applied to this spreadsheet for classification or compliance.',
    commonMistakes: ['Requires Drive Labels API enabled in the GCP project.'],
    errorRecovery: {
      PERMISSION_DENIED: 'Drive Labels API must be enabled and user must have read access.',
      alternativeActions: [
        {
          tool: 'sheets_auth',
          action: 'login',
          when: 'when you need to re-auth with broader scopes',
        },
      ],
      diagnosticSteps: [
        'Verify the Drive Labels API is enabled in your GCP project',
        'Confirm you have read access to the spreadsheet with sheets_collaborate.share_get',
        'Re-authenticate with sheets_auth.login if needed',
      ],
      userGuidance:
        'This lists Drive labels applied to your spreadsheet. Before retrying, ensure the Drive Labels API is enabled in your GCP project and you have read access.',
    },
  },
  'sheets_collaborate.label_apply': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Apply a Drive label to classify this spreadsheet (e.g., confidential, department).',
    commonMistakes: ['Get labelId from label_list — do not guess label IDs.'],
    errorRecovery: {
      INVALID_PARAMS: 'Verify labelId exists via label_list before applying.',
      alternativeActions: [
        {
          tool: 'sheets_collaborate',
          action: 'label_list',
          when: 'when you need to get valid labelIds first',
        },
      ],
      diagnosticSteps: [
        'Verify the labelId is valid by calling sheets_collaborate.label_list',
        'Confirm you have write access to the spreadsheet',
        'Check that the label is not already applied',
      ],
      userGuidance:
        'This applies a Drive label to your spreadsheet. Before retrying, get a valid labelId from label_list.',
    },
  },
  'sheets_collaborate.label_remove': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Remove a Drive label previously applied to this spreadsheet.',
    commonMistakes: ['Label must currently be applied — confirm with label_list first.'],
    errorRecovery: {
      NOT_FOUND: 'Label may not be applied. Confirm with label_list before removing.',
      alternativeActions: [
        {
          tool: 'sheets_collaborate',
          action: 'label_list',
          when: 'when you need to verify applied labels first',
        },
      ],
      diagnosticSteps: [
        'Verify the label is currently applied by calling sheets_collaborate.label_list',
        'Confirm you have write access to the spreadsheet',
        'Check the labelId matches one of the applied labels',
      ],
      userGuidance:
        'This removes a Drive label from your spreadsheet. Before retrying, verify the label is currently applied (check label_list).',
    },
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
      alternativeActions: [
        {
          tool: 'sheets_collaborate',
          action: 'share_set_link',
          when: 'when you want to create a shareable link instead',
        },
        {
          tool: 'sheets_collaborate',
          action: 'share_list',
          when: 'when you want to check existing permissions first',
        },
      ],
      diagnosticSteps: [
        'Verify you are the owner of the spreadsheet with sheets_collaborate.share_get',
        'Confirm the role is one of: reader, commenter, or writer',
        'Check that the emailAddress is valid and in the correct format',
      ],
      userGuidance:
        'This grants access to a user on your spreadsheet. Before retrying, verify you are the owner and the role is valid (reader, commenter, or writer).',
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
  'sheets_session.schedule_create': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a recurring cron schedule that runs a tool action automatically',
    commonMistakes: [
      'Validate cron expression and target action parameters before enabling in production',
    ],
  },
  'sheets_session.schedule_list': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Listing active and disabled scheduled jobs',
  },
  'sheets_session.schedule_cancel': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Disabling and removing a scheduled job',
  },
  'sheets_session.schedule_run_now': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Triggering a scheduled job immediately for smoke-testing',
    whenNotToUse: 'For read-only inspection use schedule_list instead',
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
      alternativeActions: [
        {
          tool: 'sheets_core',
          action: 'get',
          when: 'when you need to validate the spreadsheetId first',
        },
        {
          tool: 'sheets_analyze',
          action: 'scout',
          when: 'when you need to verify spreadsheet structure',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet ID is correct by checking the Google Sheets URL',
        'Confirm read access with sheets_collaborate.share_get',
        'Test the ID by calling sheets_core.get',
      ],
      userGuidance:
        'This sets the active spreadsheet for your session. Before retrying, verify the spreadsheet ID is correct from the URL.',
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
      alternativeActions: [
        {
          tool: 'sheets_history',
          action: 'list',
          when: 'when you need to check undo history first',
        },
        {
          tool: 'sheets_collaborate',
          action: 'version_restore_revision',
          when: 'when you want to restore from revision history',
        },
      ],
      diagnosticSteps: [
        'Check if there are any operations to undo with sheets_history.list',
        'Verify the operation exists in the history before undoing',
        'Confirm you have write access with sheets_collaborate.share_get',
      ],
      userGuidance:
        'This undoes the last tracked operation. Before retrying, check the operation history (sheets_history.list) to verify there are operations to undo.',
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
    errorRecovery: {
      SHEET_NOT_FOUND: 'Verify spreadsheetId with sheets_core.get first',
      PERMISSION_DENIED: 'Requires at least read access to the spreadsheet',
      alternativeActions: [
        {
          tool: 'sheets_analyze',
          action: 'comprehensive',
          when: 'when you want full analysis before suggestions',
        },
        {
          tool: 'sheets_analyze',
          action: 'scout',
          when: 'when you just need a quick structural check',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet and range contain data by calling sheets_analyze.scout',
        'Confirm read access with sheets_collaborate.share_get',
        'Check that the range is properly formatted',
      ],
      userGuidance:
        'This suggests actionable improvements for your data. Before retrying, verify the spreadsheet has data and the range is correct.',
    },
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
    errorRecovery: {
      SHEET_NOT_FOUND: 'Verify spreadsheetId with sheets_core.get first',
      ENHANCEMENT_FAILED: 'Run suggest_next_actions to get fresh suggestions, then retry',
      alternativeActions: [
        {
          tool: 'sheets_analyze',
          action: 'suggest_next_actions',
          when: 'when you want suggestions instead of auto-apply',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet exists with sheets_core.get',
        'Check that mode is set to "preview" first to verify proposed changes',
        'Call suggest_next_actions to ensure suggestions are available',
      ],
      userGuidance:
        'This automatically applies safe improvements like formatting and structure changes. Always preview first to see the changes before applying them.',
    },
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
      alternativeActions: [
        {
          tool: 'sheets_fix',
          action: 'standardize_formats',
          when: 'when cleaning specific format issues only',
        },
        {
          tool: 'sheets_quality',
          action: 'validate',
          when: 'when you want to validate before cleaning',
        },
      ],
      diagnosticSteps: [
        'Verify the range contains data with sheets_data.read',
        'Ensure the range is properly formatted (A1:Z1000, not column-only refs)',
        'Preview the changes first with mode:"preview" before applying',
      ],
      userGuidance:
        'This auto-detects and fixes common data quality issues like whitespace trimming, type normalization, and duplicates. Always preview first to verify the changes.',
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
    errorRecovery: {
      INVALID_RANGE: 'Use bounded range like Sheet1!A1:Z1000, not column-only refs like A:Z',
      PARSE_ERROR: 'Some values may not be parseable — run detect_anomalies first to identify them',
      alternativeActions: [
        {
          tool: 'sheets_fix',
          action: 'detect_anomalies',
          when: 'when you want to identify unparseable values first',
        },
        {
          tool: 'sheets_format',
          action: 'set_number_format',
          when: 'when you want just to set number format',
        },
      ],
      diagnosticSteps: [
        'Verify the range has content with sheets_data.read',
        'Identify problematic values with detect_anomalies first',
        'Ensure columns array specifies both column letter and targetFormat per column',
      ],
      userGuidance:
        'This normalizes format inconsistencies (dates, currencies, phone numbers). Some values may not parse—check for outliers with detect_anomalies first.',
    },
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
    errorRecovery: {
      INVALID_RANGE: 'Use bounded range like Sheet1!A1:Z1000, not column-only refs like A:Z',
      NO_DATA: 'Range contains no data — verify with sheets_data.read first',
      alternativeActions: [
        { tool: 'sheets_data', action: 'read', when: 'when you need to verify data exists first' },
        {
          tool: 'sheets_compute',
          action: 'statistical',
          when: 'when computing statistics for mean/median',
        },
      ],
      diagnosticSteps: [
        'Verify the range has data with sheets_data.read',
        'Check column types — mean/median only work on numeric columns',
        'Choose appropriate strategy for each column type (forward/backward for text, mean/median for numbers)',
      ],
      userGuidance:
        'This fills empty cells using statistical strategies. Mean and median only work on numeric columns—use mode or constant for text columns.',
    },
  },
  'sheets_fix.detect_anomalies': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Flag statistical outliers in numeric data (IQR, z-score, or modified z-score)',
    whenNotToUse: 'For non-numeric data quality issues — use sheets_fix.suggest_cleaning instead',
    errorRecovery: {
      NO_NUMERIC_DATA: 'Anomaly detection requires numeric columns — check column types first',
      INVALID_RANGE: 'Use bounded range like Sheet1!A1:Z1000',
      alternativeActions: [
        {
          tool: 'sheets_compute',
          action: 'statistical',
          when: 'when you want statistical analysis of numeric data',
        },
        {
          tool: 'sheets_analyze',
          action: 'analyze_data',
          when: 'when you want type detection first',
        },
      ],
      diagnosticSteps: [
        'Verify the range contains numeric data with sheets_analyze.analyze_data',
        'Check that the method parameter is valid (iqr, zscore, or modified_zscore)',
        'Ensure the threshold parameter matches your method (e.g., 1.5 for IQR, 3 for z-score)',
      ],
      userGuidance:
        'This flags statistical outliers in numeric columns. It only works on numeric data—use type detection first to understand your column types.',
    },
  },
  'sheets_fix.suggest_cleaning': {
    apiCalls: 2,
    idempotent: true,
    whenToUse: 'Get AI-powered cleaning recommendations with severity ranking — read-only preview',
    whenNotToUse:
      'When you want to actually fix issues — use sheets_fix.clean after reviewing suggestions',
    errorRecovery: {
      SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
      SAMPLING_UNAVAILABLE: 'Falls back to rule-based suggestions without MCP Sampling',
      alternativeActions: [
        {
          tool: 'sheets_fix',
          action: 'clean',
          when: 'when you want to auto-apply the suggestions',
        },
        {
          tool: 'sheets_quality',
          action: 'validate',
          when: 'when you want basic validation instead',
        },
      ],
      diagnosticSteps: [
        'Verify the range has data with sheets_data.read',
        'Check that the sheet exists with sheets_core.list_sheets',
        'Review suggestions before applying with sheets_fix.clean',
      ],
      userGuidance:
        'This provides AI-powered cleaning recommendations with severity rankings. It is read-only—use sheets_fix.clean to actually apply the suggestions.',
    },
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
    errorRecovery: {
      SAMPLING_UNAVAILABLE:
        'Falls back to template-based generation (financial, tracker, inventory, generic)',
      QUOTA_EXCEEDED: 'Reduce description complexity or use preview_generation to verify first',
      PERMISSION_DENIED: 'Requires write access — check auth with sheets_auth.status',
      alternativeActions: [
        {
          tool: 'sheets_composite',
          action: 'preview_generation',
          when: 'when you want to preview structure first',
        },
        {
          tool: 'sheets_composite',
          action: 'setup_sheet',
          when: 'when you want manual structure control',
        },
        {
          tool: 'sheets_templates',
          action: 'apply',
          when: 'when you want to use a pre-built template',
        },
      ],
      diagnosticSteps: [
        'Verify auth with sheets_auth.status before attempting generation',
        'Use preview_generation first to verify the proposed structure',
        'Check that the description is clear and specifies the data structure you want',
      ],
      userGuidance:
        'This creates a full spreadsheet from a description, including structure, formulas, and formatting. Always preview first to see what will be generated.',
    },
  },
  'sheets_composite.generate_template': {
    apiCalls: 1,
    idempotent: true,
    whenToUse:
      'Generate a reusable template definition from a description (parameterized with {{placeholders}})',
    whenNotToUse: 'When you need actual data — use generate_sheet instead',
    errorRecovery: {
      SAMPLING_UNAVAILABLE: 'Falls back to built-in template patterns',
      alternativeActions: [
        {
          tool: 'sheets_composite',
          action: 'generate_sheet',
          when: 'when you want to create a full sheet instead',
        },
      ],
      diagnosticSteps: [
        'Verify the description clearly specifies the template structure',
        'Identify where {{placeholders}} should be used for variable substitution',
        'Save the generated template with sheets_templates.create if reuse is needed',
      ],
      userGuidance:
        'This generates a reusable template with {{placeholder}} tokens for variable substitution. It returns the template definition without creating a spreadsheet.',
    },
  },
  'sheets_composite.preview_generation': {
    apiCalls: 0,
    idempotent: true,
    whenToUse:
      'Dry-run: preview proposed structure (columns, formulas, formatting) without creating anything',
    errorRecovery: {
      SAMPLING_UNAVAILABLE: 'Falls back to built-in template preview',
      alternativeActions: [
        {
          tool: 'sheets_composite',
          action: 'generate_sheet',
          when: 'when you want to create the sheet',
        },
      ],
      diagnosticSteps: [
        'Provide a clear description of the sheet structure you want',
        'Review the preview to verify columns, formulas, and formatting match expectations',
        'Use generate_sheet to create if the preview looks correct',
      ],
      userGuidance:
        'This previews the structure without creating anything. It is a zero-API-call dry-run to verify the generated structure before creating the actual sheet.',
    },
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
    errorRecovery: {
      REVISION_NOT_FOUND: 'Drive API may limit revision access — narrow the since/until window',
      PERMISSION_DENIED: 'Requires read access to Drive revision history',
      alternativeActions: [
        {
          tool: 'sheets_history',
          action: 'list',
          when: 'when you want operation history instead of revisions',
        },
        {
          tool: 'sheets_collaborate',
          action: 'version_list_revisions',
          when: 'when you want Drive revision list',
        },
      ],
      diagnosticSteps: [
        'Verify spreadsheet has read access with sheets_core.get',
        'Scope the search with since/until dates and limit parameter for performance',
        'Check that the range parameter is properly formatted if scoping to specific cells',
      ],
      userGuidance:
        'This shows chronological per-cell changes. For large revision ranges, always scope with since/until dates and limit parameter for better performance.',
    },
  },
  'sheets_history.diff_revisions': {
    apiCalls: 3,
    idempotent: true,
    whenToUse: 'Cell-level diff between two specific revisions — find exactly what changed',
    commonMistakes: [
      'Drive API metadata-only limitation: content-level diff may not be available for all revisions',
    ],
    errorRecovery: {
      REVISION_NOT_FOUND: 'Use sheets_history.timeline to get valid revision IDs first',
      METADATA_ONLY:
        'Drive API limitation — revision content may not be available for old revisions',
      alternativeActions: [
        {
          tool: 'sheets_history',
          action: 'timeline',
          when: 'when you need to find valid revision IDs',
        },
      ],
      diagnosticSteps: [
        'Get valid revision IDs from sheets_history.timeline first',
        'Verify both revision IDs exist before calling diff_revisions',
        'Check if revision content is available (old revisions may be metadata-only)',
      ],
      userGuidance:
        'This shows cell-level differences between two revisions. If content is not available for old revisions, you may only see metadata changes due to Drive API limitations.',
    },
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
    errorRecovery: {
      REVISION_NOT_FOUND: 'Use sheets_history.diff_revisions to verify revision ID exists',
      CELL_NOT_FOUND: 'Cell reference may not exist in that revision — check with diff_revisions',
      CONFIRMATION_DECLINED: 'User declined restore — no changes were made',
      alternativeActions: [
        {
          tool: 'sheets_history',
          action: 'diff_revisions',
          when: 'when you need to verify cells exist in revision',
        },
        {
          tool: 'sheets_history',
          action: 'undo',
          when: 'when you want to undo recent operations instead',
        },
      ],
      diagnosticSteps: [
        'Use sheets_history.diff_revisions to verify the cells exist in the target revision',
        'Confirm the revision ID is correct and accessible',
        'Ensure all cell references are valid A1 notation format',
      ],
      userGuidance:
        'This surgically restores specific cells from a past revision. It creates a snapshot before restoring, so you can undo if needed. User confirmation is required.',
    },
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
      alternativeActions: [
        {
          tool: 'sheets_dependencies',
          action: 'build',
          when: 'when you need to build dependency graph first',
        },
        {
          tool: 'sheets_analyze',
          action: 'analyze_formulas',
          when: 'when you want formula analysis instead',
        },
      ],
      diagnosticSteps: [
        'Build the dependency graph with sheets_dependencies.build if not yet built',
        'Verify the cell reference exists in the spreadsheet',
        'Check that all dependent cells are accessible',
      ],
      userGuidance:
        'This analyzes how changes to a cell will impact dependent formulas. Build the dependency graph first for best results.',
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
    errorRecovery: {
      NO_FORMULAS:
        'Spreadsheet has no formulas — build dependency graph first with sheets_dependencies.build',
      UNSUPPORTED_FUNCTION:
        'Some formulas cannot be simulated — result shows dependency chain instead of computed values',
      alternativeActions: [
        {
          tool: 'sheets_dependencies',
          action: 'build',
          when: 'when you need to build dependency graph first',
        },
        {
          tool: 'sheets_compute',
          action: 'evaluate',
          when: 'when you want to compute values manually',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet has formulas with sheets_dependencies.build',
        'Identify which cells to change in the scenario',
        'Check that all formulas use supported functions (complex formulas may show dependency chains only)',
      ],
      userGuidance:
        'This performs what-if analysis by tracing formula cascades. It is read-only—use create_scenario_sheet to create a materialized version with the changes.',
    },
  },
  'sheets_dependencies.compare_scenarios': {
    apiCalls: 8,
    idempotent: true,
    whenToUse: 'Side-by-side comparison of multiple what-if scenarios with delta analysis',
    commonMistakes: [
      'Each scenario runs model_scenario internally — API calls scale with scenario count',
    ],
    errorRecovery: {
      QUOTA_EXCEEDED: 'Reduce number of scenarios or narrow the cell change set per scenario',
      NO_FORMULAS: 'Build dependency graph first with sheets_dependencies.build',
      alternativeActions: [
        {
          tool: 'sheets_dependencies',
          action: 'model_scenario',
          when: 'when you want single scenario only',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet has formulas with sheets_dependencies.build',
        'Limit the number of scenarios to reduce API calls',
        'Ensure cell changes are minimal to avoid quota exceeded errors',
      ],
      userGuidance:
        'This compares multiple what-if scenarios side-by-side. API calls scale with scenario count—use model_scenario for a single scenario instead.',
    },
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
    errorRecovery: {
      SHEET_ALREADY_EXISTS: 'Target sheet name already exists — provide a unique targetSheet name',
      PERMISSION_DENIED: 'Requires write access to the spreadsheet',
      alternativeActions: [
        {
          tool: 'sheets_dependencies',
          action: 'model_scenario',
          when: 'when you want to preview scenario instead',
        },
        {
          tool: 'sheets_core',
          action: 'add_sheet',
          when: 'when you want to create a blank sheet manually',
        },
      ],
      diagnosticSteps: [
        'Run model_scenario first to verify the scenario changes are correct',
        'Provide a unique targetSheet name if the default conflicts',
        'Verify write access to the spreadsheet before attempting creation',
      ],
      userGuidance:
        'This creates a new sheet with scenario changes materialized. It cannot be undone with undo—delete the sheet manually if needed with sheets_core.delete_sheet.',
    },
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
    errorRecovery: {
      PERMISSION_DENIED:
        'Check auth for each source spreadsheet individually with sheets_auth.status',
      SHEET_NOT_FOUND: 'Verify each source spreadsheetId/range with sheets_core.get',
      NETWORK_ERROR: 'Transient failure — retry automatically with executeWithRetry',
      alternativeActions: [
        { tool: 'sheets_data', action: 'read', when: 'when reading from single spreadsheet only' },
        { tool: 'sheets_auth', action: 'status', when: 'when you need to verify auth status' },
      ],
      diagnosticSteps: [
        'Verify auth status for each source spreadsheet with sheets_auth.status',
        'Confirm all spreadsheetIds and ranges are correct with sheets_core.get',
        'Use specific ranges instead of entire sheets for better performance',
      ],
      userGuidance:
        'This reads and merges data from multiple spreadsheets. Ensure all source spreadsheetIds are accessible and use specific ranges for large sources.',
    },
  },
  'sheets_data.cross_query': {
    apiCalls: 5,
    idempotent: true,
    whenToUse:
      'Natural language query across multiple spreadsheets (e.g., "total revenue from Sales joined with costs from Finance")',
    commonMistakes: [
      'Requires MCP Sampling for NL interpretation; falls back to cross_read without it',
    ],
    errorRecovery: {
      SAMPLING_UNAVAILABLE:
        'Falls back to cross_read without NL interpretation — provide explicit ranges',
      PERMISSION_DENIED: 'Check auth for each source spreadsheet individually',
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'cross_read',
          when: 'when you can specify ranges explicitly',
        },
        {
          tool: 'sheets_analyze',
          action: 'query_natural_language',
          when: 'when querying single spreadsheet only',
        },
      ],
      diagnosticSteps: [
        'Verify auth status for each source spreadsheet',
        'Ensure the query clearly describes the data sources and join logic',
        'Check that all referenced spreadsheets are accessible',
      ],
      userGuidance:
        'This performs natural language queries across multiple spreadsheets. It requires MCP Sampling—without it, use cross_read with explicit ranges instead.',
    },
  },
  'sheets_data.cross_write': {
    apiCalls: 4,
    idempotent: false,
    whenToUse: 'Copy data between spreadsheets — requires confirmation for destination overwrite',
    commonMistakes: [
      'Source and destination ranges must be compatible sizes',
      'Requires sheets_confirm approval before overwriting existing data',
    ],
    errorRecovery: {
      CONFIRMATION_DECLINED: 'User declined overwrite — no changes made',
      SIZE_MISMATCH: 'Resize destination range to match source data dimensions',
      PERMISSION_DENIED: 'Requires write access to destination spreadsheet',
      alternativeActions: [
        { tool: 'sheets_data', action: 'write', when: 'when writing to single spreadsheet only' },
        { tool: 'sheets_core', action: 'copy', when: 'when copying entire spreadsheet' },
      ],
      diagnosticSteps: [
        'Verify read access to the source spreadsheet',
        'Verify write access to the destination spreadsheet',
        'Ensure source and destination ranges have compatible dimensions',
      ],
      userGuidance:
        'This copies data between spreadsheets and requires user confirmation before overwriting. Ensure source and destination range sizes match.',
    },
  },
  'sheets_data.cross_compare': {
    apiCalls: 4,
    idempotent: true,
    whenToUse: 'Diff two ranges across different spreadsheets — find added/removed/changed rows',
    commonMistakes: [
      'Specify compareColumns to align rows by key — without it, comparison is positional',
    ],
    errorRecovery: {
      PERMISSION_DENIED: 'Check auth for both source spreadsheets',
      NO_DATA: 'One or both ranges are empty — verify with sheets_data.read first',
      alternativeActions: [
        {
          tool: 'sheets_data',
          action: 'read',
          when: 'when reading single range for manual comparison',
        },
      ],
      diagnosticSteps: [
        'Verify read access to both source spreadsheets',
        'Confirm both ranges have data with sheets_data.read',
        'Specify compareColumns to align rows by key for accurate comparison',
      ],
      userGuidance:
        'This compares two ranges across different spreadsheets. Specify compareColumns for key-based alignment, otherwise comparison is positional.',
    },
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
    errorRecovery: {
      SHEET_NOT_FOUND: 'Verify spreadsheetId with sheets_core.get first',
      PERMISSION_DENIED:
        'Requires at least read access plus Drive revision access for change history',
      alternativeActions: [
        { tool: 'sheets_quality', action: 'validate', when: 'when you want basic validation only' },
        {
          tool: 'sheets_analyze',
          action: 'comprehensive',
          when: 'when you want full analysis instead',
        },
      ],
      diagnosticSteps: [
        'Verify the spreadsheet exists with sheets_core.get',
        'Check that you have at least read access to the spreadsheet',
        'Scope to a specific range if the sheet is large to improve performance',
      ],
      userGuidance:
        'This performs a full compliance audit covering data quality, formulas, access controls, and history. It is read-only and produces a report.',
    },
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
    errorRecovery: {
      PERMISSION_DENIED:
        'Auth must include drive.file scope for sharing — re-login with broader scopes',
      EXPORT_FAILED: 'Try a smaller range or simpler format (XLSX vs PDF)',
      alternativeActions: [
        { tool: 'sheets_composite', action: 'export_xlsx', when: 'when exporting to Excel only' },
        {
          tool: 'sheets_collaborate',
          action: 'share_set_link',
          when: 'when creating shareable link instead',
        },
      ],
      diagnosticSteps: [
        'Verify auth includes drive.file scope for sharing',
        'Test export with a smaller range if the full sheet fails',
        'Choose format carefully—PDF may fail for complex spreadsheets',
      ],
      userGuidance:
        'This exports a sheet as a formatted report and optionally shares it. Ensure auth includes drive.file scope for sharing functionality.',
    },
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
    errorRecovery: {
      STEP_FAILED:
        'Pipeline creates snapshot before writing — use sheets_history.undo to revert partial writes',
      QUOTA_EXCEEDED: 'Reduce range size or number of transformation steps',
      PERMISSION_DENIED: 'Requires write access to destination range',
      alternativeActions: [
        { tool: 'sheets_fix', action: 'clean', when: 'when you want cleaning only' },
        {
          tool: 'sheets_composite',
          action: 'import_and_format',
          when: 'when you want import + format only',
        },
      ],
      diagnosticSteps: [
        'Use dryRun mode first to preview transformations',
        'Use specific ranges for large datasets to avoid memory issues',
        'Verify write access to the destination range before committing',
      ],
      userGuidance:
        'This runs a multi-step transformation pipeline (read → clean → transform → write). Always preview with dryRun mode first. Large datasets need specific ranges.',
    },
  },
  'sheets_composite.instantiate_template': {
    apiCalls: 4,
    idempotent: false,
    prerequisites: ['sheets_templates.create'],
    whenToUse:
      'Create a new spreadsheet from a saved template with variable substitution ({{placeholders}})',
    whenNotToUse: 'When the template has no placeholders — use sheets_core.copy instead',
    errorRecovery: {
      TEMPLATE_NOT_FOUND: 'List available templates with sheets_templates.list first',
      MISSING_VARIABLES:
        'Check required {{placeholders}} with sheets_templates.get and provide all variables',
      alternativeActions: [
        {
          tool: 'sheets_templates',
          action: 'list',
          when: 'when you need to find available templates',
        },
        { tool: 'sheets_core', action: 'copy', when: 'when the template has no placeholders' },
      ],
      diagnosticSteps: [
        'List available templates with sheets_templates.list',
        'Get template details with sheets_templates.get to identify {{placeholders}}',
        'Provide values for all required placeholders in the variables parameter',
      ],
      userGuidance:
        'This creates a spreadsheet from a template with variable substitution. Identify required {{placeholders}} first and provide values for all of them.',
    },
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
    errorRecovery: {
      PERMISSION_DENIED: 'Requires write access to destination and read access to source',
      SHEET_NOT_FOUND: 'Verify both source and destination spreadsheetIds with sheets_core.get',
      SNAPSHOT_FAILED: 'Destination snapshot failed — migration aborted safely, no changes made',
      alternativeActions: [
        { tool: 'sheets_core', action: 'copy', when: 'when copying entire spreadsheet' },
        {
          tool: 'sheets_composite',
          action: 'clone_structure',
          when: 'when copying structure only',
        },
      ],
      diagnosticSteps: [
        'Verify both source and destination spreadsheetIds exist',
        'Confirm you have read access to source and write access to destination',
        'Note that named ranges and protected ranges are not migrated',
      ],
      userGuidance:
        'This migrates structure and data between spreadsheets with schema transformation. It creates a snapshot first, so you can undo if needed.',
    },
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
      alternativeActions: [
        { tool: 'sheets_auth', action: 'status', when: 'when you need to check auth status first' },
      ],
      diagnosticSteps: [
        'Check current auth status with sheets_auth.status first',
        'Verify that the OAuth configuration is properly set up',
        'Ensure the required scopes (drive.file, spreadsheets) are included',
      ],
      userGuidance:
        'This initiates the OAuth flow or refreshes an expired token. Check status first to see if a new login is needed.',
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
      alternativeActions: [
        {
          tool: 'sheets_analyze',
          action: 'suggest_visualization',
          when: 'when you want recommendations first',
        },
        { tool: 'sheets_data', action: 'read', when: 'when you need to verify data exists first' },
      ],
      diagnosticSteps: [
        'Verify the dataRange references actual sheet data with sheets_data.read',
        'Ensure the chartType is valid (BAR, LINE, PIE, COLUMN, SCATTER, AREA)',
        'Specify the position or anchorCell where the chart should be placed',
      ],
      userGuidance:
        'This creates a new chart from a data range. Verify the range has data and specify where to place the chart (position or anchorCell).',
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
  'sheets_appsscript.install_serval_function': {
    apiCalls: 2,
    idempotent: false,
    whenToUse: 'Installing SERVAL() into a spreadsheet with a signed callback integration',
    commonMistakes: ['Provide callbackUrl (or SERVAL_CALLBACK_URL) reachable by Apps Script'],
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
  'sheets_webhook.subscribe_workspace': {
    apiCalls: 1,
    idempotent: false,
    whenToUse: 'Creating a Workspace Events subscription for spreadsheet change notifications',
    commonMistakes: ['notificationEndpoint must be a Pub/Sub topic path'],
  },
  'sheets_webhook.unsubscribe_workspace': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Deleting an existing Workspace Events subscription',
  },
  'sheets_webhook.list_workspace_subscriptions': {
    apiCalls: 0,
    idempotent: true,
    whenToUse: 'Listing current Workspace Events subscriptions tracked by the server',
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
  'sheets_compute.sql_query': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Running SQL over one or more sheet ranges using DuckDB',
    whenNotToUse: 'For single aggregate operations use sheets_compute.aggregate',
  },
  'sheets_compute.sql_join': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Joining two sheet ranges with SQL semantics (inner/left/right/full)',
    whenNotToUse: 'For visual pivot-style summaries use sheets_compute.pivot_compute',
  },
  'sheets_compute.python_eval': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Executing custom Python analysis (NumPy/Pandas) on sheet data',
    commonMistakes: ['Requires ENABLE_PYTHON_COMPUTE=true at server startup'],
  },
  'sheets_compute.pandas_profile': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Generating descriptive statistics and optional correlations via pandas',
  },
  'sheets_compute.sklearn_model': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Training and evaluating a scikit-learn model from sheet ranges',
  },
  'sheets_compute.matplotlib_chart': {
    apiCalls: 1,
    idempotent: true,
    whenToUse: 'Rendering Python matplotlib/seaborn charts as base64 images',
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
    whenNotToUse: 'For connectors that already use authType:"none" and are already configured',
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
  errorRecovery?: ErrorRecoveryHints;
}

export type AlternativeActionHint =
  | string
  | {
      tool: string;
      action: string;
      when: string;
      notes?: string;
    };

export interface ErrorRecoveryHints {
  alternativeActions?: AlternativeActionHint[];
  diagnosticSteps?: string[];
  userGuidance?: string;
  [errorCode: string]: string | string[] | AlternativeActionHint[] | undefined;
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
