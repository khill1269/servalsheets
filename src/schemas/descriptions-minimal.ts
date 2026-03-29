/**
 * ServalSheets - MINIMAL Tool Descriptions (Token-Optimized)
 *
 * These descriptions are designed for DEFERRED_DESCRIPTIONS mode.
 * Target: ~50-100 tokens per tool (vs ~350-500 in full mode)
 *
 * Full documentation available via:
 * - schema://tools/{toolName} - Full schemas
 * - resource://skill/servalsheets - Comprehensive guide (SKILL.md)
 *
 * @module schemas/descriptions-minimal
 */

import { ACTION_COUNTS } from './action-counts.js';

export const TOOL_DESCRIPTIONS_MINIMAL: Record<string, string> = {
  sheets_auth: `AUTH - Authentication and readiness (${ACTION_COUNTS['sheets_auth']} actions). status, login, callback, logout, setup_feature. ALWAYS call status first, then follow readiness.recommendedNextAction.`,

  sheets_core: `CORE - Spreadsheet/sheet management (${ACTION_COUNTS['sheets_core']} actions). create, get, list_sheets, add_sheet, update_sheet, delete_sheet, batch_get, copy. NOT for cell values (use sheets_data). NOT for formatting (use sheets_format).`,

  sheets_data: `DATA - Read/write cell values (${ACTION_COUNTS['sheets_data']} actions). read, write, append, batch_read, batch_write, find_replace, cross_read, cross_query. Range: "Sheet1!A1:D10". NOT for formatting (use sheets_format). NOT for sheet structure (use sheets_core). MISTAKES: (1) Do NOT use find_replace for targeted updates — use write when you know the cell. (2) Do NOT use append to retry a failed write — append is NOT idempotent.`,

  sheets_format: `FORMAT - Cell styling and appearance (${ACTION_COUNTS['sheets_format']} actions). set_format, set_background, set_text_format, batch_format, conditional rules, data_validation, sparklines, number_format. WHEN: "make it bold", "color", "format as currency", "add borders". NOT for cell values (use sheets_data). NOT for row/column sizing (use sheets_dimensions). 3+ changes → use batch_format (1 API call).`,

  sheets_dimensions: `DIMENSIONS - Rows, columns, sorting, filtering (${ACTION_COUNTS['sheets_dimensions']} actions). insert, delete, resize, hide, freeze, sort_range, set_basic_filter, create_filter_view, create_slicer, auto_resize. WHEN: "freeze header", "sort by", "filter where", "hide column", "insert row". Use dimension:"ROWS"/"COLUMNS". NOT for adding sheets (use sheets_core.add_sheet). MISTAKE: Indices are 0-based (row 1 = index 0).`,

  sheets_visualize: `VISUALIZE - Charts and pivots (${ACTION_COUNTS['sheets_visualize']} actions). chart_create, chart_update, chart_delete, chart_list, pivot_create, suggest_chart. NOT for sparklines (use sheets_format.sparkline_add).`,

  sheets_collaborate: `COLLABORATE - Sharing, comments, versions (${ACTION_COUNTS['sheets_collaborate']} actions). share_add, share_update, comment_add, comment_list, version_create_snapshot, approval_*. Role values: "writer" (not "editor"), "reader". Requires Drive scopes. NOT for cell values (use sheets_data). NOT for version undo (use sheets_history).`,

  sheets_advanced: `ADVANCED - Named ranges, protection, banding, tables, chips (${ACTION_COUNTS['sheets_advanced']} actions). add_named_range, add_protected_range, banding, tables, smart_chips, named_functions. NOT for cell values (use sheets_data). NOT for formatting (use sheets_format). NOT for charts (use sheets_visualize).`,

  sheets_transaction: `TRANSACTION - Atomic batch ops (${ACTION_COUNTS['sheets_transaction']} actions). begin, queue, commit, rollback. WHEN: 5+ mixed operations that must succeed or fail together. 80-95% API savings. MISTAKE: Do NOT use for 1-4 operations — overhead exceeds benefit, use sheets_data directly.`,

  sheets_quality: `QUALITY - Validation and conflicts (${ACTION_COUNTS['sheets_quality']} actions). validate, detect_conflicts, analyze_impact. Use BEFORE large writes to catch issues early. NOT for fixing issues (use sheets_fix). NOT for data analysis (use sheets_analyze).`,

  sheets_history: `HISTORY - Undo, audit trail, time-travel (${ACTION_COUNTS['sheets_history']} actions). list, undo, redo, revert_to, timeline, diff_revisions, restore_cells. NOT for version snapshots (use sheets_collaborate).`,

  sheets_confirm: `CONFIRM - User confirmation and wizards (${ACTION_COUNTS['sheets_confirm']} actions). request, get_stats, wizard_*. Used internally by destructive ops. Call directly only for >100 cell operations. NOT for data reads/writes (use sheets_data). NOT for analysis (use sheets_analyze).`,

  sheets_analyze: `ANALYZE - AI analysis and understanding (${ACTION_COUNTS['sheets_analyze']} actions). scout (fast metadata), comprehensive (full audit), analyze_data, analyze_formulas, generate_formula, suggest_next_actions. WHEN: "what's in this sheet", "analyze", "find patterns", "generate a formula for". SKIP when user already specified an exact cell/range/action — go straight to sheets_data or sheets_format. MISTAKE: Do NOT run scout before every operation — only when you need to discover sheet structure.`,

  sheets_fix: `FIX - Data cleaning and issue repair (${ACTION_COUNTS['sheets_fix']} actions). clean, standardize_formats, fill_missing, detect_anomalies, suggest_cleaning. Use clean with mode:"preview" first. NOT for formula fixes (use sheets_analyze.analyze_formulas).`,

  sheets_composite: `COMPOSITE - High-level multi-step workflows (${ACTION_COUNTS['sheets_composite']} actions). import_csv, import_xlsx, smart_append, deduplicate, setup_sheet, generate_sheet, audit_sheet, publish_report, data_pipeline, migrate_spreadsheet. WHEN: "import a CSV", "set up a new sheet", "generate a spreadsheet from description", "deduplicate". 60-80% API savings vs manual steps. NOT for single cell reads/writes (use sheets_data). NOT for formatting only (use sheets_format).`,

  sheets_session: `SESSION - Conversation context (${ACTION_COUNTS['sheets_session']} actions). set_active, get_context, find_by_reference, save_checkpoint, manage_alerts, profile. set_active enables omitting spreadsheetId from subsequent calls. NOT for reading/writing data (use sheets_data). NOT for undo (use sheets_history).`,

  sheets_templates: `TEMPLATES - Reusable sheet templates (${ACTION_COUNTS['sheets_templates']} actions). list, create, apply, import_builtin, delete. Stored in Drive appDataFolder. NOT for creating sheets from scratch (use sheets_composite.generate_sheet or sheets_core.add_sheet).`,

  sheets_bigquery: `BIGQUERY - Connected Sheets and SQL (${ACTION_COUNTS['sheets_bigquery']} actions). query, connect_table, import_from_bigquery, export_to_bigquery, connect_looker. Requires BigQuery API enabled + service account. NOT for in-sheet calculations (use sheets_compute). NOT for CSV import (use sheets_composite.import_csv).`,

  sheets_appsscript: `APPSSCRIPT - Google Apps Script automation (${ACTION_COUNTS['sheets_appsscript']} actions). create, update_content, create_version, deploy, run, list_processes, get_metrics. Use for custom menus, mail merge, print setup, and ScriptApp-based trigger code shipped via update_content + deploy. Trigger CRUD compatibility actions stay hidden by default because the Apps Script REST API has no trigger-management endpoints. USER OAuth only. NOT for simple data reads/writes (use sheets_data).`,

  sheets_webhook: `WEBHOOK - Change notifications (${ACTION_COUNTS['sheets_webhook']} actions). register, unregister, list, test, watch_changes, subscribe_workspace, reactivate_workspace. Redis is required for classic HTTPS webhooks, but Drive watch and Workspace Events flows do not require Redis. NOT for reading data (use sheets_data). NOT for polling changes (use sheets_history.timeline).`,

  sheets_dependencies: `DEPENDENCIES - Formula dependency graph and what-if (${ACTION_COUNTS['sheets_dependencies']} actions). build, analyze_impact, detect_cycles, model_scenario, compare_scenarios, create_scenario_sheet. Use analyze_impact BEFORE deleting sheets/ranges. NOT for data analysis (use sheets_analyze). NOT for formula writing (use sheets_data.write or sheets_compute).`,

  sheets_federation: `FEDERATION - Call external MCP servers (${ACTION_COUNTS['sheets_federation']} actions). call_remote, list_servers, get_server_tools, validate_connection. Requires MCP_FEDERATION_SERVERS env. NOT for Google Sheets operations (use sheets_data/format/core). Only for cross-server MCP calls.`,

  sheets_compute: `COMPUTE - Server-side calculations (${ACTION_COUNTS['sheets_compute']} actions). evaluate, aggregate, statistical, regression, forecast, matrix_op, pivot_compute, explain_formula. Read-only — does NOT modify sheets. NOT for writing results back (use sheets_data.write after). NOT for chart creation (use sheets_visualize).`,

  sheets_agent: `AGENT - Autonomous multi-step execution (${ACTION_COUNTS['sheets_agent']} actions). plan, execute, execute_step, observe, rollback, get_status, list_plans, resume. Use for complex tasks requiring 3+ coordinated tool calls. Checkpoint-based rollback. NOT for single operations (call the tool directly). NOT for analysis (use sheets_analyze).`,

  sheets_connectors: `CONNECTORS - External API data (${ACTION_COUNTS['sheets_connectors']} actions). list_connectors, configure, status, query, batch_query, subscribe. First: list_connectors, then configure, then query. Supports Finnhub, FRED, Alpha Vantage, Polygon, REST APIs. NOT for BigQuery (use sheets_bigquery). NOT for Google Sheets data (use sheets_data).`,
};
