/**
 * ServalSheets - Flat Tool Routing Adapter
 *
 * Maps flat tool calls (e.g., sheets_data_read) back to the existing
 * compound handler system (sheets_data + action: 'read').
 *
 * This is the bridge between the new flat MCP surface and the existing
 * 25-handler architecture. No handlers are modified — this adapter
 * simply injects the action parameter and delegates.
 *
 * @module mcp/registration/flat-tool-routing
 */

import { parseFlatToolName, getFlatToolRegistry } from './flat-tool-registry.js';
import { logger } from '../../utils/logger.js';

/**
 * Check if a tool name is a flat tool (vs a compound/bundled tool).
 *
 * Flat tools have 3+ underscore-separated segments after 'sheets_':
 *   sheets_data_read (flat) vs sheets_data (compound)
 */
export function isFlatToolName(toolName: string): boolean {
  // Quick check: compound tools are in the known set of 25
  if (COMPOUND_TOOL_NAMES.has(toolName)) return false;
  // Otherwise check if it's in the flat registry
  return parseFlatToolName(toolName) !== null;
}

/**
 * The 25 compound tool names. Used for fast exclusion in isFlatToolName.
 */
const COMPOUND_TOOL_NAMES: ReadonlySet<string> = new Set([
  'sheets_auth',
  'sheets_core',
  'sheets_data',
  'sheets_format',
  'sheets_dimensions',
  'sheets_visualize',
  'sheets_collaborate',
  'sheets_advanced',
  'sheets_transaction',
  'sheets_quality',
  'sheets_history',
  'sheets_confirm',
  'sheets_analyze',
  'sheets_fix',
  'sheets_composite',
  'sheets_session',
  'sheets_templates',
  'sheets_bigquery',
  'sheets_appsscript',
  'sheets_webhook',
  'sheets_dependencies',
  'sheets_federation',
  'sheets_compute',
  'sheets_agent',
  'sheets_connectors',
]);

/**
 * Route a flat tool call to the compound handler.
 *
 * Takes the flat tool name and raw args, injects the action field,
 * and returns the compound tool name + normalized args ready for
 * the existing handler pipeline.
 *
 * @example
 *   routeFlatToolCall('sheets_data_read', { spreadsheetId: '...', range: 'A1:B10' })
 *   // Returns: {
 *   //   compoundToolName: 'sheets_data',
 *   //   normalizedArgs: { action: 'read', spreadsheetId: '...', range: 'A1:B10' }
 *   // }
 */
export function routeFlatToolCall(
  flatToolName: string,
  args: Record<string, unknown>
): { compoundToolName: string; normalizedArgs: Record<string, unknown> } | null {
  const parsed = parseFlatToolName(flatToolName);
  if (!parsed) {
    logger.warn('Flat tool routing: unknown flat tool name', { flatToolName });
    return null;
  }

  const { parentTool, action } = parsed;

  // Inject the action field into the args.
  // The existing normalizeToolArgs() in tool-arg-normalization.ts will
  // then wrap this into { request: { action, ...params } } as needed.
  const normalizedArgs: Record<string, unknown> = {
    ...args,
    action,
  };

  logger.debug('Flat tool routed', {
    flatTool: flatToolName,
    compoundTool: parentTool,
    action,
  });

  return {
    compoundToolName: parentTool,
    normalizedArgs,
  };
}

/**
 * Build a reverse lookup map from flat tool names to compound tool names.
 * Used for batch operations and pre-flight checks.
 */
export function buildFlatToCompoundMap(): Map<string, { parentTool: string; action: string }> {
  const map = new Map<string, { parentTool: string; action: string }>();
  for (const entry of getFlatToolRegistry()) {
    map.set(entry.name, { parentTool: entry.parentTool, action: entry.action });
  }
  return map;
}

/**
 * Get the compound tool name for a flat tool name.
 * Returns the flat name itself if it's not a flat tool (compound passthrough).
 */
export function resolveCompoundToolName(toolName: string): string {
  if (COMPOUND_TOOL_NAMES.has(toolName)) return toolName;
  const parsed = parseFlatToolName(toolName);
  return parsed?.parentTool ?? toolName;
}
