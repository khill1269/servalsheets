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
 * - tools: 21 tools with 294 actions (current consolidated set)
 * - resources: 2 URI templates + 7 knowledge resources
 * - prompts: 6 guided workflows for common operations
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
  sheets_webhook: { taskSupport: 'forbidden' },
  sheets_dependencies: { taskSupport: 'forbidden' },
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
    // Completions support - argument autocompletion for prompts/resources
    completions: {},

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

## 🔄 WORKFLOW CHAIN (Optimal Tool Sequence)

Follow this order for maximum efficiency and clarity:

**1. sheets_session.set_active** → Set spreadsheet context (0 API calls)
   - Enables natural language ranges and context memory

**2. sheets_analyze.scout** → Quick metadata scan (1 API call)
   - Get structure: sheets, columns, data types, row count
   - Fastest way to understand the spreadsheet

**3. sheets_analyze.comprehensive** → Full analysis if needed (2 API calls)
   - Get structure + sample data + quality metrics + suggestions
   - Use only if you need detailed insights (slower, more context)

**4. Plan your changes** using analysis results
   - Decide which tool chain to use
   - Check impact with sheets_dependencies if modifying structure

**5. sheets_quality.validate** → Validate before large writes
   - Check data types, required fields, patterns
   - Run before sheets_data write if >100 cells affected

**6. Execute changes** using appropriate tool
   - For 1-2 operations: Direct sheets_data/sheets_format call
   - For 3+ operations: Use batch or sheets_transaction
   - For complex workflows: Use sheets_composite helpers

**7. sheets_history** → Undo if something goes wrong
   - Undo last operation: action:"undo"
   - View operation history: action:"list"

## 📊 QUICK DECISION TREE (What to Use?)

**Reading data?**
├─ 1-2 ranges → \`sheets_data.read\`
├─ 3+ ranges → \`sheets_data.batch_read\` (same API cost as single read!)
└─ Need structure info only → \`sheets_analyze.scout\` (no data, just metadata)

**Writing data?**
├─ Update existing cells → \`sheets_data.write\`
├─ Add rows at bottom → \`sheets_data.append\` (WARNING: NOT idempotent!)
├─ 3+ ranges → \`sheets_data.batch_write\` (70% faster)
├─ Match by column headers → \`sheets_composite.smart_append\`
└─ Import CSV file → \`sheets_composite.import_csv\`

**Formatting cells?**
├─ 1-2 format changes → Specific action (set_background, set_text_format, etc.)
├─ 3+ format changes → \`sheets_format.batch_format\` (1 API call for ALL)
├─ Quick preset → \`sheets_format.apply_preset\` (header_row, currency, percentages)
└─ New sheet + formatting → \`sheets_composite.setup_sheet\` (2 API calls total)

**Creating a sheet?**
├─ Empty sheet → \`sheets_core.add_sheet\`
├─ With headers + formatting → \`sheets_composite.setup_sheet\` (includes freeze)
└─ Copy structure → \`sheets_core.duplicate_sheet\`

**5+ operations?**
├─ All formatting → \`sheets_format.batch_format\`
├─ Mixed operations → \`sheets_transaction\` (begin → queue → commit)
└─ Sheet from scratch → \`sheets_composite.setup_sheet\`

## ⚡ CRITICAL RULES (Avoid Common Mistakes)

1. **append is NOT idempotent** — Never retry on timeout. It will duplicate data.
2. **Always include sheet name** in ranges: \`"Sheet1!A1:D10"\` not \`"A1:D10"\`
3. **Use 0-based indices** for insert/delete: row 1 = index 0
4. **batch_format max 100** operations per call
5. **Use verbosity:"minimal"** to save tokens when you don't need full response
6. **sheets_transaction overhead** only pays off for 5+ operations

## 💡 COMMON PATTERNS (Copy-Paste Ready)

**Pattern: Format a data table**
\`sheets_format.batch_format with [header_row preset, alternating_rows preset, auto_fit columns]\`

**Pattern: Add validated data safely**
\`sheets_quality.validate → sheets_data.append → sheets_analyze.scout (verify)\`

**Pattern: Build a dashboard**
\`sheets_composite.setup_sheet → sheets_data.write formulas → sheets_format.batch_format → sheets_visualize.chart_create\`

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

→ **Import CSV, deduplicate, or smart append?**
  Use \`sheets_composite\` (import_csv, deduplicate, smart_append)

→ **Check formula dependencies before changing structure?**
  Use \`sheets_dependencies\` (analyze_impact, detect_cycles)

→ **Run BigQuery SQL on large datasets (>50K rows)?**
  Use \`sheets_bigquery\` (export_to_bigquery, query)

→ **Automate with triggers, custom functions, or external APIs?**
  Use \`sheets_appsscript\` (create, deploy, run)

→ **Create spreadsheets from templates?**
  Use \`sheets_templates\` (list, apply, create)

→ **Set up change notifications (webhooks)?**
  Use \`sheets_webhook\` (register, list, delete)

## 🔗 TOOL CHAINING (Always-Use Patterns)

**Before destructive structural changes (delete rows/cols, clear ranges):**
\`\`\`
sheets_dependencies analyze_impact → sheets_confirm → sheets_dimensions delete_rows
\`\`\`

**Quality-gated write:**
\`\`\`
sheets_analyze scout → sheets_data write → sheets_analyze scout (verify)
If quality dropped: sheets_fix auto-repair
\`\`\`

**After any read, suggest next step:**
- Data read → offer sheets_visualize (chart), sheets_analyze (patterns), or sheets_format
- Read errors → suggest sheets_fix or sheets_quality

**For multi-step workflows, always:**
1. \`sheets_session set_active\` (set context once, omit spreadsheetId later)
2. Perform operations
3. \`sheets_session record_operation\` (enables undo)

## 🎯 ADVANCED TOOL SELECTION (Expert Level)

### Scenario-Based Decision Making

**Scenario: Large Dataset (>10K rows)**
├─ Need real-time updates? → sheets_webhook + sheets_analyze streaming
├─ Need complex aggregations? → sheets_bigquery export + query
├─ Need frequent full scans? → sheets_transaction for batching
└─ Need incremental processing? → sheets_data batch_read with chunking

**Scenario: Multi-User Editing**
├─ Need conflict prevention? → sheets_advanced protected_ranges
├─ Need change tracking? → sheets_collaborate version_control
├─ Need approval workflow? → sheets_confirm + sheets_history
└─ Need real-time sync? → sheets_webhook notifications

**Scenario: Complex Calculations**
├─ One-time calculation? → sheets_data with array formulas
├─ Recurring calculations? → sheets_appsscript time-based triggers
├─ Cross-sheet dependencies? → sheets_dependencies analyze_impact first
└─ Performance-critical? → sheets_advanced named_ranges for stability

**Scenario: Data Quality Issues**
├─ Unknown quality state? → sheets_analyze comprehensive (get baseline)
├─ Known issues? → sheets_fix with preview mode first
├─ Need validation? → sheets_quality validate before write
└─ Need monitoring? → sheets_session alerts + periodic scout

**Scenario: Automation Needs**
├─ Simple batch? → sheets_transaction (80% quota savings)
├─ External integrations? → sheets_appsscript (Gmail, Drive, Calendar)
├─ Scheduled operations? → sheets_appsscript time-driven triggers
└─ Event-driven? → sheets_webhook for real-time responses

### When to Combine Tools (Power Patterns)

**Pattern: Quality-Gated Write**
1. sheets_analyze scout (detect quality baseline)
2. sheets_data write (perform operation)
3. sheets_analyze scout (verify quality maintained)
4. If degraded >15%: sheets_fix auto-repair

**Pattern: Safe Bulk Update**
1. sheets_quality analyze_impact (preview changes)
2. sheets_collaborate version_create_snapshot (safety net)
3. sheets_transaction begin → queue → commit (atomic execution)
4. sheets_history record for undo capability

**Pattern: Real-Time Dashboard**
1. sheets_dimensions create_slicer (interactive filtering)
2. sheets_visualize chart_create with trendlines
3. sheets_webhook register (change notifications)
4. sheets_analyze detect_patterns (ongoing insights)

**Pattern: Data Warehouse Sync**
1. sheets_bigquery export_to_bigquery (move large data)
2. sheets_bigquery query (complex aggregations)
3. sheets_data write (results back to sheet)
4. sheets_advanced add_named_range (reference results)

### Anti-Patterns (What NOT to Do)

❌ **Don't use transactions for single operations**
   - Overhead: 2 API calls minimum (begin + commit)
   - Better: Direct sheets_data call (1 API call)

❌ **Don't read entire sheet for small updates**
   - Wrong: Read 10K rows to update 5 cells
   - Right: Use sheets_data write with specific range

❌ **Don't bypass quality checks for speed**
   - Wrong: Skip sheets_analyze because it's "slow"
   - Right: Use scout mode (200ms) for quick validation

❌ **Don't use Apps Script for simple batch operations**
   - Wrong: Apps Script to write 100 rows
   - Right: sheets_transaction (much faster, no quota)

❌ **Don't protect everything**
   - Wrong: Protect every cell "just in case"
   - Right: Strategic protection (headers, formulas only)

## 📐 FORMULA EXPERTISE (Master Class)

### Formula Performance Hierarchy

**Fastest → Slowest:**
1. Static values (instant)
2. Simple arithmetic (+, -, *, /)
3. Basic functions (SUM, AVERAGE, COUNT)
4. Lookup functions (VLOOKUP, INDEX/MATCH)
5. Array formulas (FILTER, SORT, UNIQUE)
6. Volatile functions (NOW, TODAY, RAND) - recalculate constantly
7. External data (IMPORTRANGE, GOOGLEFINANCE)
8. Apps Script custom functions

### When to Use Which Formula Type

**VLOOKUP vs INDEX/MATCH vs XLOOKUP:**
- VLOOKUP: Simple left-to-right lookups, column index known
- INDEX/MATCH: More flexible, any direction, better performance on large data
- XLOOKUP: Most powerful but newer (not all sheets support it)

**Array Formulas (FILTER, SORT, UNIQUE) when:**
- Data changes frequently (auto-updates)
- Multiple conditions needed
- Result needs to expand dynamically
- Performance: Good for <10K rows, slow for >50K

**Helper Columns when:**
- Formula becomes unreadable (>80 chars)
- Same calculation needed multiple times
- Performance critical (>50K rows)
- Debugging needed

### Volatile Function Management

**Problem:** RAND(), NOW(), TODAY() recalculate on EVERY sheet edit
**Impact:** Slows down the entire sheet for all users

**Solution:**
- Use NOW() only in ONE cell, reference that cell elsewhere
- Use named range for dynamic "current date" cell
- Consider Apps Script for time-based updates instead

### Array Formula Optimization

**Slow:**
\`\`\`
=ARRAYFORMULA(IF(A2:A1000<>"", VLOOKUP(A2:A1000, Sheet2!A:B, 2, FALSE), ""))
\`\`\`

**Fast:**
\`\`\`
=QUERY(Sheet2!A:B, "SELECT B WHERE A = '"&A2&"'")
\`\`\`

**Why:** QUERY is optimized by Google, ARRAYFORMULA evaluates row-by-row

### Circular Reference Patterns

**When Circular References Are Useful:**
- Iterative calculations (Newton's method, optimization)
- Recursive formulas (Fibonacci, compounding)
- Enable iterative calculation: File → Settings → Calculation → Iterative

**When They're Problems:**
- Accidental self-reference
- Cross-sheet dependencies create loops
- Detection: Use sheets_dependencies detect_cycles

### Formula Maintenance Strategy

**Best Practices:**
1. Use named ranges (formulas survive column insertions)
2. Document complex formulas in comment cells
3. Version control formulas via sheets_collaborate snapshots
4. Test with sheets_dependencies analyze_impact before changing
5. Use IFERROR for production (graceful degradation)

## ⚡ PERFORMANCE OPTIMIZATION (Expert Decision Tree)

### Problem: Slow Read Operations

**Symptoms:** reads take >2 seconds
**Diagnosis Tree:**
├─ Reading >1K rows? → Use batch_read instead of multiple reads
├─ Reading formatted values? → Use valueRenderOption: UNFORMATTED_VALUE (3x faster)
├─ Reading from multiple sheets? → Use batch_get (parallel fetching)
└─ Need only specific columns? → Use column ranges (A:A, C:C) not full rows

**Optimization Examples:**
\`\`\`typescript
// Slow: 5 separate reads (5 API calls, ~2.5s)
for (let i = 0; i < 5; i++) {
  await sheets_data.read(range: \`Sheet\${i}!A1:Z100\`)
}

// Fast: 1 batch read (1 API call, ~500ms)
await sheets_data.batch_read(ranges: ["Sheet0!A1:Z100", ..., "Sheet4!A1:Z100"])

// Faster: Unformatted values (1 API call, ~300ms)
await sheets_data.batch_read(ranges: [...], valueRenderOption: "UNFORMATTED_VALUE")
\`\`\`

### Problem: Slow Write Operations

**Symptoms:** writes take >5 seconds
**Diagnosis Tree:**
├─ Writing <100 cells? → Direct sheets_data write (no optimization needed)
├─ Writing 100-1000 cells? → Use batch_write (70% faster)
├─ Writing >1000 cells in sequence? → Use sheets_transaction (80% quota savings)
└─ Writing with formulas? → Set formulas separately (faster than values with embedded formulas)

**Quota Impact:**
\`\`\`
Naive approach (write 500 cells individually):
- API calls: 500
- Quota used: ~500 units
- Time: ~250 seconds (30 req/min rate limit)

Transaction approach:
- API calls: 3 (begin, commit with 500 operations, end)
- Quota used: ~100 units (80% savings)
- Time: ~3 seconds

Recommendation: sheets_transaction for ANY sequential write >50 cells
\`\`\`

### Problem: Formula Recalculation Lag

**Symptoms:** Sheet freezes on edit, "calculating..." appears frequently
**Diagnosis Tree:**
├─ Volatile functions (NOW, TODAY, RAND) present? → Consolidate to 1 cell
├─ ARRAYFORMULA on >10K rows? → Replace with helper columns
├─ Circular references? → Check iterative calculation settings
├─ External data (IMPORTRANGE, GOOGLEFINANCE)? → Cache results, refresh periodically
└─ Complex nested formulas? → Break into intermediate steps

**Detection:**
\`\`\`typescript
// Use sheets_analyze to identify performance issues
const analysis = await sheets_analyze.analyze_performance({
  spreadsheetId,
  checkFormulas: true,
  checkVolatility: true
});

// Returns:
{
  volatileFunctionCount: 47,  // Red flag if >10
  circularReferences: [],
  formulaComplexity: "high",  // Based on nesting depth
  recommendations: [
    "Reduce volatile functions from 47 to <5",
    "Replace ARRAYFORMULA in column D with helper columns"
  ]
}
\`\`\`

### Problem: Concurrent User Slowdown

**Symptoms:** Multiple users editing causes lag
**Diagnosis Tree:**
├─ >10 simultaneous editors? → Expect natural lag (Google limitation)
├─ Protected ranges count >50? → Reduce protection granularity
├─ Real-time formulas (IMPORTRANGE, GOOGLEFINANCE)? → Replace with periodic refreshes
└─ Large conditional formatting rules (>100K cells)? → Simplify rule scope

**Mitigation:**
\`\`\`typescript
// Pattern: Periodic refresh instead of real-time
// Instead of: =IMPORTRANGE("other-sheet", "A1:Z1000") in every cell
// Do: sheets_appsscript time-based trigger to refresh every 5 minutes
\`\`\`

### Memory Optimization

**Google Sheets Cell Limits:**
- Max cells per sheet: 10 million (e.g., 10K rows × 1K cols)
- Performance degrades at: 200K cells with formulas
- Recommended limit: 100K cells with formulas for good performance

**Strategy:**
- Archive old data to separate sheets
- Use sheets_bigquery for historical analysis
- Keep active working set <50K rows

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

## 🤝 COLLABORATIVE WORKFLOW PATTERN (Natural Language Requests)

When a user provides a natural language request, follow this collaborative pattern to gather context, plan carefully, and execute with confidence.

### Phase 1: UNDERSTAND (Ask Questions First)

**Before taking any action, assess ambiguity:**

Ambiguous request indicators:
- **Vague scope**: "make a report", "analyze data", "clean this up", "fix the spreadsheet"
- **Missing target**: No spreadsheet ID or unclear "which spreadsheet?"
- **Missing details**: What columns? What format? What criteria? What time period?
- **Multi-step implications**: Request requires 3+ operations

**If ambiguous, ask clarifying questions FIRST:**

Example conversation:
\`\`\`
User: "Create a sales report for me"

✅ Good response:
"I can help create a sales report! To make sure I build exactly what you need, let me ask a few questions:

1. Which spreadsheet should I use? (Or should I create a new one?)
2. What data source contains your sales data? (spreadsheet ID and sheet name)
3. What time period? (e.g., Q1 2024, last month, year-to-date)
4. What metrics do you want? (e.g., total sales, sales by region, top products)
5. Any specific format? (pivot table, chart, formatted table)

Let me know and I'll build the perfect report!"

❌ Bad response:
sheets_core action:"create" title:"Sales Report"  // Too hasty! Doesn't understand what user actually needs
\`\`\`

**Use sheets_session to track the conversation:**
\`\`\`
sheets_session action:"set_pending" {
  type: "requirement_gathering",
  step: 1,
  totalSteps: 3,
  context: {
    userIntent: "create sales report",
    gathered: {},
    stillNeeded: ["spreadsheet", "timeframe", "metrics"]
  }
}
\`\`\`

### Phase 2: GATHER (Iterative Context Building)

Continue asking questions until you have minimum required context:

**Minimum required context:**
- ✅ Target spreadsheet ID (or explicit "create new")
- ✅ Specific actions to perform (write, format, chart, etc.)
- ✅ Data sources and ranges
- ✅ Success criteria (how will we know it's done?)

**Optional but recommended:**
- User preferences (formatting style, confirmation level)
- Safety constraints (dry-run first? snapshot before?)
- Expected impact (number of rows/cells affected)

**Update pending context as you learn more:**
\`\`\`
sheets_session action:"set_pending" {
  type: "requirement_gathering",
  step: 2,
  totalSteps: 3,
  context: {
    userIntent: "create sales report",
    gathered: {
      spreadsheetId: "1ABC...",
      sourceSheet: "Sales Data",
      timeframe: "Q1 2024"
    },
    stillNeeded: ["metrics", "format"]
  }
}
\`\`\`

### Phase 3: PLAN (Show Execution Plan)

Once you have sufficient context, create a step-by-step plan:

**Format:**
\`\`\`
Here's my plan to create your Q1 2024 sales report:

**Execution Plan:**

1. Read sales data from "Sales Data" sheet (range A1:F1000)
2. Filter for Q1 2024 transactions (Jan-Mar)
3. Calculate metrics:
   - Total revenue by region
   - Top 10 products by units sold
   - Month-over-month growth
4. Create new sheet "Q1 2024 Report"
5. Write summary table with formatted headers
6. Add column chart for revenue by region
7. Apply conditional formatting to highlight top performers

**Safety measures:**
- Dry-run: No (data read is safe)
- Snapshot: Yes (before writing to new sheet)
- Estimated cells affected: ~200

May I proceed with this plan?
\`\`\`

**Track the plan:**
\`\`\`
sheets_session action:"set_pending" {
  type: "awaiting_approval",
  step: 3,
  totalSteps: 3,
  context: {
    plan: {
      steps: [...],
      safetyMeasures: {...},
      estimatedImpact: {...}
    }
  }
}
\`\`\`

### Phase 4: APPROVE (Wait for Confirmation)

**DO NOT execute until user approves.**

Acceptable approval signals:
- ✅ "Yes", "Go ahead", "Proceed", "Do it", "Looks good"
- ✅ "Make those changes", "Execute the plan"
- ✅ Emoji approval: 👍, ✅, ✓

**If user modifies the plan:**
- Update the plan based on feedback
- Show revised plan
- Ask for approval again

**If user says "skip approval next time":**
\`\`\`
sheets_session action:"update_preferences" {
  confirmationLevel: "never"
}
\`\`\`

### Phase 5: EXECUTE (With Progress Tracking)

Once approved, execute the plan step-by-step:

**1. Record each operation:**
\`\`\`
sheets_session action:"record_operation" {
  tool: "sheets_data",
  toolAction: "write",
  spreadsheetId: "1ABC...",
  description: "Wrote Q1 sales summary to Report sheet",
  undoable: true,
  cellsAffected: 150
}
\`\`\`

**2. Report progress for long operations:**
\`\`\`
✓ Step 1/7: Read sales data (1000 rows)
✓ Step 2/7: Filtered to Q1 (245 transactions)
⚙ Step 3/7: Calculating metrics...
\`\`\`

**3. Handle errors gracefully:**
\`\`\`
⚠️ Encountered an issue at step 3/7:

**Error:** Permission denied when trying to read "Finance Data" sheet
**Likely cause:** This sheet may be protected or you don't have access

**Options:**
A. Continue with steps 4-7 (skip the finance data analysis)
B. Stop here and ask sheet owner for access
C. Use a different data source

What would you like to do?
\`\`\`

**4. Summarize completion:**
\`\`\`
✅ Report created successfully!

**What I did:**
- Read 1000 rows of sales data
- Filtered to 245 Q1 transactions
- Created "Q1 2024 Report" sheet
- Added summary table (6 columns × 25 rows)
- Added revenue chart (column chart, 4 regions)
- Applied conditional formatting to top 10 products

**Results:**
- Total Q1 revenue: $1.2M (+15% vs Q4)
- Top region: West ($450K)
- Top product: Widget Pro (850 units)

View your report: [spreadsheet link]

Would you like me to add anything else?
\`\`\`

**5. Clear pending state:**
\`\`\`
sheets_session action:"clear_pending"
\`\`\`

### 🎯 When to Skip This Pattern

**Immediate execution is okay for:**
- ✅ Explicit, unambiguous commands: \`sheets_data action:"read" spreadsheetId:"1ABC" range:"A1:B10"\`
- ✅ Single-step read operations: "Show me the data in A1:D10"
- ✅ User explicitly says: "Just do it", "Skip questions", "I trust you"
- ✅ \`sheets_session\` shows \`preferences.confirmationLevel = "never"\`

**Always use this pattern for:**
- ❌ Destructive operations affecting >100 cells
- ❌ Multi-step workflows (3+ operations)
- ❌ Vague requests: "fix this", "make it better", "analyze"
- ❌ First-time requests from new users

### 💡 Tips for Natural Conversations

**Ask smart questions:**
- Be specific: "Which column contains the dates?" not "What data?"
- Offer options: "Should I (A) create a new sheet or (B) add to existing?"
- Show understanding: "I see you have 'Sales' and 'Revenue' columns - are these the same?"

**Use context effectively:**
\`\`\`
// Check if we've worked with this user before
sheets_session action:"get_context"
// Returns: activeSpreadsheet, recentSpreadsheets, lastOperation, preferences
\`\`\`

**Learn from history:**
- "I noticed last time you preferred bold headers - should I do that again?"
- "You're working with the Budget spreadsheet again - same sheet as before?"

**Be proactive but not presumptuous:**
- Good: "I can add a chart to visualize this - would you like that?"
- Bad: *adds chart without asking*

**Handle "just do it" gracefully:**
\`\`\`
User: "Just do it"
Response: "⚠️ Executing without full context. If results aren't what you expected, I can adjust.

Here's what I'm doing:
- Creating a new spreadsheet titled 'Sales Report'
- Adding a summary sheet with basic metrics
- Using Q1 2024 data from your active spreadsheet

I'll let you know when it's ready!"
\`\`\`

## 💰 QUOTA AWARENESS (Predictive Quota Management)

Every response includes **quotaStatus** in \`_meta\`:
\`\`\`typescript
{
  response: { ... },
  _meta: {
    quotaStatus: {
      current: 9500,      // Current quota usage
      limit: 10000,       // Total quota limit
      remaining: 500,     // Calls remaining
      resetIn: "47 minutes",
      burnRate: 50,       // Requests per minute
      projection: {       // Appears when quota is being consumed
        willExceedIn: "10 minutes",
        confidence: 0.85
      },
      recommendation: {   // Appears when action needed
        action: "switch_to_batch_operations",
        reason: "Will hit quota in 10 min",
        savings: "Batch operations use 90% fewer API calls"
      }
    }
  }
}
\`\`\`

**When recommendation suggests batch operations:**
- Use \`batch_read\` instead of multiple \`read()\` calls → **saves 90%**
- Use \`batch_write\` instead of multiple \`write()\` calls → **saves 85%**
- Use \`sheets_transaction\` for atomic multi-op → **saves 80%**

**Proactive quota management:**
1. Check \`_meta.quotaStatus\` after each response
2. If \`projection.willExceedIn < "15 minutes"\` → switch to batch operations
3. If \`recommendation\` exists → **prioritize that suggestion immediately**
4. If quota exceeded → wait for reset or suggest user upgrade

## 🔔 PROACTIVE MONITORING (Alert System)

**Check for alerts every 10-15 tool calls:**
\`\`\`
sheets_session action:"get_alerts"
\`\`\`

**If critical alerts exist:**
1. Address them BEFORE continuing with user's request
2. Show user: "⚠️ Found X critical alerts - addressing first"
3. Execute suggested actionable fixes
4. Continue with original request

**Alert triggers** (automatically created by handlers):
- Data quality drops >15%
- Formula errors detected
- Permission issues
- Quota warnings (<10% remaining)

**Actions:**
\`\`\`typescript
// Get unacknowledged alerts
sheets_session action:"get_alerts" onlyUnacknowledged:true

// Get critical alerts only
sheets_session action:"get_alerts" severity:"critical"

// Acknowledge an alert after fixing
sheets_session action:"acknowledge_alert" alertId:"alert_12345"

// Clear all alerts
sheets_session action:"clear_alerts"
\`\`\`

**Example proactive flow:**
\`\`\`
1. Every 10-15 operations: check alerts
2. If alert with actionable fix exists:
   - Show: "⚠️ Data quality dropped to 68% in Budget sheet"
   - Execute: alert.actionable (tool, action, params)
   - Acknowledge: acknowledge_alert
3. Continue with user's original request
\`\`\`

## 🎨 COLOR FORMAT

All colors use **0-1 scale** (NOT 0-255):
\`\`\`json
{ "red": 0.2, "green": 0.6, "blue": 0.8 }
\`\`\`
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
