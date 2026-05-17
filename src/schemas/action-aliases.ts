/**
 * ServalSheets - Action Alias Registry
 *
 * Backward-compatibility shim for action names that have been renamed.
 * When a request arrives with an old action name, the alias is rewritten
 * to the canonical name before Zod validation. A structured deprecation
 * warning is logged so usage can be tracked and the alias eventually retired.
 *
 * Scope:
 *   - Keyed by `{toolName}.{oldAction}` to avoid collisions across tools.
 *   - Only action renames — NOT tool renames.
 *
 * Adding an alias:
 *   1. Add an entry below with `deprecatedSince` (semver of the rename PR).
 *   2. Optionally set `removeIn` — the version at which the alias becomes
 *      a hard error. CI/tests can assert no aliases are past their removeIn.
 *   3. Log usage via `mcp.deprecation.alias_used` will appear in metrics;
 *      retire the alias only after usage drops to zero for a full release.
 *
 * CI guard: `scripts/check-action-aliases.mjs` should verify every entry
 * has a valid canonical action in `src/mcp/completions.ts:TOOL_ACTIONS`.
 *
 * MCP Protocol: 2025-11-25
 */

export interface ActionAlias {
  /** The canonical action name to rewrite to. */
  readonly canonical: string;
  /** Semver when the rename landed. */
  readonly deprecatedSince: string;
  /** Semver at which the alias will be removed. Informational. */
  readonly removeIn?: string;
  /** Short human-readable reason for the alias (shown in deprecation log). */
  readonly reason?: string;
}

/**
 * Map of `{toolName}.{oldAction}` → alias metadata.
 *
 * Keys MUST use the compound tool name (e.g. `sheets_data`) not flat or short.
 * Flat / short names are rewritten to compound form by the interceptor before
 * this map is consulted, so aliases here only need the compound entry.
 */
export const ACTION_ALIASES: Readonly<Record<string, ActionAlias>> = Object.freeze({
  // Range-flavored rename sweep (ISSUE-231 / P7-B1):
  // write_range / read_range / append_range were unified into write/read/append.
  'sheets_data.write_range': {
    canonical: 'write',
    deprecatedSince: '2.0.0',
    reason: 'Unified with batch_write; range is now the first positional field.',
  },
  'sheets_data.read_range': {
    canonical: 'read',
    deprecatedSince: '2.0.0',
    reason: 'Unified under read; use read with range to read a single range.',
  },
  'sheets_data.append_range': {
    canonical: 'append',
    deprecatedSince: '2.0.0',
    reason: 'append_range was the only append flavor; renamed for brevity.',
  },

  // NOTE: `sheets_connectors.list_connectors` is CANONICAL (not an alias).
});

/**
 * Resolve an action alias. Returns the canonical name if aliased, else null.
 *
 * @param toolName Compound tool name (e.g. `sheets_data`).
 * @param action Incoming action name (possibly an alias).
 */
export function resolveActionAlias(toolName: string, action: string): ActionAlias | null {
  const key = `${toolName}.${action}`;
  return ACTION_ALIASES[key] ?? null;
}

/**
 * Returns true if the given `{toolName}.{action}` key is a known alias.
 * Useful for tests that want to assert no aliases are stale.
 */
export function isAliasKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACTION_ALIASES, key);
}

/**
 * All alias keys (`{toolName}.{oldAction}`). Stable, frozen array.
 */
export function listAliasKeys(): readonly string[] {
  return Object.freeze(Object.keys(ACTION_ALIASES));
}
