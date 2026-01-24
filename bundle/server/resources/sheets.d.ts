/**
 * ServalSheets - Dynamic Sheet Resources
 *
 * Resource templates for dynamic sheet discovery (MCP 2025-11-25)
 * Enables clients to browse available sheets without explicit tool calls
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HandlerContext } from '../handlers/index.js';
export interface SheetResourceOptions {
    spreadsheetId: string;
    sheetName: string;
}
/**
 * Register dynamic sheet resources with resource templates
 *
 * Provides:
 * - sheets://spreadsheets/{id}/sheets/{name} - Individual sheet data
 * - sheets://spreadsheets/{id}/sheets - List of all sheets in a spreadsheet
 */
export declare function registerSheetResources(server: McpServer, context: HandlerContext): void;
/**
 * Read sheet resource (handler for resource read requests)
 */
export declare function readSheetResource(uri: string, context: HandlerContext): Promise<{
    contents: Array<{
        uri: string;
        mimeType: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=sheets.d.ts.map