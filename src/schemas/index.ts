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

// Core tool schemas
export * from './auth.js';
export * from './core.js'; // Consolidated spreadsheet + sheet
export * from './data.js'; // Consolidated values + cells (Wave 4)
export * from './format.js';
export * from './dimensions.js';
export * from './visualize.js'; // Consolidated charts + pivot
export * from './collaborate.js'; // Consolidated sharing + comments + versions
export * from './analysis.js';
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
// export * from './formulas.js'; // MERGED into sheets_advanced (2026-01-14) with formula_ prefix

// Performance optimizations
export * from './fast-validators.js'; // Pre-compiled validators (80-90% faster)

// Action-level metadata for AI cost-aware decision making
export * from './action-metadata.js';

// Tool metadata for registration
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
    ],
  },
  sheets_data: {
    name: 'sheets_data',
    title: 'Cell Data',
    description:
      'Working with cell data: Read/write cell values | Append new rows | Batch updates across multiple ranges | Find and replace text | Add/edit/remove cell notes | Set data validation rules | Add/remove hyperlinks | Merge/unmerge cells | Cut/copy cell content',
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
      'find',
      'replace',
      'add_note',
      'get_note',
      'clear_note',
      'set_validation',
      'clear_validation',
      'set_hyperlink',
      'clear_hyperlink',
      'merge',
      'unmerge',
      'get_merges',
      'cut',
      'copy',
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
      'set_background',
      'set_text_format',
      'set_number_format',
      'set_alignment',
      'set_borders',
      'clear_format',
      'apply_preset',
      'auto_fit',
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
      'insert_rows',
      'insert_columns',
      'delete_rows',
      'delete_columns',
      'move_rows',
      'move_columns',
      'resize_rows',
      'resize_columns',
      'auto_resize',
      'hide_rows',
      'hide_columns',
      'show_rows',
      'show_columns',
      'freeze_rows',
      'freeze_columns',
      'group_rows',
      'group_columns',
      'ungroup_rows',
      'ungroup_columns',
      'append_rows',
      'append_columns',
    ],
  },
  sheets_visualize: {
    name: 'sheets_visualize',
    title: 'Visualizations',
    description:
      'Creating charts and pivot tables: Create charts (line, bar, pie, scatter) | Get chart suggestions from data | Update/move/resize charts | Create pivot tables for data summarization | Suggest pivot table structure | Export charts as images',
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
      'chart_export',
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
  sheets_analysis: {
    name: 'sheets_analysis',
    title: 'Analysis',
    description:
      'Data analysis (read-only): Analyze data quality and patterns | Audit formulas for errors | Calculate statistics and correlations | Detect dependencies between cells | Compare data ranges | Generate suggested templates | Get AI-powered insights',
    schema: 'SheetsAnalysisInputSchema',
    output: 'SheetsAnalysisOutputSchema',
    annotations: 'SHEETS_ANALYSIS_ANNOTATIONS',
    actions: [
      'data_quality',
      'formula_audit',
      'structure_analysis',
      'statistics',
      'correlations',
      'summary',
      'dependencies',
      'compare_ranges',
      'detect_patterns',
      'column_analysis',
      'suggest_templates',
      'generate_formula',
      'suggest_chart',
    ],
  },
  sheets_advanced: {
    name: 'sheets_advanced',
    title: 'Advanced',
    description:
      'Power user features: Named ranges for easy cell referencing | Protected ranges to prevent edits | Custom metadata for tracking | Alternating row colors (banding) | Smart tables for structured data | Formula intelligence (generate, explain, optimize, trace dependencies)',
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
    actions: ['request', 'get_stats'],
  },
  sheets_analyze: {
    name: 'sheets_analyze',
    title: 'Ultimate Data Analysis',
    description:
      "🤖 ONE TOOL TO RULE THEM ALL - Use 'comprehensive' action to get EVERYTHING in a single call: metadata, data, quality analysis, patterns, formulas, performance, visualizations. Replaces sheets_spreadsheet + sheets_values + sheets_analysis. Other actions: analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, analyze_formulas, query_natural_language, explain_analysis.",
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
    ],
  },
  sheets_fix: {
    name: 'sheets_fix',
    title: 'Automated Issue Fixing',
    description:
      'Automatically fix common spreadsheet issues detected by sheets_analysis. Supports preview mode (see what would be fixed) and apply mode (actually fix).',
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
    actions: ['import_csv', 'smart_append', 'bulk_update', 'deduplicate'],
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
      'reset',
    ],
  },
  // sheets_formulas: MERGED into sheets_advanced (2026-01-14) with formula_ prefix
  // Formula intelligence actions now available as: formula_generate, formula_suggest, formula_explain,
  // formula_optimize, formula_fix, formula_trace_precedents, formula_trace_dependents, formula_manage_named_ranges
} as const;

// Tool count (after Wave 5: merged sheets_formulas into sheets_advanced)
export const TOOL_COUNT = 17;

// Action count (17 tools after Wave 5: sheets_formulas merged into sheets_advanced)
// Computed in annotations.ts from ACTION_COUNTS map
export const ACTION_COUNT = 226;
