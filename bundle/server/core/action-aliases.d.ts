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
/**
 * Flat v1 → v2 action alias mapping
 *
 * Key: v1 action name (deprecated)
 * Value: v2 action name (current standard)
 *
 * Only includes actions that changed - unchanged actions are not listed
 */
export declare const ACTION_ALIASES: Record<string, string>;
/**
 * Reverse mapping: v2 → v1 action names
 *
 * For backward compatibility lookups and migration tooling
 */
export declare const REVERSE_ALIASES: Record<string, string>;
/**
 * Actions that were merged (multiple v1 actions → single v2 action)
 *
 * Used for migration tooling to detect semantic changes
 */
export declare const MERGED_ACTIONS: Record<string, string[]>;
/**
 * Resolve an action name to its v2 equivalent
 *
 * @param action - v1 or v2 action name
 * @param logWarning - Whether to log deprecation warning (default: false)
 * @returns v2 action name (or original if no alias exists)
 */
export declare function resolveAction(action: string, logWarning?: boolean): string;
/**
 * Resolve an action name to its v1 equivalent
 *
 * @param action - v2 or v1 action name
 * @returns v1 action name (or original if no reverse alias exists)
 */
export declare function resolveActionReverse(action: string): string;
/**
 * Check if an action name is a v1 action that has been renamed
 *
 * @param action - Action name to check
 * @returns true if this is a v1 action with a v2 equivalent
 */
export declare function isV1Action(action: string): boolean;
/**
 * Check if an action name is a v2 action
 *
 * @param action - Action name to check
 * @returns true if this is a v2 action (or an unchanged action)
 */
export declare function isV2Action(action: string): boolean;
/**
 * Get all v1 actions that map to a given v2 action
 *
 * Useful for merged actions (e.g., find_replace ← [find, replace])
 *
 * @param v2Action - v2 action name
 * @returns Array of v1 action names that map to this v2 action
 */
export declare function getV1ActionsFor(v2Action: string): string[];
/**
 * Get migration info for an action
 *
 * @param action - Action name (v1 or v2)
 * @returns Migration info or null if no migration needed
 */
export declare function getMigrationInfo(action: string): {
    from: string;
    to: string;
    merged?: string[];
    reason: string;
} | null;
/**
 * Statistics about the v1 → v2 migration
 */
export declare const MIGRATION_STATS: {
    totalRenames: number;
    mergedActions: number;
    affectedTools: number;
};
/**
 * @deprecated Use resolveAction() instead
 */
export declare function resolveActionName(_tool: string, action: string): string;
/**
 * @deprecated Use isV1Action() instead
 */
export declare function isDeprecatedAction(_tool: string, action: string): boolean;
/**
 * @deprecated Use resolveAction() instead
 */
export declare function getCanonicalActionName(_tool: string, action: string): string;
/**
 * @deprecated Use getV1ActionsFor() and merge with existing action list
 */
export declare function getAllValidActionNames(_tool: string, canonicalActions: string[]): string[];
/**
 * @deprecated Use getMigrationInfo() instead
 */
export declare function getDeprecationInfo(_tool: string, action: string): {
    deprecated: string;
    canonical: string;
    message: string;
} | undefined;
//# sourceMappingURL=action-aliases.d.ts.map