#!/usr/bin/env node
/**
 * check-promotion-candidates.mjs
 *
 * Advisory script that identifies live API test promotion candidates in the
 * action matrix. Reports:
 *   1. Read-only probe_only actions safe to promote to mcp_execute
 *   2. probe_only tools with ≥3 mcp_execute action-level overrides (bulk candidates)
 *
 * Exit: always 0 (advisory, never a gate).
 */

// ─── TOOL_ACTIONS (loaded from src/generated/manifest.json — auto-kept in sync by schema:commit) ──

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(__dirname, '../src/generated/manifest.json'), 'utf8'));
const TOOL_ACTIONS = Object.fromEntries(manifest.tools.map((t) => [t.name, t.actions]));

// ─── Legacy static fallback (kept for reference — remove when manifest is stable) ──────────────
// prettier-ignore
const _TOOL_ACTIONS_STATIC_FALLBACK = {
  sheets_advanced: [
    'add_named_range', 'update_named_range', 'delete_named_range', 'list_named_ranges',
    'get_named_range', 'add_protected_range', 'update_protected_range', 'delete_protected_range',
    'list_protected_ranges', 'set_metadata', 'get_metadata', 'delete_metadata', 'add_banding',
    'update_banding', 'delete_banding', 'list_banding', 'create_table', 'delete_table',
    'list_tables', 'update_table', 'rename_table_column', 'set_table_column_properties',
    'add_person_chip', 'add_drive_chip', 'add_rich_link_chip', 'list_chips',
    'create_named_function', 'list_named_functions', 'get_named_function',
    'update_named_function', 'delete_named_function',
  ],
  sheets_agent: [
    'plan', 'execute', 'execute_step', 'observe', 'rollback', 'get_status', 'list_plans', 'resume',
  ],
  sheets_analyze: [
    'comprehensive', 'analyze_data', 'suggest_visualization', 'generate_formula',
    'detect_patterns', 'analyze_structure', 'analyze_quality', 'analyze_performance',
    'analyze_formulas', 'query_natural_language', 'explain_analysis', 'scout', 'plan',
    'execute_plan', 'drill_down', 'generate_actions', 'suggest_next_actions', 'auto_enhance',
    'discover_action', 'diagnose_errors', 'formula_health_check', 'quick_insights',
    'semantic_search', 'schedule_intelligence', 'get_intelligence_report', 'cancel_intelligence',
  ],
  sheets_appsscript: [
    'create', 'get', 'get_content', 'update_content', 'create_version', 'list_versions',
    'get_version', 'deploy', 'list_deployments', 'get_deployment', 'undeploy', 'run',
    'list_processes', 'get_metrics', 'create_trigger', 'list_triggers', 'delete_trigger',
    'update_trigger', 'install_serval_function',
  ],
  sheets_auth: ['status', 'login', 'callback', 'logout', 'setup_feature'],
  sheets_bigquery: [
    'connect', 'connect_looker', 'disconnect', 'list_connections', 'get_connection', 'query',
    'preview', 'refresh', 'cancel_refresh', 'list_datasets', 'list_tables', 'get_table_schema',
    'export_to_bigquery', 'import_from_bigquery', 'create_scheduled_query',
    'list_scheduled_queries', 'delete_scheduled_query',
  ],
  sheets_collaborate: [
    'share_add', 'share_update', 'share_remove', 'share_list', 'share_get',
    'share_transfer_ownership', 'share_set_link', 'share_get_link', 'comment_add',
    'comment_update', 'comment_delete', 'comment_list', 'comment_get', 'comment_resolve',
    'comment_reopen', 'comment_add_reply', 'comment_update_reply', 'comment_delete_reply',
    'version_list_revisions', 'version_get_revision', 'version_restore_revision',
    'version_keep_revision', 'version_create_snapshot', 'version_snapshot_status',
    'version_list_snapshots', 'version_restore_snapshot', 'version_delete_snapshot',
    'version_compare', 'version_export', 'approval_create', 'approval_approve',
    'approval_reject', 'approval_get_status', 'approval_list_pending', 'approval_delegate',
    'approval_cancel', 'list_access_proposals', 'resolve_access_proposal', 'label_list',
    'label_apply', 'label_remove',
  ],
  sheets_composite: [
    'import_csv', 'smart_append', 'bulk_update', 'deduplicate', 'export_xlsx', 'import_xlsx',
    'get_form_responses', 'setup_sheet', 'import_and_format', 'clone_structure',
    'export_large_dataset', 'audit_sheet', 'publish_report', 'data_pipeline',
    'instantiate_template', 'migrate_spreadsheet', 'generate_sheet', 'generate_template',
    'preview_generation', 'batch_operations', 'build_dashboard',
  ],
  sheets_compute: [
    'evaluate', 'aggregate', 'statistical', 'regression', 'forecast', 'matrix_op',
    'pivot_compute', 'custom_function', 'batch_compute', 'explain_formula', 'sql_query',
    'sql_join', 'python_eval', 'pandas_profile', 'sklearn_model', 'matplotlib_chart',
  ],
  sheets_confirm: ['request', 'get_stats', 'wizard_start', 'wizard_step', 'wizard_complete'],
  sheets_connectors: [
    'list_connectors', 'configure', 'query', 'batch_query', 'subscribe', 'unsubscribe',
    'list_subscriptions', 'transform', 'status', 'discover',
  ],
  sheets_core: [
    'get', 'create', 'copy', 'update_properties', 'get_url', 'batch_get', 'get_comprehensive',
    'describe_workbook', 'workbook_fingerprint', 'list', 'add_sheet', 'delete_sheet',
    'duplicate_sheet', 'update_sheet', 'copy_sheet_to', 'list_sheets', 'get_sheet',
    'batch_delete_sheets', 'batch_update_sheets', 'clear_sheet', 'move_sheet',
  ],
  sheets_data: [
    'read', 'write', 'append', 'clear', 'batch_read', 'batch_write', 'batch_clear',
    'find_replace', 'add_note', 'get_note', 'clear_note', 'set_hyperlink', 'clear_hyperlink',
    'merge_cells', 'unmerge_cells', 'get_merges', 'cut_paste', 'copy_paste',
    'detect_spill_ranges', 'smart_fill', 'auto_fill', 'cross_read', 'cross_query',
    'cross_write', 'cross_compare',
  ],
  sheets_dependencies: [
    'build', 'analyze_impact', 'detect_cycles', 'get_dependencies', 'get_dependents',
    'get_stats', 'export_dot', 'model_scenario', 'compare_scenarios', 'create_scenario_sheet',
  ],
  sheets_dimensions: [
    'insert', 'delete', 'move', 'resize', 'auto_resize', 'hide', 'show', 'freeze', 'group',
    'ungroup', 'append', 'set_basic_filter', 'clear_basic_filter', 'get_basic_filter',
    'sort_range', 'delete_duplicates', 'trim_whitespace', 'randomize_range', 'text_to_columns',
    'auto_fill', 'create_filter_view', 'duplicate_filter_view', 'update_filter_view',
    'delete_filter_view', 'list_filter_views', 'get_filter_view', 'create_slicer',
    'update_slicer', 'delete_slicer', 'list_slicers',
  ],
  sheets_federation: ['call_remote', 'list_servers', 'get_server_tools', 'validate_connection'],
  sheets_fix: ['fix', 'clean', 'standardize_formats', 'fill_missing', 'detect_anomalies', 'suggest_cleaning'],
  sheets_format: [
    'set_format', 'suggest_format', 'set_background', 'set_text_format', 'set_number_format',
    'set_alignment', 'set_borders', 'clear_format', 'apply_preset', 'auto_fit', 'sparkline_add',
    'sparkline_get', 'sparkline_clear', 'rule_add_conditional_format',
    'rule_update_conditional_format', 'rule_delete_conditional_format',
    'rule_list_conditional_formats', 'set_data_validation', 'clear_data_validation',
    'list_data_validations', 'add_conditional_format_rule', 'batch_format', 'set_rich_text',
    'generate_conditional_format', 'build_dependent_dropdown',
  ],
  sheets_history: [
    'list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear', 'timeline',
    'diff_revisions', 'restore_cells',
  ],
  sheets_quality: ['validate', 'detect_conflicts', 'resolve_conflict', 'analyze_impact'],
  sheets_session: [
    'set_active', 'get_active', 'get_context', 'record_operation', 'get_last_operation',
    'get_history', 'find_by_reference', 'update_preferences', 'get_preferences', 'set_pending',
    'get_pending', 'clear_pending', 'save_checkpoint', 'load_checkpoint', 'list_checkpoints',
    'delete_checkpoint', 'reset', 'compact_session', 'get_alerts', 'acknowledge_alert',
    'clear_alerts', 'set_user_id', 'get_profile', 'update_profile_preferences',
    'record_successful_formula', 'reject_suggestion', 'get_top_formulas', 'schedule_create',
    'schedule_list', 'schedule_cancel', 'schedule_run_now', 'execute_pipeline',
  ],
  sheets_templates: ['list', 'get', 'create', 'apply', 'update', 'delete', 'preview', 'import_builtin'],
  sheets_transaction: ['begin', 'queue', 'commit', 'rollback', 'status', 'list'],
  sheets_visualize: [
    'chart_create', 'suggest_chart', 'chart_update', 'chart_delete', 'chart_list', 'chart_get',
    'chart_move', 'chart_resize', 'chart_update_data_range', 'chart_add_trendline',
    'chart_remove_trendline', 'pivot_create', 'suggest_pivot', 'pivot_update', 'pivot_delete',
    'pivot_list', 'pivot_get', 'pivot_refresh',
  ],
  sheets_webhook: [
    'subscribe', 'unsubscribe', 'list', 'get', 'pause', 'resume', 'test', 'list_events',
    'rotate_secret', 'get_stats', 'delete_all',
  ],
}; // end _TOOL_ACTIONS_STATIC_FALLBACK

// ─── MATRIX_TOOL_DEFAULTS (from tests/live-api/action-matrix-support.ts) ────

const MATRIX_TOOL_DEFAULTS = {
  sheets_advanced:    { mode: 'mcp_execute' },
  sheets_agent:       { mode: 'probe_only' },
  sheets_analyze:     { mode: 'probe_only' },
  sheets_appsscript:  { mode: 'skip_external' },
  sheets_auth:        { mode: 'mcp_execute' },
  sheets_bigquery:    { mode: 'skip_external' },
  sheets_collaborate: { mode: 'probe_only' },
  sheets_composite:   { mode: 'probe_only' },
  sheets_compute:     { mode: 'probe_only' },
  sheets_confirm:     { mode: 'probe_only' },
  sheets_connectors:  { mode: 'skip_external' },
  sheets_core:        { mode: 'mcp_execute' },
  sheets_data:        { mode: 'mcp_execute' },
  sheets_dependencies:{ mode: 'mcp_execute' },
  sheets_dimensions:  { mode: 'mcp_execute' },
  sheets_federation:  { mode: 'skip_external' },
  sheets_fix:         { mode: 'probe_only' },
  sheets_format:      { mode: 'mcp_execute' },
  sheets_history:     { mode: 'probe_only' },
  sheets_quality:     { mode: 'mcp_execute' },
  sheets_session:     { mode: 'mcp_execute' },
  sheets_templates:   { mode: 'probe_only' },
  sheets_transaction: { mode: 'mcp_execute' },
  sheets_visualize:   { mode: 'probe_only' },
  sheets_webhook:     { mode: 'skip_external' },
};

// ─── MATRIX_ACTION_OVERRIDES (from tests/live-api/action-matrix-support.ts) ─

const MATRIX_ACTION_OVERRIDES = {
  'sheets_auth.callback':                     { mode: 'skip_external' },
  'sheets_auth.login':                        { mode: 'skip_external' },
  'sheets_auth.logout':                       { mode: 'skip_external' },
  'sheets_auth.setup_feature':                { mode: 'probe_only' },
  'sheets_confirm.get_stats':                 { mode: 'mcp_execute' },
  'sheets_core.copy':                         { mode: 'probe_only' },
  'sheets_history.list':                      { mode: 'mcp_execute' },
  'sheets_history.stats':                     { mode: 'mcp_execute' },
  'sheets_templates.create':                  { mode: 'mcp_execute' },
  'sheets_templates.list':                    { mode: 'mcp_execute' },
  'sheets_advanced.create_named_function':    { mode: 'probe_only' },
  'sheets_advanced.list_named_functions':     { mode: 'probe_only' },
  'sheets_advanced.get_named_function':       { mode: 'probe_only' },
  'sheets_advanced.update_named_function':    { mode: 'probe_only' },
  'sheets_advanced.delete_named_function':    { mode: 'probe_only' },
  'sheets_advanced.add_banding':              { mode: 'probe_only' },
  'sheets_advanced.add_drive_chip':           { mode: 'probe_only' },
  'sheets_advanced.add_rich_link_chip':       { mode: 'probe_only' },
  'sheets_data.smart_fill':                   { mode: 'probe_only' },
  'sheets_templates.import_builtin':          { mode: 'probe_only' },
  'sheets_transaction.begin':                 { mode: 'probe_only' },
  'sheets_transaction.list':                  { mode: 'probe_only' },
  'sheets_visualize.chart_create':            { mode: 'mcp_execute' },
  'sheets_visualize.chart_list':              { mode: 'mcp_execute' },
  'sheets_visualize.pivot_create':            { mode: 'mcp_execute' },
  'sheets_visualize.pivot_list':              { mode: 'mcp_execute' },
  'sheets_visualize.suggest_chart':           { mode: 'probe_only' },
  'sheets_visualize.suggest_pivot':           { mode: 'probe_only' },
};

// ─── READ_ONLY_ACTION_NAMES (from tests/live-api/action-matrix-support.ts) ──

const READ_ONLY_ACTION_NAMES = new Set([
  'analyze_impact', 'analyze_quality', 'analyze_structure', 'batch_get', 'batch_read',
  'build', 'check_auth', 'comprehensive', 'describe_workbook', 'detect_anomalies',
  'detect_conflicts', 'detect_cycles', 'detect_patterns', 'detect_spill_ranges', 'discover',
  'discover_action', 'diagnose_errors', 'evaluate', 'explain_analysis', 'explain_formula',
  'formula_health_check', 'get', 'get_named_range', 'get_active', 'get_alerts',
  'get_comprehensive', 'get_context', 'get_dependencies', 'get_dependents', 'get_last_operation',
  'get_merges', 'get_note', 'get_preferences', 'get_profile', 'get_scopes', 'get_sheet',
  'get_stats', 'get_top_formulas', 'get_url', 'list', 'list_access_proposals', 'list_banding',
  'list_chips', 'list_filter_views', 'list_named_functions', 'list_named_ranges', 'list_plans',
  'list_protected_ranges', 'list_sheets', 'list_slicers', 'list_tables', 'preview',
  'preview_generation', 'query_natural_language', 'quick_insights', 'read', 'scout',
  'share_get_link', 'share_list', 'status', 'suggest_chart', 'suggest_cleaning',
  'suggest_format', 'suggest_pivot', 'suggest_visualization', 'validate', 'workbook_fingerprint',
  'chart_list', 'list_data_validations', 'pivot_list', 'stats',
]);

// ─── Analysis ────────────────────────────────────────────────────────────────

/** Resolve the effective mode for a given tool.action pair. */
function effectiveMode(tool, action) {
  const actionKey = `${tool}.${action}`;
  if (MATRIX_ACTION_OVERRIDES[actionKey]) {
    return MATRIX_ACTION_OVERRIDES[actionKey].mode;
  }
  return MATRIX_TOOL_DEFAULTS[tool]?.mode ?? 'probe_only';
}

// 1. Read-only probe_only actions not already overridden to mcp_execute
const safeToPromote = [];

for (const [tool, actions] of Object.entries(TOOL_ACTIONS)) {
  const toolDefault = MATRIX_TOOL_DEFAULTS[tool]?.mode;
  if (toolDefault !== 'probe_only') continue; // only interested in probe_only tool defaults

  for (const action of actions) {
    if (!READ_ONLY_ACTION_NAMES.has(action)) continue; // must be read-only

    const actionKey = `${tool}.${action}`;
    const override = MATRIX_ACTION_OVERRIDES[actionKey];
    if (override && override.mode === 'mcp_execute') continue; // already promoted
    if (override && override.mode === 'skip_external') continue; // explicitly excluded

    // effective mode is probe_only (tool default, no mcp_execute override)
    safeToPromote.push(actionKey);
  }
}

safeToPromote.sort();

// 2. probe_only tools with ≥3 mcp_execute action-level overrides
const bulkCandidates = [];

for (const [tool, toolRule] of Object.entries(MATRIX_TOOL_DEFAULTS)) {
  if (toolRule.mode !== 'probe_only') continue;

  const mcpOverrides = Object.entries(MATRIX_ACTION_OVERRIDES)
    .filter(([key, rule]) => key.startsWith(`${tool}.`) && rule.mode === 'mcp_execute')
    .map(([key]) => key.replace(`${tool}.`, ''));

  if (mcpOverrides.length >= 3) {
    bulkCandidates.push({ tool, actions: mcpOverrides });
  }
}

bulkCandidates.sort((a, b) => b.actions.length - a.actions.length);

// ─── Output ──────────────────────────────────────────────────────────────────

const LINE = '══════════════════════════════════════════';

console.log('');
console.log('ServalSheets — Promotion Candidates Report');
console.log(LINE);

console.log('');
console.log('Read-only probe_only actions (safe to promote to mcp_execute):');
if (safeToPromote.length === 0) {
  console.log('  (none found)');
} else {
  for (const key of safeToPromote) {
    const [tool, action] = key.split('.');
    console.log(`  ${key} — tool default is probe_only, action is read-only`);
  }
}

console.log('');
console.log('Tools with ≥3 mcp_execute action overrides (bulk promotion candidates):');
if (bulkCandidates.length === 0) {
  console.log('  (none found)');
} else {
  for (const { tool, actions } of bulkCandidates) {
    console.log(`  ${tool} — ${actions.length} actions already mcp_execute (${actions.join(', ')})`);
  }
}

console.log('');
console.log(`Total safe-to-promote actions: ${safeToPromote.length}`);
console.log(`Total bulk-promotion-candidate tools: ${bulkCandidates.length}`);
console.log('');
console.log('Note: This is advisory only. Review each action before promoting.');
console.log('');

process.exit(0);
