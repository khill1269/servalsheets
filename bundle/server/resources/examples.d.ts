/**
 * ServalSheets - Action Examples Library
 *
 * Provides concrete code examples for common ServalSheets patterns:
 * - Basic CRUD operations
 * - Batch operations
 * - Transaction patterns
 * - Composite workflows
 * - Error handling
 *
 * These examples help AI agents understand practical usage
 * patterns and best practices for ServalSheets actions.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Register examples library resources
 */
export declare function registerExamplesResources(server: McpServer): void;
/**
 * Read examples resource content
 */
export declare function readExamplesResource(uri: string): Promise<{
    contents: Array<{
        uri: string;
        mimeType?: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=examples.d.ts.map