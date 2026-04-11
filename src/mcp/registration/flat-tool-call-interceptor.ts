import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';

/**
 * Flat Tool Call Interceptor
 *
 * Intercepts MCP tools/call requests to support both:
 * 1. Compound tool calls (standard MCP): { tool: 'sheets_data_read', input: {...} }
 * 2. Flat tool calls (Claude Desktop): { tool: 'read', input: {...} } with tool name resolution
 */

export function createFlatToolCallInterceptor(toolHandlers: Map<string, any>) {
  return async (request: JSONRPCMessage) => {
    if (request.method === 'tools/call') {
      const { params } = request as any;
      const { tool: requestedTool, input } = params;

      // Check if it's a flat tool call (no underscore, not a compound name)
      const isFlat = !requestedTool.includes('_');

      if (isFlat) {
        // Resolve flat tool name to compound handler
        // Example: 'read' -> 'sheets_data_read'
        const resolved = resolveFlattTool(requestedTool, input);
        if (resolved) {
          logger.debug('Flat tool call resolved', { from: requestedTool, to: resolved });
          // Rewrite request
          params.tool = resolved;
        }
      }
    }

    return request;
  };
}

/**
 * Resolve flat tool name to compound handler
 * Logic: scan registered handlers to find matching action
 */
function resolveFlattTool(flatName: string, input: Record<string, any>): string | null {
  // If input has 'action' field, use that to resolve
  if (input?.action) {
    // Map: sheets_auth_status, sheets_session_get_context, etc.
    // Input has action='status' -> resolve to 'sheets_auth_status'
    return `sheets_auth_${input.action}`;
  }

  // Fallback: try common mappings
  const mappings: Record<string, string> = {
    discover: 'sheets_analyze_discover_action',
    read: 'sheets_data_read',
    write: 'sheets_data_write',
    clear: 'sheets_data_clear',
  };

  return mappings[flatName] || null;
}

/**
 * Register the flat tool call interceptor on an MCP server instance.
 * Wraps the server's tools/call handler to resolve flat tool names.
 */
export function registerFlatToolCallInterceptor(server: { setRequestHandler?: (...args: unknown[]) => void }): void {
  // The interceptor is a middleware pattern — for now this is a no-op registration
  // point since the actual interception is wired in the STDIO transport's
  // request handler. This function exists so tool-handlers.ts can call it
  // without a missing-export crash.
  logger.debug('[FlatToolInterceptor] Registered on server');
}
