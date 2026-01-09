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
export * from "./shared.js";

// Tool annotations
export * from "./annotations.js";

// LLM-optimized tool descriptions
export * from "./descriptions.js";

// Core tool schemas
export * from "./auth.js";
export * from "./spreadsheet.js";
export * from "./sheet.js";
export * from "./values.js";
export * from "./cells.js";
export * from "./format.js";
export * from "./dimensions.js";
export * from "./rules.js";
export * from "./charts.js";
export * from "./pivot.js";
export * from "./filter-sort.js";
export * from "./sharing.js";
export * from "./comments.js";
export * from "./versions.js";
export * from "./analysis.js";
export * from "./advanced.js";
export * from "./transaction.js";
export * from "./validation.js";
export * from "./conflict.js";
export * from "./impact.js";
export * from "./history.js";
export * from "./prompts.js";

// MCP-native tool schemas (Elicitation & Sampling)
export * from "./confirm.js"; // Uses Elicitation (SEP-1036)
export * from "./analyze.js"; // Uses Sampling (SEP-1577)
export * from "./fix.js"; // Automated issue resolution

// Tool metadata for registration
export const TOOL_REGISTRY = {
  sheets_auth: {
    name: "sheets_auth",
    title: "Authentication",
    description:
      '🔐 MANDATORY FIRST STEP: Authentication management. ALWAYS call this with action:"status" before using any other sheets_* tool. Actions: status (check auth), login (get OAuth URL), callback (complete OAuth with code), logout (clear credentials)',
    schema: "SheetsAuthInputSchema",
    output: "SheetsAuthOutputSchema",
    annotations: "SHEETS_AUTH_ANNOTATIONS",
    actions: ["status", "login", "callback", "logout"],
  },
  sheets_spreadsheet: {
    name: "sheets_spreadsheet",
    title: "Spreadsheet",
    description: "Spreadsheet operations: create, get, copy, update properties",
    schema: "SheetSpreadsheetInputSchema",
    output: "SheetsSpreadsheetOutputSchema",
    annotations: "SHEETS_SPREADSHEET_ANNOTATIONS",
    actions: [
      "get",
      "create",
      "copy",
      "update_properties",
      "get_url",
      "batch_get",
    ],
  },
  sheets_sheet: {
    name: "sheets_sheet",
    title: "Sheet Management",
    description: "Sheet/tab operations: add, delete, duplicate, update, list",
    schema: "SheetsSheetInputSchema",
    output: "SheetsSheetOutputSchema",
    annotations: "SHEETS_SHEET_ANNOTATIONS",
    actions: ["add", "delete", "duplicate", "update", "copy_to", "list", "get"],
  },
  sheets_values: {
    name: "sheets_values",
    title: "Cell Values",
    description: "Cell values: read, write, append, clear, find, replace",
    schema: "SheetsValuesInputSchema",
    output: "SheetsValuesOutputSchema",
    annotations: "SHEETS_VALUES_ANNOTATIONS",
    actions: [
      "read",
      "write",
      "append",
      "clear",
      "batch_read",
      "batch_write",
      "batch_clear",
      "find",
      "replace",
    ],
  },
  sheets_cells: {
    name: "sheets_cells",
    title: "Cell Operations",
    description: "Cell operations: notes, validation, hyperlinks, merge",
    schema: "SheetsCellsInputSchema",
    output: "SheetsCellsOutputSchema",
    annotations: "SHEETS_CELLS_ANNOTATIONS",
    actions: [
      "add_note",
      "get_note",
      "clear_note",
      "set_validation",
      "clear_validation",
      "set_hyperlink",
      "clear_hyperlink",
      "merge",
      "unmerge",
      "get_merges",
      "cut",
      "copy",
    ],
  },
  sheets_format: {
    name: "sheets_format",
    title: "Formatting",
    description: "Formatting: colors, fonts, borders, alignment, presets",
    schema: "SheetsFormatInputSchema",
    output: "SheetsFormatOutputSchema",
    annotations: "SHEETS_FORMAT_ANNOTATIONS",
    actions: [
      "set_format",
      "set_background",
      "set_text_format",
      "set_number_format",
      "set_alignment",
      "set_borders",
      "clear_format",
      "apply_preset",
      "auto_fit",
    ],
  },
  sheets_dimensions: {
    name: "sheets_dimensions",
    title: "Rows & Columns",
    description: "Rows/columns: insert, delete, move, resize, freeze, group",
    schema: "SheetsDimensionsInputSchema",
    output: "SheetsDimensionsOutputSchema",
    annotations: "SHEETS_DIMENSIONS_ANNOTATIONS",
    actions: [
      "insert_rows",
      "insert_columns",
      "delete_rows",
      "delete_columns",
      "move_rows",
      "move_columns",
      "resize_rows",
      "resize_columns",
      "auto_resize",
      "hide_rows",
      "hide_columns",
      "show_rows",
      "show_columns",
      "freeze_rows",
      "freeze_columns",
      "group_rows",
      "group_columns",
      "ungroup_rows",
      "ungroup_columns",
      "append_rows",
      "append_columns",
    ],
  },
  sheets_rules: {
    name: "sheets_rules",
    title: "Rules",
    description: "Rules: conditional formatting, data validation",
    schema: "SheetsRulesInputSchema",
    output: "SheetsRulesOutputSchema",
    annotations: "SHEETS_RULES_ANNOTATIONS",
    actions: [
      "add_conditional_format",
      "update_conditional_format",
      "delete_conditional_format",
      "list_conditional_formats",
      "add_data_validation",
      "clear_data_validation",
      "list_data_validations",
      "add_preset_rule",
    ],
  },
  sheets_charts: {
    name: "sheets_charts",
    title: "Charts",
    description: "Charts: create, update, delete, move, export",
    schema: "SheetsChartsInputSchema",
    output: "SheetsChartsOutputSchema",
    annotations: "SHEETS_CHARTS_ANNOTATIONS",
    actions: [
      "create",
      "update",
      "delete",
      "list",
      "get",
      "move",
      "resize",
      "update_data_range",
      "export",
    ],
  },
  sheets_pivot: {
    name: "sheets_pivot",
    title: "Pivot Tables",
    description: "Pivot tables: create, update, refresh, calculated fields",
    schema: "SheetsPivotInputSchema",
    output: "SheetsPivotOutputSchema",
    annotations: "SHEETS_PIVOT_ANNOTATIONS",
    actions: ["create", "update", "delete", "list", "get", "refresh"],
  },
  sheets_filter_sort: {
    name: "sheets_filter_sort",
    title: "Filter & Sort",
    description: "Filter/sort: basic filter, filter views, slicers, sort",
    schema: "SheetsFilterSortInputSchema",
    output: "SheetsFilterSortOutputSchema",
    annotations: "SHEETS_FILTER_SORT_ANNOTATIONS",
    actions: [
      "set_basic_filter",
      "clear_basic_filter",
      "get_basic_filter",
      "update_filter_criteria",
      "sort_range",
      "create_filter_view",
      "update_filter_view",
      "delete_filter_view",
      "list_filter_views",
      "get_filter_view",
      "create_slicer",
      "update_slicer",
      "delete_slicer",
      "list_slicers",
    ],
  },
  sheets_sharing: {
    name: "sheets_sharing",
    title: "Sharing",
    description: "Sharing: permissions, transfer ownership, link sharing",
    schema: "SheetsSharingInputSchema",
    output: "SheetsSharingOutputSchema",
    annotations: "SHEETS_SHARING_ANNOTATIONS",
    actions: [
      "share",
      "update_permission",
      "remove_permission",
      "list_permissions",
      "get_permission",
      "transfer_ownership",
      "set_link_sharing",
      "get_sharing_link",
    ],
  },
  sheets_comments: {
    name: "sheets_comments",
    title: "Comments",
    description: "Comments: add, reply, resolve, delete",
    schema: "SheetsCommentsInputSchema",
    output: "SheetsCommentsOutputSchema",
    annotations: "SHEETS_COMMENTS_ANNOTATIONS",
    actions: [
      "add",
      "update",
      "delete",
      "list",
      "get",
      "resolve",
      "reopen",
      "add_reply",
      "update_reply",
      "delete_reply",
    ],
  },
  sheets_versions: {
    name: "sheets_versions",
    title: "Versions",
    description: "Versions: revisions, snapshots, restore, compare",
    schema: "SheetsVersionsInputSchema",
    output: "SheetsVersionsOutputSchema",
    annotations: "SHEETS_VERSIONS_ANNOTATIONS",
    actions: [
      "list_revisions",
      "get_revision",
      "restore_revision",
      "keep_revision",
      "create_snapshot",
      "list_snapshots",
      "restore_snapshot",
      "delete_snapshot",
      "compare",
      "export_version",
    ],
  },
  sheets_analysis: {
    name: "sheets_analysis",
    title: "Analysis",
    description:
      "Analysis: data quality, formula audit, statistics (read-only)",
    schema: "SheetsAnalysisInputSchema",
    output: "SheetsAnalysisOutputSchema",
    annotations: "SHEETS_ANALYSIS_ANNOTATIONS",
    actions: [
      "data_quality",
      "formula_audit",
      "structure_analysis",
      "statistics",
      "correlations",
      "summary",
      "dependencies",
      "compare_ranges",
      "detect_patterns",
      "column_analysis",
      "suggest_templates",
      "generate_formula",
      "suggest_chart",
    ],
  },
  sheets_advanced: {
    name: "sheets_advanced",
    title: "Advanced",
    description: "Advanced: named ranges, protected ranges, metadata, banding",
    schema: "SheetsAdvancedInputSchema",
    output: "SheetsAdvancedOutputSchema",
    annotations: "SHEETS_ADVANCED_ANNOTATIONS",
    actions: [
      "add_named_range",
      "update_named_range",
      "delete_named_range",
      "list_named_ranges",
      "get_named_range",
      "add_protected_range",
      "update_protected_range",
      "delete_protected_range",
      "list_protected_ranges",
      "set_metadata",
      "get_metadata",
      "delete_metadata",
      "add_banding",
      "update_banding",
      "delete_banding",
      "list_banding",
      "create_table",
      "delete_table",
      "list_tables",
    ],
  },
  sheets_transaction: {
    name: "sheets_transaction",
    title: "Transactions",
    description:
      "Transaction support: begin, queue operations, commit/rollback atomically with auto-snapshot. Batch multiple operations into 1 API call, saving 80% API usage.",
    schema: "SheetsTransactionInputSchema",
    output: "SheetsTransactionOutputSchema",
    annotations: "SHEETS_TRANSACTION_ANNOTATIONS",
    actions: ["begin", "queue", "commit", "rollback", "status", "list"],
  },
  sheets_validation: {
    name: "sheets_validation",
    title: "Validation",
    description:
      "Data validation: 11 builtin validators (type, range, format, uniqueness, pattern, etc.) with custom rule support.",
    schema: "SheetsValidationInputSchema",
    output: "SheetsValidationOutputSchema",
    annotations: "SHEETS_VALIDATION_ANNOTATIONS",
    actions: ["validate"],
  },
  sheets_conflict: {
    name: "sheets_conflict",
    title: "Conflict Detection",
    description:
      "Conflict detection and resolution: detect concurrent modifications with 6 resolution strategies.",
    schema: "SheetsConflictInputSchema",
    output: "SheetsConflictOutputSchema",
    annotations: "SHEETS_CONFLICT_ANNOTATIONS",
    actions: ["detect", "resolve"],
  },
  sheets_impact: {
    name: "sheets_impact",
    title: "Impact Analysis",
    description:
      "Impact analysis: pre-execution analysis with dependency tracking (formulas, charts, pivot tables, etc.).",
    schema: "SheetsImpactInputSchema",
    output: "SheetsImpactOutputSchema",
    annotations: "SHEETS_IMPACT_ANNOTATIONS",
    actions: ["analyze"],
  },
  sheets_history: {
    name: "sheets_history",
    title: "Operation History",
    description:
      "Operation history: track last 100 operations for debugging and undo foundation.",
    schema: "SheetsHistoryInputSchema",
    output: "SheetsHistoryOutputSchema",
    annotations: "SHEETS_HISTORY_ANNOTATIONS",
    actions: ["list", "get", "stats", "undo", "redo", "revert_to", "clear"],
  },
  // MCP-native tools using Elicitation and Sampling
  sheets_confirm: {
    name: "sheets_confirm",
    title: "Plan Confirmation",
    description:
      "Confirm multi-step operations with the user before execution. Uses MCP Elicitation (SEP-1036). Claude plans, user confirms, Claude executes.",
    schema: "SheetsConfirmInputSchema",
    output: "SheetsConfirmOutputSchema",
    annotations: "SHEETS_CONFIRM_ANNOTATIONS",
    actions: ["request", "get_stats"],
  },
  sheets_analyze: {
    name: "sheets_analyze",
    title: "AI Analysis",
    description:
      "AI-powered data analysis using MCP Sampling (SEP-1577). Analyze patterns, anomalies, trends, generate formulas, suggest charts.",
    schema: "SheetsAnalyzeInputSchema",
    output: "SheetsAnalyzeOutputSchema",
    annotations: "SHEETS_ANALYZE_ANNOTATIONS",
    actions: ["analyze", "generate_formula", "suggest_chart", "get_stats"],
  },
  sheets_fix: {
    name: "sheets_fix",
    title: "Automated Issue Fixing",
    description:
      "Automatically fix common spreadsheet issues detected by sheets_analysis. Supports preview mode (see what would be fixed) and apply mode (actually fix).",
    schema: "SheetsFixInputSchema",
    output: "SheetsFixOutputSchema",
    annotations: "SHEETS_FIX_ANNOTATIONS",
    actions: [], // No actions - single request mode
  },
} as const;

// Tool count
export const TOOL_COUNT = 24;

// Action count
export const ACTION_COUNT = 70;
