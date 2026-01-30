/**
 * ServalSheets - Schema Resources
 *
 * Provides on-demand access to full tool schemas when DEFER_SCHEMAS is enabled.
 * This allows tools to be registered with minimal schemas while full schemas
 * are available via MCP resources.
 *
 * URI Pattern: schema://tools/{toolName}
 *
 * @module resources/schemas
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Get the full JSON Schema for a tool
 *
 * @param toolName - Name of the tool (e.g., 'sheets_core')
 * @returns JSON string of the full schema, or null if not found
 */
export declare function getToolSchema(toolName: string): string | null;
/**
 * Get a summary of all available tool schemas
 *
 * @returns JSON string with tool names and brief descriptions
 */
export declare function getSchemaIndex(): string;
/**
 * Read a schema resource by URI
 *
 * @param uri - Resource URI (schema://tools or schema://tools/{toolName})
 * @returns Resource contents
 */
export declare function readSchemaResource(uri: string): Promise<{
    contents: Array<{
        uri: string;
        mimeType: string;
        text: string;
    }>;
}>;
/**
 * Register schema resources with the MCP server
 *
 * Registers resources for tool schema access:
 * - schema://tools - Index of all tool schemas
 * - schema://tools/{toolName} - Full schema for a specific tool
 *
 * When DEFER_SCHEMAS is enabled, Claude should read these resources
 * before calling tools to understand available actions.
 *
 * @param server - McpServer instance
 */
export declare function registerSchemaResources(server: McpServer): void;
//# sourceMappingURL=schemas.d.ts.map