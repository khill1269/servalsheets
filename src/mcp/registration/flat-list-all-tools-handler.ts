/**
 * ServalSheets - sheets_list_all_tools Handler (P-2 audit fix)
 *
 * Problem this solves (audit finding L-1):
 *   Some MCP clients cap ListTools results or apply deferred-loading policies
 *   that hide most of the ~409 action names behind tool_search / sheets_discover.
 *   When a user can't find a tool via search, they currently have no way to
 *   see the full inventory.
 *
 * This meta-tool returns the complete flat tool registry — every exposed
 * action name, parent compound tool, domain, and defer-loading flag. Clients
 * that can't get the full ListTools response can reach everything through
 * ONE known call.
 *
 * Supports filtering (by parent tool, domain, load mode) and minimal mode
 * for token efficiency on large result sets.
 */
import { logger } from '../../utils/logger.js';
import {
  getFlatToolRegistry,
  getFlatRegistryStats,
  type FlatToolDefinition,
} from './flat-tool-registry.js';

export interface ListAllToolsInput {
  /** Filter by parent tool (e.g., 'sheets_core', 'sheets_data') */
  parentTool?: string;
  /** Filter by domain prefix (e.g., 'core', 'data', 'analyze') */
  domain?: string;
  /** If true, only return always-loaded tools */
  alwaysLoadedOnly?: boolean;
  /** If true, only return deferred tools */
  deferredOnly?: boolean;
  /** If 'minimal', omit description + annotations for token efficiency */
  verbosity?: 'minimal' | 'standard';
}

export interface ListAllToolsResult {
  success: true;
  action: 'list_all_tools';
  stats: ReturnType<typeof getFlatRegistryStats>;
  /** Total after filtering */
  count: number;
  tools: Array<
    | Pick<FlatToolDefinition, 'name' | 'parentTool' | 'action' | 'deferLoading'>
    | FlatToolDefinition
  >;
}

function getDomainPrefix(parentTool: string): string {
  return parentTool.replace(/^sheets_/, '');
}

/**
 * Handle a sheets_list_all_tools call.
 * Returns the full registry filtered by the supplied criteria.
 */
export function handleListAllTools(input: ListAllToolsInput): ListAllToolsResult {
  const {
    parentTool,
    domain,
    alwaysLoadedOnly = false,
    deferredOnly = false,
    verbosity = 'standard',
  } = input;

  let tools = getFlatToolRegistry();

  if (parentTool) {
    tools = tools.filter((t) => t.parentTool === parentTool);
  }
  if (domain) {
    tools = tools.filter((t) => getDomainPrefix(t.parentTool) === domain);
  }
  if (alwaysLoadedOnly) {
    tools = tools.filter((t) => !t.deferLoading);
  }
  if (deferredOnly) {
    tools = tools.filter((t) => t.deferLoading);
  }

  logger.debug('sheets_list_all_tools', {
    filters: { parentTool, domain, alwaysLoadedOnly, deferredOnly },
    returned: tools.length,
  });

  const projected =
    verbosity === 'minimal'
      ? tools.map((t) => ({
          name: t.name,
          parentTool: t.parentTool,
          action: t.action,
          deferLoading: t.deferLoading,
        }))
      : tools;

  return {
    success: true,
    action: 'list_all_tools',
    stats: getFlatRegistryStats(),
    count: tools.length,
    tools: projected,
  };
}
