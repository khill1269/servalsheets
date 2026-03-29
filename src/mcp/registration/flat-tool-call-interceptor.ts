/**
 * ServalSheets - Flat Tool Call Interceptor
 *
 * Intercepts MCP `tools/call` requests in flat mode to rewrite flat tool names
 * (e.g., `sheets_data_read`) back to compound tool names (e.g., `sheets_data`)
 * with the action parameter injected into the arguments.
 *
 * Also handles the `sheets_discover` meta-tool directly without delegation.
 *
 * This uses the same `setRequestHandler` override pattern as the tools/list
 * compatibility handler in tools-list-compat.ts.
 *
 * @module mcp/registration/flat-tool-call-interceptor
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getEffectiveToolMode } from '../../config/constants.js';
import { isFlatToolName, routeFlatToolCall } from './flat-tool-routing.js';
import { handleDiscover, type DiscoverInput } from './flat-discover-handler.js';
import { buildToolResponse } from './tool-response.js';
import { logger } from '../../utils/logger.js';

type CallToolRequest = z.infer<typeof CallToolRequestSchema>;

/**
 * Register an interceptor on `tools/call` that rewrites flat tool names
 * to compound names before the SDK dispatches to the registered handler.
 *
 * In bundled mode this is a no-op — the original SDK handler runs unchanged.
 *
 * Architecture:
 *   Client calls `sheets_data_read` with { spreadsheetId, range }
 *   → Interceptor rewrites to `sheets_data` with { action: 'read', spreadsheetId, range }
 *   → SDK finds the registered `sheets_data` handler
 *   → Normal pipeline runs (auth, rate limit, tracing, history, etc.)
 */
export function registerFlatToolCallInterceptor(server: McpServer): void {
  // Only needed in flat mode
  if (getEffectiveToolMode() !== 'flat') return;

  const protocolServer = server.server as unknown as {
    setRequestHandler: typeof server.server.setRequestHandler;
  };

  // Access the SDK's internal registered tools map so we can delegate
  // to the original compound tool handler after rewriting.
  const registeredTools = (
    server as unknown as {
      _registeredTools?: Record<
        string,
        {
          enabled: boolean;
          execution?: { taskSupport?: string };
          handler: {
            (args: Record<string, unknown>, extra: unknown): Promise<CallToolResult>;
            createTask?: unknown;
          };
          inputSchema?: unknown;
          outputSchema?: unknown;
        }
      >;
    }
  )._registeredTools;

  if (!registeredTools) {
    logger.warn('Flat tool call interceptor: _registeredTools not found on McpServer');
    return;
  }

  // Capture the SDK's original tools/call handler by registering our override.
  // The SDK's setRequestHandler replaces the previous handler, so we need to
  // intercept, transform, and then call the compound tool's handler directly.
  protocolServer.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest, extra: unknown) => {
      const toolName = request.params.name;
      const args = request.params.arguments ?? {};

      // ── sheets_discover ──────────────────────────────────────────────
      // Handle the discovery meta-tool directly (no compound handler exists)
      if (toolName === 'sheets_discover') {
        const discoverInput: DiscoverInput = {
          query: typeof args['query'] === 'string' ? args['query'] : '',
          category: typeof args['category'] === 'string' ? args['category'] : undefined,
          maxResults: typeof args['maxResults'] === 'number' ? args['maxResults'] : undefined,
        };

        logger.debug('sheets_discover tool call', { query: discoverInput.query });

        const result = handleDiscover(discoverInput);
        return buildToolResponse({ response: result });
      }

      // ── Flat tool rewriting ──────────────────────────────────────────
      // Rewrite flat tool names to compound names + inject action
      if (isFlatToolName(toolName)) {
        const routed = routeFlatToolCall(toolName, args as Record<string, unknown>);
        if (!routed) {
          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'TOOL_NOT_FOUND',
                message: `Unknown flat tool: ${toolName}. Use sheets_discover to find available tools.`,
                retryable: false,
              },
            },
          });
        }

        logger.debug('Flat tool intercepted', {
          flatTool: toolName,
          compoundTool: routed.compoundToolName,
          action: routed.normalizedArgs['action'],
        });

        // Look up the compound tool handler in SDK's registry
        const compoundTool = registeredTools[routed.compoundToolName];
        if (!compoundTool) {
          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'TOOL_NOT_FOUND',
                message: `Compound tool ${routed.compoundToolName} not registered. Server may still be initializing.`,
                retryable: true,
              },
            },
          });
        }

        if (!compoundTool.enabled) {
          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'TOOL_DISABLED',
                message: `Tool ${routed.compoundToolName} is currently disabled.`,
                retryable: false,
              },
            },
          });
        }

        // Delegate to the compound handler with the rewritten args.
        // The compound handler's closure has all middleware (auth, rate limiting,
        // tracing, history recording, etc.) built in via createToolCallHandler().
        //
        // Note: We bypass the SDK's validateToolInput() here because the compound
        // handler already runs Zod validation via parseForHandler(). The flat args
        // with injected action will be normalized by normalizeToolArgs() inside
        // the handler closure.
        const handler = compoundTool.handler;
        return handler(routed.normalizedArgs, extra);
      }

      // ── Compound tool passthrough ────────────────────────────────────
      // For compound (bundled) tool names, delegate to the SDK's normal dispatch.
      // We reproduce the core SDK dispatch logic here since we've overridden the handler.
      const tool = registeredTools[toolName];
      if (!tool) {
        const { McpError, ErrorCode } = await import('@modelcontextprotocol/sdk/types.js');
        throw new McpError(ErrorCode.InvalidParams, `Tool ${toolName} not found`);
      }

      if (!tool.enabled) {
        const { McpError, ErrorCode } = await import('@modelcontextprotocol/sdk/types.js');
        throw new McpError(ErrorCode.InvalidParams, `Tool ${toolName} disabled`);
      }

      // Reproduce SDK's task support logic
      const isTaskRequest = !!(request.params as Record<string, unknown>)['task'];
      const taskSupport = tool.execution?.taskSupport;
      const isTaskHandler = 'createTask' in tool.handler;

      if ((taskSupport === 'required' || taskSupport === 'optional') && !isTaskHandler) {
        const { McpError, ErrorCode } = await import('@modelcontextprotocol/sdk/types.js');
        throw new McpError(
          ErrorCode.InternalError,
          `Tool ${toolName} has taskSupport '${taskSupport}' but was not registered with registerToolTask`
        );
      }

      if (taskSupport === 'required' && !isTaskRequest) {
        const { McpError, ErrorCode } = await import('@modelcontextprotocol/sdk/types.js');
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool ${toolName} requires task augmentation (taskSupport: 'required')`
        );
      }

      if (taskSupport === 'optional' && !isTaskRequest && isTaskHandler) {
        // Delegate to SDK's handleAutomaticTaskPolling via the McpServer instance.
        // Since we can't call a private method directly, we let the handler run normally
        // and rely on the tool's own task support logic.
        const handler = tool.handler;
        return handler(args as Record<string, unknown>, extra);
      }

      // Normal execution: delegate to handler directly
      // (SDK's validateToolInput is already handled inside createToolCallHandler)
      const handler = tool.handler;
      return handler(args as Record<string, unknown>, extra);
    }
  );

  logger.info('Flat tool call interceptor registered');
}
