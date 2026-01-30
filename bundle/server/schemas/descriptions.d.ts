/**
 * ServalSheets - LLM-Optimized Tool Descriptions
 *
 * Routing-focused descriptions that help Claude select the right tool:
 * 1. **ROUTING** - When to pick this tool
 * 2. **NOT this tool** - Cross-references to alternatives
 * 3. **ACTIONS BY CATEGORY** - Grouped for quick scanning
 * 4. **TOP 3 ACTIONS** - Most common usage patterns
 * 5. **SAFETY** - Destructive operation warnings
 *
 * Total: 21 tools, 267 actions
 */
export declare const TOOL_DESCRIPTIONS: Record<string, string>;
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;
export declare function getToolDescription(name: string): string;
//# sourceMappingURL=descriptions.d.ts.map