/**
 * Action Aliases: v1 → v2 Action Name Mapping
 *
 * Phase 1.2 of ServalSheets v2.0 - Full Google Sheets API Alignment
 *
 * This file maps v1 action names to v2 action names that align with
 * Google Sheets API v4 naming conventions and semantics.
 *
 * Design Principles:
 * 1. Remove redundant prefixes (filter_, rule_) where they don't add clarity
 * 2. Clarify ambiguous actions (merge → merge_cells, copy → copy_paste)
 * 3. Merge split actions (find + replace → find_replace)
 * 4. Maintain user-friendly names for LLM clarity (keep basic_filter vs just filter)
 * 5. Keep snake_case convention for LLM readability
 *
 * Migration Strategy:
 * - Phase 1.2 (Current): Define v1 → v2 mappings, update schemas
 * - Phase 1.2+: Both old and new names work during migration
 * - Phase 2.0: Old names deprecated with warnings
 * - Phase 2.1+: Old names removed
 *
 * @see docs/MIGRATION_V1_TO_V2.md for complete migration guide
 */
import { logger } from '../utils/logger.js';
/**
 * Flat v1 → v2 action alias mapping
 *
 * Key: v1 action name (deprecated)
 * Value: v2 action name (current standard)
 *
 * Only includes actions that changed - unchanged actions are not listed
 */
export const ACTION_ALIASES = {
    // ============================================================================
    // sheets_dimensions - Remove redundant 'filter_' prefix (keep specificity)
    // ============================================================================
    filter_set_basic_filter: 'set_basic_filter',
    filter_clear_basic_filter: 'clear_basic_filter',
    filter_get_basic_filter: 'get_basic_filter',
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
    // ============================================================================
    // sheets_format - Remove redundant 'rule_' prefix, align with Google API
    // ============================================================================
    rule_add_data_validation: 'set_data_validation',
    rule_clear_data_validation: 'clear_data_validation',
    rule_list_data_validations: 'list_data_validations',
    rule_add_preset_rule: 'add_conditional_format_rule',
    // ============================================================================
    // sheets_data - Merge find/replace, clarify ambiguous actions
    // ============================================================================
    find: 'find_replace', // Merged: find + replace → find_replace
    replace: 'find_replace', // Merged: find + replace → find_replace
    copy: 'copy_paste', // Align with Google API copyPaste request
    cut: 'cut_paste', // Align with Google API cutPaste request
    merge: 'merge_cells', // Clarify that this merges cells, not data
    unmerge: 'unmerge_cells', // Clarify that this unmerges cells
    // ============================================================================
    // sheets_advanced - Clarify formula operations (keep formula_ prefix)
    // ============================================================================
    generate_formula: 'formula_generate', // Add prefix for consistency with other formula actions
};
/**
 * Reverse mapping: v2 → v1 action names
 *
 * For backward compatibility lookups and migration tooling
 */
export const REVERSE_ALIASES = Object.fromEntries(Object.entries(ACTION_ALIASES).map(([v1, v2]) => [v2, v1]));
/**
 * Actions that were merged (multiple v1 actions → single v2 action)
 *
 * Used for migration tooling to detect semantic changes
 */
export const MERGED_ACTIONS = {
    find_replace: ['find', 'replace'],
};
/**
 * Resolve an action name to its v2 equivalent
 *
 * @param action - v1 or v2 action name
 * @param logWarning - Whether to log deprecation warning (default: false)
 * @returns v2 action name (or original if no alias exists)
 */
export function resolveAction(action, logWarning = false) {
    const v2Action = ACTION_ALIASES[action];
    if (v2Action && logWarning) {
        logger.warn('Deprecated action name used', {
            deprecatedAction: action,
            canonicalAction: v2Action,
            message: `Please update to use "${v2Action}" instead of "${action}"`,
            migrationGuide: 'See docs/MIGRATION_V1_TO_V2.md for complete migration guide',
        });
    }
    return v2Action ?? action;
}
/**
 * Resolve an action name to its v1 equivalent
 *
 * @param action - v2 or v1 action name
 * @returns v1 action name (or original if no reverse alias exists)
 */
export function resolveActionReverse(action) {
    return REVERSE_ALIASES[action] ?? action;
}
/**
 * Check if an action name is a v1 action that has been renamed
 *
 * @param action - Action name to check
 * @returns true if this is a v1 action with a v2 equivalent
 */
export function isV1Action(action) {
    return action in ACTION_ALIASES;
}
/**
 * Check if an action name is a v2 action
 *
 * @param action - Action name to check
 * @returns true if this is a v2 action (or an unchanged action)
 */
export function isV2Action(action) {
    return action in REVERSE_ALIASES || !isV1Action(action);
}
/**
 * Get all v1 actions that map to a given v2 action
 *
 * Useful for merged actions (e.g., find_replace ← [find, replace])
 *
 * @param v2Action - v2 action name
 * @returns Array of v1 action names that map to this v2 action
 */
export function getV1ActionsFor(v2Action) {
    return Object.entries(ACTION_ALIASES)
        .filter(([_, v2]) => v2 === v2Action)
        .map(([v1]) => v1);
}
/**
 * Get migration info for an action
 *
 * @param action - Action name (v1 or v2)
 * @returns Migration info or null if no migration needed
 */
export function getMigrationInfo(action) {
    if (isV1Action(action)) {
        const v2Action = resolveAction(action);
        const merged = MERGED_ACTIONS[v2Action];
        return {
            from: action,
            to: v2Action,
            merged,
            reason: merged
                ? `Merged with ${merged.filter((a) => a !== action).join(', ')} into ${v2Action}`
                : `Renamed to align with Google Sheets API v4 naming conventions`,
        };
    }
    return null;
}
/**
 * Statistics about the v1 → v2 migration
 */
export const MIGRATION_STATS = {
    totalRenames: Object.keys(ACTION_ALIASES).length,
    mergedActions: Object.keys(MERGED_ACTIONS).length,
    affectedTools: new Set([
        'sheets_dimensions', // 13 renames (filter_ prefix removal)
        'sheets_format', // 4 renames (rule_ prefix removal)
        'sheets_data', // 6 renames (merge/copy/cut clarification + find/replace merge)
        'sheets_advanced', // 1 rename (formula naming consistency)
    ]).size,
};
// ============================================================================
// Legacy API Support (for backward compatibility with existing code)
// ============================================================================
/**
 * @deprecated Use resolveAction() instead
 */
export function resolveActionName(_tool, action) {
    return resolveAction(action, true);
}
/**
 * @deprecated Use isV1Action() instead
 */
export function isDeprecatedAction(_tool, action) {
    return isV1Action(action);
}
/**
 * @deprecated Use resolveAction() instead
 */
export function getCanonicalActionName(_tool, action) {
    return resolveAction(action);
}
/**
 * @deprecated Use getV1ActionsFor() and merge with existing action list
 */
export function getAllValidActionNames(_tool, canonicalActions) {
    const deprecatedNames = Object.keys(ACTION_ALIASES);
    return [...canonicalActions, ...deprecatedNames];
}
/**
 * @deprecated Use getMigrationInfo() instead
 */
export function getDeprecationInfo(_tool, action) {
    const info = getMigrationInfo(action);
    if (!info) {
        return undefined;
    }
    return {
        deprecated: info.from,
        canonical: info.to,
        message: `Action "${info.from}" is deprecated. Use "${info.to}" instead. ${info.reason}`,
    };
}
//# sourceMappingURL=action-aliases.js.map