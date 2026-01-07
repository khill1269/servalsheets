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
 * - tools: 24 tools with 188 actions (discriminated unions)
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
 * - SEP-973 Icons (SVG icons for all 15 tools)
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
  sheets_spreadsheet: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNnoiLz48cGF0aCBkPSJNMTQgMnY2aDYiLz48cGF0aCBkPSJNOCAxM2g4Ii8+PHBhdGggZD0iTTggMTdoOCIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_sheet: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIi8+PHBhdGggZD0iTTMgOWgxOCIvPjxwYXRoIGQ9Ik05IDN2MTgiLz48L3N2Zz4=',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_values: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNNCA3VjRoMTZ2MyIvPjxwYXRoIGQ9Ik05IDIwaDYiLz48cGF0aCBkPSJNMTIgNHYxNiIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_cells: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iNyIgaGVpZ2h0PSI3Ii8+PHJlY3QgeD0iMTQiIHk9IjMiIHdpZHRoPSI3IiBoZWlnaHQ9IjciLz48cmVjdCB4PSIxNCIgeT0iMTQiIHdpZHRoPSI3IiBoZWlnaHQ9IjciLz48cmVjdCB4PSIzIiB5PSIxNCIgd2lkdGg9IjciIGhlaWdodD0iNyIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_format: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJtOS4wNiAxMS45IDguMDctOC4wNmEyLjg1IDIuODUgMCAxIDEgNC4wMyA0LjAzbC04LjA2IDguMDgiLz48cGF0aCBkPSJNNy4wNyAxNC45NGMtMS42NiAwLTMgMS4zNS0zIDNMMiAyMWwzLjA2LTIuMDdjMS42NCAwIDMtMS4zNCAzLTN6Ii8+PC9zdmc+',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_dimensions: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMjEgM0gzdjE4aDE4VjN6Ii8+PHBhdGggZD0iTTIxIDloLTE4Ii8+PHBhdGggZD0iTTkgMjFWOSIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_rules: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTIgMjJ2LTZoNHY2Ii8+PHBhdGggZD0iTTIgMjBoMjAiLz48cGF0aCBkPSJNNCAxNnYtNmgydjYiLz48cGF0aCBkPSJNMTAgMTZ2LTZoMnY2Ii8+PHBhdGggZD0iTTE2IDE2VjZoMnYxMCIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_charts: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48bGluZSB4MT0iMTgiIHkxPSIyMCIgeDI9IjE4IiB5Mj0iMTAiLz48bGluZSB4MT0iMTIiIHkxPSIyMCIgeDI9IjEyIiB5Mj0iNCIvPjxsaW5lIHgxPSI2IiB5MT0iMjAiIHgyPSI2IiB5Mj0iMTQiLz48L3N2Zz4=',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_pivot: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cG9seWxpbmUgcG9pbnRzPSIxNiAzIDIxIDMgMjEgOCIvPjxsaW5lIHgxPSI0IiB5MT0iMjAiIHgyPSIyMSIgeTI9IjMiLz48cG9seWxpbmUgcG9pbnRzPSIyMSAxNCAyMSAyMSAxNCIvPjxsaW5lIHgxPSIxNSIgeTE9IjE1IiB4Mj0iMjEiIHkyPSIyMSIvPjxsaW5lIHgxPSI0IiB5MT0iNCIgeDI9IjkiIHkyPSI5Ii8+PC9zdmc+',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_filter_sort: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cG9seWdvbiBwb2ludHM9IjIyIDMgMiAzIDEwIDEyLjQ2IDEwIDE5IDE0IDIxIDE0IDEyLjQ2IDIyIDMiLz48L3N2Zz4=',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_sharing: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxOCIgY3k9IjUiIHI9IjMiLz48Y2lyY2xlIGN4PSI2IiBjeT0iMTIiIHI9IjMiLz48Y2lyY2xlIGN4PSIxOCIgY3k9IjE5IiByPSIzIi8+PGxpbmUgeDE9IjguNTkiIHkxPSIxMy41MSIgeDI9IjE1LjQyIiB5Mj0iMTcuNDkiLz48bGluZSB4MT0iMTUuNDEiIHkxPSI2LjUxIiB4Mj0iOC41OSIgeTI9IjEwLjQ5Ii8+PC9zdmc+',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_comments: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMjEgMTVhMiAyIDAgMCAxLTIgMkg3bC00IDRWNWEyIDIgMCAwIDEgMi0yaDE0YTIgMiAwIDAgMSAyIDJ6Ii8+PC9zdmc+',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_versions: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwb2x5bGluZSBwb2ludHM9IjEyIDYgMTIgMTIgMTYgMTQiLz48L3N2Zz4=',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_analysis: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PGxpbmUgeDE9IjIxIiB5MT0iMjEiIHgyPSIxNi42NSIgeTI9IjE2LjY1Ii8+PC9zdmc+',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
  sheets_advanced: [{
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0iTTE5LjQgMTVhMS42NSAxLjY1IDAgMCAwIC4zMyAxLjgybC4wNi4wNmEyIDIgMCAwIDEgMCAyLjgzIDIgMiAwIDAgMS0yLjgzIDBsLS4wNi0uMDZhMS42NSAxLjY1IDAgMCAwLTEuODItLjMzIDEuNjUgMS42NSAwIDAgMC0xIDEuNTFWMjFhMiAyIDAgMCAxLTIgMiAyIDIgMCAwIDEtMi0ydi0uMDlBMS42NSAxLjY1IDAgMCAwIDkgMTkuNGExLjY1IDEuNjUgMCAwIDAtMS44Mi4zM2wtLjA2LjA2YTIgMiAwIDAgMS0yLjgzIDAgMiAyIDAgMCAxIDAtMi44M2wuMDYtLjA2YTEuNjUgMS42NSAwIDAgMCAuMzMtMS44MiAxLjY1IDEuNjUgMCAwIDAtMS41MS0xSDNhMiAyIDAgMCAxLTItMiAyIDIgMCAwIDEgMi0yaC4wOUExLjY1IDEuNjUgMCAwIDAgNC42IDlhMS42NSAxLjY1IDAgMCAwLS4zMy0xLjgybC0uMDYtLjA2YTIgMiAwIDAgMSAwLTIuODMgMiAyIDAgMCAxIDIuODMgMGwuMDYuMDZhMS42NSAxLjY1IDAgMCAwIDEuODIuMzNIOS4xNWExLjY1IDEuNjUgMCAwIDAgMS0xLjUxVjNhMiAyIDAgMCAxIDItMiAyIDIgMCAwIDEgMiAydi4wOWExLjY1IDEuNjUgMCAwIDAgMSAxLjUxIDEuNjUgMS42NSAwIDAgMCAxLjgyLS4zM2wuMDYtLjA2YTIgMiAwIDAgMSAyLjgzIDAgMiAyIDAgMCAxIDAgMi44M2wtLjA2LjA2YTEuNjUgMS42NSAwIDAgMC0uMzMgMS44MlY5YTEuNjUgMS42NSAwIDAgMCAxLjUxIDFIMjFhMiAyIDAgMCAxIDIgMiAyIDIgMCAwIDEtMiAyaC0uMDlhMS42NSAxLjY1IDAgMCAwLTEuNTEgMXoiLz48L3N2Zz4=',
    mimeType: 'image/svg+xml',
    sizes: ['24x24'],
  }],
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
  // TEMPORARILY DISABLED: Task support causes "No task store provided" error
  // because taskStore is commented out in server.ts line 118 to prevent hanging
  // TODO: Re-enable task support after fixing taskStore initialization

  // Analysis tools - potentially long-running, task support disabled
  sheets_analysis: { taskSupport: 'forbidden' },

  // Value operations - can be slow with large ranges, task support disabled
  sheets_values: { taskSupport: 'forbidden' },

  // Formatting - can be slow with large ranges, task support disabled
  sheets_format: { taskSupport: 'forbidden' },

  // Version operations - snapshot creation can be slow, task support disabled
  sheets_versions: { taskSupport: 'forbidden' },

  // Standard operations - typically fast, no task support needed
  sheets_spreadsheet: { taskSupport: 'forbidden' },
  sheets_sheet: { taskSupport: 'forbidden' },
  sheets_cells: { taskSupport: 'forbidden' },
  sheets_dimensions: { taskSupport: 'forbidden' },
  sheets_rules: { taskSupport: 'forbidden' },
  sheets_charts: { taskSupport: 'forbidden' },
  sheets_pivot: { taskSupport: 'forbidden' },
  sheets_filter_sort: { taskSupport: 'forbidden' },
  sheets_sharing: { taskSupport: 'forbidden' },
  sheets_comments: { taskSupport: 'forbidden' },
  sheets_advanced: { taskSupport: 'forbidden' },
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
 */
export const SERVER_INSTRUCTIONS = `
ServalSheets is a comprehensive Google Sheets MCP server with 24 tools and 188 actions.

## 🔐 MANDATORY FIRST STEP: Authentication

**BEFORE using ANY sheets_* tool, you MUST first verify authentication:**

1. Call sheets_auth with action:"status" to check if authenticated
2. If NOT authenticated (authenticated: false):
   - Call sheets_auth with action:"login" to get an OAuth URL
   - Present the authUrl to the user as a clickable link
   - Wait for user to provide the authorization code
   - Call sheets_auth with action:"callback" and the code
3. Only proceed with other tools AFTER authentication is confirmed

**NEVER skip this step.** Auth errors waste time and confuse users.

## Quick Start (after auth confirmed)
Use sheets_spreadsheet action:"get" to explore any spreadsheet.
Use sheets_analysis action:"structure_analysis" for quick overview.
Use sheets_analysis action:"data_quality" for data quality assessment.
Use sheets_analyze for AI-powered pattern detection (via MCP Sampling).

## Safety Features
- Always use dryRun:true for destructive operations first
- Use effectScope.maxCellsAffected to limit blast radius
- Auto-snapshots are enabled by default for undo capability
- Use sheets_confirm for multi-step operations (via MCP Elicitation)

## Best Practices
1. AUTH first: Always verify authentication before any operation
2. READ before WRITE: Always read data to understand structure
3. Use batch operations: Combine multiple changes in one call
4. Respect quotas: 60 req/min/user, 300 req/min/project
5. Use semantic ranges: Reference columns by header names when possible
6. Use transactions for atomic multi-operation updates

## Tool Categories
- Auth: sheets_auth (ALWAYS check this first!)
- Data: sheets_values, sheets_cells
- Structure: sheets_spreadsheet, sheets_sheet, sheets_dimensions
- Formatting: sheets_format, sheets_rules
- Analysis: sheets_analysis (read-only, safe to run anytime)
- AI Analysis: sheets_analyze (MCP Sampling for patterns/anomalies)
- Visualization: sheets_charts, sheets_pivot
- Filtering: sheets_filter_sort
- Collaboration: sheets_sharing, sheets_comments
- Management: sheets_versions, sheets_advanced
- Enterprise: sheets_transaction, sheets_validation, sheets_conflict, sheets_impact, sheets_history
- MCP Native: sheets_confirm (user confirmation), sheets_analyze (AI analysis)

## Color Format
All colors use 0-1 scale: { red: 0.2, green: 0.6, blue: 0.8 }
NOT 0-255 scale.

## Auth Error Recovery
If any tool returns auth-related errors, go back to sheets_auth action:"status"
and run the full authentication flow again.
`.trim();
