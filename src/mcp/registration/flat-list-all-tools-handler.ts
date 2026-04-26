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
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import {
  getFlatToolRegistry,
  type FlatToolDefinition,
} from './flat-tool-registry.js';

/** Compute aggregate stats over the flat registry. Inlined here so this file
 *  does not depend on un-exported helpers in flat-tool-registry.js. */
function computeFlatRegistryStats(): {
  total: number;
  alwaysLoaded: number;
  deferred: number;
  byDomain: Record<string, number>;
} {
  const registry = getFlatToolRegistry();
  const byDomain: Record<string, number> = {};
  for (const tool of registry) {
    const domain = tool.parentTool.replace(/^sheets_/, '');
    byDomain[domain] = (byDomain[domain] ?? 0) + 1;
  }
  return {
    total: registry.length,
    alwaysLoaded: registry.filter((t) => !t.deferLoading).length,
    deferred: registry.filter((t) => t.deferLoading).length,
    byDomain,
  };
}

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

/**
 * Zod input schema for trust-boundary validation (audit OWASP A03 fix).
 *
 * The MCP `tools/call` interceptor MUST parse untrusted JSON-RPC arguments
 * through this schema before invoking handleListAllTools(). Unknown keys are
 * stripped and types are enforced; this is the only place "external input"
 * crosses into trusted territory for this handler.
 */
export const ListAllToolsInputSchema = z
  .object({
    parentTool: z.string().max(100).optional(),
    domain: z.string().max(50).optional(),
    alwaysLoadedOnly: z.boolean().optional(),
    deferredOnly: z.boolean().optional(),
    verbosity: z.enum(['minimal', 'standard']).optional(),
  })
  .strict();

export interface ListAllToolsResult {
  success: true;
  action: 'list_all_tools';
  stats: ReturnType<typeof computeFlatRegistryStats>;
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
    stats: computeFlatRegistryStats(),
    count: tools.length,
    tools: projected,
  };
}
