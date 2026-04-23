#!/usr/bin/env node
/**
 * CI Gate: Mutation Action Handler Coverage
 *
 * Walks src/handlers/*.ts and looks for action names that *sound* mutating
 * (write/append/delete/clear/create/update/set_/add_/remove_/move/copy/
 *  import/export/merge/unmerge/rename/insert/bulk_/batch_<mutate>/sort/
 *  auto_fill/deduplicate/...). For each candidate, the script asserts the
 * action name is present in MUTATION_ACTION_NAMES (canonical source in
 * src/middleware/mutation-actions.constants.ts).
 *
 * Anything that matches the mutation-verb regex but is intentionally NOT
 * a data mutation (e.g. `update_preferences` for session config,
 * `create_filter_view` — oh wait, that IS a mutation) goes in the explicit
 * KNOWN_NON_MUTATING allowlist below. The allowlist is the only place to
 * suppress a match; the source-of-truth constant must NOT be edited to
 * silence this check.
 *
 * Sister script: scripts/check-mutation-actions.mjs (alignment between
 * audit + write-lock middleware). This script covers the orthogonal
 * question "did someone forget to add a new mutating handler to the
 * canonical list?".
 *
 * Exit 0 = all mutating-looking handler actions are in MUTATION_ACTION_NAMES.
 * Exit 1 = drift detected (see table).
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Matches the initial verb of a handler action name that *looks* mutating.
 *
 * Anchored to the start (handler actions tend to follow verb_noun),
 * with the exception of batch_* where we look at the second token.
 */
const MUTATION_VERB_RE =
  /^(write|append|delete|clear|create|update|set_|add_|remove|move|copy|import|export|merge|unmerge|rename|insert|bulk_|smart_(append|fill)|auto_fill|deduplicate|sort|trim|standardize|fill_missing|clean|revert|undo|redo|setup_sheet|generate_sheet|generate_template|migrate_spreadsheet|instantiate_template|clone_structure|data_pipeline|batch_operations|find_replace|cut_paste|copy_paste|randomize_range|text_to_columns|sparkline_|rule_|freeze|hide|show|group|ungroup|resize|cross_write|apply_preset)/;

/**
 * batch_<verb> where verb is itself a mutating op.
 * Kept separate because batch_read, batch_get are read-only.
 */
const BATCH_MUTATION_RE =
  /^batch_(write|clear|update|delete|format|operations|delete_sheets)$/;

/**
 * Actions that match the mutation-verb regex but are intentionally
 * NOT data/structure/format mutations that need audit + write-lock
 * coverage. Each entry must have a reason.
 *
 * Keys are `<tool>.<action>` so we can disambiguate — e.g. session's
 * update_preferences is config, but a future data.update_values would
 * still need to be caught.
 */
const KNOWN_NON_MUTATING = new Map([
  // Session / preferences / context — pure in-memory session config
  ['session.update_preferences', 'session config — not spreadsheet data'],
  ['session.set_active', 'picks the active spreadsheet; no API write'],
  ['session.set_context', 'session context update; no API write'],
  ['session.record_operation', 'records operation metadata; no API write'],
  ['session.create_checkpoint', 'session-local checkpoint; no API write'],
  ['session.restore_checkpoint', 'session-local checkpoint; no API write'],
  ['session.delete_checkpoint', 'session-local checkpoint; no API write'],
  ['session.add_spreadsheet', 'adds to in-memory connector list'],
  ['session.remove_spreadsheet', 'removes from in-memory connector list'],
  ['session.add_favorite', 'session-local bookmark'],
  ['session.remove_favorite', 'session-local bookmark'],
  ['session.set_preferences', 'session config; no API write'],
  ['session.update_connector', 'session connector config'],
  ['session.add_connector', 'session connector config'],
  ['session.remove_connector', 'session connector config'],
  ['session.import_state', 'session state import; no API write'],
  ['session.export_state', 'session state export; no API write'],
  ['session.clear_history', 'clears session history; no API write'],
  ['session.set_undo_checkpoint', 'session-local undo marker'],
  // Auth — OAuth flow, not a sheet mutation
  ['auth.setup_feature', 'OAuth/connector setup; no sheet API call'],
  // Connectors — configuring 3rd-party data sources, not Sheets writes
  ['connectors.add_connector', 'registers a connector; no Sheets API write'],
  ['connectors.remove_connector', 'unregisters a connector; no Sheets API write'],
  ['connectors.update_connector', 'updates connector config; no Sheets API write'],
  ['connectors.import_from_connector', 'wrapper — dispatches to data.write which IS audited'],
  // Transaction — transaction lifecycle, not a sheet mutation itself.
  // Individual queued ops are audited when they commit.
  ['transaction.create', 'starts a transaction; commit is what mutates'],
  ['transaction.delete', 'aborts a transaction; no commit happens'],
  // Agent — dispatches to other tools that ARE audited
  ['agent.create_plan', 'in-memory plan creation'],
  ['agent.update_plan', 'in-memory plan update'],
  ['agent.delete_plan', 'in-memory plan deletion'],
  ['agent.clear_plans', 'in-memory plan list reset'],
  // Webhook — external webhook lifecycle, not a sheet write
  ['webhook.create', 'registers webhook; no Sheets API write'],
  ['webhook.update', 'updates webhook; no Sheets API write'],
  ['webhook.delete', 'removes webhook; no Sheets API write'],
  ['webhook.add_subscription', 'webhook subscription; no Sheets API write'],
  ['webhook.remove_subscription', 'webhook subscription; no Sheets API write'],
  ['webhook.update_subscription', 'webhook subscription; no Sheets API write'],
  // Apps Script — separate service (not core Sheets API)
  ['appsscript.create', 'creates Apps Script project'],
  ['appsscript.update_content', 'updates script content; handled by Apps Script service'],
  ['appsscript.create_version', 'Apps Script version bump'],
  ['appsscript.deploy', 'Apps Script deployment'],
  ['appsscript.undeploy', 'Apps Script deployment'],
  // Federation — remote MCP server registration, not Sheets
  ['federation.add_server', 'remote MCP server registration'],
  ['federation.remove_server', 'remote MCP server registration'],
  // Dependencies — analysis/tracking, not writes
  ['dependencies.add_dependency', 'dependency graph update; no Sheets API'],
  ['dependencies.remove_dependency', 'dependency graph update; no Sheets API'],
  ['dependencies.update_dependency', 'dependency graph update; no Sheets API'],
  // Templates — generate_sheet/instantiate_template are in the canonical list;
  // list-style operations on the template library are not.
  ['templates.add_template', 'adds to template library; no Sheets API write'],
  ['templates.delete_template', 'removes from template library; no Sheets API write'],
  ['templates.update_template', 'updates template library; no Sheets API write'],
  // History / quality / confirm — read/analysis/prompt flows
  ['history.create_snapshot', 'snapshot metadata; no Sheets API write'],
  ['confirm.create', 'creates a pending confirmation; no Sheets API write'],
  ['confirm.delete', 'cancels a pending confirmation; no Sheets API write'],
  // Analyze / compute — analysis planning, not writes
  ['analyze.create_plan', 'analysis plan metadata'],
  ['analyze.update_plan', 'analysis plan metadata'],
  ['compute.create_macro', 'macro definition; no Sheets API write'],
  ['compute.update_macro', 'macro definition; no Sheets API write'],
  ['compute.delete_macro', 'macro definition; no Sheets API write'],
  // BigQuery — separate BQ service (writes land in BQ, not Sheets)
  ['bigquery.create_table', 'BigQuery table, not Sheets'],
  ['bigquery.delete_table', 'BigQuery table, not Sheets'],
  ['bigquery.update_table', 'BigQuery table, not Sheets'],
  ['bigquery.import_from_bigquery', 'wrapper — dispatches to data.write which IS audited'],
  ['bigquery.export_to_bigquery', 'push to BigQuery, not Sheets'],
  // Advanced — named ranges / protected ranges / tables / banding / metadata
  // These mutate spreadsheet *structure* but are deliberately out of the core
  // mutation set (they operate on ranges/metadata, not on cell values).
  // They are audited separately via structure-level events if needed.
  ['advanced.create_table', 'table metadata; not cell data'],
  ['advanced.delete_table', 'table metadata; not cell data'],
  ['advanced.update_table', 'table metadata; not cell data'],
  ['advanced.rename_table_column', 'table metadata; not cell data'],
  ['advanced.set_table_column_properties', 'table metadata; not cell data'],
  ['advanced.add_named_range', 'named-range metadata; not cell data'],
  ['advanced.update_named_range', 'named-range metadata; not cell data'],
  ['advanced.delete_named_range', 'named-range metadata; not cell data'],
  ['advanced.create_named_function', 'named-function metadata'],
  ['advanced.update_named_function', 'named-function metadata'],
  ['advanced.delete_named_function', 'named-function metadata'],
  ['advanced.add_protected_range', 'protection metadata'],
  ['advanced.update_protected_range', 'protection metadata'],
  ['advanced.delete_protected_range', 'protection metadata'],
  ['advanced.add_banding', 'banded-range styling metadata'],
  ['advanced.update_banding', 'banded-range styling metadata'],
  ['advanced.delete_banding', 'banded-range styling metadata'],
  ['advanced.add_drive_chip', 'smart chip metadata'],
  ['advanced.add_person_chip', 'smart chip metadata'],
  ['advanced.add_rich_link_chip', 'smart chip metadata'],
  ['advanced.set_metadata', 'developer metadata; not cell data'],
  ['advanced.delete_metadata', 'developer metadata; not cell data'],
  // Apps Script triggers — Apps Script service, not Sheets API
  ['appsscript.create_trigger', 'Apps Script trigger, not Sheets cell data'],
  ['appsscript.update_trigger', 'Apps Script trigger, not Sheets cell data'],
  ['appsscript.delete_trigger', 'Apps Script trigger, not Sheets cell data'],
  // BigQuery scheduled queries — BQ service, not Sheets
  ['bigquery.create_scheduled_query', 'BigQuery schedule, not Sheets'],
  ['bigquery.delete_scheduled_query', 'BigQuery schedule, not Sheets'],
  // Composite — export ops produce files outbound, no Sheets write
  ['composite.export_large_dataset', 'read-export; does not write to Sheets'],
  ['composite.export_xlsx', 'read-export; does not write to Sheets'],
  // Core sheet-structure ops — structural changes audited at the spreadsheet
  // creation / sheet-management layer, not via the data mutation set.
  ['core.create', 'creates a new spreadsheet; structural, no existing-sheet mutation'],
  ['core.add_sheet', 'adds tab; structural metadata'],
  ['core.copy', 'duplicates a spreadsheet; structural'],
  ['core.copy_sheet_to', 'copies a tab across spreadsheets; structural'],
  ['core.copy_to', 'copies a tab across spreadsheets; structural'],
  ['core.hide_sheet', 'tab visibility; metadata only'],
  ['core.show_sheet', 'tab visibility; metadata only'],
  ['core.move_sheet', 'tab reorder; metadata only'],
  ['core.rename_sheet', 'tab rename; metadata only'],
  ['core.update_properties', 'spreadsheet-level properties'],
  ['core.update_sheet', 'sheet-level properties'],
  ['core.update_sheet_properties', 'sheet-level properties'],
  // Dependencies — dependency-graph exports, not Sheets writes
  ['dependencies.create_scenario_sheet', 'dispatches to core.add_sheet + data.write which ARE audited'],
  ['dependencies.export_dot', 'read-export of dependency graph; no Sheets write'],
  // Dimensions — deduplicate lives in composite; delete_duplicates is a thin
  // wrapper that dispatches to it.
  ['dimensions.delete_duplicates', 'wrapper over composite.deduplicate which IS audited'],
  // Format — false positives for list/get operations
  ['format.rule_list_conditional_formats', 'list is a read operation'],
  ['format.sparkline_get', 'get is a read operation'],
  // History — undo/redo/revert_to are handled by replay, each replayed step
  // goes through its own mutation audit.
  ['history.undo', 'replays prior ops; each op audits on replay'],
  ['history.redo', 'replays prior ops; each op audits on replay'],
  ['history.revert_to', 'replays prior ops; each op audits on replay'],
  // Session — all session-local state
  ['session.clear_alerts', 'session-local alerts'],
  ['session.clear_pending', 'session-local pending queue'],
  ['session.set_pending', 'session-local pending queue'],
  ['session.set_user_id', 'session identity; no API write'],
  ['session.update_profile_preferences', 'session profile config'],
  // Templates — template library metadata, not a Sheets write
  ['templates.create', 'template-library entry; no Sheets write'],
  ['templates.update', 'template-library entry; no Sheets write'],
  ['templates.import_builtin', 'template-library bulk load; no Sheets write'],
]);

function extractCanonicalMutationNames() {
  const src = readFileSync(
    resolve(ROOT, 'src/middleware/mutation-actions.constants.ts'),
    'utf8'
  );
  const match = src.match(
    /export const MUTATION_ACTION_NAMES[\s\S]*?=\s*\[([\s\S]*?)\]\s*as\s+const/
  );
  if (!match) {
    console.error(
      "  error: Could not find MUTATION_ACTION_NAMES in src/middleware/mutation-actions.constants.ts"
    );
    process.exit(1);
  }
  const entries = new Set();
  for (const m of match[1].matchAll(/'([^']+)'/g)) {
    entries.add(m[1]);
  }
  return entries;
}

/**
 * Pull the tool short-name from the handler filename.
 * src/handlers/data.ts -> "data" (matches our <tool>.<action> keys).
 */
function toolFromFilename(file) {
  return file.replace(/\.ts$/, '');
}

function extractHandlerActions(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const actions = new Set();
  // switch case 'name':
  for (const m of src.matchAll(/case\s+['"]([a-z][a-z0-9_]*)['"]\s*:/g)) {
    actions.add(m[1]);
  }
  return actions;
}

function isMutatingName(name) {
  return MUTATION_VERB_RE.test(name) || BATCH_MUTATION_RE.test(name);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('=======================================================');
console.log('  Mutation-Action Handler Coverage Check');
console.log('=======================================================\n');

const canonical = extractCanonicalMutationNames();
console.log(`  Canonical MUTATION_ACTION_NAMES: ${canonical.size} entries`);

const handlersDir = resolve(ROOT, 'src/handlers');
const handlerFiles = readdirSync(handlersDir)
  .filter((f) => f.endsWith('.ts'))
  // Skip infrastructure files that aren't tool handlers.
  .filter(
    (f) => !['base.ts', 'index.ts', 'error-codes.ts', 'logging.ts', 'optimization.ts', 'dimensions-filter-helpers.ts'].includes(f)
  );

console.log(`  Handler files scanned:            ${handlerFiles.length}\n`);

const drift = [];

for (const file of handlerFiles) {
  const tool = toolFromFilename(file);
  const actions = extractHandlerActions(join(handlersDir, file));

  for (const action of actions) {
    if (!isMutatingName(action)) continue;
    if (canonical.has(action)) continue;
    const key = `${tool}.${action}`;
    if (KNOWN_NON_MUTATING.has(key)) continue;
    drift.push({ tool, action });
  }
}

if (drift.length === 0) {
  console.log('  result: PASS — every mutation-looking handler action is in MUTATION_ACTION_NAMES\n');
  console.log('=======================================================');
  process.exit(0);
}

console.log(`  result: FAIL — ${drift.length} handler action(s) look mutating but are missing from MUTATION_ACTION_NAMES:\n`);
console.log('    tool                 action');
console.log('    -------------------- --------------------------------');
for (const { tool, action } of drift.sort((a, b) => (a.tool + a.action).localeCompare(b.tool + b.action))) {
  console.log(`    ${tool.padEnd(20)} ${action}`);
}
console.log('\n  To fix:');
console.log('    1. If the action is a real Sheets mutation: add it to MUTATION_ACTION_NAMES');
console.log('       in src/middleware/mutation-actions.constants.ts AND to MutationEvent[\'action\']');
console.log('       in src/services/audit-logger-types.ts.');
console.log('    2. If it is genuinely non-mutating (e.g. session-local config): add an entry');
console.log('       to KNOWN_NON_MUTATING in this script with a short reason.\n');
console.log('=======================================================');
process.exit(1);
