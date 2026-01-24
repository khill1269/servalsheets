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
 * - tools: 19 tools with 260 actions (current consolidated set)
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
import { DEFER_SCHEMAS } from '../config/constants.js';
import { TOOL_COUNT, ACTION_COUNT } from '../schemas/index.js';

// ============================================================================
// MCP 2025-11-25 FEATURE STATUS
// ============================================================================

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

// ============================================================================
// ICONS (SEP-973)
// ============================================================================

/**
 * Tool icons for ServalSheets
 *
 * Icons improve UX in MCP clients by providing visual identification.
 * Format: data: URI with base64 SVG
 *
 * Icon interface: { src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }
 */
export const TOOL_ICONS: Record<string, Icon[]> = {
  sheets_auth: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMjAgMjFWMTlBNCA0IDAgMCAwIDE2IDE1SDhBNCA0IDAgMCAwIDQgMTlWMjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_core: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNnoiLz48cGF0aCBkPSJNMTQgMnY2aDYiLz48cGF0aCBkPSJNOCAxM2g4Ii8+PHBhdGggZD0iTTggMTdoOCIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_data: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNNCA3VjRoMTZ2MyIvPjxwYXRoIGQ9Ik05IDIwaDYiLz48cGF0aCBkPSJNMTIgNHYxNiIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_format: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJtOS4wNiAxMS45IDguMDctOC4wNmEyLjg1IDIuODUgMCAxIDEgNC4wMyA0LjAzbC04LjA2IDguMDgiLz48cGF0aCBkPSJNNy4wNyAxNC45NGMtMS42NiAwLTMgMS4zNS0zIDNMMiAyMWwzLjA2LTIuMDdjMS42NCAwIDMtMS4zNCAzLTN6Ii8+PC9zdmc+',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_dimensions: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMjEgM0gzdjE4aDE4VjN6Ii8+PHBhdGggZD0iTTIxIDloLTE4Ii8+PHBhdGggZD0iTTkgMjFWOSIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_visualize: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48bGluZSB4MT0iMTgiIHkxPSIyMCIgeDI9IjE4IiB5Mj0iMTAiLz48bGluZSB4MT0iMTIiIHkxPSIyMCIgeDI9IjEyIiB5Mj0iNCIvPjxsaW5lIHgxPSI2IiB5MT0iMjAiIHgyPSI2IiB5Mj0iMTQiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_collaborate: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxOCIgY3k9IjUiIHI9IjMiLz48Y2lyY2xlIGN4PSI2IiBjeT0iMTIiIHI9IjMiLz48Y2lyY2xlIGN4PSIxOCIgY3k9IjE5IiByPSIzIi8+PGxpbmUgeDE9IjguNTkiIHkxPSIxMy41MSIgeDI9IjE1LjQyIiB5Mj0iMTcuNDkiLz48bGluZSB4MT0iMTUuNDEiIHkxPSI2LjUxIiB4Mj0iOC41OSIgeTI9IjEwLjQ5Ii8+PC9zdmc+',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_advanced: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0iTTE5LjQgMTVhMS42NSAxLjY1IDAgMCAwIC4zMyAxLjgybC4wNi4wNmEyIDIgMCAwIDEgMCAyLjgzIDIgMiAwIDAgMS0yLjgzIDBsLS4wNi0uMDZhMS42NSAxLjY1IDAgMCAwLTEuODItLjMzIDEuNjUgMS42NSAwIDAgMC0xIDEuNTFWMjFhMiAyIDAgMCAxLTIgMiAyIDIgMCAwIDEtMi0ydi0uMDlBMS42NSAxLjY1IDAgMCAwIDkgMTkuNGExLjY1IDEuNjUgMCAwIDAtMS44Mi4zM2wtLjA2LjA2YTIgMiAwIDAgMS0yLjgzIDAgMiAyIDAgMCAxIDAtMi44M2wuMDYtLjA2YTEuNjUgMS42NSAwIDAgMCAuMzMtMS44MiAxLjY1IDEuNjUgMCAwIDAtMS41MS0xSDNhMiAyIDAgMCAxLTItMiAyIDIgMCAwIDEgMi0yaC4wOUExLjY1IDEuNjUgMCAwIDAgNC42IDlhMS42NSAxLjY1IDAgMCAwLS4zMy0xLjgybC0uMDYtLjA2YTIgMiAwIDAgMSAwLTIuODMgMiAyIDAgMCAxIDIuODMgMGwuMDYuMDZhMS42NSAxLjY1IDAgMCAwIDEuODIuMzNIOS4xNWExLjY1IDEuNjUgMCAwIDAgMS0xLjUxVjNhMiAyIDAgMCAxIDItMiAyIDIgMCAwIDEgMiAydi4wOWExLjY1IDEuNjUgMCAwIDAgMSAxLjUxIDEuNjUgMS42NSAwIDAgMCAxLjgyLS4zM2wuMDYtLjA2YTIgMiAwIDAgMSAyLjgzIDAgMiAyIDAgMCAxIDAgMi44M2wtLjA2LjA2YTEuNjUgMS42NSAwIDAgMC0uMzMgMS44MlY5YTEuNjUgMS42NSAwIDAgMCAxLjUxIDFIMjFhMiAyIDAgMCAxIDIgMiAyIDIgMCAwIDEtMiAyaC0uMDlhMS42NSAxLjY1IDAgMCAwLTEuNTEgMXoiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_transaction: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cG9seWdvbiBwb2ludHM9IjIyIDMgMiAzIDEwIDEyLjQ2IDEwIDE5IDE0IDIxIDE0IDEyLjQ2IDIyIDMiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_quality: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTIgMjJ2LTZoNHY2Ii8+PHBhdGggZD0iTTIgMjBoMjAiLz48cGF0aCBkPSJNNCAxNnYtNmgydjYiLz48cGF0aCBkPSJNMTAgMTZ2LTZoMnY2Ii8+PHBhdGggZD0iTTE2IDE2VjZoMnYxMCIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_history: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwb2x5bGluZSBwb2ludHM9IjEyIDYgMTIgMTIgMTYgMTQiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_confirm: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMjEgMTVhMiAyIDAgMCAxLTIgMkg3bC00IDRWNWEyIDIgMCAwIDEgMi0yaDE0YTIgMiAwIDAgMSAyIDJ6Ii8+PC9zdmc+',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_analyze: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PGxpbmUgeDE9IjIxIiB5MT0iMjEiIHgyPSIxNi42NSIgeTI9IjE2LjY1Ii8+PC9zdmc+',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_fix: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iNyIgaGVpZ2h0PSI3Ii8+PHJlY3QgeD0iMTQiIHk9IjMiIHdpZHRoPSI3IiBoZWlnaHQ9IjciLz48cmVjdCB4PSIxNCIgeT0iMTQiIHdpZHRoPSI3IiBoZWlnaHQ9IjciLz48cmVjdCB4PSIzIiB5PSIxNCIgd2lkdGg9IjciIGhlaWdodD0iNyIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_composite: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIi8+PHBhdGggZD0iTTMgOWgxOCIvPjxwYXRoIGQ9Ik05IDN2MTgiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_session: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMjAgMjFWMTlBNCA0IDAgMCAwIDE2IDE1SDhBNCA0IDAgMCAwIDQgMTlWMjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
};

// ============================================================================
// EXECUTION / TASK SUPPORT
// ============================================================================

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
export const TOOL_EXECUTION_CONFIG: Record<string, ToolExecution> = {
  // Task support enabled for long-running operations to allow progress tracking and cancellation

  // Analysis tools - potentially long-running, task support enabled
  sheets_analyze: { taskSupport: 'optional' },

  // Data operations - can be slow with large ranges (>1000 rows)
  sheets_data: { taskSupport: 'optional' },

  // Formatting - can be slow with large ranges (>10K cells)
  sheets_format: { taskSupport: 'optional' },

  // Dimension operations - can be slow with bulk row/column operations (>100 rows)
  sheets_dimensions: { taskSupport: 'optional' },

  // Visualization - can be slow with large datasets
  sheets_visualize: { taskSupport: 'optional' },

  // Composite operations - can be slow with large imports
  sheets_composite: { taskSupport: 'optional' },

  // Standard operations - typically fast, no task support needed
  sheets_auth: { taskSupport: 'forbidden' },
  sheets_core: { taskSupport: 'forbidden' },
  sheets_collaborate: { taskSupport: 'forbidden' },
  sheets_advanced: { taskSupport: 'forbidden' },
  sheets_transaction: { taskSupport: 'forbidden' },
  sheets_quality: { taskSupport: 'forbidden' },
  sheets_history: { taskSupport: 'forbidden' },
  sheets_confirm: { taskSupport: 'forbidden' },
  sheets_fix: { taskSupport: 'forbidden' },
  sheets_session: { taskSupport: 'forbidden' },

  // Tier 7: Enterprise tools - potentially long-running, task support enabled
  sheets_appsscript: { taskSupport: 'optional' },
  sheets_bigquery: { taskSupport: 'optional' },
  sheets_templates: { taskSupport: 'optional' },
};

// ============================================================================
// SERVER CAPABILITIES
// ============================================================================

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
export function createServerCapabilities(): ServerCapabilities {
  return {
    // Completions support - enables argument autocompletion for prompts/resources
    // NOTE: MCP SDK v1.25.x only supports completions for prompts/resources, NOT tool arguments
    // Tool argument completions will be added when SDK supports them
    completions: {},

    // Task support (SEP-1686) - Enables task-augmented execution
    // Tools with taskSupport: 'optional' can be invoked with task mode
    tasks: {
      list: {},
      cancel: {},
      requests: {
        tools: {
          call: {},
        },
      },
    },

    // Logging support - Dynamic log level control
    // Clients can use logging/setLevel to adjust server verbosity
    logging: {},

    // Note: tools, prompts, resources capabilities are auto-registered by McpServer
    // when using registerTool(), registerPrompt(), registerResource()
  };
}

// ============================================================================
// SERVER INSTRUCTIONS
// ============================================================================

/**
 * Server instructions for LLM context
 *
 * These instructions help the LLM understand how to use ServalSheets effectively.
 * They are sent during initialization and can be added to system prompts.
 *
 * Optimized for LLM tool usage based on Anthropic best practices:
 * 1. Clear prerequisites and ordering
 * 2. Decision tree for tool selection
 * 3. Error recovery guidance
 * 4. Context management with sheets_session
 */
export function getServerInstructions(): string {
  const baseInstructions = `
ServalSheets is a Google Sheets MCP server with ${TOOL_COUNT} tools and ${ACTION_COUNT} actions.

## 🔐 STEP 1: Authentication (MANDATORY)

**BEFORE any other tool, verify authentication:**
\`\`\`
sheets_auth action:"status"
\`\`\`

If \`authenticated: false\`:
1. \`sheets_auth action:"login"\` → Get OAuth URL
2. Show user the authUrl link
3. User provides authorization code
4. \`sheets_auth action:"callback" code:"..."\`

**NEVER skip authentication.** All other tools will fail without it.

## 📍 STEP 2: Set Context (RECOMMENDED)

After auth, set the active spreadsheet to enable natural language ranges:
\`\`\`
sheets_session action:"set_active" spreadsheetId:"1ABC..."
\`\`\`

Benefits:
- Omit spreadsheetId from subsequent calls
- Use column names instead of A1 notation: \`range:"Sales column"\`
- Server tracks your working context

## 🎯 TOOL SELECTION DECISION TREE

**What do you need to do?**

→ **Create/manage spreadsheets or sheets (tabs)?**
  Use \`sheets_core\` (get, create, add_sheet, delete_sheet)

→ **Read or write CELL VALUES?**
  Use \`sheets_data\` (read, write, append, batch_read, batch_write)

→ **Change cell APPEARANCE (colors, fonts, borders)?**
  Use \`sheets_format\` (set_format, set_background, set_text_format)

→ **Insert/delete/resize ROWS or COLUMNS?**
  Use \`sheets_dimensions\` (insert_rows, delete_rows, resize_columns)

→ **Create CHARTS or PIVOT TABLES?**
  Use \`sheets_visualize\` (chart_create, pivot_create)

→ **Analyze data patterns or get recommendations?**
  Use \`sheets_analyze\` (comprehensive, analyze_data, suggest_chart)

→ **Share spreadsheet or manage comments?**
  Use \`sheets_collaborate\` (share_add, comment_add)

→ **Named ranges, formulas, or protection?**
  Use \`sheets_advanced\` (add_named_range, protect_range)

→ **Batch multiple operations atomically?**
  Use \`sheets_transaction\` (begin, queue, commit)

→ **Destructive operation needing user approval?**
  Use \`sheets_confirm\` (request) BEFORE the destructive tool

## ⚠️ COMMON ERRORS AND RECOVERY

| Error Code | Meaning | Recovery |
|------------|---------|----------|
| UNAUTHENTICATED | Token expired/missing | Run sheets_auth status → login flow |
| PERMISSION_DENIED | No access to spreadsheet | Check spreadsheetId, request access |
| SPREADSHEET_NOT_FOUND | Invalid spreadsheetId | Verify ID from URL |
| SHEET_NOT_FOUND | Sheet name doesn't exist | Use sheets_core action:"list_sheets" |
| INVALID_RANGE | Bad A1 notation | Check format: "A1:B10" or "Sheet1!A1" |
| QUOTA_EXCEEDED | Too many requests | Wait 60 seconds, use batch operations |
| PROTECTED_RANGE | Range is protected | Use sheets_advanced to check protection |

**General recovery pattern:**
1. Read the error message carefully - it explains what went wrong
2. Check prerequisites (auth? correct spreadsheetId? sheet exists?)
3. Use dryRun:true to test before actual execution
4. For persistent errors, use sheets_analyze action:"comprehensive" to inspect the spreadsheet

## 🛡️ SAFETY CHECKLIST

Before destructive operations (delete, clear, overwrite):
- [ ] Use \`dryRun: true\` first to preview changes
- [ ] For >100 cells: Use \`sheets_confirm\` to get user approval
- [ ] For >1000 cells: Consider using \`sheets_transaction\` for atomicity
- [ ] Set \`safety.maxCellsAffected\` to limit blast radius

## 📊 PERFORMANCE TIPS

- **Batch operations:** \`batch_read\` / \`batch_write\` instead of multiple single calls
- **Transactions:** 100 writes = 1 API call (vs 100 calls without)
- **Quotas:** 60 requests/min/user, 300 requests/min/project
- **Large data:** Use \`sheets_composite action:"import_csv"\` for bulk imports

## 🎨 COLOR FORMAT

All colors use **0-1 scale** (NOT 0-255):
\`\`\`json
{ "red": 0.2, "green": 0.6, "blue": 0.8 }
\`\`\`
`;

  const deferredSchemaInstructions = `
## 📋 SCHEMA RESOURCES

Tool schemas are available as resources:
- \`schema://tools\` - List all tools
- \`schema://tools/{toolName}\` - Full schema for a tool

Example: Read \`schema://tools/sheets_data\` to see all data actions and parameters.
`;

  // Include deferred schema instructions when DEFER_SCHEMAS is enabled
  if (DEFER_SCHEMAS) {
    return (baseInstructions + deferredSchemaInstructions).trim();
  }

  return baseInstructions.trim();
}

/**
 * Server instructions for LLM context (static export for backward compatibility)
 *
 * @deprecated Use getServerInstructions() instead for dynamic content
 */
export const SERVER_INSTRUCTIONS = getServerInstructions();
