/**
 * ServalSheets - Schema Index
 * 
 * Re-exports all schemas for easy importing
 */

// Shared types
export * from './shared.js';

// Tool annotations
export * from './annotations.js';

// Tool schemas (16 tools, 160 actions)
export * from './auth.js';
export * from './spreadsheet.js';
export * from './sheet.js';
export * from './values.js';
export * from './cells.js';
export * from './format.js';
export * from './dimensions.js';
export * from './rules.js';
export * from './charts.js';
export * from './pivot.js';
export * from './filter-sort.js';
export * from './sharing.js';
export * from './comments.js';
export * from './versions.js';
export * from './analysis.js';
export * from './advanced.js';
export * from './transaction.js';
export * from './workflow.js';
export * from './insights.js';
export * from './validation.js';
export * from './planning.js';
export * from './conflict.js';
export * from './impact.js';
export * from './history.js';
export * from './prompts.js';

// Tool metadata for registration
export const TOOL_REGISTRY = {
  sheets_auth: {
    name: 'sheets_auth',
    title: 'Authentication',
    description: 'Authentication management: status, login, callback, logout',
    schema: 'SheetsAuthInputSchema',
    output: 'SheetsAuthOutputSchema',
    annotations: 'SHEETS_AUTH_ANNOTATIONS',
    actions: ['status', 'login', 'callback', 'logout'],
  },
  sheets_spreadsheet: {
    name: 'sheets_spreadsheet',
    title: 'Spreadsheet',
    description: 'Spreadsheet-level operations: create, get, copy, update properties',
    schema: 'SheetSpreadsheetInputSchema',
    output: 'SheetsSpreadsheetOutputSchema',
    annotations: 'SHEETS_SPREADSHEET_ANNOTATIONS',
    actions: ['get', 'create', 'copy', 'update_properties', 'get_url', 'batch_get'],
  },
  sheets_sheet: {
    name: 'sheets_sheet',
    title: 'Sheet Management',
    description: 'Sheet/tab operations: add, delete, duplicate, update, copy_to, list, get',
    schema: 'SheetsSheetInputSchema',
    output: 'SheetsSheetOutputSchema',
    annotations: 'SHEETS_SHEET_ANNOTATIONS',
    actions: ['add', 'delete', 'duplicate', 'update', 'copy_to', 'list', 'get'],
  },
  sheets_values: {
    name: 'sheets_values',
    title: 'Cell Values',
    description: 'Cell value operations: read, write, append, clear, find, replace',
    schema: 'SheetsValuesInputSchema',
    output: 'SheetsValuesOutputSchema',
    annotations: 'SHEETS_VALUES_ANNOTATIONS',
    actions: ['read', 'write', 'append', 'clear', 'batch_read', 'batch_write', 'batch_clear', 'find', 'replace'],
  },
  sheets_cells: {
    name: 'sheets_cells',
    title: 'Cell Operations',
    description: 'Cell-level operations: notes, validation, hyperlinks, merge, cut, copy',
    schema: 'SheetsCellsInputSchema',
    output: 'SheetsCellsOutputSchema',
    annotations: 'SHEETS_CELLS_ANNOTATIONS',
    actions: ['add_note', 'get_note', 'clear_note', 'set_validation', 'clear_validation', 'set_hyperlink', 'clear_hyperlink', 'merge', 'unmerge', 'get_merges', 'cut', 'copy'],
  },
  sheets_format: {
    name: 'sheets_format',
    title: 'Cell Formatting',
    description: 'Formatting operations: set_format, background, text, number, alignment, borders, presets',
    schema: 'SheetsFormatInputSchema',
    output: 'SheetsFormatOutputSchema',
    annotations: 'SHEETS_FORMAT_ANNOTATIONS',
    actions: ['set_format', 'set_background', 'set_text_format', 'set_number_format', 'set_alignment', 'set_borders', 'clear_format', 'apply_preset', 'auto_fit'],
  },
  sheets_dimensions: {
    name: 'sheets_dimensions',
    title: 'Rows & Columns',
    description: 'Row/column operations: insert, delete, move, resize, hide, freeze, group',
    schema: 'SheetsDimensionsInputSchema',
    output: 'SheetsDimensionsOutputSchema',
    annotations: 'SHEETS_DIMENSIONS_ANNOTATIONS',
    actions: ['insert_rows', 'insert_columns', 'delete_rows', 'delete_columns', 'move_rows', 'move_columns', 'resize_rows', 'resize_columns', 'auto_resize', 'hide_rows', 'hide_columns', 'show_rows', 'show_columns', 'freeze_rows', 'freeze_columns', 'group_rows', 'group_columns', 'ungroup_rows', 'ungroup_columns', 'append_rows', 'append_columns'],
  },
  sheets_rules: {
    name: 'sheets_rules',
    title: 'Rules & Validation',
    description: 'Conditional formatting and data validation rules',
    schema: 'SheetsRulesInputSchema',
    output: 'SheetsRulesOutputSchema',
    annotations: 'SHEETS_RULES_ANNOTATIONS',
    actions: ['add_conditional_format', 'update_conditional_format', 'delete_conditional_format', 'list_conditional_formats', 'add_data_validation', 'clear_data_validation', 'list_data_validations', 'add_preset_rule'],
  },
  sheets_charts: {
    name: 'sheets_charts',
    title: 'Charts',
    description: 'Chart operations: create, update, delete, list, move, resize, export',
    schema: 'SheetsChartsInputSchema',
    output: 'SheetsChartsOutputSchema',
    annotations: 'SHEETS_CHARTS_ANNOTATIONS',
    actions: ['create', 'update', 'delete', 'list', 'get', 'move', 'resize', 'update_data_range', 'export'],
  },
  sheets_pivot: {
    name: 'sheets_pivot',
    title: 'Pivot Tables',
    description: 'Pivot table operations: create, update, delete, list, get, refresh',
    schema: 'SheetsPivotInputSchema',
    output: 'SheetsPivotOutputSchema',
    annotations: 'SHEETS_PIVOT_ANNOTATIONS',
    actions: ['create', 'update', 'delete', 'list', 'get', 'refresh'],
  },
  sheets_filter_sort: {
    name: 'sheets_filter_sort',
    title: 'Filter & Sort',
    description: 'Filtering and sorting: basic filter, filter views, slicers, sort range',
    schema: 'SheetsFilterSortInputSchema',
    output: 'SheetsFilterSortOutputSchema',
    annotations: 'SHEETS_FILTER_SORT_ANNOTATIONS',
    actions: ['set_basic_filter', 'clear_basic_filter', 'get_basic_filter', 'update_filter_criteria', 'sort_range', 'create_filter_view', 'update_filter_view', 'delete_filter_view', 'list_filter_views', 'get_filter_view', 'create_slicer', 'update_slicer', 'delete_slicer', 'list_slicers'],
  },
  sheets_sharing: {
    name: 'sheets_sharing',
    title: 'Sharing & Permissions',
    description: 'Permission operations: share, update, remove, transfer ownership, link sharing',
    schema: 'SheetsSharingInputSchema',
    output: 'SheetsSharingOutputSchema',
    annotations: 'SHEETS_SHARING_ANNOTATIONS',
    actions: ['share', 'update_permission', 'remove_permission', 'list_permissions', 'get_permission', 'transfer_ownership', 'set_link_sharing', 'get_sharing_link'],
  },
  sheets_comments: {
    name: 'sheets_comments',
    title: 'Comments',
    description: 'Comment operations: add, update, delete, list, resolve, reopen, replies',
    schema: 'SheetsCommentsInputSchema',
    output: 'SheetsCommentsOutputSchema',
    annotations: 'SHEETS_COMMENTS_ANNOTATIONS',
    actions: ['add', 'update', 'delete', 'list', 'get', 'resolve', 'reopen', 'add_reply', 'update_reply', 'delete_reply'],
  },
  sheets_versions: {
    name: 'sheets_versions',
    title: 'Version Control',
    description: 'Version history: revisions, snapshots, restore, compare, export',
    schema: 'SheetsVersionsInputSchema',
    output: 'SheetsVersionsOutputSchema',
    annotations: 'SHEETS_VERSIONS_ANNOTATIONS',
    actions: ['list_revisions', 'get_revision', 'restore_revision', 'keep_revision', 'create_snapshot', 'list_snapshots', 'restore_snapshot', 'delete_snapshot', 'compare', 'export_version'],
  },
  sheets_analysis: {
    name: 'sheets_analysis',
    title: 'Data Analysis',
    description: 'Analysis operations: data quality, formula audit, statistics, correlations, AI-powered suggestions',
    schema: 'SheetsAnalysisInputSchema',
    output: 'SheetsAnalysisOutputSchema',
    annotations: 'SHEETS_ANALYSIS_ANNOTATIONS',
    actions: ['data_quality', 'formula_audit', 'structure_analysis', 'statistics', 'correlations', 'summary', 'dependencies', 'compare_ranges', 'detect_patterns', 'column_analysis', 'suggest_templates', 'generate_formula', 'suggest_chart'],
  },
  sheets_advanced: {
    name: 'sheets_advanced',
    title: 'Advanced Features',
    description: 'Advanced features: named ranges, protected ranges, metadata, banding, tables',
    schema: 'SheetsAdvancedInputSchema',
    output: 'SheetsAdvancedOutputSchema',
    annotations: 'SHEETS_ADVANCED_ANNOTATIONS',
    actions: ['add_named_range', 'update_named_range', 'delete_named_range', 'list_named_ranges', 'get_named_range', 'add_protected_range', 'update_protected_range', 'delete_protected_range', 'list_protected_ranges', 'set_metadata', 'get_metadata', 'delete_metadata', 'add_banding', 'update_banding', 'delete_banding', 'list_banding', 'create_table', 'delete_table', 'list_tables'],
  },
  sheets_transaction: {
    name: 'sheets_transaction',
    title: 'Transactions',
    description: 'Transaction management: begin, commit, rollback, savepoints',
    schema: 'SheetsTransactionInputSchema',
    output: 'SheetsTransactionOutputSchema',
    annotations: 'SHEETS_TRANSACTION_ANNOTATIONS',
    actions: ['begin', 'commit', 'rollback', 'savepoint', 'rollback_to_savepoint', 'status'],
  },
  sheets_workflow: {
    name: 'sheets_workflow',
    title: 'Workflows',
    description: 'Multi-step workflow automation with dependencies and rollback',
    schema: 'SheetsWorkflowInputSchema',
    output: 'SheetsWorkflowOutputSchema',
    annotations: 'SHEETS_WORKFLOW_ANNOTATIONS',
    actions: ['create', 'execute', 'status', 'cancel', 'list'],
  },
  sheets_insights: {
    name: 'sheets_insights',
    title: 'AI Insights',
    description: 'AI-powered data insights, anomaly detection, and recommendations',
    schema: 'SheetsInsightsInputSchema',
    output: 'SheetsInsightsOutputSchema',
    annotations: 'SHEETS_INSIGHTS_ANNOTATIONS',
    actions: ['analyze', 'detect_anomalies', 'recommend'],
  },
  sheets_validation: {
    name: 'sheets_validation',
    title: 'Validation',
    description: 'Data validation and constraint checking',
    schema: 'SheetsValidationInputSchema',
    output: 'SheetsValidationOutputSchema',
    annotations: 'SHEETS_VALIDATION_ANNOTATIONS',
    actions: ['validate_data', 'validate_formulas', 'validate_references', 'check_constraints'],
  },
  sheets_plan: {
    name: 'sheets_plan',
    title: 'Planning',
    description: 'Natural language operation planning with cost estimation and risk analysis',
    schema: 'SheetsPlanningInputSchema',
    output: 'SheetsPlanningOutputSchema',
    annotations: 'SHEETS_PLANNING_ANNOTATIONS',
    actions: ['create', 'execute', 'validate'],
  },
  sheets_conflict: {
    name: 'sheets_conflict',
    title: 'Conflict Detection',
    description: 'Conflict detection and resolution for concurrent modifications',
    schema: 'SheetsConflictInputSchema',
    output: 'SheetsConflictOutputSchema',
    annotations: 'SHEETS_CONFLICT_ANNOTATIONS',
    actions: ['detect', 'resolve'],
  },
  sheets_impact: {
    name: 'sheets_impact',
    title: 'Impact Analysis',
    description: 'Pre-execution impact analysis with dependency tracking',
    schema: 'SheetsImpactInputSchema',
    output: 'SheetsImpactOutputSchema',
    annotations: 'SHEETS_IMPACT_ANNOTATIONS',
    actions: ['analyze'],
  },
  sheets_history: {
    name: 'sheets_history',
    title: 'Operation History',
    description: 'Operation history tracking for debugging and undo foundation',
    schema: 'SheetsHistoryInputSchema',
    output: 'SheetsHistoryOutputSchema',
    annotations: 'SHEETS_HISTORY_ANNOTATIONS',
    actions: ['list', 'get', 'stats'],
  },
} as const;

// Tool count
export const TOOL_COUNT = Object.keys(TOOL_REGISTRY).length;

// Action count
export const ACTION_COUNT = Object.values(TOOL_REGISTRY).reduce(
  (sum, tool) => sum + tool.actions.length,
  0
);
