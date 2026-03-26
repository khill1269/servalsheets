// @generated — Do not edit manually. Run npm run schema:commit to regenerate.
/**
 * ServalSheets - Completions Support
 *
 * Implements MCP completions capability for argument autocompletion.
 * Provides suggestions for spreadsheet IDs, sheet names, and action names.
 *
 * MCP Protocol: 2025-11-25
 */

import type { CompleteResult } from '@modelcontextprotocol/sdk/types.js';
import { getAvailableToolActions, getAvailableToolNames } from '../mcp/tool-registry-state.js';

/**
 * Action names for each tool (for autocompletion)
 * Total: 407 actions across 25 tools
 *
 * IMPORTANT: These must match the z.literal('action') values in the schema files.
 * Source of truth: src/schemas/*.ts
 * Total counts are derived from src/schemas/action-counts.ts.
 * Note: sheets_analyze has 23 actions (comprehensive + targeted + progressive analyses)
 */
export const TOOL_ACTIONS: Record<string, string[]> = {
  sheets_advanced: [
    'add_named_range', 'update_named_range', 'delete_named_range', 'list_named_ranges', 'get_named_range',
    'add_protected_range', 'update_protected_range', 'delete_protected_range', 'list_protected_ranges',
    'set_metadata', 'get_metadata', 'delete_metadata', 'add_banding', 'update_banding', 'delete_banding',
    'list_banding', 'create_table', 'delete_table', 'list_tables', 'update_table', 'rename_table_column',
    'set_table_column_properties', 'add_person_chip', 'add_drive_chip', 'add_rich_link_chip', 'list_chips',
    'create_named_function', 'list_named_functions', 'get_named_function', 'update_named_function', 'delete_named_function'
  ],
  sheets_agent: ['plan', 'execute', 'execute_step', 'observe', 'rollback', 'get_status', 'list_plans', 'resume'],
  sheets_analyze: [
    'comprehensive', 'analyze_data', 'suggest_visualization', 'generate_formula', 'detect_patterns',
    'analyze_structure', 'analyze_quality', 'analyze_performance', 'analyze_formulas', 'query_natural_language',
    'quick_insights', 'plan', 'execute_plan', 'discover_action', 'drill_down', 'scout', 'semantic_search',
    'suggest_next_actions', 'auto_enhance', 'formula_health_check', 'diagnose_errors', 'get_intelligence_report',
    'schedule_intelligence', 'cancel_intelligence', 'explain_analysis', 'generate_actions'
  ],
  sheets_appsscript: [
    'create', 'get', 'get_content', 'update_content', 'create_version', 'list_versions', 'get_version',
    'deploy', 'list_deployments', 'get_deployment', 'run', 'list_processes', 'get_metrics', 'install_serval_function',
    'undeploy'
  ],
  sheets_auth: ['status', 'login', 'callback', 'logout', 'setup_feature'],
  sheets_bigquery: [
    'connect', 'disconnect', 'list_connections', 'get_connection', 'refresh', 'cancel_refresh',
    'query', 'preview', 'list_datasets', 'list_tables', 'get_table_schema', 'import_from_bigquery',
    'export_to_bigquery', 'create_scheduled_query', 'list_scheduled_queries', 'delete_scheduled_query'
  ],
  sheets_collaborate: [
    'share_add', 'share_update', 'share_remove', 'share_list', 'share_get', 'share_transfer_ownership',
    'share_set_link', 'share_get_link', 'comment_add', 'comment_update', 'comment_delete', 'comment_list',
    'comment_get', 'comment_reopen', 'comment_resolve', 'comment_add_reply', 'comment_update_reply',
    'comment_delete_reply', 'label_apply', 'label_remove', 'label_list', 'approval_create', 'approval_approve',
    'approval_reject', 'approval_cancel', 'approval_list_pending', 'approval_get_status', 'approval_delegate',
    'version_create_snapshot', 'version_list_snapshots', 'version_snapshot_status', 'version_delete_snapshot',
    'version_restore_snapshot', 'version_list_revisions', 'version_get_revision', 'version_keep_revision',
    'version_restore_revision', 'version_export', 'version_compare'
  ],
  sheets_composite: [
    'import_csv', 'import_xlsx', 'import_and_format', 'export_xlsx', 'export_large_dataset', 'smart_append',
    'deduplicate', 'bulk_update', 'setup_sheet', 'generate_sheet', 'generate_template', 'preview_generation',
    'instantiate_template', 'clone_structure', 'get_form_responses', 'publish_report', 'audit_sheet',
    'build_dashboard', 'data_pipeline', 'migrate_spreadsheet', 'batch_operations'
  ],
  sheets_compute: [
    'evaluate', 'aggregate', 'statistical', 'regression', 'forecast', 'matrix_op', 'pivot_compute',
    'custom_function', 'batch_compute', 'explain_formula', 'pandas_profile', 'python_eval', 'sql_query',
    'sql_join', 'sklearn_model', 'matplotlib_chart'
  ],
  sheets_confirm: ['request', 'get_stats', 'wizard_start', 'wizard_step', 'wizard_complete'],
  sheets_connectors: ['list_connectors', 'configure', 'query', 'batch_query', 'subscribe', 'unsubscribe', 'list_subscriptions', 'status', 'discover', 'transform'],
  sheets_core: [
    'create', 'get', 'list', 'update_properties', 'copy', 'batch_get', 'get_comprehensive', 'describe_workbook',
    'workbook_fingerprint', 'get_url', 'add_sheet', 'delete_sheet', 'get_sheet', 'list_sheets', 'update_sheet',
    'clear_sheet', 'duplicate_sheet', 'copy_sheet_to', 'move_sheet', 'batch_delete_sheets', 'batch_update_sheets'
  ],
  sheets_data: [
    'read', 'write', 'append', 'clear', 'batch_read', 'batch_write', 'batch_clear', 'find_replace',
    'copy_paste', 'cut_paste', 'smart_fill', 'auto_fill', 'add_note', 'get_note', 'clear_note',
    'set_hyperlink', 'clear_hyperlink', 'merge_cells', 'unmerge_cells', 'get_merges', 'detect_spill_ranges',
    'cross_read', 'cross_query', 'cross_write', 'cross_compare'
  ],
  sheets_dependencies: ['build', 'analyze_impact', 'detect_cycles', 'get_dependencies', 'get_dependents', 'get_stats', 'export_dot', 'model_scenario', 'compare_scenarios', 'create_scenario_sheet'],
  sheets_dimensions: [
    'insert', 'delete', 'move', 'resize', 'auto_resize', 'hide', 'show', 'freeze', 'group', 'ungroup',
    'sort_range', 'randomize_range', 'text_to_columns', 'trim_whitespace', 'delete_duplicates',
    'set_basic_filter', 'get_basic_filter', 'clear_basic_filter', 'create_filter_view', 'delete_filter_view',
    'update_filter_view', 'list_filter_views', 'duplicate_filter_view', 'create_slicer', 'delete_slicer',
    'update_slicer', 'list_slicers', 'append'
  ],
  sheets_federation: ['get_server_tools', 'list_servers', 'call_remote', 'validate_connection'],
  sheets_fix: ['clean', 'standardize_formats', 'fill_missing', 'detect_anomalies', 'suggest_cleaning', 'fix'],
  sheets_format: [
    'set_format', 'set_background', 'set_text_format', 'set_number_format', 'set_alignment', 'set_borders',
    'clear_format', 'apply_preset', 'auto_fit', 'batch_format', 'suggest_format', 'add_conditional_format_rule',
    'update_conditional_format', 'delete_conditional_format', 'list_conditional_formats',
    'rule_add_conditional_format', 'rule_update_conditional_format', 'rule_delete_conditional_format',
    'rule_list_conditional_formats', 'set_data_validation', 'clear_data_validation', 'list_data_validations',
    'set_rich_text', 'sparkline_add', 'sparkline_clear', 'sparkline_get', 'build_dependent_dropdown'
  ],
  sheets_history: ['list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear', 'timeline', 'diff_revisions', 'restore_cells'],
  sheets_quality: ['validate', 'detect_conflicts', 'resolve_conflict', 'analyze_impact'],
  sheets_session: [
    'set_active', 'get_active', 'get_context', 'record_operation', 'get_last_operation', 'get_history',
    'find_by_reference', 'update_preferences', 'get_preferences', 'get_profile', 'update_profile_preferences',
    'set_user_id', 'set_pending', 'get_pending', 'clear_pending', 'save_checkpoint', 'load_checkpoint',
    'list_checkpoints', 'delete_checkpoint', 'get_alerts', 'acknowledge_alert', 'clear_alerts',
    'record_successful_formula', 'reject_suggestion', 'get_top_formulas', 'reset', 'schedule_create',
    'schedule_list', 'schedule_cancel', 'schedule_run_now', 'execute_pipeline'
  ],
  sheets_templates: ['list', 'get', 'create', 'update', 'delete', 'preview', 'apply', 'import_builtin'],
  sheets_transaction: ['begin', 'queue', 'commit', 'rollback', 'status', 'list'],
  sheets_visualize: [
    'chart_create', 'chart_update', 'chart_delete', 'chart_list', 'chart_get', 'chart_move', 'chart_resize',
    'chart_update_data_range', 'chart_add_trendline', 'chart_remove_trendline', 'suggest_chart', 'pivot_create',
    'pivot_update', 'pivot_delete', 'pivot_list', 'pivot_get', 'pivot_refresh', 'suggest_pivot'
  ],
  sheets_webhook: ['watch_changes', 'subscribe_workspace', 'unsubscribe_workspace', 'list_workspace_subscriptions', 'register', 'unregister', 'list', 'test']
};

/**
 * Complete a spreadsheet ID (user context unknown)
 */
export function completeSpreadsheetId(partial: string): string[] {
  return [
    '1BxiMVs0XRA5nFMrE7N6f97Rpyl455K7aohNYcgc19P8', // Example: Google Sheets API demo
    '1mHIWnDvW9cABJz3l2p-WlrF7Fkc8lE5Dj8Xg3qF8K0u', // Example placeholder
  ];
}

/**
 * Complete a sheet name given a spreadsheet
 */
export function completeSheetName(partial: string): string[] {
  return ['Sheet1', 'Data', 'Summary', 'Analysis', 'Dashboard', 'Archive'];
}

/**
 * Complete a tool name
 */
export function completeToolName(partial: string): string[] {
  return getAvailableToolNames().filter(tool =>
    !partial || tool.toLowerCase().includes(partial.toLowerCase())
  );
}

/**
 * Complete an action name for a given tool
 */
export function completeActionName(tool: string, partial: string): string[] {
  const actions = TOOL_ACTIONS[tool] || [];
  return actions.filter(action =>
    !partial || action.toLowerCase().includes(partial.toLowerCase())
  );
}

/**
 * MCP Completions handler: returns completion results for text input
 */
export async function handleCompletions(
  ref: string,
  argument: string
): Promise<CompleteResult> {
  const [field, partial] = (argument || '').split(':');
  const completions: string[] = [];

  switch (field) {
    case 'spreadsheetId':
      completions.push(...completeSpreadsheetId(partial || ''));
      break;
    case 'sheetName':
      completions.push(...completeSheetName(partial || ''));
      break;
    case 'tool':
      completions.push(...completeToolName(partial || ''));
      break;
    case 'action':
      const [toolName] = (partial || '').split('.');
      completions.push(...completeActionName(toolName, partial || ''));
      break;
    default:
      break;
  }

  return {
    completion: {
      values: completions.map(v => ({ type: 'text', value: v })),
    },
  };
}
