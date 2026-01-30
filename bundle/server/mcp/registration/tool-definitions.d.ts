/**
 * ServalSheets - Tool Definitions
 *
 * Complete tool registry with Zod schemas and metadata.
 *
 * @module mcp/registration/tool-definitions
 */
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';
/**
 * Tool definition with Zod schemas
 *
 * Schemas can be z.object(), z.discriminatedUnion(), or other Zod types.
 * The SDK compatibility layer handles conversion to JSON Schema.
 */
export interface ToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: ZodTypeAny;
    readonly outputSchema: ZodTypeAny;
    readonly annotations: ToolAnnotations;
}
/**
 * Complete tool registry for ServalSheets
 *
 * 21 tools after Phase 1 optimization (removed deprecated sheets_analysis):
 * - Wave 1: sheets_core (replaces sheets_spreadsheet + sheets_sheet)
 * - Wave 1: sheets_visualize (replaces sheets_charts + sheets_pivot)
 * - Wave 1: sheets_collaborate (replaces sheets_sharing + sheets_comments + sheets_versions)
 * - Wave 2: sheets_format (absorbed sheets_rules conditional formatting + data validation)
 * - Wave 2: sheets_dimensions (absorbed sheets_filter_sort filtering + sorting)
 * - Wave 3: sheets_quality (replaces sheets_validation + sheets_conflict + sheets_impact)
 * - Wave 4: sheets_data (replaces sheets_values + sheets_cells)
 *
 * Schema Pattern: z.object({ request: z.discriminatedUnion('action', ...) })
 * - Actions are discriminated by `action` within `request`
 * - Responses are discriminated by `success` within `response`
 *
 * Note: Removed sheets_plan and sheets_insights (anti-patterns).
 * Replaced with sheets_confirm (Elicitation) and sheets_analyze (Sampling).
 *
 * Descriptions: All tool descriptions are imported from descriptions.ts to maintain
 * a single source of truth for LLM-optimized tool descriptions.
 */
export declare const TOOL_DEFINITIONS: readonly ToolDefinition[];
/**
 * Filtered tool definitions based on SERVAL_TOOL_MODE
 *
 * Use this instead of TOOL_DEFINITIONS for registration.
 * - 'full': All 21 tools (~527KB schema payload)
 * - 'standard': 12 tools (~444KB)
 * - 'lite': 8 tools (~199KB, recommended for Claude Desktop)
 */
export declare const ACTIVE_TOOL_DEFINITIONS: readonly ToolDefinition[];
//# sourceMappingURL=tool-definitions.d.ts.map