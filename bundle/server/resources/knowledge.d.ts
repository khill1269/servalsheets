/**
 * ServalSheets - Knowledge Resources
 *
 * Registers embedded knowledge files as MCP resources.
 * These resources provide Claude with deep context about:
 * - Google Sheets API patterns
 * - Formula recipes and best practices
 * - Template structures
 * - Data schemas
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface KnowledgeResource {
    uri: string;
    name: string;
    description: string;
    path: string;
    mimeType: string;
    category: string;
}
/**
 * Registers all knowledge resources with the MCP server.
 */
export declare function registerKnowledgeResources(server: McpServer): number;
/**
 * Returns a list of all available knowledge resources (for introspection).
 */
export declare function listKnowledgeResources(): KnowledgeResource[];
//# sourceMappingURL=knowledge.d.ts.map