/**
 * ServalSheets - Performance Guide Resources
 *
 * Provides AI-friendly performance optimization guides:
 * - Quota optimization strategies
 * - Batching patterns and best practices
 * - Caching strategies
 * - Error recovery patterns
 *
 * These resources help LLMs make optimal decisions about
 * API usage, performance trade-offs, and error handling.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Register performance guide resources
 */
export declare function registerGuideResources(server: McpServer): void;
/**
 * Read guide resource content
 */
export declare function readGuideResource(uri: string): Promise<{
    contents: Array<{
        uri: string;
        mimeType?: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=guides.d.ts.map