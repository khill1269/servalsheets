/**
 * Action Alias System
 *
 * Provides backward compatibility for deprecated action names while
 * allowing gradual migration to standardized naming conventions.
 *
 * @see /tmp/action_naming_analysis.txt for full naming standard
 *
 * Migration Strategy:
 * - Phase 1 (Current): Both old and new names work, deprecation warnings logged
 * - Phase 2 (v2.0): Old names removed, migration guide provided
 *
 * Naming Standard:
 * - Format: <domain>_<verb>_<object>
 * - Tool-level actions: NO domain prefix (e.g., get, create, read, write)
 * - Sub-domain actions: WITH domain prefix (e.g., chart_create, filter_set)
 * - Analysis actions: analyze_*, suggest_*, generate_*, detect_*
 */

import { logger } from '../utils/logger.js';

/**
 * Action alias mapping: oldName -> newName
 *
 * Key: Deprecated action name
 * Value: Current standardized action name
 */
export const ACTION_ALIASES: Record<string, Record<string, string>> = {
  // sheets_analysis: Align with sheets_analyze naming
  sheets_analysis: {
    suggest_chart: 'chart_suggest',
    generate_formula: 'formula_generate',
  },

  // sheets_dimensions: Remove redundant "filter_" prefix
  sheets_dimensions: {
    filter_set_basic_filter: 'set_filter',
    filter_clear_basic_filter: 'clear_filter',
    filter_get_basic_filter: 'get_filter',
    filter_update_filter_criteria: 'update_filter_criteria',
    filter_sort_range: 'sort_range',
    filter_create_filter_view: 'create_filter_view',
    filter_update_filter_view: 'update_filter_view',
    filter_delete_filter_view: 'delete_filter_view',
    filter_list_filter_views: 'list_filter_views',
    filter_get_filter_view: 'get_filter_view',
    filter_create_slicer: 'create_slicer',
    filter_update_slicer: 'update_slicer',
    filter_delete_slicer: 'delete_slicer',
    filter_list_slicers: 'list_slicers',
  },

  // sheets_format: Standardize suggest_format
  sheets_format: {
    suggest_format: 'format_suggest',
  },

  // sheets_visualize: Align suggest actions with domain_verb pattern
  sheets_visualize: {
    suggest_chart: 'chart_suggest',
    suggest_pivot: 'pivot_suggest',
  },
};

/**
 * Reverse mapping: newName -> oldName (for documentation)
 */
export const ACTION_CANONICAL_NAMES: Record<string, Record<string, string>> = {};

// Build reverse mapping
for (const [tool, aliases] of Object.entries(ACTION_ALIASES)) {
  ACTION_CANONICAL_NAMES[tool] = {};
  for (const [oldName, newName] of Object.entries(aliases)) {
    ACTION_CANONICAL_NAMES[tool]![newName] = oldName;
  }
}

/**
 * Resolve action name, handling aliases with deprecation warnings
 *
 * @param tool Tool name (e.g., 'sheets_data')
 * @param action Action name (may be aliased)
 * @returns Canonical action name
 */
export function resolveActionName(tool: string, action: string): string {
  const toolAliases = ACTION_ALIASES[tool];
  if (!toolAliases) {
    return action; // No aliases for this tool
  }

  const canonicalName = toolAliases[action];
  if (canonicalName) {
    logger.warn('Deprecated action name used', {
      tool,
      deprecatedAction: action,
      canonicalAction: canonicalName,
      message: `Please update to use "${canonicalName}" instead of "${action}"`,
      migrationGuide: 'See docs/ACTION_NAMING_STANDARD.md for full naming standard',
    });
    return canonicalName;
  }

  return action; // Not an alias, return as-is
}

/**
 * Check if an action name is deprecated
 *
 * @param tool Tool name
 * @param action Action name
 * @returns true if deprecated
 */
export function isDeprecatedAction(tool: string, action: string): boolean {
  return !!ACTION_ALIASES[tool]?.[action];
}

/**
 * Get canonical action name without logging (for validation)
 *
 * @param tool Tool name
 * @param action Action name (may be aliased)
 * @returns Canonical action name
 */
export function getCanonicalActionName(tool: string, action: string): string {
  return ACTION_ALIASES[tool]?.[action] || action;
}

/**
 * Get all valid action names (canonical + deprecated) for a tool
 *
 * @param tool Tool name
 * @param canonicalActions Array of canonical action names
 * @returns Array including both canonical and deprecated names
 */
export function getAllValidActionNames(tool: string, canonicalActions: string[]): string[] {
  const toolAliases = ACTION_ALIASES[tool];
  if (!toolAliases) {
    return canonicalActions;
  }

  // Add deprecated names
  const deprecatedNames = Object.keys(toolAliases);
  return [...canonicalActions, ...deprecatedNames];
}

/**
 * Get deprecation info for an action
 *
 * @param tool Tool name
 * @param action Action name
 * @returns Deprecation info or undefined
 */
export function getDeprecationInfo(
  tool: string,
  action: string
): { deprecated: string; canonical: string; message: string } | undefined {
  const canonicalName = ACTION_ALIASES[tool]?.[action];
  if (!canonicalName) {
    // OK: Explicit empty - action is not deprecated (valid case)
    return undefined;
  }

  return {
    deprecated: action,
    canonical: canonicalName,
    message: `Action "${action}" is deprecated. Use "${canonicalName}" instead.`,
  };
}
