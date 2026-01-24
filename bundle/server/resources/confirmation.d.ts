/**
 * ServalSheets - Confirmation Resources
 *
 * MCP Resources that provide Claude with confirmation guidance.
 * Claude can query these to understand when/how to confirm.
 *
 * @module resources/confirmation
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Register confirmation-related resources
 */
export declare function registerConfirmationResources(server: McpServer): void;
export declare const ConfirmationResources: {
    registerConfirmationResources: typeof registerConfirmationResources;
};
//# sourceMappingURL=confirmation.d.ts.map