#!/usr/bin/env node
/**
 * CI Gate: Cache Invalidation Rule Coverage
 *
 * Every (tool, action) pair surfaced through TOOL_ACTIONS must have a
 * matching rule in CacheInvalidationGraph.buildInvalidationRules().
 * Missing rules silently fall through to `{ invalidates: [] }` at
 * runtime, so stale caches survive mutations — a correctness bug with
 * no logs to trace.
 *
 * This script parses both sources statically and exits non-zero if
 * anything is missing. Known-OK gaps (rare; typically for new tools
 * that hadn't been wired yet) must be added to the KNOWN_MISSING
 * allowlist below with a short justification.
 *
 * Usage: node scripts/check-cache-invalidation-coverage.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Allowlist: known (tool.action) keys that intentionally lack a rule.
// Every entry needs a short justification.
//
// The entries captured at gate introduction all share the same reason:
// "pre-existing gap at coverage-gate introduction" — a systematic
// audit of buildInvalidationRules() vs TOOL_ACTIONS found these 171
// tool-action pairs with no rule. They are intentionally frozen here so
// the gate catches *new* drift, while follow-up work can burn down the
// existing backlog tool-by-tool.
//
// When you wire a rule in src/services/cache-invalidation-graph.ts,
// delete the matching entry below.
// ---------------------------------------------------------------------------
const DEFAULT_REASON = 'pre-existing gap at coverage-gate introduction';
const KNOWN_MISSING = new Map([
  // sheets_advanced
  ['sheets_advanced.add_banding', DEFAULT_REASON],
  ['sheets_advanced.add_drive_chip', DEFAULT_REASON],
  ['sheets_advanced.add_named_range', DEFAULT_REASON],
  ['sheets_advanced.add_person_chip', DEFAULT_REASON],
  ['sheets_advanced.add_protected_range', DEFAULT_REASON],
  ['sheets_advanced.add_rich_link_chip', DEFAULT_REASON],
  ['sheets_advanced.create_named_function', DEFAULT_REASON],
  ['sheets_advanced.delete_banding', DEFAULT_REASON],
  ['sheets_advanced.delete_metadata', DEFAULT_REASON],
  ['sheets_advanced.delete_named_function', DEFAULT_REASON],
  ['sheets_advanced.delete_named_range', DEFAULT_REASON],
  ['sheets_advanced.delete_protected_range', DEFAULT_REASON],
  ['sheets_advanced.get_metadata', DEFAULT_REASON],
  ['sheets_advanced.get_named_function', DEFAULT_REASON],
  ['sheets_advanced.get_named_range', DEFAULT_REASON],
  ['sheets_advanced.list_banding', DEFAULT_REASON],
  ['sheets_advanced.list_chips', DEFAULT_REASON],
  ['sheets_advanced.list_named_functions', DEFAULT_REASON],
  ['sheets_advanced.list_named_ranges', DEFAULT_REASON],
  ['sheets_advanced.list_protected_ranges', DEFAULT_REASON],
  ['sheets_advanced.list_tables', DEFAULT_REASON],
  ['sheets_advanced.set_metadata', DEFAULT_REASON],
  ['sheets_advanced.update_banding', DEFAULT_REASON],
  ['sheets_advanced.update_named_function', DEFAULT_REASON],
  ['sheets_advanced.update_named_range', DEFAULT_REASON],
  ['sheets_advanced.update_protected_range', DEFAULT_REASON],
  // sheets_analyze
  ['sheets_analyze.cancel_intelligence', DEFAULT_REASON],
  ['sheets_analyze.formula_health_check', DEFAULT_REASON],
  ['sheets_analyze.get_intelligence_report', DEFAULT_REASON],
  ['sheets_analyze.schedule_intelligence', DEFAULT_REASON],
  // sheets_appsscript
  ['sheets_appsscript.create_trigger', DEFAULT_REASON],
  ['sheets_appsscript.delete_trigger', DEFAULT_REASON],
  ['sheets_appsscript.install_serval_function', DEFAULT_REASON],
  ['sheets_appsscript.list_triggers', DEFAULT_REASON],
  ['sheets_appsscript.update_trigger', DEFAULT_REASON],
  // sheets_auth
  ['sheets_auth.callback', DEFAULT_REASON],
  ['sheets_auth.login', DEFAULT_REASON],
  ['sheets_auth.logout', DEFAULT_REASON],
  ['sheets_auth.setup_feature', DEFAULT_REASON],
  // sheets_bigquery
  ['sheets_bigquery.connect_looker', DEFAULT_REASON],
  ['sheets_bigquery.create_scheduled_query', DEFAULT_REASON],
  ['sheets_bigquery.delete_scheduled_query', DEFAULT_REASON],
  ['sheets_bigquery.get_connection', DEFAULT_REASON],
  ['sheets_bigquery.get_table_schema', DEFAULT_REASON],
  ['sheets_bigquery.import_from_bigquery', DEFAULT_REASON],
  ['sheets_bigquery.list_scheduled_queries', DEFAULT_REASON],
  ['sheets_bigquery.preview', DEFAULT_REASON],
  // sheets_collaborate
  ['sheets_collaborate.approval_approve', DEFAULT_REASON],
  ['sheets_collaborate.approval_cancel', DEFAULT_REASON],
  ['sheets_collaborate.approval_create', DEFAULT_REASON],
  ['sheets_collaborate.approval_delegate', DEFAULT_REASON],
  ['sheets_collaborate.approval_get_status', DEFAULT_REASON],
  ['sheets_collaborate.approval_list_pending', DEFAULT_REASON],
  ['sheets_collaborate.approval_reject', DEFAULT_REASON],
  ['sheets_collaborate.label_apply', DEFAULT_REASON],
  ['sheets_collaborate.label_list', DEFAULT_REASON],
  ['sheets_collaborate.label_remove', DEFAULT_REASON],
  ['sheets_collaborate.list_access_proposals', DEFAULT_REASON],
  ['sheets_collaborate.resolve_access_proposal', DEFAULT_REASON],
  ['sheets_collaborate.share_add', DEFAULT_REASON],
  ['sheets_collaborate.share_get', DEFAULT_REASON],
  ['sheets_collaborate.share_get_link', DEFAULT_REASON],
  ['sheets_collaborate.share_list', DEFAULT_REASON],
  ['sheets_collaborate.share_remove', DEFAULT_REASON],
  ['sheets_collaborate.share_set_link', DEFAULT_REASON],
  ['sheets_collaborate.share_transfer_ownership', DEFAULT_REASON],
  ['sheets_collaborate.share_update', DEFAULT_REASON],
  ['sheets_collaborate.version_compare', DEFAULT_REASON],
  ['sheets_collaborate.version_create_snapshot', DEFAULT_REASON],
  ['sheets_collaborate.version_delete_snapshot', DEFAULT_REASON],
  ['sheets_collaborate.version_export', DEFAULT_REASON],
  ['sheets_collaborate.version_get_revision', DEFAULT_REASON],
  ['sheets_collaborate.version_keep_revision', DEFAULT_REASON],
  ['sheets_collaborate.version_list_revisions', DEFAULT_REASON],
  ['sheets_collaborate.version_list_snapshots', DEFAULT_REASON],
  ['sheets_collaborate.version_restore_revision', DEFAULT_REASON],
  ['sheets_collaborate.version_restore_snapshot', DEFAULT_REASON],
  ['sheets_collaborate.version_snapshot_status', DEFAULT_REASON],
  // sheets_composite
  ['sheets_composite.batch_operations', DEFAULT_REASON],
  ['sheets_composite.build_dashboard', DEFAULT_REASON],
  // sheets_compute
  ['sheets_compute.matplotlib_chart', DEFAULT_REASON],
  ['sheets_compute.pandas_profile', DEFAULT_REASON],
  ['sheets_compute.python_eval', DEFAULT_REASON],
  ['sheets_compute.sklearn_model', DEFAULT_REASON],
  ['sheets_compute.sql_join', DEFAULT_REASON],
  ['sheets_compute.sql_query', DEFAULT_REASON],
  // sheets_confirm
  ['sheets_confirm.get_stats', DEFAULT_REASON],
  ['sheets_confirm.request', DEFAULT_REASON],
  ['sheets_confirm.wizard_complete', DEFAULT_REASON],
  ['sheets_confirm.wizard_start', DEFAULT_REASON],
  ['sheets_confirm.wizard_step', DEFAULT_REASON],
  // sheets_connectors
  ['sheets_connectors.batch_query', DEFAULT_REASON],
  ['sheets_connectors.configure', DEFAULT_REASON],
  ['sheets_connectors.discover', DEFAULT_REASON],
  ['sheets_connectors.list_connectors', DEFAULT_REASON],
  ['sheets_connectors.list_subscriptions', DEFAULT_REASON],
  ['sheets_connectors.query', DEFAULT_REASON],
  ['sheets_connectors.status', DEFAULT_REASON],
  ['sheets_connectors.subscribe', DEFAULT_REASON],
  ['sheets_connectors.transform', DEFAULT_REASON],
  ['sheets_connectors.unsubscribe', DEFAULT_REASON],
  // sheets_core
  ['sheets_core.batch_get', DEFAULT_REASON],
  ['sheets_core.describe_workbook', DEFAULT_REASON],
  ['sheets_core.get_comprehensive', DEFAULT_REASON],
  ['sheets_core.get_url', DEFAULT_REASON],
  ['sheets_core.workbook_fingerprint', DEFAULT_REASON],
  // sheets_data
  ['sheets_data.add_note', DEFAULT_REASON],
  ['sheets_data.get_merges', DEFAULT_REASON],
  ['sheets_data.get_note', DEFAULT_REASON],
  ['sheets_data.merge_cells', DEFAULT_REASON],
  ['sheets_data.smart_fill', DEFAULT_REASON],
  ['sheets_data.unmerge_cells', DEFAULT_REASON],
  // sheets_dimensions
  ['sheets_dimensions.append', DEFAULT_REASON],
  ['sheets_dimensions.clear_basic_filter', DEFAULT_REASON],
  ['sheets_dimensions.create_filter_view', DEFAULT_REASON],
  ['sheets_dimensions.delete', DEFAULT_REASON],
  ['sheets_dimensions.delete_duplicates', DEFAULT_REASON],
  ['sheets_dimensions.delete_filter_view', DEFAULT_REASON],
  ['sheets_dimensions.duplicate_filter_view', DEFAULT_REASON],
  ['sheets_dimensions.freeze', DEFAULT_REASON],
  ['sheets_dimensions.get_basic_filter', DEFAULT_REASON],
  ['sheets_dimensions.get_filter_view', DEFAULT_REASON],
  ['sheets_dimensions.group', DEFAULT_REASON],
  ['sheets_dimensions.hide', DEFAULT_REASON],
  ['sheets_dimensions.insert', DEFAULT_REASON],
  ['sheets_dimensions.list_filter_views', DEFAULT_REASON],
  ['sheets_dimensions.move', DEFAULT_REASON],
  ['sheets_dimensions.randomize_range', DEFAULT_REASON],
  ['sheets_dimensions.resize', DEFAULT_REASON],
  ['sheets_dimensions.set_basic_filter', DEFAULT_REASON],
  ['sheets_dimensions.show', DEFAULT_REASON],
  ['sheets_dimensions.text_to_columns', DEFAULT_REASON],
  ['sheets_dimensions.trim_whitespace', DEFAULT_REASON],
  ['sheets_dimensions.ungroup', DEFAULT_REASON],
  ['sheets_dimensions.update_filter_view', DEFAULT_REASON],
  // sheets_federation
  ['sheets_federation.get_server_tools', DEFAULT_REASON],
  ['sheets_federation.validate_connection', DEFAULT_REASON],
  // sheets_format
  ['sheets_format.apply_preset', DEFAULT_REASON],
  ['sheets_format.auto_fit', DEFAULT_REASON],
  ['sheets_format.clear_data_validation', DEFAULT_REASON],
  ['sheets_format.list_data_validations', DEFAULT_REASON],
  ['sheets_format.set_alignment', DEFAULT_REASON],
  ['sheets_format.set_data_validation', DEFAULT_REASON],
  ['sheets_format.set_rich_text', DEFAULT_REASON],
  ['sheets_format.set_text_format', DEFAULT_REASON],
  ['sheets_format.sparkline_add', DEFAULT_REASON],
  ['sheets_format.sparkline_clear', DEFAULT_REASON],
  ['sheets_format.sparkline_get', DEFAULT_REASON],
  // sheets_quality
  ['sheets_quality.analyze_impact', DEFAULT_REASON],
  ['sheets_quality.detect_conflicts', DEFAULT_REASON],
  ['sheets_quality.resolve_conflict', DEFAULT_REASON],
  // sheets_templates
  ['sheets_templates.import_builtin', DEFAULT_REASON],
  // sheets_transaction
  ['sheets_transaction.list', DEFAULT_REASON],
  ['sheets_transaction.queue', DEFAULT_REASON],
  ['sheets_transaction.status', DEFAULT_REASON],
  // sheets_visualize
  ['sheets_visualize.chart_add_trendline', DEFAULT_REASON],
  ['sheets_visualize.chart_create', DEFAULT_REASON],
  ['sheets_visualize.chart_delete', DEFAULT_REASON],
  ['sheets_visualize.chart_get', DEFAULT_REASON],
  ['sheets_visualize.chart_list', DEFAULT_REASON],
  ['sheets_visualize.chart_move', DEFAULT_REASON],
  ['sheets_visualize.chart_remove_trendline', DEFAULT_REASON],
  ['sheets_visualize.chart_resize', DEFAULT_REASON],
  ['sheets_visualize.chart_update', DEFAULT_REASON],
  ['sheets_visualize.chart_update_data_range', DEFAULT_REASON],
  ['sheets_visualize.pivot_create', DEFAULT_REASON],
  ['sheets_visualize.pivot_delete', DEFAULT_REASON],
  ['sheets_visualize.pivot_get', DEFAULT_REASON],
  ['sheets_visualize.pivot_list', DEFAULT_REASON],
  ['sheets_visualize.pivot_refresh', DEFAULT_REASON],
  ['sheets_visualize.pivot_update', DEFAULT_REASON],
]);

// ---------------------------------------------------------------------------
// Parse TOOL_ACTIONS from the generated completions file.
// ---------------------------------------------------------------------------
function loadToolActions() {
  const src = readFileSync(resolve(ROOT, 'src/generated/completions.ts'), 'utf8');
  const blockMatch = src.match(
    /export const TOOL_ACTIONS[^=]*=\s*\{([\s\S]*?)\n\};/
  );
  if (!blockMatch) {
    console.error('  error: Could not find TOOL_ACTIONS export in src/generated/completions.ts');
    process.exit(1);
  }
  const block = blockMatch[1];

  // Match each `tool_name: [ 'a', 'b', ... ]`.
  const toolRe = /(sheets_[a-z_]+)\s*:\s*\[([\s\S]*?)\],?\n/g;
  const pairs = [];
  let m;
  while ((m = toolRe.exec(block)) !== null) {
    const tool = m[1];
    const body = m[2];
    for (const actionMatch of body.matchAll(/'([^']+)'/g)) {
      pairs.push(`${tool}.${actionMatch[1]}`);
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Parse rule keys from cache-invalidation-graph.ts
// Pattern: rules['sheets_x.action'] = { invalidates: [...] };
// ---------------------------------------------------------------------------
function loadRuleKeys() {
  const src = readFileSync(resolve(ROOT, 'src/services/cache-invalidation-graph.ts'), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/rules\[\s*'(sheets_[a-z_]+\.[a-z_0-9]+)'\s*\]\s*=/g)) {
    keys.add(m[1]);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('=======================================================');
console.log('  Cache Invalidation Rule Coverage Check');
console.log('=======================================================\n');

const expectedKeys = loadToolActions();
const ruleKeys = loadRuleKeys();

console.log(`  TOOL_ACTIONS pairs:    ${expectedKeys.length}`);
console.log(`  cache-graph rule keys: ${ruleKeys.size}`);
console.log(`  allowlisted gaps:      ${KNOWN_MISSING.size}\n`);

const missing = [];
for (const key of expectedKeys) {
  if (ruleKeys.has(key)) continue;
  if (KNOWN_MISSING.has(key)) continue;
  missing.push(key);
}

if (missing.length === 0) {
  console.log('  result: PASS — every tool.action has a cache-invalidation rule');
  console.log('\n=======================================================');
  process.exit(0);
}

console.log(`  result: FAIL — ${missing.length} tool.action pair(s) have no cache-invalidation rule:\n`);
console.log('    key');
console.log('    -----------------------------------------------');
for (const key of missing.sort()) {
  console.log(`    ${key}`);
}
console.log('\n  To fix:');
console.log('    1. Add a rule to buildInvalidationRules() in');
console.log('       src/services/cache-invalidation-graph.ts. Use');
console.log('       { invalidates: [] } for read-only actions, or a pattern like');
console.log("       { invalidates: ['values:*'] } / { invalidates: ['metadata:*'] } for mutations.");
console.log('    2. If an action is legitimately out of scope, add it to KNOWN_MISSING');
console.log('       in this script with a justification.');
console.log('\n=======================================================');
process.exit(1);
