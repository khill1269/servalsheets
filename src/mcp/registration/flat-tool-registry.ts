/**
 * ServalSheets - Flat Tool Registry
 *
 * Presentation adapter that exposes each of the current actions as an individual
 * MCP tool with a flat z.object() schema. This eliminates the discriminated
 * union "action-inside-a-tool" pattern and gives LLMs single-purpose tools
 * that follow the MCP convention of 1 tool = 1 operation.
 *
 * Architecture:
 *   - Internal handlers remain unchanged (25 compound tools)
 *   - This module generates the current flat tool definitions at startup
 *   - The routing adapter maps flat tool names back to compound handlers
 *   - TOOL_MODE env controls which surface is exposed
 *
 * Token economics:
 *   - Bundled mode (legacy): ~53K tokens for all 25 tools
 *   - Flat mode + defer_loading: ~1,500 tokens (5 always-loaded + search)
 *
 * @module mcp/registration/flat-tool-registry
 */

import { TOOL_ACTIONS } from '../completions.js';
import { ACTION_ANNOTATIONS } from '../../schemas/annotations.js';
import { logger } from '../../utils/logger.js';
import { filterAvailableActions, isToolFullyUnavailable } from '../tool-availability.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FlatToolDefinition {
  /** Flat tool name: sheets_{domain}_{action} */
  readonly name: string;
  /** Human-readable title */
  readonly title: string;
  /** Concise description of what this single operation does */
  readonly description: string;
  /** The parent compound tool name (e.g., 'sheets_data') */
  readonly parentTool: string;
  /** The action name within the parent tool (e.g., 'read') */
  readonly action: string;
  /** Whether this tool should be loaded immediately or deferred */
  readonly deferLoading: boolean;
  /** MCP annotations inherited from parent tool */
  readonly annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Tools that are ALWAYS loaded (never deferred).
 * These form the "starting 5" that every session needs.
 *
 * Criteria:
 * - Used in 90%+ of sessions
 * - Required for session bootstrap
 * - Gateway to discovering other tools
 */
const ALWAYS_LOADED_ACTIONS: ReadonlySet<string> = new Set([
  'sheets_auth.status',
  'sheets_auth.login',
  'sheets_auth.callback',
  'sheets_session.get_context',
  'sheets_session.set_active',
  'sheets_session.get_active',
  'sheets_session.record_operation',
  'sheets_session.update_preferences',
  // Data essentials — most common operations
  'sheets_data.read',
  'sheets_data.write',
  'sheets_data.append',
  'sheets_core.list',
  'sheets_core.list_sheets',
  'sheets_core.get',
  'sheets_core.create',
]);

/**
 * Mutation actions — inherited from audit-middleware MUTATION_ACTIONS.
 * Used to set destructiveHint on flat tools.
 */
const KNOWN_MUTATIONS: ReadonlySet<string> = new Set([
  'write',
  'append',
  'clear',
  'batch_write',
  'merge_cells',
  'unmerge_cells',
  'create',
  'delete_sheet',
  'duplicate_sheet',
  'rename_sheet',
  'add_sheet',
  'update_sheet',
  'rename',
  'copy_to',
  'set_background',
  'set_text_format',
  'set_number_format',
  'set_alignment',
  'set_borders',
  'clear_format',
  'apply_preset',
  'add_conditional_format_rule',
  'generate_conditional_format',
  'rule_add_conditional_format',
  'build_dependent_dropdown',
  'clear_data_validation',
  'resize_rows',
  'resize_columns',
  'insert_rows',
  'insert_columns',
  'delete_rows',
  'delete_columns',
  'move_rows',
  'move_columns',
  'hide_rows',
  'hide_columns',
  'unhide_rows',
  'unhide_columns',
  'freeze',
  'unfreeze',
  'sort_range',
  'group',
  'ungroup',
  'chart_create',
  'chart_update',
  'chart_delete',
  'chart_move',
  'chart_resize',
  'pivot_create',
  'pivot_update',
  'pivot_delete',
  'share_add',
  'share_update',
  'share_remove',
  'share_transfer_ownership',
  'comment_add',
  'comment_update',
  'comment_delete',
  'comment_resolve',
  'comment_reopen',
  'comment_add_reply',
  'comment_update_reply',
  'comment_delete_reply',
  'clean',
  'standardize_formats',
  'fill_missing',
  'fix',
  'auto_enhance',
  'begin',
  'queue',
  'commit',
  'rollback',
  'undo',
  'redo',
  'revert_to',
  'restore_cells',
  'add_named_range',
  'update_named_range',
  'delete_named_range',
  'add_protected_range',
  'update_protected_range',
  'delete_protected_range',
  'set_metadata',
  'delete_metadata',
  'add_banding',
  'update_banding',
  'delete_banding',
  'create_table',
  'delete_table',
  'update_table',
]);

/**
 * Domain prefix overrides for shorter/cleaner flat tool names.
 * Default: strips "sheets_" prefix → uses domain as-is.
 * Overrides shorten long domain names.
 */
const DOMAIN_PREFIX_MAP: Record<string, string> = {
  sheets_dimensions: 'dim',
  sheets_visualize: 'viz',
  sheets_collaborate: 'collab',
  sheets_dependencies: 'deps',
  sheets_transaction: 'tx',
  sheets_appsscript: 'script',
  sheets_bigquery: 'bq',
  sheets_federation: 'fed',
  sheets_connectors: 'connector',
  sheets_templates: 'template',
  sheets_composite: 'composite',
};

// ============================================================================
// REGISTRY GENERATION
// ============================================================================

let flatRegistryCache: FlatToolDefinition[] | null = null;

/**
 * Get the flat domain prefix for a compound tool name.
 *
 * Examples:
 *   sheets_data → data
 *   sheets_dimensions → dim
 *   sheets_collaborate → collab
 */
function getDomainPrefix(toolName: string): string {
  return DOMAIN_PREFIX_MAP[toolName] ?? toolName.replace('sheets_', '');
}

/**
 * Build the flat tool name from parent tool + action.
 *
 * Convention: sheets_{domain}_{action}
 *
 * Examples:
 *   sheets_data + read → sheets_data_read
 *   sheets_dimensions + freeze → sheets_dim_freeze
 *   sheets_collaborate + comment_add → sheets_collab_comment_add
 */
export function buildFlatToolName(parentTool: string, action: string): string {
  const domain = getDomainPrefix(parentTool);
  return `sheets_${domain}_${action}`;
}

/**
 * Parse a flat tool name back into parent tool + action.
 *
 * Returns null if the name doesn't match any known flat tool.
 */
export function parseFlatToolName(flatName: string): { parentTool: string; action: string } | null {
  // Build reverse lookup from the registry
  const registry = getFlatToolRegistry();
  const entry = registry.find((t) => t.name === flatName);
  if (!entry) return null;
  return { parentTool: entry.parentTool, action: entry.action };
}

/**
 * Build a description for a flat tool from its annotation.
 */
function buildFlatDescription(parentTool: string, action: string): string {
  const key = `${parentTool}.${action}`;
  const annotation = (ACTION_ANNOTATIONS as Record<string, { whenToUse?: string }>)[key];

  if (annotation?.whenToUse) {
    // Truncate to ~200 chars for token efficiency
    const desc = annotation.whenToUse;
    return desc.length > 200 ? `${desc.slice(0, 197)}...` : desc;
  }

  // Fallback: humanize the action name
  const humanAction = action.replace(/_/g, ' ');
  const domain = parentTool.replace('sheets_', '');
  return `${humanAction} (${domain})`;
}

/**
 * Generate the complete flat tool registry from TOOL_ACTIONS.
 *
 * This is generated once at startup and cached. Each entry maps
 * a single action to a flat MCP tool definition.
 */
export function getFlatToolRegistry(): FlatToolDefinition[] {
  if (flatRegistryCache) return flatRegistryCache;

  const registry: FlatToolDefinition[] = [];

  for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
    // Skip tools that are completely unavailable
    if (isToolFullyUnavailable(toolName)) continue;

    // Filter to only available actions (respects Redis/Apps Script config)
    const availableActions = filterAvailableActions(toolName, actions);

    for (const action of availableActions) {
      const flatName = buildFlatToolName(toolName, action);
      const actionKey = `${toolName}.${action}`;
      const isAlwaysLoaded = ALWAYS_LOADED_ACTIONS.has(actionKey);
      const isMutation = KNOWN_MUTATIONS.has(action);

      registry.push({
        name: flatName,
        title: `${action.replace(/_/g, ' ')}`,
        description: buildFlatDescription(toolName, action),
        parentTool: toolName,
        action,
        deferLoading: !isAlwaysLoaded,
        annotations: {
          readOnlyHint: !isMutation,
          destructiveHint: isMutation,
          idempotentHint: false,
          openWorldHint: true,
        },
      });
    }
  }

  logger.info('Flat tool registry built', {
    totalFlatTools: registry.length,
    alwaysLoaded: registry.filter((t) => !t.deferLoading).length,
    deferred: registry.filter((t) => t.deferLoading).length,
  });

  flatRegistryCache = registry;
  return registry;
}
