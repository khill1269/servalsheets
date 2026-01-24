/**
 * ServalSheets - Resource Registration
 *
 * Resource templates and handlers for spreadsheet data access.
 *
 * @module mcp/registration/resource-registration
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GoogleApiClient } from '../../services/google-api.js';
/**
 * Registers ServalSheets resources with the MCP server
 *
 * Resources provide read-only access to spreadsheet metadata via URI templates.
 *
 * @param server - McpServer instance
 * @param googleClient - Google API client (null if not authenticated)
 */
export declare function registerServalSheetsResources(server: McpServer, googleClient: GoogleApiClient | null): void;
//# sourceMappingURL=resource-registration.d.ts.map