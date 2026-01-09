/**
 * ServalSheets - Completions Support
 *
 * Implements MCP completions capability for argument autocompletion.
 * Provides suggestions for spreadsheet IDs, sheet names, and action names.
 *
 * MCP Protocol: 2025-11-25
 */

import type { CompleteResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Action names for each tool (for autocompletion)
 *
 * IMPORTANT: These must match the z.literal('action') values in the schema files.
 * Source of truth: src/schemas/*.ts
 * Total: 188 actions across 24 tools (sheets_fix has no actions - single request mode)
 */
export const TOOL_ACTIONS: Record<string, string[]> = {
  sheets_analysis: [
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
  sheets_analyze: [
    "analyze",
    "generate_formula",
    "suggest_chart",
    "get_stats",
  ],
  sheets_comments: [
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
  sheets_confirm: [
    "request",
    "get_stats",
  ],
  sheets_filter_sort: [
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
  sheets_history: [
    "list",
    "get",
    "stats",
    "undo",
    "redo",
    "revert_to",
    "clear",
  ],
  sheets_impact: [
    "analyze",
  ],
  sheets_sharing: [
    "share",
    "update_permission",
    "remove_permission",
    "list_permissions",
    "get_permission",
    "transfer_ownership",
    "set_link_sharing",
    "get_sharing_link",
  ],
  sheets_validation: [
    "validate",
  ],
  sheets_versions: [
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
};

/**
 * Chart types for autocompletion
 */
export const CHART_TYPES = [
  "BAR",
  "LINE",
  "AREA",
  "COLUMN",
  "SCATTER",
  "COMBO",
  "STEPPED_AREA",
  "PIE",
  "DOUGHNUT",
  "TREEMAP",
  "WATERFALL",
  "HISTOGRAM",
  "CANDLESTICK",
  "ORG",
  "RADAR",
  "SCORECARD",
  "BUBBLE",
];

/**
 * Number format types for autocompletion
 */
export const NUMBER_FORMAT_TYPES = [
  "TEXT",
  "NUMBER",
  "PERCENT",
  "CURRENCY",
  "DATE",
  "TIME",
  "DATE_TIME",
  "SCIENTIFIC",
];

/**
 * Condition types for validation and conditional formatting
 */
export const CONDITION_TYPES = [
  "NUMBER_GREATER",
  "NUMBER_GREATER_THAN_EQ",
  "NUMBER_LESS",
  "NUMBER_LESS_THAN_EQ",
  "NUMBER_EQ",
  "NUMBER_NOT_EQ",
  "NUMBER_BETWEEN",
  "NUMBER_NOT_BETWEEN",
  "TEXT_CONTAINS",
  "TEXT_NOT_CONTAINS",
  "TEXT_STARTS_WITH",
  "TEXT_ENDS_WITH",
  "TEXT_EQ",
  "TEXT_IS_EMAIL",
  "TEXT_IS_URL",
  "DATE_EQ",
  "DATE_BEFORE",
  "DATE_AFTER",
  "DATE_ON_OR_BEFORE",
  "DATE_ON_OR_AFTER",
  "DATE_BETWEEN",
  "DATE_NOT_BETWEEN",
  "DATE_IS_VALID",
  "BLANK",
  "NOT_BLANK",
  "CUSTOM_FORMULA",
  "ONE_OF_LIST",
  "ONE_OF_RANGE",
  "BOOLEAN",
];

/**
 * Formatting presets for autocompletion
 */
export const FORMAT_PRESETS = [
  "alternating",
  "corporate",
  "modern",
  "minimal",
  "colorful",
  "financial",
  "dashboard",
];

/**
 * Permission roles for autocompletion
 */
export const PERMISSION_ROLES = [
  "owner",
  "organizer",
  "fileOrganizer",
  "writer",
  "commenter",
  "reader",
];

/**
 * Visibility options for autocompletion
 */
export const VISIBILITY_OPTIONS = [
  "private",
  "anyone_with_link",
  "anyone_in_domain",
];

/**
 * Recent spreadsheet cache for completions
 * In production, this would be populated from user's recent activity
 */
class SpreadsheetCache {
  private recentIds: Map<string, { title: string; lastAccess: number }> =
    new Map();
  private maxSize = 50;

  add(spreadsheetId: string, title: string): void {
    this.recentIds.set(spreadsheetId, {
      title,
      lastAccess: Date.now(),
    });

    // Prune if over max size
    if (this.recentIds.size > this.maxSize) {
      const entries = Array.from(this.recentIds.entries()).sort(
        (a, b) => b[1].lastAccess - a[1].lastAccess,
      );
      this.recentIds = new Map(entries.slice(0, this.maxSize));
    }
  }

  getCompletions(partial: string): string[] {
    const lower = partial.toLowerCase();
    return Array.from(this.recentIds.entries())
      .filter(
        ([id, meta]) =>
          id.toLowerCase().includes(lower) ||
          meta.title.toLowerCase().includes(lower),
      )
      .sort((a, b) => b[1].lastAccess - a[1].lastAccess)
      .map(([id]) => id)
      .slice(0, 20);
  }
}

export const spreadsheetCache = new SpreadsheetCache();

const DEFAULT_SPREADSHEET_IDS = [
  "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
];

const DEFAULT_RANGES = ["Sheet1!A1:Z100", "Sheet1!A1:Z1000", "A1:Z100"];

/**
 * Complete action names for a tool
 */
export function completeAction(toolName: string, partial: string): string[] {
  const actions = TOOL_ACTIONS[toolName] ?? [];
  const lower = partial.toLowerCase();
  return actions.filter((a) => a.toLowerCase().startsWith(lower)).slice(0, 20);
}

/**
 * Complete spreadsheet IDs from cache
 */
export function completeSpreadsheetId(partial: string): string[] {
  const cached = spreadsheetCache.getCompletions(partial);
  const lower = partial.toLowerCase();
  const defaults = DEFAULT_SPREADSHEET_IDS.filter((id) =>
    id.toLowerCase().includes(lower),
  );
  const merged = [...cached, ...defaults.filter((id) => !cached.includes(id))];
  return merged.slice(0, 20);
}

/**
 * Complete A1-style ranges
 */
export function completeRange(partial: string): string[] {
  const lower = partial.toLowerCase();
  return DEFAULT_RANGES.filter((range) =>
    range.toLowerCase().startsWith(lower),
  ).slice(0, 20);
}

/**
 * Extract spreadsheetId from an input payload
 */
export function extractSpreadsheetId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const direct = record["spreadsheetId"];
  if (typeof direct === "string") return direct;
  const request = record["request"];
  if (request && typeof request === "object") {
    const nested = (request as Record<string, unknown>)["spreadsheetId"];
    if (typeof nested === "string") return nested;
  }
  return null;
}

/**
 * Record spreadsheet ID usage for completions
 */
export function recordSpreadsheetId(input: unknown): void {
  const spreadsheetId = extractSpreadsheetId(input);
  if (!spreadsheetId) return;
  spreadsheetCache.add(spreadsheetId, spreadsheetId);
}

/**
 * Complete chart types
 */
export function completeChartType(partial: string): string[] {
  const lower = partial.toLowerCase();
  return CHART_TYPES.filter((t) => t.toLowerCase().startsWith(lower)).slice(
    0,
    20,
  );
}

/**
 * Complete number format types
 */
export function completeNumberFormatType(partial: string): string[] {
  const lower = partial.toLowerCase();
  return NUMBER_FORMAT_TYPES.filter((t) =>
    t.toLowerCase().startsWith(lower),
  ).slice(0, 20);
}

/**
 * Complete condition types
 */
export function completeConditionType(partial: string): string[] {
  const lower = partial.toLowerCase();
  return CONDITION_TYPES.filter((t) => t.toLowerCase().startsWith(lower)).slice(
    0,
    20,
  );
}

/**
 * Complete format presets
 */
export function completeFormatPreset(partial: string): string[] {
  const lower = partial.toLowerCase();
  return FORMAT_PRESETS.filter((p) => p.toLowerCase().startsWith(lower)).slice(
    0,
    20,
  );
}

/**
 * Complete permission roles
 */
export function completePermissionRole(partial: string): string[] {
  const lower = partial.toLowerCase();
  return PERMISSION_ROLES.filter((r) =>
    r.toLowerCase().startsWith(lower),
  ).slice(0, 20);
}

/**
 * Create a completion result
 */
export function createCompletionResult(values: string[]): CompleteResult {
  return {
    completion: {
      values: values.slice(0, 100),
      total: values.length,
      hasMore: values.length > 100,
    },
  };
}

/**
 * Empty completion result
 */
export const EMPTY_COMPLETION: CompleteResult = {
  completion: {
    values: [],
    hasMore: false,
  },
};
