/**
 * ServalSheets - Completions Support
 *
 * Implements MCP completions capability for argument autocompletion.
 * Provides suggestions for spreadsheet IDs, sheet names, and action names.
 *
 * MCP Protocol: 2025-11-25
 */

import type { CompleteResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Action names for each tool (for autocompletion)
 *
 * IMPORTANT: These must match the z.literal('action') values in the schema files.
 * Source of truth: src/schemas/*.ts
 * Total: 246 actions across 19 tools (Tier 7: templates, bigquery, appsscript)
 * Note: sheets_analyze now has 16 actions (11 original + 5 progressive analysis)
 */
export const TOOL_ACTIONS: Record<string, string[]> = {
  sheets_advanced: [
    'add_named_range',
    'update_named_range',
    'delete_named_range',
    'list_named_ranges',
    'get_named_range',
    'add_protected_range',
    'update_protected_range',
    'delete_protected_range',
    'list_protected_ranges',
    'set_metadata',
    'get_metadata',
    'delete_metadata',
    'add_banding',
    'update_banding',
    'delete_banding',
    'list_banding',
    'create_table',
    'delete_table',
    'list_tables',
    'add_person_chip',
    'add_drive_chip',
    'add_rich_link_chip',
    'list_chips',
  ],
  sheets_analyze: [
    'comprehensive',
    'analyze_data',
    'suggest_visualization',
    'generate_formula',
    'detect_patterns',
    'analyze_structure',
    'analyze_quality',
    'analyze_performance',
    'analyze_formulas',
    'query_natural_language',
    'explain_analysis',
  ],
  sheets_appsscript: [
    'create',
    'get',
    'get_content',
    'update_content',
    'create_version',
    'list_versions',
    'get_version',
    'deploy',
    'list_deployments',
    'get_deployment',
    'undeploy',
    'run',
    'list_processes',
    'get_metrics',
  ],
  sheets_auth: ['status', 'login', 'callback', 'logout'],
  sheets_bigquery: [
    'connect',
    'connect_looker',
    'disconnect',
    'list_connections',
    'get_connection',
    'query',
    'preview',
    'refresh',
    'cancel_refresh',
    'list_datasets',
    'list_tables',
    'get_table_schema',
    'export_to_bigquery',
    'import_from_bigquery',
  ],
  sheets_collaborate: [
    'share_add',
    'share_update',
    'share_remove',
    'share_list',
    'share_get',
    'share_transfer_ownership',
    'share_set_link',
    'share_get_link',
    'comment_add',
    'comment_update',
    'comment_delete',
    'comment_list',
    'comment_get',
    'comment_resolve',
    'comment_reopen',
    'comment_add_reply',
    'comment_update_reply',
    'comment_delete_reply',
    'version_list_revisions',
    'version_get_revision',
    'version_restore_revision',
    'version_keep_revision',
    'version_create_snapshot',
    'version_list_snapshots',
    'version_restore_snapshot',
    'version_delete_snapshot',
    'version_compare',
    'version_export',
  ],
  sheets_composite: [
    'import_csv',
    'smart_append',
    'bulk_update',
    'deduplicate',
    'export_xlsx',
    'import_xlsx',
    'get_form_responses',
    'setup_sheet',
    'import_and_format',
    'clone_structure',
  ],
  sheets_confirm: ['request', 'get_stats', 'wizard_start', 'wizard_step', 'wizard_complete'],
  sheets_core: [
    'get',
    'create',
    'copy',
    'update_properties',
    'get_url',
    'batch_get',
    'get_comprehensive',
    'list',
    'add_sheet',
    'delete_sheet',
    'duplicate_sheet',
    'update_sheet',
    'copy_sheet_to',
    'list_sheets',
    'get_sheet',
    'batch_delete_sheets',
    'batch_update_sheets',
  ],
  sheets_data: [
    'read',
    'write',
    'append',
    'clear',
    'batch_read',
    'batch_write',
    'batch_clear',
    'find_replace',
    'add_note',
    'get_note',
    'clear_note',
    'set_hyperlink',
    'clear_hyperlink',
    'merge_cells',
    'unmerge_cells',
    'get_merges',
    'cut_paste',
    'copy_paste',
  ],
  sheets_dimensions: [
    'insert',
    'delete',
    'move',
    'resize',
    'auto_resize',
    'hide',
    'show',
    'freeze',
    'group',
    'ungroup',
    'append',
    'set_basic_filter',
    'clear_basic_filter',
    'get_basic_filter',
    'sort_range',
    'trim_whitespace',
    'randomize_range',
    'text_to_columns',
    'auto_fill',
    'create_filter_view',
    'update_filter_view',
    'delete_filter_view',
    'list_filter_views',
    'get_filter_view',
    'create_slicer',
    'update_slicer',
    'delete_slicer',
    'list_slicers',
  ],
  sheets_fix: ['fix'],
  sheets_format: [
    'set_format',
    'suggest_format',
    'set_background',
    'set_text_format',
    'set_number_format',
    'set_alignment',
    'set_borders',
    'clear_format',
    'apply_preset',
    'auto_fit',
    'sparkline_add',
    'sparkline_get',
    'sparkline_clear',
    'rule_add_conditional_format',
    'rule_update_conditional_format',
    'rule_delete_conditional_format',
    'rule_list_conditional_formats',
    'set_data_validation',
    'clear_data_validation',
    'list_data_validations',
    'add_conditional_format_rule',
  ],
  sheets_history: ['list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear'],
  sheets_quality: ['validate', 'detect_conflicts', 'resolve_conflict', 'analyze_impact'],
  sheets_session: [
    'set_active',
    'get_active',
    'get_context',
    'record_operation',
    'get_last_operation',
    'get_history',
    'find_by_reference',
    'update_preferences',
    'get_preferences',
    'set_pending',
    'get_pending',
    'clear_pending',
    'reset',
  ],
  sheets_templates: [
    'list',
    'get',
    'create',
    'apply',
    'update',
    'delete',
    'preview',
    'import_builtin',
  ],
  sheets_transaction: ['begin', 'queue', 'commit', 'rollback', 'status', 'list'],
  sheets_visualize: [
    'chart_create',
    'suggest_chart',
    'chart_update',
    'chart_delete',
    'chart_list',
    'chart_get',
    'chart_move',
    'chart_resize',
    'chart_update_data_range',
    'chart_add_trendline',
    'chart_remove_trendline',
    'pivot_create',
    'suggest_pivot',
    'pivot_update',
    'pivot_delete',
    'pivot_list',
    'pivot_get',
    'pivot_refresh',
  ],
  sheets_webhooks: ['register', 'unregister', 'list', 'get', 'test', 'get_stats'],
};

/**
 * Chart types for autocompletion
 */
export const CHART_TYPES = [
  'BAR',
  'LINE',
  'AREA',
  'COLUMN',
  'SCATTER',
  'COMBO',
  'STEPPED_AREA',
  'PIE',
  'DOUGHNUT',
  'TREEMAP',
  'WATERFALL',
  'HISTOGRAM',
  'CANDLESTICK',
  'ORG',
  'RADAR',
  'SCORECARD',
  'BUBBLE',
];

/**
 * Number format types for autocompletion
 */
export const NUMBER_FORMAT_TYPES = [
  'TEXT',
  'NUMBER',
  'PERCENT',
  'CURRENCY',
  'DATE',
  'TIME',
  'DATE_TIME',
  'SCIENTIFIC',
];

/**
 * Condition types for validation and conditional formatting
 */
export const CONDITION_TYPES = [
  'NUMBER_GREATER',
  'NUMBER_GREATER_THAN_EQ',
  'NUMBER_LESS',
  'NUMBER_LESS_THAN_EQ',
  'NUMBER_EQ',
  'NUMBER_NOT_EQ',
  'NUMBER_BETWEEN',
  'NUMBER_NOT_BETWEEN',
  'TEXT_CONTAINS',
  'TEXT_NOT_CONTAINS',
  'TEXT_STARTS_WITH',
  'TEXT_ENDS_WITH',
  'TEXT_EQ',
  'TEXT_IS_EMAIL',
  'TEXT_IS_URL',
  'DATE_EQ',
  'DATE_BEFORE',
  'DATE_AFTER',
  'DATE_ON_OR_BEFORE',
  'DATE_ON_OR_AFTER',
  'DATE_BETWEEN',
  'DATE_NOT_BETWEEN',
  'DATE_IS_VALID',
  'BLANK',
  'NOT_BLANK',
  'CUSTOM_FORMULA',
  'ONE_OF_LIST',
  'ONE_OF_RANGE',
  'BOOLEAN',
];

/**
 * Formatting presets for autocompletion
 */
export const FORMAT_PRESETS = [
  'alternating',
  'corporate',
  'modern',
  'minimal',
  'colorful',
  'financial',
  'dashboard',
];

/**
 * Permission roles for autocompletion
 */
export const PERMISSION_ROLES = [
  'owner',
  'organizer',
  'fileOrganizer',
  'writer',
  'commenter',
  'reader',
];

/**
 * Visibility options for autocompletion
 */
export const VISIBILITY_OPTIONS = ['private', 'anyone_with_link', 'anyone_in_domain'];

/**
 * Recent spreadsheet cache for completions
 * In production, this would be populated from user's recent activity
 */
class SpreadsheetCache {
  private recentIds: Map<string, { title: string; lastAccess: number }> = new Map();
  private maxSize = 50;

  add(spreadsheetId: string, title: string): void {
    this.recentIds.set(spreadsheetId, {
      title,
      lastAccess: Date.now(),
    });

    // Prune if over max size
    if (this.recentIds.size > this.maxSize) {
      const entries = Array.from(this.recentIds.entries()).sort(
        (a, b) => b[1].lastAccess - a[1].lastAccess
      );
      this.recentIds = new Map(entries.slice(0, this.maxSize));
    }
  }

  getCompletions(partial: string): string[] {
    const lower = partial.toLowerCase();
    return Array.from(this.recentIds.entries())
      .filter(
        ([id, meta]) => id.toLowerCase().includes(lower) || meta.title.toLowerCase().includes(lower)
      )
      .sort((a, b) => b[1].lastAccess - a[1].lastAccess)
      .map(([id]) => id)
      .slice(0, 20);
  }
}

export const spreadsheetCache = new SpreadsheetCache();

const DEFAULT_SPREADSHEET_IDS = ['1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'];

const DEFAULT_RANGES = ['Sheet1!A1:Z100', 'Sheet1!A1:Z1000', 'A1:Z100'];

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
  const defaults = DEFAULT_SPREADSHEET_IDS.filter((id) => id.toLowerCase().includes(lower));
  const merged = [...cached, ...defaults.filter((id) => !cached.includes(id))];
  return merged.slice(0, 20);
}

/**
 * Complete A1-style ranges
 */
export function completeRange(partial: string): string[] {
  const lower = partial.toLowerCase();
  return DEFAULT_RANGES.filter((range) => range.toLowerCase().startsWith(lower)).slice(0, 20);
}

/**
 * Extract spreadsheetId from an input payload
 */
export function extractSpreadsheetId(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const direct = record['spreadsheetId'];
  if (typeof direct === 'string') return direct;
  const request = record['request'];
  if (request && typeof request === 'object') {
    const nested = (request as Record<string, unknown>)['spreadsheetId'];
    if (typeof nested === 'string') return nested;
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
  return CHART_TYPES.filter((t) => t.toLowerCase().startsWith(lower)).slice(0, 20);
}

/**
 * Complete number format types
 */
export function completeNumberFormatType(partial: string): string[] {
  const lower = partial.toLowerCase();
  return NUMBER_FORMAT_TYPES.filter((t) => t.toLowerCase().startsWith(lower)).slice(0, 20);
}

/**
 * Complete condition types
 */
export function completeConditionType(partial: string): string[] {
  const lower = partial.toLowerCase();
  return CONDITION_TYPES.filter((t) => t.toLowerCase().startsWith(lower)).slice(0, 20);
}

/**
 * Complete format presets
 */
export function completeFormatPreset(partial: string): string[] {
  const lower = partial.toLowerCase();
  return FORMAT_PRESETS.filter((p) => p.toLowerCase().startsWith(lower)).slice(0, 20);
}

/**
 * Complete permission roles
 */
export function completePermissionRole(partial: string): string[] {
  const lower = partial.toLowerCase();
  return PERMISSION_ROLES.filter((r) => r.toLowerCase().startsWith(lower)).slice(0, 20);
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
