/**
 * ServalSheets - Static Reference Resources
 *
 * Provides read-only reference documentation for LLMs:
 * - Color palettes and formatting codes
 * - Common formula patterns
 * - Number format strings
 * - API quotas and limits
 * - Data validation patterns
 *
 * These resources help LLMs understand Google Sheets conventions
 * without needing to make API calls or read external documentation.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Register static reference resources
 */
export declare function registerReferenceResources(server: McpServer): void;
/**
 * Read reference resource content
 */
export declare function readReferenceResource(uri: string): Promise<{
    contents: Array<{
        uri: string;
        mimeType?: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=reference.d.ts.map