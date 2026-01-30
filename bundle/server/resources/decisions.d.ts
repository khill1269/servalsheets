/**
 * ServalSheets - Decision Tree Resources
 *
 * Provides AI-friendly decision trees for common ServalSheets choices:
 * - When to use transactions
 * - When to request confirmation
 * - Tool selection guidance
 * - Read vs batch_read decisions
 *
 * These resources help LLMs make optimal decisions about
 * which tools and patterns to use for specific scenarios.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Register decision tree resources
 */
export declare function registerDecisionResources(server: McpServer): void;
/**
 * Read decision tree resource content
 */
export declare function readDecisionResource(uri: string): Promise<{
    contents: Array<{
        uri: string;
        mimeType?: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=decisions.d.ts.map