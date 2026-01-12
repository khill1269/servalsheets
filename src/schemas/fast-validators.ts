/**
 * ServalSheets - Fast Validators
 *
 * Pre-compiled validators for ALL 25 tools.
 * These perform FAST validation (action + required fields only).
 * Full Zod validation happens in handlers for type safety.
 *
 * Purpose: Catch obvious errors early with minimal overhead.
 * Pattern: Return raw input after basic checks (handlers do full parsing)
 */

// ============================================================================
// VALIDATION ERROR
// ============================================================================

export class FastValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "FastValidationError";
    this.code = code;
    this.details = details;
  }

  toErrorDetail(): {
    code: "INVALID_PARAMS";
    message: string;
    details: Record<string, unknown>;
    retryable: boolean;
  } {
    return {
      code: "INVALID_PARAMS" as const,
      message: this.message,
      details: { validationCode: this.code, ...this.details },
      retryable: false,
    };
  }
}

// ============================================================================
// COMMON VALIDATORS
// ============================================================================

const SPREADSHEET_ID_REGEX = /^[a-zA-Z0-9_-]{20,100}$/;

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new FastValidationError(
      "MISSING_FIELD",
      `${field} is required and must be a non-empty string`,
    );
  }
}

function assertSpreadsheetId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new FastValidationError("MISSING_FIELD", "spreadsheetId is required");
  }
  if (!SPREADSHEET_ID_REGEX.test(value)) {
    throw new FastValidationError(
      "INVALID_SPREADSHEET_ID",
      "Invalid spreadsheetId format",
      {
        hint: "Found in URL: docs.google.com/spreadsheets/d/{ID}",
      },
    );
  }
}

function assertArray(
  value: unknown,
  field: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new FastValidationError("MISSING_FIELD", `${field} must be an array`);
  }
}

/**
 * Assert range is provided in any valid format:
 * - String: "Sheet1!A1:B10" (A1 notation)
 * - Object: { a1: "..." } | { namedRange: "..." } | { semantic: {...} } | { grid: {...} }
 *
 * This allows both formats as documented in RangeInputSchema (shared.ts:534-538)
 */
function assertRange(value: unknown, field: string): void {
  if (value === undefined || value === null) {
    throw new FastValidationError(
      "MISSING_FIELD",
      `${field} is required`,
    );
  }

  // Accept string format (A1 notation)
  if (typeof value === "string") {
    if (value.length === 0) {
      throw new FastValidationError(
        "INVALID_RANGE",
        `${field} must be a non-empty string or valid range object`,
      );
    }
    return; // Valid string range
  }

  // Accept object format (a1, namedRange, semantic, grid)
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const hasValidKey =
      "a1" in obj || "namedRange" in obj || "semantic" in obj || "grid" in obj;

    if (hasValidKey) {
      return; // Valid object range - full validation happens in Zod
    }

    throw new FastValidationError(
      "INVALID_RANGE",
      `${field} object must have one of: a1, namedRange, semantic, or grid`,
      {
        hint: 'Examples: {a1: "Sheet1!A1:B10"}, {namedRange: "MyRange"}, {semantic: {...}}, {grid: {...}}',
      },
    );
  }

  throw new FastValidationError(
    "INVALID_RANGE",
    `${field} must be a string or range object`,
    {
      hint: 'Examples: "Sheet1!A1:B10" or {a1: "Sheet1!A1:B10"}',
    },
  );
}

function assertAction<T extends string>(
  value: unknown,
  validActions: Set<T>,
): asserts value is T {
  if (typeof value !== "string") {
    throw new FastValidationError("MISSING_FIELD", "action is required");
  }
  if (!validActions.has(value as T)) {
    throw new FastValidationError(
      "INVALID_ACTION",
      `Unknown action: ${value}`,
      {
        validActions: Array.from(validActions),
      },
    );
  }
}

// ============================================================================
// TOOL VALIDATORS
// All validators return void (assertions) - input passes through unchanged
// ============================================================================

// 1. sheets_auth
const AUTH_ACTIONS = new Set(["status", "login", "callback", "logout"]);

export function fastValidateAuth(input: Record<string, unknown>): void {
  assertAction(input["action"], AUTH_ACTIONS);
  if (input["action"] === "callback") {
    assertString(input["code"], "code");
  }
}

// 2. sheets_spreadsheet
const SPREADSHEET_ACTIONS = new Set([
  "get",
  "create",
  "copy",
  "update_properties",
  "get_url",
  "batch_get",
  "get_comprehensive",
  "list",
]);

export function fastValidateSpreadsheet(input: Record<string, unknown>): void {
  assertAction(input["action"], SPREADSHEET_ACTIONS);
  if (input["action"] !== "create" && input["action"] !== "list") {
    assertSpreadsheetId(input["spreadsheetId"]);
  }
}

// 3. sheets_sheet
const SHEET_ACTIONS = new Set([
  "add",
  "delete",
  "duplicate",
  "update",
  "copy_to",
  "list",
  "get",
]);

export function fastValidateSheet(input: Record<string, unknown>): void {
  assertAction(input["action"], SHEET_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);

  const needsSheetId =
    input["action"] === "delete" ||
    input["action"] === "duplicate" ||
    input["action"] === "update" ||
    input["action"] === "get";
  if (needsSheetId && typeof input["sheetId"] !== "number") {
    throw new FastValidationError(
      "MISSING_FIELD",
      "sheetId is required for this action",
    );
  }
}

// 4. sheets_values
const VALUES_ACTIONS = new Set([
  "read",
  "write",
  "append",
  "clear",
  "batch_read",
  "batch_write",
  "batch_clear",
  "find",
  "replace",
]);

export function fastValidateValues(input: Record<string, unknown>): void {
  assertAction(input["action"], VALUES_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);

  switch (input["action"]) {
    case "read":
    case "clear":
      assertRange(input["range"], "range");
      break;
    case "write":
    case "append":
      assertRange(input["range"], "range");
      assertArray(input["values"], "values");
      break;
    case "batch_read":
    case "batch_clear":
      assertArray(input["ranges"], "ranges");
      break;
    case "batch_write":
      assertArray(input["data"], "data");
      break;
    case "find":
      assertString(input["query"], "query");
      break;
    case "replace":
      assertString(input["find"], "find");
      assertString(input["replacement"], "replacement");
      break;
  }
}

// 5. sheets_cells
const CELLS_ACTIONS = new Set([
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
]);

export function fastValidateCells(input: Record<string, unknown>): void {
  assertAction(input["action"], CELLS_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
  if (input["action"] !== "get_merges") {
    assertRange(input["range"], "range");
  }
}

// 6. sheets_format
const FORMAT_ACTIONS = new Set([
  "set_format",
  "set_background",
  "set_text_format",
  "set_number_format",
  "set_alignment",
  "set_borders",
  "clear_format",
  "apply_preset",
  "auto_fit",
]);

export function fastValidateFormat(input: Record<string, unknown>): void {
  assertAction(input["action"], FORMAT_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
  assertRange(input["range"], "range");
}

// 7. sheets_dimensions
const DIMENSIONS_ACTIONS = new Set([
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
]);

export function fastValidateDimensions(input: Record<string, unknown>): void {
  assertAction(input["action"], DIMENSIONS_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
  if (typeof input["sheetId"] !== "number") {
    throw new FastValidationError("MISSING_FIELD", "sheetId is required");
  }
}

// 8. sheets_rules
const RULES_ACTIONS = new Set([
  "add_conditional_format",
  "update_conditional_format",
  "delete_conditional_format",
  "list_conditional_formats",
  "add_data_validation",
  "clear_data_validation",
  "list_data_validations",
  "add_preset_rule",
]);

export function fastValidateRules(input: Record<string, unknown>): void {
  assertAction(input["action"], RULES_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 9. sheets_charts
const CHARTS_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "list",
  "get",
  "move",
  "resize",
  "update_data_range",
  "export",
]);

export function fastValidateCharts(input: Record<string, unknown>): void {
  assertAction(input["action"], CHARTS_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
  if (input["action"] === "create") {
    assertString(input["type"], "type");
    assertString(input["dataRange"], "dataRange");
  }
}

// 10. sheets_pivot
const PIVOT_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "list",
  "get",
  "refresh",
]);

export function fastValidatePivot(input: Record<string, unknown>): void {
  assertAction(input["action"], PIVOT_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 11. sheets_filter_sort
const FILTER_SORT_ACTIONS = new Set([
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
]);

export function fastValidateFilterSort(input: Record<string, unknown>): void {
  assertAction(input["action"], FILTER_SORT_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 12. sheets_sharing
const SHARING_ACTIONS = new Set([
  "share",
  "update_permission",
  "remove_permission",
  "list_permissions",
  "get_permission",
  "transfer_ownership",
  "set_link_sharing",
  "get_sharing_link",
]);

export function fastValidateSharing(input: Record<string, unknown>): void {
  assertAction(input["action"], SHARING_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
  if (input["action"] === "share") {
    assertString(input["email"], "email");
    assertString(input["role"], "role");
  }
}

// 13. sheets_comments
const COMMENTS_ACTIONS = new Set([
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
]);

export function fastValidateComments(input: Record<string, unknown>): void {
  assertAction(input["action"], COMMENTS_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 14. sheets_versions
const VERSIONS_ACTIONS = new Set([
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
]);

export function fastValidateVersions(input: Record<string, unknown>): void {
  assertAction(input["action"], VERSIONS_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 15. sheets_analysis
const ANALYSIS_ACTIONS = new Set([
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
]);

export function fastValidateAnalysis(input: Record<string, unknown>): void {
  assertAction(input["action"], ANALYSIS_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 16. sheets_advanced
const ADVANCED_ACTIONS = new Set([
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
]);

export function fastValidateAdvanced(input: Record<string, unknown>): void {
  assertAction(input["action"], ADVANCED_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 17. sheets_transaction
const TRANSACTION_ACTIONS = new Set([
  "begin",
  "queue",
  "commit",
  "rollback",
  "status",
  "list",
]);

export function fastValidateTransaction(input: Record<string, unknown>): void {
  assertAction(input["action"], TRANSACTION_ACTIONS);
  if (input["action"] === "begin") {
    assertSpreadsheetId(input["spreadsheetId"]);
  } else if (input["action"] !== "list") {
    assertString(input["transactionId"], "transactionId");
  }
}

// 18. sheets_validation
const VALIDATION_ACTIONS = new Set(["validate"]);

export function fastValidateValidation(input: Record<string, unknown>): void {
  assertAction(input["action"], VALIDATION_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 19. sheets_conflict
const CONFLICT_ACTIONS = new Set(["detect", "resolve"]);

export function fastValidateConflict(input: Record<string, unknown>): void {
  assertAction(input["action"], CONFLICT_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 20. sheets_impact
const IMPACT_ACTIONS = new Set(["analyze"]);

export function fastValidateImpact(input: Record<string, unknown>): void {
  assertAction(input["action"], IMPACT_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// 21. sheets_history
const HISTORY_ACTIONS = new Set([
  "list",
  "get",
  "stats",
  "undo",
  "redo",
  "revert_to",
  "clear",
]);

export function fastValidateHistory(input: Record<string, unknown>): void {
  assertAction(input["action"], HISTORY_ACTIONS);
}

// 22. sheets_confirm
const CONFIRM_ACTIONS = new Set(["request", "get_stats"]);

export function fastValidateConfirm(input: Record<string, unknown>): void {
  assertAction(input["action"], CONFIRM_ACTIONS);
  if (input["action"] === "request" && !input["plan"]) {
    throw new FastValidationError(
      "MISSING_FIELD",
      "plan is required for request action",
    );
  }
}

// 23. sheets_analyze
const ANALYZE_ACTIONS = new Set([
  "analyze",
  "generate_formula",
  "suggest_chart",
  "get_stats",
]);

export function fastValidateAnalyze(input: Record<string, unknown>): void {
  assertAction(input["action"], ANALYZE_ACTIONS);
  if (input["action"] !== "get_stats") {
    assertSpreadsheetId(input["spreadsheetId"]);
  }
}

// 24. sheets_fix
const FIX_ACTIONS = new Set(["fix"]);

export function fastValidateFix(input: Record<string, unknown>): void {
  assertAction(input["action"], FIX_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
  assertArray(input["issues"], "issues");
}

// 25. sheets_composite
const COMPOSITE_ACTIONS = new Set([
  "import_csv",
  "smart_append",
  "bulk_update",
  "deduplicate",
]);

export function fastValidateComposite(input: Record<string, unknown>): void {
  assertAction(input["action"], COMPOSITE_ACTIONS);
  assertSpreadsheetId(input["spreadsheetId"]);
}

// ============================================================================
// VALIDATOR REGISTRY
// ============================================================================

type FastValidatorFn = (input: Record<string, unknown>) => void;

const FAST_VALIDATORS: Record<string, FastValidatorFn> = {
  sheets_auth: fastValidateAuth,
  sheets_spreadsheet: fastValidateSpreadsheet,
  sheets_sheet: fastValidateSheet,
  sheets_values: fastValidateValues,
  sheets_cells: fastValidateCells,
  sheets_format: fastValidateFormat,
  sheets_dimensions: fastValidateDimensions,
  sheets_rules: fastValidateRules,
  sheets_charts: fastValidateCharts,
  sheets_pivot: fastValidatePivot,
  sheets_filter_sort: fastValidateFilterSort,
  sheets_sharing: fastValidateSharing,
  sheets_comments: fastValidateComments,
  sheets_versions: fastValidateVersions,
  sheets_analysis: fastValidateAnalysis,
  sheets_advanced: fastValidateAdvanced,
  sheets_transaction: fastValidateTransaction,
  sheets_validation: fastValidateValidation,
  sheets_conflict: fastValidateConflict,
  sheets_impact: fastValidateImpact,
  sheets_history: fastValidateHistory,
  sheets_confirm: fastValidateConfirm,
  sheets_analyze: fastValidateAnalyze,
  sheets_fix: fastValidateFix,
  sheets_composite: fastValidateComposite,
};

/**
 * Get fast validator for a tool
 */
export function getFastValidator(
  toolName: string,
): FastValidatorFn | undefined {
  return FAST_VALIDATORS[toolName];
}

/**
 * Fast validate input - throws FastValidationError on failure
 */
export function fastValidate(toolName: string, input: unknown): void {
  if (!input || typeof input !== "object") {
    throw new FastValidationError("INVALID_INPUT", "Input must be an object");
  }

  const validator = FAST_VALIDATORS[toolName];
  if (!validator) {
    throw new FastValidationError(
      "UNKNOWN_TOOL",
      `No validator for tool: ${toolName}`,
    );
  }

  validator(input as Record<string, unknown>);
}

/**
 * Check if fast validator exists
 */
export function hasFastValidator(toolName: string): boolean {
  return toolName in FAST_VALIDATORS;
}
