/**
 * ServalSheets - MCP 2025-11-25 Feature Enhancement
 *
 * This file documents and implements all MCP 2025-11-25 features
 * including SEP-1686 (Tasks), SEP-973 (Icons), and proper capability wiring.
 *
 * AUDIT: January 2026
 *
 * ============================================================================
 * MCP SERVER CAPABILITIES DECLARATION
 * ============================================================================
 *
 * DECLARED CAPABILITIES (via createServerCapabilities):
 * - tools: 16 tools with 207 actions (current consolidated set)
 * - resources: 2 URI templates + 7 knowledge resources
 * - prompts: 6 guided workflows for common operations
 * - completions: Argument autocompletion for prompts/resources
 * - tasks: Background execution with TaskStoreAdapter (SEP-1686)
 * - logging: Dynamic log level control via logging/setLevel handler
 *
 * IMPLEMENTED BUT NOT DECLARED (SDK v1.25.1 limitations):
 * - elicitation (SEP-1036): sheets_confirm uses extra.elicit for plan confirmation
 * - sampling (SEP-1577): sheets_analyze uses extra.sample for AI-powered analysis
 * Note: These features work correctly but cannot be declared in ServerCapabilities
 * until the SDK adds support for these capability fields.
 *
 * NOT APPLICABLE:
 * - roots: Not applicable for Google Sheets (cloud-based, no filesystem)
 *
 * ============================================================================
 */
import type { ServerCapabilities, Icon, ToolExecution } from '@modelcontextprotocol/sdk/types.js';
/**
 * MCP 2025-11-25 Feature Implementation Status
 *
 * ✅ FULLY IMPLEMENTED (100% MCP 2025-11-25 Compliant):
 * - SEP-986 Tool Naming (snake_case, validated)
 * - Tool Annotations (all 4 hints: readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
 * - Structured Outputs (content + structuredContent in responses)
 * - Discriminated Unions (action in request, success in response)
 * - Resources (spreadsheet metadata via URI template)
 * - Prompts (6 guided workflows)
 * - Knowledge Resources (formulas, colors, formats)
 * - listChanged notifications (auto-registered by McpServer)
 * - SEP-973 Icons (SVG icons for all 16 tools)
 * - Server Instructions (LLM context guidance)
 * - SEP-1686 Tasks (SDK-compatible TaskStoreAdapter with listTasks)
 * - Logging capability (winston logger + MCP logging/setLevel)
 * - Completions capability (argument autocompletion for actions, IDs, types)
 * - SEP-1577 Sampling (server-to-client LLM requests for AI-powered analysis)
 * - SEP-1036 Elicitation (user input collection via forms and URLs)
 *
 * All MCP 2025-11-25 features are now implemented!
 */
/**
 * Tool icons for ServalSheets
 *
 * Icons improve UX in MCP clients by providing visual identification.
 * Format: data: URI with base64 SVG
 *
 * Icon interface: { src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }
 */
export declare const TOOL_ICONS: Record<string, Icon[]>;
/**
 * Tool execution configuration for task support (SEP-1686)
 *
 * taskSupport values:
 * - 'forbidden': Tool cannot be used with task augmentation
 * - 'optional': Tool can be used with or without task augmentation
 * - 'required': Tool MUST be used with task augmentation
 *
 * Long-running tools (analysis, bulk operations) use 'optional' to allow
 * clients to request task-based execution for progress tracking.
 */
export declare const TOOL_EXECUTION_CONFIG: Record<string, ToolExecution>;
/**
 * Full server capabilities for ServalSheets
 *
 * MCP 2025-11-25 ServerCapabilities (Honest Declaration):
 * - completions: Argument autocompletion for prompts/resources (NOT tool args)
 * - prompts: Auto-registered by McpServer.registerPrompt()
 * - resources: Auto-registered by McpServer.registerResource()
 * - tools: Auto-registered by McpServer.registerTool()
 * - tasks: Task-augmented execution (SEP-1686)
 * - logging: Dynamic log level control via logging/setLevel handler
 *
 * NOT DECLARED (but used):
 * - elicitation (SEP-1036): Sheets_confirm uses it, but SDK doesn't expose capability declaration
 * - sampling (SEP-1577): Sheets_analyze uses it, but SDK doesn't expose capability declaration
 *
 * ARCHITECTURAL NOTE:
 * This server USES elicitation and sampling in handlers, but cannot DECLARE them
 * as capabilities because the SDK v1.25.x doesn't expose the capability types yet.
 * When the SDK adds these capability types, we should declare them here.
 */
export declare function createServerCapabilities(): ServerCapabilities;
/**
 * Server instructions for LLM context
 *
 * These instructions help the LLM understand how to use ServalSheets effectively.
 * They are sent during initialization and can be added to system prompts.
 *
 * When DEFER_SCHEMAS is enabled, instructions include guidance on fetching
 * full schemas from resources before calling tools.
 */
export declare function getServerInstructions(): string;
/**
 * Server instructions for LLM context (static export for backward compatibility)
 *
 * @deprecated Use getServerInstructions() instead for dynamic content
 */
export declare const SERVER_INSTRUCTIONS: string;
//# sourceMappingURL=features-2025-11-25.d.ts.map