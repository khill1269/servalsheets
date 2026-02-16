/**
 * ServalSheets - Schema Index
 *
 * Re-exports all schemas for easy importing.
 *
 * Architectural Notes (MCP 2025-11-25):
 * - sheets_confirm: Uses Elicitation (SEP-1036) for user confirmation
 * - sheets_analyze: Uses Sampling (SEP-1577) for AI analysis
 * - Removed: sheets_plan, sheets_insights (replaced by MCP-native patterns)
 */

// Shared types
export * from './shared.js';

// Tool annotations
export * from './annotations.js';

// LLM-optimized tool descriptions
export * from './descriptions.js';
export * from './descriptions-minimal.js';

// Core tool schemas
export * from './auth.js';
export * from './core.js'; // Consolidated spreadsheet + sheet
export * from './data.js'; // Consolidated values + cells (Wave 4)
export * from './format.js';
export * from './dimensions.js';
export * from './visualize.js'; // Consolidated charts + pivot
export * from './collaborate.js'; // Consolidated sharing + comments + versions
export * from './advanced.js';
export * from './transaction.js';
export * from './quality.js';
export * from './history.js';
export * from './prompts.js';

// MCP-native tool schemas (Elicitation & Sampling)
export * from './confirm.js'; // Uses Elicitation (SEP-1036)
export * from './analyze.js'; // Uses Sampling (SEP-1577)
export * from './fix.js'; // Automated issue resolution
export * from './composite.js'; // High-level composite operations
export * from './session.js'; // Session context for NL excellence
export * from './templates.js'; // Enterprise templates (Tier 7)
export * from './bigquery.js'; // BigQuery Connected Sheets (Tier 7)
export * from './appsscript.js'; // Apps Script automation (Tier 7)
export * from './webhook.js'; // Webhook notifications
export * from './dependencies.js'; // Formula dependency analysis
export * from './federation.js'; // MCP server federation (Feature 3)

// Action-level metadata for AI cost-aware decision making
export * from './action-metadata.js';

// Tool actions for completions and test orchestration
// This is the single source of truth for action lists
export { TOOL_ACTIONS } from '../mcp/completions.js';

// Tool metadata for registration
// DEPRECATED: Use TOOL_ACTIONS for action lists instead
// This registry will be removed in Phase 4 (Action Naming Standardization)
export const TOOL_REGISTRY = {
  sheets_auth: {
    name: 'sheets_auth',
    title: 'Authentication',
    description:
      '🔐 MANDATORY FIRST STEP: Authentication management. ALWAYS call this with action:"status" before using any other sheets_* tool. Actions: status (check auth), login (get OAuth URL), callback (complete OAuth with code), logout (clear credentials)',
    schema: 'SheetsAuthInputSchema',
    output: 'SheetsAuthOutputSchema',
    annotations: 'SHEETS_AUTH_ANNOTATIONS',
    actions: ['status', 'login', 'callback', 'logout'],
  },
  sheets_core: {
    name: 'sheets_core',
    title: 'Core Operations',
    description:
      'Managing spreadsheets and sheets: Get spreadsheet info and metadata | Create new spreadsheets | Copy/update spreadsheet properties (title, locale, timezone) | Add/delete/rename sheets | Duplicate sheets | List all sheets in a spreadsheet',
    schema: 'SheetsCoreInputSchema',
    output: 'SheetsCoreOutputSchema',
    annotations: 'SHEETS_CORE_ANNOTATIONS',
    actions: [
      'get',
      'create',
      'copy',
      'update_properties',
      'get_url',
      'batch_get',
      'get_comprehensive',
      'list',
      'add_sheet',
      'delete_sheet',
      'duplicate_sheet',
      'update_sheet',
      'copy_sheet_to',
      'list_sheets',
      'get_sheet',
      'batch_delete_sheets',
      'batch_update_sheets',
    ],
  },
  sheets_data: {
    name: 'sheets_data',
    title: 'Cell Data',
    description:
      'Working with cell data: Read/write cell values | Append new rows | Batch updates | Find/replace text | Notes | Hyperlinks | Merge/Copy/Paste (Data validation moved to sheets_format in v2.0)',
    schema: 'SheetsDataInputSchema',
    output: 'SheetsDataOutputSchema',
    annotations: 'SHEETS_DATA_ANNOTATIONS',
    actions: [
      'read',
      'write',
      'append',
      'clear',
      'batch_read',
      'batch_write',
      'batch_clear',
      'find_replace',
      'add_note',
      'get_note',
      'clear_note',
      // 'set_validation', // REMOVED in v2.0 - moved to sheets_format
      // 'clear_validation', // REMOVED in v2.0 - moved to sheets_format
      'set_hyperlink',
      'clear_hyperlink',
      'merge_cells',
      'unmerge_cells',
      'get_merges',
      'cut_paste',
      'copy_paste',
    ],
  },
  sheets_format: {
    name: 'sheets_format',
    title: 'Formatting',
    description:
      'Formatting cells: Apply background colors and text styles | Set number formats (currency, dates, percentages) | Add borders and alignment | Apply formatting presets | Auto-fit column widths | Clear formatting | Conditional formatting rules',
    schema: 'SheetsFormatInputSchema',
    output: 'SheetsFormatOutputSchema',
    annotations: 'SHEETS_FORMAT_ANNOTATIONS',
    actions: [
      'set_format',
      'suggest_format',
      'set_background',
      'set_text_format',
      'set_number_format',
      'set_alignment',
      'set_borders',
      'clear_format',
      'apply_preset',
      'auto_fit',
      'sparkline_add',
      'sparkline_get',
      'sparkline_clear',
      'rule_add_conditional_format',
      'rule_update_conditional_format',
      'rule_delete_conditional_format',
      'rule_list_conditional_formats',
      'set_data_validation',
      'clear_data_validation',
      'list_data_validations',
      'add_conditional_format_rule',
    ],
  },
  sheets_dimensions: {
    name: 'sheets_dimensions',
    title: 'Rows & Columns',
    description:
      'Managing rows and columns: Insert/delete rows or columns | Move and resize dimensions | Hide/show rows or columns | Freeze panes for scrolling | Group/ungroup for collapsing | Apply filters and sorting | Create filter views | Add slicers',
    schema: 'SheetsDimensionsInputSchema',
    output: 'SheetsDimensionsOutputSchema',
    annotations: 'SHEETS_DIMENSIONS_ANNOTATIONS',
    actions: [
      // Consolidated dimension actions (use dimension: 'ROWS' | 'COLUMNS')
      'insert', // insert rows/columns at index
      'delete', // delete rows/columns
      'move', // move rows/columns to new position
      'resize', // resize rows/columns to specific size
      'auto_resize', // auto-fit rows/columns to content
      'hide', // hide rows/columns
      'show', // show hidden rows/columns
      'freeze', // freeze rows/columns for scrolling
      'group', // group rows/columns for collapsing
      'ungroup', // ungroup rows/columns
      'append', // append rows/columns at end
      // Filter and sort actions
      'set_basic_filter', // set/update basic filter (also handles incremental updates)
      'clear_basic_filter', // clear basic filter
      'get_basic_filter', // get basic filter settings
      'sort_range', // sort a range by columns
      // Range utility actions
      'trim_whitespace', // trim whitespace from cells
      'randomize_range', // randomize row order
      'text_to_columns', // split text into columns
      'auto_fill', // auto-fill based on patterns
      // Filter view actions
      'create_filter_view',
      'update_filter_view',
      'delete_filter_view',
      'list_filter_views',
      'get_filter_view',
      // Slicer actions
      'create_slicer',
      'update_slicer',
      'delete_slicer',
      'list_slicers',
    ],
  },
  sheets_visualize: {
    name: 'sheets_visualize',
    title: 'Visualizations',
    description:
      'Creating charts and pivot tables: Create charts (line, bar, pie, scatter) | Get chart suggestions from data | Update/move/resize charts | Create pivot tables for data summarization | Suggest pivot table structure',
    schema: 'SheetsVisualizeInputSchema',
    output: 'SheetsVisualizeOutputSchema',
    annotations: 'SHEETS_VISUALIZE_ANNOTATIONS',
    actions: [
      'chart_create',
      'suggest_chart',
      'chart_update',
      'chart_delete',
      'chart_list',
      'chart_get',
      'chart_move',
      'chart_resize',
      'chart_update_data_range',
      'chart_add_trendline',
      'chart_remove_trendline',
      'pivot_create',
      'suggest_pivot',
      'pivot_update',
      'pivot_delete',
      'pivot_list',
      'pivot_get',
      'pivot_refresh',
    ],
  },
  sheets_collaborate: {
    name: 'sheets_collaborate',
    title: 'Collaboration',
    description:
      '👥 Sharing and teamwork: Share spreadsheets with specific users or via link | Manage permissions (view/comment/edit) | Add/reply to comments | Track revisions and version history | Create/restore snapshots | Compare versions | Export historical versions',
    schema: 'SheetsCollaborateInputSchema',
    output: 'SheetsCollaborateOutputSchema',
    annotations: 'SHEETS_COLLABORATE_ANNOTATIONS',
    actions: [
      'share_add',
      'share_update',
      'share_remove',
      'share_list',
      'share_get',
      'share_transfer_ownership',
      'share_set_link',
      'share_get_link',
      'comment_add',
      'comment_update',
      'comment_delete',
      'comment_list',
      'comment_get',
      'comment_resolve',
      'comment_reopen',
      'comment_add_reply',
      'comment_update_reply',
      'comment_delete_reply',
      'version_list_revisions',
      'version_get_revision',
      'version_restore_revision',
      'version_keep_revision',
      'version_create_snapshot',
      'version_list_snapshots',
      'version_restore_snapshot',
      'version_delete_snapshot',
      'version_compare',
      'version_export',
    ],
  },
  sheets_advanced: {
    name: 'sheets_advanced',
    title: 'Advanced',
    description:
      'Power user features: Named ranges for easy cell referencing | Protected ranges to prevent edits | Custom metadata for tracking | Alternating row colors (banding) | Smart tables for structured data',
    schema: 'SheetsAdvancedInputSchema',
    output: 'SheetsAdvancedOutputSchema',
    annotations: 'SHEETS_ADVANCED_ANNOTATIONS',
    actions: [
      'add_named_range',
      'update_named_range',
      'delete_named_range',
      'list_named_ranges',
      'get_named_range',
      'add_protected_range',
      'update_protected_range',
      'delete_protected_range',
      'list_protected_ranges',
      'set_metadata',
      'get_metadata',
      'delete_metadata',
      'add_banding',
      'update_banding',
      'delete_banding',
      'list_banding',
      'create_table',
      'delete_table',
      'list_tables',
      'add_person_chip',
      'add_drive_chip',
      'add_rich_link_chip',
      'list_chips',
    ],
  },
  sheets_transaction: {
    name: 'sheets_transaction',
    title: 'Transactions',
    description:
      'Transaction support: begin, queue operations, commit/rollback atomically with auto-snapshot. Batch multiple operations into 1 API call, saving 80% API usage.',
    schema: 'SheetsTransactionInputSchema',
    output: 'SheetsTransactionOutputSchema',
    annotations: 'SHEETS_TRANSACTION_ANNOTATIONS',
    actions: ['begin', 'queue', 'commit', 'rollback', 'status', 'list'],
  },
  sheets_quality: {
    name: 'sheets_quality',
    title: 'Quality Assurance',
    description:
      'Enterprise quality assurance: data validation (11 builtin validators), conflict detection and resolution (6 strategies), and pre-execution impact analysis with dependency tracking.',
    schema: 'SheetsQualityInputSchema',
    output: 'SheetsQualityOutputSchema',
    annotations: 'SHEETS_QUALITY_ANNOTATIONS',
    actions: ['validate', 'detect_conflicts', 'resolve_conflict', 'analyze_impact'],
  },
  sheets_history: {
    name: 'sheets_history',
    title: 'Operation History',
    description: 'Operation history: track last 100 operations for debugging and undo foundation.',
    schema: 'SheetsHistoryInputSchema',
    output: 'SheetsHistoryOutputSchema',
    annotations: 'SHEETS_HISTORY_ANNOTATIONS',
    actions: ['list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear'],
  },
  // MCP-native tools using Elicitation and Sampling
  sheets_confirm: {
    name: 'sheets_confirm',
    title: 'Plan Confirmation',
    description:
      'Confirm multi-step operations with the user before execution. Uses MCP Elicitation (SEP-1036). Claude plans, user confirms, Claude executes.',
    schema: 'SheetsConfirmInputSchema',
    output: 'SheetsConfirmOutputSchema',
    annotations: 'SHEETS_CONFIRM_ANNOTATIONS',
    actions: ['request', 'get_stats', 'wizard_start', 'wizard_step', 'wizard_complete'],
  },
  sheets_analyze: {
    name: 'sheets_analyze',
    title: 'Ultimate Data Analysis',
    description:
      "🤖 ONE TOOL TO RULE THEM ALL - Use 'comprehensive' action to get EVERYTHING in a single call: metadata, data, quality analysis, patterns, formulas, performance, visualizations. Complements sheets_core + sheets_data for analysis workflows. Other actions: analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, analyze_formulas, query_natural_language, explain_analysis.",
    schema: 'SheetsAnalyzeInputSchema',
    output: 'SheetsAnalyzeOutputSchema',
    annotations: 'SHEETS_ANALYZE_ANNOTATIONS',
    actions: [
      'comprehensive',
      'analyze_data',
      'suggest_visualization',
      'generate_formula',
      'detect_patterns',
      'analyze_structure',
      'analyze_quality',
      'analyze_performance',
      'analyze_formulas',
      'query_natural_language',
      'explain_analysis',
      'scout',
      'plan',
      'execute_plan',
      'drill_down',
      'generate_actions',
    ],
  },
  sheets_fix: {
    name: 'sheets_fix',
    title: 'Automated Issue Fixing',
    description:
      'Automatically fix common spreadsheet issues detected by sheets_analyze. Supports preview mode (see what would be fixed) and apply mode (actually fix).',
    schema: 'SheetsFixInputSchema',
    output: 'SheetsFixOutputSchema',
    annotations: 'SHEETS_FIX_ANNOTATIONS',
    actions: ['fix'],
  },
  sheets_composite: {
    name: 'sheets_composite',
    title: 'Composite Operations',
    description:
      'High-level composite operations: import_csv (parse and write CSV), smart_append (match columns by header), bulk_update (update rows by key), deduplicate (remove duplicate rows).',
    schema: 'CompositeInputSchema',
    output: 'CompositeOutputSchema',
    annotations: 'SHEETS_COMPOSITE_ANNOTATIONS',
    actions: [
      'import_csv',
      'smart_append',
      'bulk_update',
      'deduplicate',
      'export_xlsx',
      'import_xlsx',
      'get_form_responses',
      'setup_sheet',
      'import_and_format',
      'clone_structure',
    ],
  },
  sheets_session: {
    name: 'sheets_session',
    title: 'Session Context',
    description:
      '🧠 Manage conversation context for natural language interactions. Enables references like "the spreadsheet", "undo that", "continue". Actions: set_active (remember spreadsheet), get_active (current context), get_context (full summary), record_operation (track changes), get_last_operation, get_history, find_by_reference (resolve "that"/"the budget"), update_preferences, get_preferences, set_pending (multi-step ops), get_pending, clear_pending, reset',
    schema: 'SheetsSessionInputSchema',
    output: 'SheetsSessionOutputSchema',
    annotations: 'SHEETS_SESSION_ANNOTATIONS',
    actions: [
      'set_active',
      'get_active',
      'get_context',
      'record_operation',
      'get_last_operation',
      'get_history',
      'find_by_reference',
      'update_preferences',
      'get_preferences',
      'set_pending',
      'get_pending',
      'clear_pending',
      'save_checkpoint',
      'load_checkpoint',
      'list_checkpoints',
      'delete_checkpoint',
      'reset',
    ],
  },
  sheets_templates: {
    name: 'sheets_templates',
    title: 'Templates',
    description:
      'Manage reusable spreadsheet templates stored in Google Drive: list (view saved templates), get (template details), create (save spreadsheet as template), apply (create from template), update, delete, preview, import_builtin (from knowledge base).',
    schema: 'SheetsTemplatesInputSchema',
    output: 'SheetsTemplatesOutputSchema',
    annotations: 'SHEETS_TEMPLATES_ANNOTATIONS',
    actions: ['list', 'get', 'create', 'apply', 'update', 'delete', 'preview', 'import_builtin'],
  },
  sheets_bigquery: {
    name: 'sheets_bigquery',
    title: 'BigQuery Integration',
    description:
      'BigQuery Connected Sheets integration: connect/disconnect data sources | query BigQuery with SQL | preview results | refresh data | list datasets/tables | get table schemas | export sheet data to BigQuery | import BigQuery results to sheets.',
    schema: 'SheetsBigQueryInputSchema',
    output: 'SheetsBigQueryOutputSchema',
    annotations: 'SHEETS_BIGQUERY_ANNOTATIONS',
    actions: [
      'connect',
      'connect_looker',
      'disconnect',
      'list_connections',
      'get_connection',
      'query',
      'preview',
      'refresh',
      'cancel_refresh',
      'list_datasets',
      'list_tables',
      'get_table_schema',
      'export_to_bigquery',
      'import_from_bigquery',
    ],
  },
  sheets_appsscript: {
    name: 'sheets_appsscript',
    title: 'Apps Script Automation',
    description:
      'Apps Script automation: create/get/update script projects | manage versions | deploy as web app or API executable | run functions remotely | monitor execution processes | get usage metrics.',
    schema: 'SheetsAppsScriptInputSchema',
    output: 'SheetsAppsScriptOutputSchema',
    annotations: 'SHEETS_APPSSCRIPT_ANNOTATIONS',
    actions: [
      'create',
      'get',
      'get_content',
      'update_content',
      'create_version',
      'list_versions',
      'get_version',
      'deploy',
      'list_deployments',
      'get_deployment',
      'undeploy',
      'run',
      'list_processes',
      'get_metrics',
    ],
  },
  sheets_webhook: {
    name: 'sheets_webhook',
    title: 'Webhooks',
    description:
      'Webhook notifications for spreadsheet changes: register webhooks with Google Sheets Watch API | list/get webhook details | unregister webhooks | send test deliveries | get webhook statistics and delivery metrics.',
    schema: 'SheetsWebhookInputSchema',
    output: 'SheetsWebhookOutputSchema',
    annotations: 'SHEETS_WEBHOOK_ANNOTATIONS',
    actions: ['register', 'unregister', 'list', 'get', 'test', 'get_stats'],
  },
  sheets_dependencies: {
    name: 'sheets_dependencies',
    title: 'Formula Dependencies',
    description:
      'Formula dependency analysis: build dependency graph from formulas | analyze impact of cell changes | detect circular dependencies | get dependencies/dependents for cells | export graph as DOT format | get dependency statistics.',
    schema: 'SheetsDependenciesInputSchema',
    output: 'SheetsDependenciesOutputSchema',
    annotations: 'SHEETS_DEPENDENCIES_ANNOTATIONS',
    actions: [
      'build',
      'analyze_impact',
      'detect_cycles',
      'get_dependencies',
      'get_dependents',
      'get_stats',
      'export_dot',
    ],
  },
  sheets_federation: {
    name: 'sheets_federation',
    title: 'MCP Server Federation',
    description:
      'Call external MCP servers for composite workflows: call remote tools | list configured servers | get available tools on remote servers | validate connections to remote servers.',
    schema: 'SheetsFederationInputSchema',
    output: 'SheetsFederationOutputSchema',
    annotations: 'SHEETS_FEDERATION_ANNOTATIONS',
    actions: ['call_remote', 'list_servers', 'get_server_tools', 'validate_connection'],
  },
} as const;

// Tool count
export const TOOL_COUNT = 22;

// Action count
export const ACTION_COUNT = 298;

// Last updated: 2026-02-16
// See ACTION_COUNTS in annotations.ts for per-tool breakdown
// Sum: 298 actions across 22 tools (added sheets_federation with 4 actions)
