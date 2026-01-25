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

  sheets_core: `📋 CORE - Spreadsheet/sheet management (17 actions). create, get, list_sheets, add_sheet, delete_sheet, etc. For cell values use sheets_data.`,

  sheets_data: `📝 DATA - Read/write cell values (20 actions). read, write, append, batch_read, batch_write, notes, validation, merge. Range format: "Sheet1!A1:D10"`,

  sheets_format: `🎨 FORMAT - Cell styling (21 actions). set_format, backgrounds, borders, number formats, conditional rules. For values use sheets_data.`,

  sheets_dimensions: `📐 DIMENSIONS - Rows/columns (29 actions). insert, delete, resize, hide, freeze, sort, filter. Use dimension:"ROWS" or "COLUMNS".`,

  sheets_visualize: `📊 VISUALIZE - Charts & pivots (18 actions). chart_create, chart_update, pivot_create. Use sheets_analyze first for recommendations.`,

  sheets_collaborate: `👥 COLLABORATE - Sharing/comments/versions (28 actions). share_add, comment_add, version_create_snapshot. Create snapshot before destructive ops.`,

  sheets_advanced: `⚙️ ADVANCED - Named ranges/protection/banding (19 actions). add_named_range, add_protected_range, banding, tables.`,

  sheets_transaction: `🔄 TRANSACTION - Atomic batch ops (6 actions). begin, queue, commit, rollback. Use for 5+ operations - 80-95% API savings.`,

  sheets_quality: `✅ QUALITY - Validation & conflicts (4 actions). validate, detect_conflicts, analyze_impact. Use BEFORE large writes.`,

  sheets_history: `📜 HISTORY - Operation audit (7 actions). list, undo, redo, revert_to. Tracks last 100 operations per spreadsheet.`,

  sheets_confirm: `⚠️ CONFIRM - User confirmation (2 actions). request, get_stats. Use for destructive operations >100 cells.`,

  sheets_analyze: `🤖 ANALYZE - AI analysis (11 actions). comprehensive (START HERE), analyze_data, suggest_chart, generate_formula.`,

  sheets_fix: `🔧 FIX - Auto-fix issues (1 action). Requires sheets_analyze first. Fixes: volatile formulas, missing freezes.`,

  sheets_composite: `🔗 COMPOSITE - High-level workflows (10 actions). import_csv, smart_append, deduplicate, setup_sheet. 60-80% API savings.`,

  sheets_session: `📋 SESSION - Conversation context (13 actions). set_active, get_context, find_by_reference. Enables natural language refs.`,

  sheets_templates: `📄 TEMPLATES - Reusable templates (8 actions). list, create, apply, import_builtin. Stored in Drive appDataFolder.`,

  sheets_bigquery: `📊 BIGQUERY - Connected Sheets (12 actions). query, import_from_bigquery, export_to_bigquery. Requires BigQuery API enabled.`,

  sheets_appsscript: `⚡ APPSSCRIPT - Apps Script (14 actions). run, deploy, get_content. USER OAuth only. ⚠️ run executes with side effects.`,

  sheets_webhook: `🔔 WEBHOOK - Change notifications (6 actions). register, unregister, list, test. HMAC signature verification.`,

  sheets_dependencies: `🔗 DEPENDENCIES - Formula graph (7 actions). build, analyze_impact, detect_cycles, export_dot.`,
};
