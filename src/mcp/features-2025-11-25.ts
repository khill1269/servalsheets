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
 * - tools: TOOL_COUNT tools with ACTION_COUNT actions (current consolidated set)
 * - resources: 3 URI templates + 28 registered resources
 * - prompts: 38 guided workflows for common operations
 * - completions: Argument autocompletion for prompts/resources
 * - tasks: Background execution with TaskStoreAdapter (SEP-1686)
 * - logging: Dynamic log level control via logging/setLevel handler
 *
 * CLIENT-SIDE CAPABILITIES (checked, not declared):
 * - elicitation (SEP-1036): sheets_confirm checks clientCapabilities.elicitation
 * - sampling (SEP-1577): sheets_analyze checks clientCapabilities.sampling
 * Note: These are CLIENT capabilities per MCP spec — the server sends requests,
 * the client declares support. No ServerCapabilities declaration needed.
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
 * - SEP-973 Icons (SVG icons for 16 tools; icon set is partial)
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
  sheets_templates: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIi8+PHJlY3QgeD0iMTMiIHk9IjMiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIi8+PHJlY3QgeD0iMyIgeT0iMTMiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIi8+PHJlY3QgeD0iMTMiIHk9IjEzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMSIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_bigquery: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iNiIgcj0iMi41Ii8+PGNpcmNsZSBjeD0iNyIgY3k9IjEzIiByPSIyLjUiLz48Y2lyY2xlIGN4PSIxNyIgY3k9IjEzIiByPSIyLjUiLz48cGF0aCBkPSJNMTEuNSA4LjVMMTAgMTAuNW0xIDAtMy41LjVMMTAgMTAuNW0wIDAgMy41LjVNMTIgOXY0Ii8+PC9zdmc+',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_appsscript: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDMgMTIgNiAxNSAzIi8+PHBhdGggZD0iTTkgOCAxMiAxMSAxNSA4Ii8+PHBhdGggZD0iTTkgMTMgMTIgMTYgMTUgMTMiLz48cGF0aCBkPSJNOSAxOCAxMiAyMSAxNSAxOCIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_webhook: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjQiIGN5PSI4IiByPSIyIi8+PHBhdGggZD0iTTYuNSA5LjVsOC41IC41Ii8+PGNpcmNsZSBjeD0iMjAiIGN5PSI4IiByPSIyIi8+PHBhdGggZD0iTTYgMTZoMTJ2MyIvPjxwYXRoIGQ9Ik0xMiAxMnYzIi8+PC9zdmc+',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_dependencies: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjMiIGN5PSI2IiByPSIyIi8+PGNpcmNsZSBjeD0iMjEiIGN5PSI2IiByPSIyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxOCIgcj0iMiIvPjxwYXRoIGQ9Ik01IDE4bDcgLTEwIi8+PHBhdGggZD0iTTE5IDE4bC03IC0xMCIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_federation: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iNCIgcj0iMiIvPjxjaXJjbGUgY3g9IjQiIGN5PSIxMiIgcj0iMiIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMTIiIHI9IjIiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjIwIiByPSIyIi8+PGxpbmUgeDE9IjEyIiB5MT0iNiIgeDI9IjEyIiB5Mj0iMTgiLz48bGluZSB4MT0iNi40IiB5MT0iMTAuNCIgeDI9IjEwLjQiIHkyPSI2LjQiLz48bGluZSB4MT0iMTcuNiIgeTE9IjEwLjQiIHgyPSIxMy42IiB5Mj0iNi40Ii8+PGxpbmUgeDE9IjYuNCIgeTE9IjEzLjYiIHgyPSIxMC40IiB5Mj0iMTcuNiIvPjxsaW5lIHgxPSIxNy42IiB5MT0iMTMuNiIgeDI9IjEzLjYiIHkyPSIxNy42Ii8+PC9zdmc+',
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
  sheets_collaborate: { taskSupport: 'optional' },
  sheets_advanced: { taskSupport: 'forbidden' },
  sheets_transaction: { taskSupport: 'forbidden' },
  sheets_quality: { taskSupport: 'forbidden' },
  sheets_history: { taskSupport: 'optional' },
  sheets_confirm: { taskSupport: 'forbidden' },
  sheets_fix: { taskSupport: 'optional' },
  sheets_session: { taskSupport: 'forbidden' },

  // Tier 7: Enterprise tools - potentially long-running, task support enabled
  sheets_appsscript: { taskSupport: 'optional' },
  sheets_bigquery: { taskSupport: 'optional' },
  sheets_templates: { taskSupport: 'optional' },
  sheets_webhook: { taskSupport: 'forbidden' },
  sheets_dependencies: { taskSupport: 'optional' },
  sheets_federation: { taskSupport: 'optional' }, // Network calls to remote MCP servers
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
 * CLIENT CAPABILITIES (not declared by server — this is correct per MCP spec):
 * - elicitation (SEP-1036): Client declares support; server checks before sending requests
 * - sampling (SEP-1577): Client declares support; server checks before sending requests
 *
 * ARCHITECTURAL NOTE:
 * Sampling and elicitation are CLIENT capabilities in MCP 2025-11-25.
 * The server sends sampling/createMessage and elicitation/create requests,
 * and the client declares it can handle them. See checkSamplingSupport()
 * and checkElicitationSupport() in sampling.ts and elicitation.ts.
 */
export function createServerCapabilities(): ServerCapabilities {
  return {
    // Task support (MCP 2025-11-25 standard capability)
    // Tools with taskSupport: 'optional'/'required' can be invoked with task mode
    // Registered via server.experimental.tasks.registerToolTask() SDK API
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

    // Completions support — argument autocompletion for tools (MCP 2025-11-25)
    // Required when server handles completion/complete requests.
    // ServalSheets completes spreadsheetId and action arguments.
    completions: {},

    // Extensions framework (MCP 2025-11-25)
    // Declares non-standard experimental capabilities the server supports.
    // Currently empty — all ServalSheets capabilities use standard spec fields.
    // Add entries here when adopting future experimental MCP features.
    experimental: {},

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

## 🔄 WORKFLOW CHAIN

**Optimal sequence:** session.set_active → analyze.scout → plan → quality.validate (if >100 cells) → execute (batch/transaction for 3+ ops) → history.undo if needed

## 📊 TOOL SELECTION DECISION TREE (What to Use?)

**Reading data?**
├─ 1-2 ranges → \`sheets_data.read\`
├─ 3+ ranges → \`sheets_data.batch_read\` (same API cost as single read!)
├─ Need structure info only → \`sheets_analyze.scout\` (no data, just metadata)
└─ Need data from multiple spreadsheets → \`sheets_data.cross_read\` / \`cross_query\`

**Writing data?**
├─ Update existing cells at KNOWN positions → \`sheets_data.write\` (always prefer this)
├─ Replace pattern across UNKNOWN positions → \`sheets_data.find_replace\` (pattern-based only!)
├─ Add rows at bottom → \`sheets_data.append\` (WARNING: NOT idempotent!)
├─ 3+ ranges → \`sheets_data.batch_write\` (70% faster)
├─ Match by column headers → \`sheets_composite.smart_append\`
└─ Import CSV file → \`sheets_composite.import_csv\`

⚠️ **COMMON MISTAKE**: Do NOT use \`find_replace\` when you know the cell address. Use \`write\` instead. \`find_replace\` scans the entire range for a pattern — it is slow and non-deterministic for targeted updates.

**Formatting cells?**
├─ 1-2 format changes → Specific action (set_background, set_text_format, etc.)
├─ 3+ format changes → \`sheets_format.batch_format\` (1 API call for ALL)
├─ Quick preset → \`sheets_format.apply_preset\` (header_row, currency, percentages)
└─ New sheet + formatting → \`sheets_composite.setup_sheet\` (2 API calls total)

**Rows & columns?**
├─ Insert/delete rows or columns → \`sheets_dimensions\` (insert, delete, with dimension:"ROWS" or "COLUMNS")
├─ Resize, hide, freeze → \`sheets_dimensions\` (resize, hide, show, freeze)
├─ Sort or filter data → \`sheets_dimensions\` (sort_range, set_basic_filter, create_filter_view)
└─ Auto-fit column widths → \`sheets_dimensions.auto_resize\`

**Managing sheets?**
├─ Create → \`sheets_core.add_sheet\` or \`sheets_composite.setup_sheet\` (with formatting)
├─ Delete → \`sheets_core.delete_sheet\` (⚠️ check sheets_dependencies analyze_impact first!)
├─ Copy structure → \`sheets_core.duplicate_sheet\`
└─ Apply template → \`sheets_templates.apply\`

**Sharing & collaboration?**
├─ Share spreadsheet → \`sheets_collaborate share_add\` / share_update / share_remove
├─ Comments → \`sheets_collaborate comment_add\` / comment_list / comment_resolve
└─ Version history → \`sheets_collaborate version_list_revisions\`

**Enterprise & automation?**
├─ BigQuery integration → \`sheets_bigquery\` (connect, query, import_from_bigquery)
├─ Apps Script → \`sheets_appsscript\` (run scripts, deploy, trigger management)
├─ Webhooks → \`sheets_webhook\` (register, watch_changes, trigger notifications)
├─ Templates → \`sheets_templates\` (list, apply, create reusable patterns)
└─ Federation → \`sheets_federation\` (call_remote, list_servers, cross-service workflows)

**Large datasets (>10K rows)?**
├─ Use \`sheets_data.batch_read\` with pagination (cursor-based)
├─ Use \`sheets_bigquery\` for SQL queries on connected data
├─ Use \`sheets_composite.export_large_dataset\` for exports
└─ Use \`sheets_transaction\` for bulk writes (80-95% fewer API calls)

**Checking dependencies before changes?**
├─ Impact analysis → \`sheets_dependencies analyze_impact\` (what breaks if I change this?)
├─ Formula graph → \`sheets_dependencies build\` (see all formula relationships)
├─ Circular refs → \`sheets_dependencies detect_cycles\`
└─ What-if analysis → \`sheets_dependencies model_scenario\` (revenue drops 20%? trace all cascading effects)

**Undo or audit changes?**
├─ View recent operations → \`sheets_history list\`
├─ Undo last change → \`sheets_history undo\`
├─ Redo → \`sheets_history redo\`
├─ Revert to specific point → \`sheets_history revert_to\`
└─ When did data change? → \`sheets_history timeline\` (per-cell change history across sessions)

**Cleaning data?**
├─ Auto-detect & fix issues → \`sheets_fix.clean\` (preview first with mode:"preview")
├─ Standardize formats → \`sheets_fix.standardize_formats\` (dates, currencies, phones)
├─ Fill empty cells → \`sheets_fix.fill_missing\` (forward, backward, mean, median)
├─ Find outliers → \`sheets_fix.detect_anomalies\`
└─ Get AI recommendations → \`sheets_fix.suggest_cleaning\`

**Creating a new spreadsheet from scratch?**
├─ From a description → \`sheets_composite.generate_sheet\` ("Q1 budget tracker")
├─ Preview first → \`sheets_composite.preview_generation\`
├─ Save as template → \`sheets_composite.generate_template\`
└─ Manual setup → \`sheets_composite.setup_sheet\`

**Investigating changes over time?**
├─ When did data change? → \`sheets_history.timeline\`
├─ Compare two revisions → \`sheets_history.diff_revisions\`
├─ Restore specific cells → \`sheets_history.restore_cells\` (surgical, not full revision)
└─ Undo last operation → \`sheets_history.undo\`

**What-if analysis?**
├─ Model a scenario → \`sheets_dependencies.model_scenario\` (traces formula cascade)
├─ Compare scenarios → \`sheets_dependencies.compare_scenarios\`
└─ Materialize as sheet → \`sheets_dependencies.create_scenario_sheet\`

**Want proactive suggestions?**
├─ Get ranked suggestions → \`sheets_analyze.suggest_next_actions\`
└─ Auto-apply safe improvements → \`sheets_analyze.auto_enhance\` (preview first)

**Want to understand a sheet completely?**
├─ Quick metadata → \`sheets_analyze.scout\` (1 call)
├─ Deep audit → scout → \`sheets_analyze.comprehensive\` → \`sheets_analyze.suggest_next_actions\`
├─ Formula health → \`sheets_analyze.analyze_formulas\` (includes upgrade opportunities)
└─ Architecture review → comprehensive → analyze_formulas → \`sheets_dependencies.build\`

**Want to upgrade legacy formulas?**
└─ \`sheets_analyze.analyze_formulas\` → check upgradeOpportunities → \`sheets_analyze.generate_formula\` per upgrade → \`sheets_data.write\`

**Building a dashboard?**
├─ Get chart recommendations → \`sheets_visualize.suggest_chart\`
├─ Create chart + sparklines → \`sheets_visualize.chart_create\` → \`sheets_format.sparkline_add\`
└─ Full dashboard → scout → suggest_chart → chart_create → sparkline_add → apply_preset

**5+ operations?**
├─ All formatting → \`sheets_format.batch_format\`
├─ Mixed operations → \`sheets_transaction\` (begin → queue → commit)
└─ Sheet from scratch → \`sheets_composite.setup_sheet\`

## ⚡ CRITICAL RULES (Avoid Common Mistakes)

1. **START with sheets_analyze** — For any new spreadsheet, ALWAYS call \`sheets_analyze action:"comprehensive"\` or \`action:"scout"\` FIRST. Gives you structure, data types, quality, and recommended actions. Prevents 70%+ of mistakes. Skip this = wasted effort.
2. **append is NOT idempotent** — Never retry on timeout. It will duplicate data.
3. **Always include sheet name** in ranges: \`"Sheet1!A1:D10"\` not \`"A1:D10"\`
4. **NEVER type emoji sheet names manually** — Always copy sheet names from \`sheets_core.list_sheets\` response. Emoji characters may look identical but have different Unicode (📊 U+1F4CA vs 📈 U+1F4C8). Quote sheet names with spaces or emoji: \`"'📊 Dashboard'!A1"\`
5. **Use 0-based indices** for insert/delete: row 1 = index 0
6. **batch_format max 100** operations per call
7. **Use verbosity:"minimal"** to save tokens when you don't need full response
8. **Use sheets_transaction for 5+ operations** — Saves 80-95% API calls and ensures atomicity. Example: Updating 50 rows = 1 transaction call instead of 50 individual writes. Don't use for 1-4 operations (overhead exceeds benefit)

## 🔁 ERROR RECOVERY

**Same error twice? STOP.** Read \`schema://tools/{toolName}\` or ask user for clarification. Never retry unchanged params.

**Key error patterns:**
- \`invalid_union\` on conditional format → Use \`add_conditional_format_rule\` with preset
- \`range is required\` → Use string \`"Sheet1!A1"\` not object \`{a1: "..."}\`
- Timeout on \`append\` → Don't retry (NOT idempotent, duplicates data)
- Timeout on \`auto_resize\` → Skip (non-critical)

**Auth: Max 2 login attempts.** If both fail, STOP and tell user (network/firewall/OAuth issue). Never attempt 3rd login — OAuth has built-in 3x retry. Use \`sheets_auth status\` to check state first.

**⚠️ DEBUG ARTIFACT WARNING:**
Never leave debug strings (e.g., "test123", task markers, "temp") in production cells. Always verify final values before completing operations.

## 💡 COMMON PATTERNS (Copy-Paste Ready)

**Pattern: Format a data table**
\`sheets_format.batch_format with [header_row preset, alternating_rows preset, auto_fit columns]\`

**Pattern: Add validated data safely**
\`sheets_quality.validate → sheets_data.append → sheets_analyze.scout (verify)\`

**Pattern: Build a dashboard**
\`sheets_composite.setup_sheet → sheets_data.write formulas → sheets_format.batch_format → sheets_visualize.chart_create\`

## 🔗 TOOL CHAINING (Multi-Step Workflows)

**Analysis → Fix workflow:**
\`sheets_analyze scout\` → \`sheets_analyze comprehensive\` → \`sheets_fix\` (auto-apply suggestions)

**Safe deletion workflow:**
\`sheets_dependencies analyze_impact\` → \`sheets_confirm request\` → \`sheets_core delete_sheet\`

**Data import workflow:**
\`sheets_composite import_csv\` → \`sheets_quality validate\` → \`sheets_format apply_preset\`

**Automation workflow:**
\`sheets_appsscript create\` → \`sheets_appsscript deploy\` → \`sheets_webhook register\`

**Data cleaning workflow:**
\`sheets_fix suggest_cleaning\` → \`sheets_fix clean mode:"preview"\` → \`sheets_fix clean mode:"apply"\`

**Scenario analysis workflow:**
\`sheets_dependencies build\` → \`sheets_dependencies model_scenario\` → \`sheets_dependencies create_scenario_sheet\`

**Time-travel investigation:**
\`sheets_history timeline\` → \`sheets_history diff_revisions\` → \`sheets_history restore_cells\`

**AI sheet generation:**
\`sheets_composite preview_generation\` → \`sheets_composite generate_sheet\` → \`sheets_analyze suggest_next_actions\`

**Full sheet audit:**
\`sheets_analyze scout\` → \`sheets_analyze comprehensive\` → \`sheets_analyze suggest_next_actions\` → review + apply top suggestions

**Formula modernization:**
\`sheets_analyze analyze_formulas\` → check upgradeOpportunities in response → \`sheets_analyze generate_formula\` per upgrade → \`sheets_data write\`

**Professional dashboard:**
\`sheets_analyze scout\` → \`sheets_visualize suggest_chart\` → \`sheets_visualize chart_create\` → \`sheets_format sparkline_add\` → \`sheets_format apply_preset\`

**Data relationship mapping:**
\`sheets_dependencies build\` → \`sheets_dependencies get_dependencies\` → \`sheets_analyze analyze_formulas\` → \`sheets_analyze detect_patterns\`

**Sheet architecture review:**
\`sheets_analyze comprehensive\` → \`sheets_composite setup_sheet\` → \`sheets_advanced add_protected_range\` → \`sheets_composite clone_structure\`

**Cross-sheet analysis:**
\`sheets_data cross_read\` → \`sheets_analyze comprehensive\` → \`sheets_data cross_compare\` → \`sheets_analyze suggest_next_actions\`

## ❌ ANTI-PATTERNS (What NOT to Do)

- Don't use transactions for single operations — overhead exceeds benefit for <5 ops
- Don't read entire sheet when you only need a few cells — use specific ranges
- Don't retry append on timeout — it's NOT idempotent, you'll duplicate data
- Don't skip sheets_analyze before complex operations — 70%+ of mistakes are preventable
- Don't hardcode sheet names — always get from list_sheets (emoji/unicode issues)

## 📐 FORMULA EXPERTISE

Quick formula tips for common spreadsheet tasks:
- Lookup: Use INDEX/MATCH instead of VLOOKUP for flexible column references
- Conditional sums: SUMIFS for multi-criteria, SUMPRODUCT for arrays
- Dynamic ranges: Use OFFSET+COUNTA or structured table references
- Error handling: IFERROR wraps, ISBLANK for empty checks
- Use \`sheets_analyze generate_formula\` to build complex formulas from natural language
- Use \`sheets_analyze analyze_formulas\` to detect formula upgrade opportunities (VLOOKUP→XLOOKUP, nested IF→IFS, etc.)

## ⚠️ GOOGLE SHEETS API LIMITATIONS

These operations are NOT possible or limited via the REST API v4:
- **Data bars**: Conditional formatting only supports BooleanRule and GradientRule. Use \`=SPARKLINE(data, {"charttype","bar"})\` formulas instead.
- **Print setup**: Page orientation, margins, headers/footers require Apps Script (PageSetup). Use \`sheets_appsscript\` to configure.
- **LAMBDA**: Not available on Frontline, Nonprofits, or legacy G Suite tiers. Use named ranges with regular formulas as fallback.
- **XLOOKUP**: Lookup range must be a single row or single column. For matrix lookups, use INDEX/MATCH.
- **Revision content export**: Google Drive API returns metadata for Workspace files, not cell-level historical content. Use \`sheets_history.timeline\` for per-cell change tracking.

## 🤝 COLLABORATIVE WORKFLOW

For multi-step operations that affect shared spreadsheets:
1. Gather requirements from the user (what data, which sheets, what format)
2. Plan execution steps (use sheets_analyze scout to understand current state)
3. Wait for user approval before destructive operations (use sheets_confirm)
4. Execute with safety checks (dryRun first, then actual execution)
5. Verify results and report back (use sheets_analyze to confirm changes)

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

## 💰 QUOTA & MONITORING

Quotas: 60 req/min/user, 300 req/min/project. Check \`_meta.quotaStatus\` in responses — if low, use batch/transaction ops.
Check \`sheets_session action:"get_alerts"\` every 10-15 operations for quality drops, formula errors, or quota warnings.

## 🎨 COLOR FORMAT

All colors use **0-1 scale** (NOT 0-255):
\`\`\`json
{ "red": 0.2, "green": 0.6, "blue": 0.8 }
\`\`\`

## 📚 RESOURCE DISCOVERY

- Read \`servalsheets://index\` to discover all available resources and their URIs
- Read \`schema://tools/{name}\` before calling tools with complex parameters
- Read \`sheets:///{spreadsheetId}/context\` for full structural metadata (sheets, charts, named ranges, protection, filters — 1 API call, no cell data)
- Search \`knowledge:///search?q={query}\` for domain-specific guidance (formulas, API limits, templates)
- Read \`servalsheets://guides/{topic}\` for optimization guides (quota, batching, caching, error recovery)

## 🛡️ DATA QUALITY

- Run \`sheets_quality action:"validate"\` before bulk writes to catch type mismatches and missing fields
- Use \`sheets_analyze action:"scout"\` for quick overview (1 API call), \`action:"comprehensive"\` for deep analysis (2 calls)
- Always use \`sheets_confirm action:"request"\` before destructive multi-sheet operations (delete, clear, bulk overwrite)
- After large writes, check \`sheets_session action:"get_alerts"\` for quality regressions
`;

  const deferredSchemaInstructions = `
## 📋 SCHEMA RESOURCES (IMPORTANT)

**Tool schemas are deferred to save tokens.** Before calling a tool with complex parameters,
read its full schema resource to see all available actions and parameters:

- \`schema://tools\` - Index of all ${TOOL_COUNT} tools
- \`schema://tools/{toolName}\` - Full input/output schema for a specific tool

**When to read schemas:**
- First time using a tool in this conversation
- When you need to know which actions are available
- When you get validation errors (check required fields)

Example: Read \`schema://tools/sheets_data\` before your first sheets_data call.
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
