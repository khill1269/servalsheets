/**
 * ServalSheets - Tool Handlers
 *
 * Handler mapping and tool call execution logic.
 *
 * @module mcp/registration/tool-handlers
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Handlers } from '../../handlers/index.js';
import { AuthHandler } from '../../handlers/auth.js';
import type { GoogleApiClient } from '../../services/google-api.js';
/**
 * Creates a map of tool names to handler functions
 *
 * Each handler receives validated input and returns structured output.
 * The MCP SDK validates input against inputSchema before calling the handler.
 */
export declare function createToolHandlerMap(handlers: Handlers, authHandler?: AuthHandler): Record<string, (args: unknown, extra?: unknown) => Promise<unknown>>;
/**
 * Builds a compliant MCP tool response
 *
 * MCP 2025-11-25 Response Requirements:
 * - content: Array of content blocks (always present)
 * - structuredContent: Typed object matching outputSchema
 * - isError: true for tool errors (LLM can retry), undefined for success
 *
 * @param result - The handler result (should match output schema)
 * @returns CallToolResult with content, structuredContent, and optional isError
 */
export declare function buildToolResponse(result: unknown): CallToolResult;
/**
 * Registers all ServalSheets tools with the MCP server
 *
 * Handles SDK compatibility for discriminated union schemas.
 *
 * @param server - McpServer instance
 * @param handlers - Tool handlers (null if not authenticated)
 */
export declare function registerServalSheetsTools(server: McpServer, handlers: Handlers | null, options?: {
    googleClient?: GoogleApiClient | null;
}): Promise<void>;
//# sourceMappingURL=tool-handlers.d.ts.map