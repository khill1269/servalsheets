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
export * from './shared.js';
export * from './annotations.js';
export * from './descriptions.js';
export * from './auth.js';
export * from './core.js';
export * from './data.js';
export * from './format.js';
export * from './dimensions.js';
export * from './visualize.js';
export * from './collaborate.js';
export * from './advanced.js';
export * from './transaction.js';
export * from './quality.js';
export * from './history.js';
export * from './prompts.js';
export * from './confirm.js';
export * from './analyze.js';
export * from './fix.js';
export * from './composite.js';
export * from './session.js';
export * from './templates.js';
export * from './bigquery.js';
export * from './appsscript.js';
export * from './fast-validators.js';
export * from './action-metadata.js';
export { TOOL_ACTIONS } from '../mcp/completions.js';
export declare const TOOL_REGISTRY: {
    readonly sheets_auth: {
        readonly name: "sheets_auth";
        readonly title: "Authentication";
        readonly description: "🔐 MANDATORY FIRST STEP: Authentication management. ALWAYS call this with action:\"status\" before using any other sheets_* tool. Actions: status (check auth), login (get OAuth URL), callback (complete OAuth with code), logout (clear credentials)";
        readonly schema: "SheetsAuthInputSchema";
        readonly output: "SheetsAuthOutputSchema";
        readonly annotations: "SHEETS_AUTH_ANNOTATIONS";
        readonly actions: readonly ["status", "login", "callback", "logout"];
    };
    readonly sheets_core: {
        readonly name: "sheets_core";
        readonly title: "Core Operations";
        readonly description: "Managing spreadsheets and sheets: Get spreadsheet info and metadata | Create new spreadsheets | Copy/update spreadsheet properties (title, locale, timezone) | Add/delete/rename sheets | Duplicate sheets | List all sheets in a spreadsheet";
        readonly schema: "SheetsCoreInputSchema";
        readonly output: "SheetsCoreOutputSchema";
        readonly annotations: "SHEETS_CORE_ANNOTATIONS";
        readonly actions: readonly ["get", "create", "copy", "update_properties", "get_url", "batch_get", "get_comprehensive", "list", "add_sheet", "delete_sheet", "duplicate_sheet", "update_sheet", "copy_sheet_to", "list_sheets", "get_sheet"];
    };
    readonly sheets_data: {
        readonly name: "sheets_data";
        readonly title: "Cell Data";
        readonly description: "Working with cell data: Read/write cell values | Append new rows | Batch updates across multiple ranges | Find and replace text | Add/edit/remove cell notes | Set data validation rules | Add/remove hyperlinks | Merge/unmerge cells | Cut/copy cell content";
        readonly schema: "SheetsDataInputSchema";
        readonly output: "SheetsDataOutputSchema";
        readonly annotations: "SHEETS_DATA_ANNOTATIONS";
        readonly actions: readonly ["read", "write", "append", "clear", "batch_read", "batch_write", "batch_clear", "find_replace", "add_note", "get_note", "clear_note", "set_validation", "clear_validation", "set_hyperlink", "clear_hyperlink", "merge_cells", "unmerge_cells", "get_merges", "cut_paste", "copy_paste"];
    };
    readonly sheets_format: {
        readonly name: "sheets_format";
        readonly title: "Formatting";
        readonly description: "Formatting cells: Apply background colors and text styles | Set number formats (currency, dates, percentages) | Add borders and alignment | Apply formatting presets | Auto-fit column widths | Clear formatting | Conditional formatting rules";
        readonly schema: "SheetsFormatInputSchema";
        readonly output: "SheetsFormatOutputSchema";
        readonly annotations: "SHEETS_FORMAT_ANNOTATIONS";
        readonly actions: readonly ["set_format", "suggest_format", "set_background", "set_text_format", "set_number_format", "set_alignment", "set_borders", "clear_format", "apply_preset", "auto_fit", "rule_add_conditional_format", "rule_update_conditional_format", "rule_delete_conditional_format", "rule_list_conditional_formats", "set_data_validation", "clear_data_validation", "list_data_validations", "add_conditional_format_rule"];
    };
    readonly sheets_dimensions: {
        readonly name: "sheets_dimensions";
        readonly title: "Rows & Columns";
        readonly description: "Managing rows and columns: Insert/delete rows or columns | Move and resize dimensions | Hide/show rows or columns | Freeze panes for scrolling | Group/ungroup for collapsing | Apply filters and sorting | Create filter views | Add slicers";
        readonly schema: "SheetsDimensionsInputSchema";
        readonly output: "SheetsDimensionsOutputSchema";
        readonly annotations: "SHEETS_DIMENSIONS_ANNOTATIONS";
        readonly actions: readonly ["insert_rows", "insert_columns", "delete_rows", "delete_columns", "move_rows", "move_columns", "resize_rows", "resize_columns", "auto_resize", "hide_rows", "hide_columns", "show_rows", "show_columns", "freeze_rows", "freeze_columns", "group_rows", "group_columns", "ungroup_rows", "ungroup_columns", "append_rows", "append_columns", "set_basic_filter", "clear_basic_filter", "get_basic_filter", "filter_update_filter_criteria", "sort_range", "trim_whitespace", "randomize_range", "text_to_columns", "auto_fill", "create_filter_view", "update_filter_view", "delete_filter_view", "list_filter_views", "get_filter_view", "create_slicer", "update_slicer", "delete_slicer", "list_slicers"];
    };
    readonly sheets_visualize: {
        readonly name: "sheets_visualize";
        readonly title: "Visualizations";
        readonly description: "Creating charts and pivot tables: Create charts (line, bar, pie, scatter) | Get chart suggestions from data | Update/move/resize charts | Create pivot tables for data summarization | Suggest pivot table structure";
        readonly schema: "SheetsVisualizeInputSchema";
        readonly output: "SheetsVisualizeOutputSchema";
        readonly annotations: "SHEETS_VISUALIZE_ANNOTATIONS";
        readonly actions: readonly ["chart_create", "suggest_chart", "chart_update", "chart_delete", "chart_list", "chart_get", "chart_move", "chart_resize", "chart_update_data_range", "pivot_create", "suggest_pivot", "pivot_update", "pivot_delete", "pivot_list", "pivot_get", "pivot_refresh"];
    };
    readonly sheets_collaborate: {
        readonly name: "sheets_collaborate";
        readonly title: "Collaboration";
        readonly description: "👥 Sharing and teamwork: Share spreadsheets with specific users or via link | Manage permissions (view/comment/edit) | Add/reply to comments | Track revisions and version history | Create/restore snapshots | Compare versions | Export historical versions";
        readonly schema: "SheetsCollaborateInputSchema";
        readonly output: "SheetsCollaborateOutputSchema";
        readonly annotations: "SHEETS_COLLABORATE_ANNOTATIONS";
        readonly actions: readonly ["share_add", "share_update", "share_remove", "share_list", "share_get", "share_transfer_ownership", "share_set_link", "share_get_link", "comment_add", "comment_update", "comment_delete", "comment_list", "comment_get", "comment_resolve", "comment_reopen", "comment_add_reply", "comment_update_reply", "comment_delete_reply", "version_list_revisions", "version_get_revision", "version_restore_revision", "version_keep_revision", "version_create_snapshot", "version_list_snapshots", "version_restore_snapshot", "version_delete_snapshot", "version_compare", "version_export"];
    };
    readonly sheets_advanced: {
        readonly name: "sheets_advanced";
        readonly title: "Advanced";
        readonly description: "Power user features: Named ranges for easy cell referencing | Protected ranges to prevent edits | Custom metadata for tracking | Alternating row colors (banding) | Smart tables for structured data";
        readonly schema: "SheetsAdvancedInputSchema";
        readonly output: "SheetsAdvancedOutputSchema";
        readonly annotations: "SHEETS_ADVANCED_ANNOTATIONS";
        readonly actions: readonly ["add_named_range", "update_named_range", "delete_named_range", "list_named_ranges", "get_named_range", "add_protected_range", "update_protected_range", "delete_protected_range", "list_protected_ranges", "set_metadata", "get_metadata", "delete_metadata", "add_banding", "update_banding", "delete_banding", "list_banding", "create_table", "delete_table", "list_tables"];
    };
    readonly sheets_transaction: {
        readonly name: "sheets_transaction";
        readonly title: "Transactions";
        readonly description: "Transaction support: begin, queue operations, commit/rollback atomically with auto-snapshot. Batch multiple operations into 1 API call, saving 80% API usage.";
        readonly schema: "SheetsTransactionInputSchema";
        readonly output: "SheetsTransactionOutputSchema";
        readonly annotations: "SHEETS_TRANSACTION_ANNOTATIONS";
        readonly actions: readonly ["begin", "queue", "commit", "rollback", "status", "list"];
    };
    readonly sheets_quality: {
        readonly name: "sheets_quality";
        readonly title: "Quality Assurance";
        readonly description: "Enterprise quality assurance: data validation (11 builtin validators), conflict detection and resolution (6 strategies), and pre-execution impact analysis with dependency tracking.";
        readonly schema: "SheetsQualityInputSchema";
        readonly output: "SheetsQualityOutputSchema";
        readonly annotations: "SHEETS_QUALITY_ANNOTATIONS";
        readonly actions: readonly ["validate", "detect_conflicts", "resolve_conflict", "analyze_impact"];
    };
    readonly sheets_history: {
        readonly name: "sheets_history";
        readonly title: "Operation History";
        readonly description: "Operation history: track last 100 operations for debugging and undo foundation.";
        readonly schema: "SheetsHistoryInputSchema";
        readonly output: "SheetsHistoryOutputSchema";
        readonly annotations: "SHEETS_HISTORY_ANNOTATIONS";
        readonly actions: readonly ["list", "get", "stats", "undo", "redo", "revert_to", "clear"];
    };
    readonly sheets_confirm: {
        readonly name: "sheets_confirm";
        readonly title: "Plan Confirmation";
        readonly description: "Confirm multi-step operations with the user before execution. Uses MCP Elicitation (SEP-1036). Claude plans, user confirms, Claude executes.";
        readonly schema: "SheetsConfirmInputSchema";
        readonly output: "SheetsConfirmOutputSchema";
        readonly annotations: "SHEETS_CONFIRM_ANNOTATIONS";
        readonly actions: readonly ["request", "get_stats"];
    };
    readonly sheets_analyze: {
        readonly name: "sheets_analyze";
        readonly title: "Ultimate Data Analysis";
        readonly description: "🤖 ONE TOOL TO RULE THEM ALL - Use 'comprehensive' action to get EVERYTHING in a single call: metadata, data, quality analysis, patterns, formulas, performance, visualizations. Complements sheets_core + sheets_data for analysis workflows. Other actions: analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, analyze_formulas, query_natural_language, explain_analysis.";
        readonly schema: "SheetsAnalyzeInputSchema";
        readonly output: "SheetsAnalyzeOutputSchema";
        readonly annotations: "SHEETS_ANALYZE_ANNOTATIONS";
        readonly actions: readonly ["comprehensive", "analyze_data", "suggest_visualization", "generate_formula", "detect_patterns", "analyze_structure", "analyze_quality", "analyze_performance", "analyze_formulas", "query_natural_language", "explain_analysis"];
    };
    readonly sheets_fix: {
        readonly name: "sheets_fix";
        readonly title: "Automated Issue Fixing";
        readonly description: "Automatically fix common spreadsheet issues detected by sheets_analyze. Supports preview mode (see what would be fixed) and apply mode (actually fix).";
        readonly schema: "SheetsFixInputSchema";
        readonly output: "SheetsFixOutputSchema";
        readonly annotations: "SHEETS_FIX_ANNOTATIONS";
        readonly actions: readonly ["fix"];
    };
    readonly sheets_composite: {
        readonly name: "sheets_composite";
        readonly title: "Composite Operations";
        readonly description: "High-level composite operations: import_csv (parse and write CSV), smart_append (match columns by header), bulk_update (update rows by key), deduplicate (remove duplicate rows).";
        readonly schema: "CompositeInputSchema";
        readonly output: "CompositeOutputSchema";
        readonly annotations: "SHEETS_COMPOSITE_ANNOTATIONS";
        readonly actions: readonly ["import_csv", "smart_append", "bulk_update", "deduplicate"];
    };
    readonly sheets_session: {
        readonly name: "sheets_session";
        readonly title: "Session Context";
        readonly description: "🧠 Manage conversation context for natural language interactions. Enables references like \"the spreadsheet\", \"undo that\", \"continue\". Actions: set_active (remember spreadsheet), get_active (current context), get_context (full summary), record_operation (track changes), get_last_operation, get_history, find_by_reference (resolve \"that\"/\"the budget\"), update_preferences, get_preferences, set_pending (multi-step ops), get_pending, clear_pending, reset";
        readonly schema: "SheetsSessionInputSchema";
        readonly output: "SheetsSessionOutputSchema";
        readonly annotations: "SHEETS_SESSION_ANNOTATIONS";
        readonly actions: readonly ["set_active", "get_active", "get_context", "record_operation", "get_last_operation", "get_history", "find_by_reference", "update_preferences", "get_preferences", "set_pending", "get_pending", "clear_pending", "reset"];
    };
    readonly sheets_templates: {
        readonly name: "sheets_templates";
        readonly title: "Templates";
        readonly description: "Manage reusable spreadsheet templates stored in Google Drive: list (view saved templates), get (template details), create (save spreadsheet as template), apply (create from template), update, delete, preview, import_builtin (from knowledge base).";
        readonly schema: "SheetsTemplatesInputSchema";
        readonly output: "SheetsTemplatesOutputSchema";
        readonly annotations: "SHEETS_TEMPLATES_ANNOTATIONS";
        readonly actions: readonly ["list", "get", "create", "apply", "update", "delete", "preview", "import_builtin"];
    };
    readonly sheets_bigquery: {
        readonly name: "sheets_bigquery";
        readonly title: "BigQuery Integration";
        readonly description: "BigQuery Connected Sheets integration: connect/disconnect data sources | query BigQuery with SQL | preview results | refresh data | list datasets/tables | get table schemas | export sheet data to BigQuery | import BigQuery results to sheets.";
        readonly schema: "SheetsBigQueryInputSchema";
        readonly output: "SheetsBigQueryOutputSchema";
        readonly annotations: "SHEETS_BIGQUERY_ANNOTATIONS";
        readonly actions: readonly ["connect", "disconnect", "list_connections", "get_connection", "query", "preview", "refresh", "list_datasets", "list_tables", "get_table_schema", "export_to_bigquery", "import_from_bigquery"];
    };
    readonly sheets_appsscript: {
        readonly name: "sheets_appsscript";
        readonly title: "Apps Script Automation";
        readonly description: "Apps Script automation: create/get/update script projects | manage versions | deploy as web app or API executable | run functions remotely | monitor execution processes | get usage metrics.";
        readonly schema: "SheetsAppsScriptInputSchema";
        readonly output: "SheetsAppsScriptOutputSchema";
        readonly annotations: "SHEETS_APPSSCRIPT_ANNOTATIONS";
        readonly actions: readonly ["create", "get", "get_content", "update_content", "create_version", "list_versions", "get_version", "deploy", "list_deployments", "get_deployment", "undeploy", "run", "list_processes", "get_metrics"];
    };
};
export declare const TOOL_COUNT = 19;
export declare const ACTION_COUNT = 241;
//# sourceMappingURL=index.d.ts.map