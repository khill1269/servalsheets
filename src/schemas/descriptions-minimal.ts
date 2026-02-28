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

export const TOOL_DESCRIPTIONS_MINIMAL: Record<string, string> = {
  sheets_auth: `🔐 AUTH - OAuth 2.1 (4 actions). status, login, callback, logout. ALWAYS call status first.`,

  sheets_core: `📋 CORE - Spreadsheet/sheet management (19 actions). create, get, list_sheets, add_sheet, update_sheet, delete_sheet, etc. For cell values use sheets_data.`,

  sheets_data: `📝 DATA - Read/write cell values (19 actions). read, write, append, batch_read, batch_write, notes, hyperlinks, merge. Range format: "Sheet1!A1:D10"`,

  sheets_format: `🎨 FORMAT - Cell styling (23 actions). set_format, backgrounds, borders, number formats, conditional rules, set_rich_text. For values use sheets_data.`,

  sheets_dimensions: `📐 DIMENSIONS - Rows/columns (28 actions). insert, delete, resize, hide, freeze, sort, filter. Use dimension:"ROWS"/"COLUMNS". sheetId preferred, sheetName supported.`,

  sheets_visualize: `📊 VISUALIZE - Charts & pivots (18 actions). chart_create, chart_update, pivot_create. Use sheets_analyze first for recommendations.`,

  sheets_collaborate: `👥 COLLABORATE - Sharing/comments/versions (35 actions). share_add, comment_add, version_create_snapshot, approval_*. Requires elevated Drive scopes.`,

  sheets_advanced: `⚙️ ADVANCED - Named ranges/protection/banding (31 actions). add_named_range, add_protected_range, banding, tables, smart_chips.`,

  sheets_transaction: `🔄 TRANSACTION - Atomic batch ops (6 actions). begin, queue, commit, rollback. Use for 5+ operations - 80-95% API savings.`,

  sheets_quality: `✅ QUALITY - Validation & conflicts (4 actions). validate, detect_conflicts, analyze_impact. Use BEFORE large writes.`,

  sheets_history: `📜 HISTORY - Operation audit (7 actions). list, undo, redo, revert_to. Tracks last 100 operations per spreadsheet.`,

  sheets_confirm: `⚠️ CONFIRM - User confirmation (5 actions). request, get_stats, wizard_* for multi-step flows. Use for destructive operations >100 cells.`,

  sheets_analyze: `🤖 ANALYZE - AI analysis (16 actions). comprehensive (START HERE), analyze_data, suggest_visualization, generate_formula, scout, plan.`,

  sheets_fix: `🔧 FIX - Auto-fix issues (1 action). Requires sheets_analyze first. Fixes: volatile formulas, missing freezes.`,

  sheets_composite: `🔗 COMPOSITE - High-level workflows (11 actions). import_csv, smart_append, deduplicate, setup_sheet. 60-80% API savings.`,

  sheets_session: `📋 SESSION - Conversation context (26 actions). set_active, get_context, find_by_reference, checkpoints, alerts, profile. save_checkpoint needs ENABLE_CHECKPOINTS=true.`,

  sheets_templates: `📄 TEMPLATES - Reusable templates (8 actions). list, create, apply, import_builtin. Stored in Drive appDataFolder.`,

  sheets_bigquery: `📊 BIGQUERY - Connected Sheets (17 actions). query, connect_looker, cancel_refresh, import_from_bigquery, scheduled queries. Requires BigQuery API enabled.`,

  sheets_appsscript: `⚡ APPSSCRIPT - Apps Script (18 actions). run, deploy, get_content, triggers. USER OAuth only. ⚠️ run executes with side effects.`,

  sheets_webhook: `🔔 WEBHOOK - Change notifications (7 actions). register, unregister, list, test, watch_changes. Requires Redis backend + HTTPS endpoint. HMAC signature verification.`,

  sheets_dependencies: `🔗 DEPENDENCIES - Formula graph (7 actions). build, analyze_impact, detect_cycles, export_dot.`,

  sheets_federation: `🌐 FEDERATION - Call external MCP servers (4 actions). call_remote, list_servers, get_server_tools, validate_connection. Requires MCP_FEDERATION_SERVERS env var.`,

  sheets_compute: `🧮 COMPUTE - Server-side computation engine (10 actions). evaluate, aggregate, statistical, regression, forecast, matrix_op, pivot_compute, custom_function, batch_compute, explain_formula. Read-only.`,

  sheets_agent: `🤖 AGENT - Autonomous multi-step execution (8 actions). plan, execute, execute_step, observe, rollback, get_status, list_plans, resume. Checkpoint-based rollback.`,

  sheets_connectors: `🔌 CONNECTORS - Pull live external data into Sheets (10 actions). query, batch_query, transform, subscribe, configure. Supports Finnhub, FRED, Alpha Vantage, Polygon, REST APIs.`,
};
