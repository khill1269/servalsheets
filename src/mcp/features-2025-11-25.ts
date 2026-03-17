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
 * - tools: configured tool set with the configured action count
 * - resources: registered URI templates and reference resources
 * - prompts: registered guided workflows for common operations
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
import { DEFER_SCHEMAS, STAGED_REGISTRATION } from '../config/constants.js';
import { getConfiguredActionCount, getConfiguredToolCount } from './tool-catalog.js';

// ============================================================================
// MCP 2025-11-25 FEATURE STATUS
// ============================================================================

/**
 * MCP 2025-11-25 Feature Implementation Status
 *
 * ✅ IMPLEMENTED MCP 2025-11-25 SERVER FEATURES:
 * - MCP-compliant tool naming validation (letters, numbers, hyphens, underscores)
 * - Tool Annotations (all 4 hints: readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
 * - Structured Outputs (content + structuredContent in responses)
 * - Discriminated Unions (action in request, success in response)
 * - Resources (spreadsheet metadata via URI template)
 * - Prompts (guided workflows)
 * - Knowledge Resources (formulas, colors, formats)
 * - listChanged notifications (auto-registered by McpServer)
 * - SEP-973 Icons (SVG icons for all 25 tools)
 * - Server Instructions (LLM context guidance)
 * - SEP-1686 Tasks (SDK-compatible TaskStoreAdapter with listTasks)
 * - Logging capability (winston logger + MCP logging/setLevel)
 * - Completions capability (argument autocompletion for actions, IDs, types)
 * - SEP-1577 Sampling (server-to-client LLM requests for AI-powered analysis)
 * - SEP-1036 Elicitation (user input collection via forms and URLs)
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
  sheets_compute: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJtMyAxNyA2LTYgNCA0IDgtOCIvPjxwYXRoIGQ9Ik0xNyA3aDR2NCIvPjwvc3ZnPg==',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_agent: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTQiIHJ4PSIyIi8+PHBhdGggZD0iTTggMTRsMi0yIDIgMiA0LTQiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjIiIHI9IjEiLz48L3N2Zz4=',
      mimeType: 'image/svg+xml',
      sizes: ['24x24'],
    },
  ],
  sheets_connectors: [
    {
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNNyA3bTItMmgtNGEyIDIgMCAwIDAtMiAydjRhMiAyIDAgMCAwIDIgMmg0YTIgMiAwIDAgMCAyLTJ2LTRhMiAyIDAgMCAwLTItMnoiLz48cGF0aCBkPSJNMTcgMTdtMi0yaC00YTIgMiAwIDAgMC0yIDJ2NGEyIDIgMCAwIDAgMiAyaDRhMiAyIDAgMCAwIDItMnYtNGEyIDIgMCAwIDAtMi0yeiIvPjxwYXRoIGQ9Ik0xMCA4aDRhMiAyIDAgMCAxIDIgMnY0Ii8+PC9zdmc+',
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

  // Composite operations can be long-running and may require cancellation.
  // Nested sampling requests use the base server channel so task mode remains
  // compatible with the official Streamable HTTP SDK client.
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
  sheets_compute: { taskSupport: 'optional' },
  sheets_agent: { taskSupport: 'optional' },
  sheets_connectors: { taskSupport: 'optional' },
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
    // Resource update support - clients can subscribe to concrete resource URIs
    // and re-read them after notifications/resources/updated.
    resources: {
      subscribe: true,
      listChanged: true,
    },

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

    // When staged registration is enabled, we emit tools/list_changed after each stage.
    // Declare this so clients know to re-fetch the tool list on notification.
    // When disabled, all tools register at once — no notification needed.
    ...(STAGED_REGISTRATION ? { tools: { listChanged: true } } : {}),

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
ServalSheets is a Google Sheets MCP server with ${getConfiguredToolCount()} tools and ${getConfiguredActionCount()} actions.

Available tools may vary by deployment settings or staged registration. Treat \`tools/list\` as the source of truth for what is callable right now.

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

**sheets_advanced actions? (ISSUE-210: 31 actions across 7 domains)**
├─ Named ranges → \`add_named_range\`, \`update_named_range\`, \`delete_named_range\`, \`list_named_ranges\`, \`get_named_range\`
├─ Protected ranges → \`add_protected_range\`, \`update_protected_range\`, \`delete_protected_range\`, \`list_protected_ranges\`
├─ Metadata (developer) → \`set_metadata\`, \`get_metadata\`, \`delete_metadata\`
├─ Banding (row colors) → \`add_banding\`, \`update_banding\`, \`delete_banding\`, \`list_banding\`
├─ Tables → \`create_table\`, \`delete_table\`, \`list_tables\`, \`update_table\`, \`rename_table_column\`, \`set_table_column_properties\`
├─ Smart chips → \`add_person_chip\`, \`add_drive_chip\`, \`add_rich_link_chip\`, \`list_chips\`
└─ Named functions → \`list_named_functions\`, \`get_named_function\`, \`create_named_function\`, \`update_named_function\`, \`delete_named_function\`

**Enterprise & automation?**
├─ BigQuery integration → \`sheets_bigquery\` (connect, query, import_from_bigquery)
├─ Apps Script → \`sheets_appsscript\` (run scripts, deploy, trigger management)
├─ Webhooks → \`sheets_webhook\` (register, watch_changes, trigger notifications)
├─ Templates → \`sheets_templates\` (list, apply, create reusable patterns)
└─ Federation → \`sheets_federation\` (call_remote, list_servers, cross-service workflows)

**Live external API data?**
└─ \`sheets_connectors\` (list connectors, configure, query/batch_query, subscribe)

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

**Want to understand a sheet completely? (ISSUE-209: choose the right entry point)**
├─ "What's in this sheet?" (fast) → \`sheets_analyze.scout\` (structure only, ~200ms, 1 API call)
├─ "Analyze only one aspect" → \`sheets_analyze.analyze_data\` with category:"formulas"|"data"|"structure"|"performance"|"quality"
├─ "Full audit of everything" → \`sheets_analyze.comprehensive\` (all categories, 2 API calls, use after scout)
├─ Formula health specifically → \`sheets_analyze.analyze_formulas\` (upgrade opportunities, errors)
└─ Architecture review → \`sheets_analyze.comprehensive\` → \`sheets_analyze.analyze_formulas\` → \`sheets_dependencies.build\`

⚠️ **HIERARCHY**: scout → analyze_data (targeted) OR comprehensive (full). Never call comprehensive without scout first — it needs context. Never use analyze_data when you only need metadata (use scout).

**Want to upgrade legacy formulas?**
└─ \`sheets_analyze.analyze_formulas\` → check upgradeOpportunities → \`sheets_analyze.generate_formula\` per upgrade → \`sheets_data.write\`

**Building a dashboard?**
├─ Get chart recommendations → \`sheets_visualize.suggest_chart\`
├─ Create chart + sparklines → \`sheets_visualize.chart_create\` → \`sheets_format.sparkline_add\`
├─ Add interactive slicer → \`sheets_dimensions.create_slicer\` (⚠️ do NOT combine with set_basic_filter on the same range — use one or the other)
├─ Add dropdowns/validation → \`sheets_format.set_data_validation\`
└─ Full dashboard → scout → suggest_chart → chart_create → sparkline_add → apply_preset → add_conditional_format_rule

**Auditing, reporting, or migrating spreadsheets?**
├─ Full quality + formula + structure audit → \`sheets_composite.audit_sheet\`
├─ Export formatted report as PDF/XLSX/CSV → \`sheets_composite.publish_report\`
├─ Build a recurring data pipeline (fetch → transform → write) → \`sheets_composite.data_pipeline\`
├─ Create a sheet from a saved template with custom values → \`sheets_composite.instantiate_template\`
└─ Move data between spreadsheets with structure preservation → \`sheets_composite.migrate_spreadsheet\`

**Running formulas/statistics/regression/forecasting server-side?**
└─ \`sheets_compute\` (evaluate expressions, run statistical analysis, forecast)

**Multi-step autonomous plan/execute/rollback workflows?**
└─ \`sheets_agent\` (plan, execute steps, handle errors, rollback on failure)

**5+ operations?**
├─ All formatting → \`sheets_format.batch_format\`
├─ Mixed operations → \`sheets_transaction\` (begin → queue → commit)
└─ Sheet from scratch → \`sheets_composite.setup_sheet\`

## 🗺️ QUICK ROUTING MATRIX

When the user's intent is CLEAR, skip analysis and route directly:

| User Says | Route Directly To |
|-----------|------------------|
| "write/append/clear/read" | sheets_data |
| "format/color/border/font" | sheets_format |
| "share/comment/permission" | sheets_collaborate |
| "create/delete/copy sheet" | sheets_core |
| "undo/redo/history/revert" | sheets_history |
| "insert/delete rows/columns" | sheets_dimensions |
| "chart/graph/visualization" | sheets_visualize |
| "import/export CSV/XLSX" | sheets_composite |
| "formula dependencies/impact" | sheets_dependencies |
| "clean/fix/standardize" | sheets_fix |
| "compute/calculate/regression/forecast/statistics" | sheets_compute |
| "run plan/agent/autonomous pipeline/multi-step" | sheets_agent |
| "external API/live data/connector/market data/weather" | sheets_connectors |
| "audit/report/analyze quality/health check" | sheets_composite.audit_sheet |
| "publish report/export findings/generate summary" | sheets_composite.publish_report |
| "data pipeline/recurring import/scheduled transform" | sheets_composite.data_pipeline |
| "instantiate template/apply template with values" | sheets_composite.instantiate_template |
| "migrate/move data between spreadsheets/transfer" | sheets_composite.migrate_spreadsheet |
| "analyze/understand/explore/summarize sheet" | sheets_analyze |
| "dropdown/data validation/restrict input" | sheets_format.set_data_validation |
| "named range/protected range/table/metadata/chips" | sheets_advanced |
| "template/save pattern/reuse layout" | sheets_templates |
| "what if/scenario/model impact" | sheets_dependencies.model_scenario |
| "validate/check quality/detect conflicts" | sheets_quality |
| "session/preferences/checkpoint/context" | sheets_session |
| "webhook/watch changes/event notification" | sheets_webhook |
| "transaction/atomic batch/multi-op commit" | sheets_transaction |
| "remote MCP/cross-server/federation" | sheets_federation |
| "apps script/trigger/deploy/run function" | sheets_appsscript |
| "bigquery/connected sheets/external query" | sheets_bigquery |
| "confirm/wizard/approve/elicit input" | sheets_confirm |
| "authenticate/login/oauth/token" | sheets_auth |

ONLY use sheets_analyze when the user's request is exploratory or analytical.

## 🧭 5-GROUP MENTAL MODEL (Start Here Before Picking a Tool)

When the user's intent is ambiguous, classify it into one of 5 groups first, then drill into the specific tool. This avoids the most common tool-selection errors.

**GROUP 1 — Data I/O** (move data in or out; read, write, import, export, compute)
→ \`sheets_data\` · \`sheets_composite\` · \`sheets_compute\` · \`sheets_connectors\`
→ Use when: "read", "write", "append", "import", "export", "calculate", "fetch", "get stock price"

**GROUP 2 — Appearance** (how the sheet looks; formatting, charts, layout, sizing)
→ \`sheets_format\` · \`sheets_visualize\` · \`sheets_dimensions\`
→ Use when: "format", "color", "bold", "chart", "freeze", "sort", "hide", "resize", "filter"

**GROUP 3 — Spreadsheet Structure** (files, sheets, sharing, named ranges, protection)
→ \`sheets_core\` · \`sheets_collaborate\` · \`sheets_advanced\` · \`sheets_templates\`
→ Use when: "create spreadsheet", "add sheet", "share", "protect", "named range", "label"

**GROUP 4 — Analysis & Quality** (understand data; fix issues; trace dependencies)
→ \`sheets_analyze\` · \`sheets_fix\` · \`sheets_quality\` · \`sheets_dependencies\`
→ Use when: "analyze", "what's in", "find issues", "clean", "dependencies", "what-if scenario"

**GROUP 5 — Automation & Workflow** (orchestrate; automate; track state; integrate)
→ \`sheets_history\` · \`sheets_session\` · \`sheets_transaction\` · \`sheets_agent\`
→ \`sheets_auth\` · \`sheets_confirm\` · \`sheets_webhook\` · \`sheets_appsscript\`
→ \`sheets_bigquery\` · \`sheets_federation\`
→ Use when: "undo", "automate", "trigger", "run script", "transaction", "authenticate"

**Tiebreaker rule**: If two groups seem to fit, pick GROUP 1 (Data I/O) for anything involving cell values, GROUP 2 for anything involving appearance only.

## 🤖 WHEN TO USE AI FEATURES

These actions invoke LLM analysis automatically (Sampling SEP-1577):

**Need AI data analysis?** → \`sheets_analyze action:"comprehensive"\` (Sampling auto-triggered)
**Need formula generated from description?** → \`sheets_analyze action:"generate_formula" description:"profit margin = revenue minus costs divided by revenue"\`
**Need chart type recommendation?** → \`sheets_visualize action:"suggest_chart"\` (Sampling picks best fit)
**Need to understand revision changes?** → \`sheets_history action:"diff_revisions"\` (Sampling explains what changed)
**Need to model a what-if scenario?** → \`sheets_dependencies action:"model_scenario"\` (Sampling narrates the cascade)
**Need interactive input from user?** → \`sheets_confirm action:"request"\` (Elicitation wizard)

## 🔀 DISAMBIGUATION: Same Name, Different Tool

"list" → What are you listing?
  - Spreadsheets in Drive → sheets_core.list
  - Sheets/tabs in a spreadsheet → sheets_core.list_sheets
  - Named ranges → sheets_advanced.list_named_ranges
  - Charts → sheets_visualize.chart_list
  - Comments → sheets_collaborate.comment_list
  - Templates → sheets_templates.list
  - Webhooks → sheets_webhook.list
  - Transactions → sheets_transaction.list
  - Data validations → sheets_format.list_data_validations
  - Filter views → sheets_dimensions.list_filter_views

"delete" → What are you deleting?
  - Rows/columns → sheets_dimensions.delete
  - A sheet tab → sheets_core.delete_sheet
  - A named range → sheets_advanced.delete_named_range
  - A chart → sheets_visualize.chart_delete
  - A comment → sheets_collaborate.comment_delete
  - Data validation → sheets_format.clear_data_validation
  - A filter view → sheets_dimensions.delete_filter_view
  - A template → sheets_templates.delete
  - A webhook → sheets_webhook.unregister

"create" → What are you creating?
  - New spreadsheet → sheets_core.create
  - New sheet/tab → sheets_core.add_sheet
  - New chart → sheets_visualize.chart_create
  - New template → sheets_templates.create
  - New named range → sheets_advanced.add_named_range
  - New filter view → sheets_dimensions.create_filter_view
  - New Apps Script → sheets_appsscript.create

"get" → What are you getting?
  - Spreadsheet metadata → sheets_core.get
  - Cell data → sheets_data.read
  - Sheet properties → sheets_core.get_sheet
  - Chart details → sheets_visualize.chart_get
  - Comment → sheets_collaborate.comment_get
  - Named range → sheets_advanced.get_named_range

"update" → What are you updating?
  - Cell values → sheets_data.write
  - Sheet properties (name, color, visibility) → sheets_core.update_sheet
  - Spreadsheet title/locale → sheets_core.update_properties
  - Chart appearance → sheets_visualize.chart_update
  - Permission role → sheets_collaborate.share_update
  - Named range bounds → sheets_advanced.update_named_range
  - Dimension sizes (row height, column width) → sheets_dimensions.resize

"import" → What are you importing?
  - CSV file → sheets_composite.import_csv
  - Excel XLSX file → sheets_composite.import_xlsx
  - Built-in template → sheets_templates.import_builtin
  - Data from BigQuery → sheets_bigquery.import_from_bigquery
  - Data from external API → sheets_connectors.query

"analyze" → What do you want to analyze?
  - Cell values and data quality → sheets_analyze.analyze_data
  - Formulas and upgrade opportunities → sheets_analyze.analyze_formulas
  - Sheet structure and layout → sheets_analyze.analyze_structure
  - Performance bottlenecks → sheets_analyze.analyze_performance
  - Formula dependency impact for a specific cell → sheets_dependencies.analyze_impact
  - Data validation conflicts → sheets_quality.analyze_impact

## ⚡ CRITICAL RULES (Avoid Common Mistakes)

1. **Use sheets_analyze.scout ONLY when:**
   - User hasn't specified exact range/sheet
   - Operation requires understanding sheet structure (e.g., 'find duplicates', 'summarize data')
   - User asks 'what's in this spreadsheet?'
   **SKIP scout when user provides:** specific cell/range, exact action ('write A1'), or structural command ('add sheet', 'delete sheet', 'share with').
2. **append is NOT idempotent** — Never retry on timeout. It will duplicate data.
3. **Always include sheet name** in ranges: \`"Sheet1!A1:D10"\` not \`"A1:D10"\`
4. **NEVER type emoji sheet names manually** — Always copy sheet names from \`sheets_core.list_sheets\` response. Emoji characters may look identical but have different Unicode (📊 U+1F4CA vs 📈 U+1F4C8). Quote sheet names with spaces or emoji: \`"'📊 Dashboard'!A1"\`
5. **Use 0-based indices** for insert/delete: row 1 = index 0
6. **batch_format max 100** operations per call
7. **Use verbosity:"minimal"** to save tokens when you don't need full response
8. **Use sheets_transaction for 5+ operations** — Saves 80-95% API calls and ensures atomicity. Example: Updating 50 rows = 1 transaction call instead of 50 individual writes. Don't use for 1-4 operations (overhead exceeds benefit)
9. **\`find_replace\` is for patterns, NOT targeted updates** (ISSUE-208) — If you know the cell address, use \`data.write\`. \`find_replace\` scans the entire range for a regex pattern — slow, non-deterministic for single-cell updates, and may match unintended cells. Rule: "Do I know WHERE to write?" → write. "Do I need to search?" → find_replace.

## 🔁 ERROR RECOVERY

**Same error twice? STOP.** Check the tool description and inline action parameter hints, or ask the user for clarification. Never retry unchanged params.

**Key error patterns:**
- \`invalid_union\` on conditional format → Use \`add_conditional_format_rule\` with preset
- \`range is required\` → Use string \`"Sheet1!A1"\` not object \`{a1: "..."}\`
- Timeout on \`append\` → Don't retry (NOT idempotent, duplicates data)
- Timeout on \`auto_resize\` → Skip (non-critical)

**Auth: Max 2 login attempts.** If both fail, STOP and tell user (network/firewall/OAuth issue). Never attempt 3rd login — OAuth has built-in 3x retry. Use \`sheets_auth status\` to check state first.

**⚠️ DEBUG ARTIFACT WARNING:**
Never leave debug strings (e.g., "test123", task markers, "temp") in production cells. Always verify final values before completing operations.

## 🔄 SELF-CORRECTION & INTELLIGENT ERROR RECOVERY

Error responses include structured recovery data to enable autonomous self-correction:

**\`fixableVia\`** — On error, check \`response.error.fixableVia\` for an executable fix:
\`\`\`json
{ "tool": "sheets_core", "action": "list_sheets", "params": { "spreadsheetId": "..." } }
\`\`\`
Call this tool+action directly to resolve the issue, then retry the original operation.

**\`alternatives\`** — Array of alternative approaches if the primary fix doesn't work:
\`\`\`json
[{ "tool": "sheets_analyze", "action": "scout", "description": "Scan structure to find valid ranges" }]
\`\`\`

**\`resolutionSteps\`** — Step-by-step human-readable guidance for complex failures.

**\`suggestedTools\`** — Tools relevant to diagnosing the issue.

**\`_learnedFix\`** — When the server has seen this error pattern before and knows a fix that worked:
\`\`\`json
{ "fix": "Use Sheet1 instead of sheet1 (case-sensitive)", "confidence": 0.85, "seenCount": 7 }
\`\`\`
Higher confidence + higher seenCount = more reliable fix. Apply it directly.

**\`suggestedNextActions\`** — On success, response includes recommended follow-up actions:
\`\`\`json
[{ "tool": "sheets_format", "action": "apply_preset", "reason": "Data written — apply formatting" }]
\`\`\`

**\`_hints\`** — Chain-of-thought hints for data-aware planning (on read responses):
\`\`\`json
{ "dataShape": "time-series (monthly)", "primaryKeyColumn": "Date", "riskLevel": "low", "nextPhase": "..." }
\`\`\`

**TAER Self-Correction Pattern:**
When an operation fails, follow this loop:
1. **Think** — Read \`fixableVia\`, \`alternatives\`, \`_learnedFix\` from the error response
2. **Analyze** — Determine root cause from \`resolutionSteps\` and error code
3. **Execute** — Call the \`fixableVia\` tool/action, or apply \`_learnedFix\`
4. **Review** — Verify the fix resolved the issue; retry original operation
5. **Plan** — If still failing after 2 attempts, use \`sheets_analyze.scout\` to re-examine the spreadsheet structure before trying a different approach

## 🔁 ERROR SELF-CORRECTION PROTOCOL

When any ServalSheets tool returns an error:
1. Check \`error.retryable\` — if true, retry after \`error.retryAfterMs\` milliseconds
2. Check \`error.fixableVia\` — if present, call that tool/action with those params FIRST, then retry
3. Follow \`error.resolutionSteps\` — numbered steps in order
4. Use \`error.suggestedTools\` — listed tools for diagnosis
5. If error persists after 2 retries, report to user with \`error.resolution\`

Example: \`ELICITATION_UNAVAILABLE\` error includes \`fixableVia: { tool: "sheets_confirm", action: "wizard_start" }\` — call that first, then retry the original operation.

## ⚡ OPERATION PERFORMANCE TIERS

Use this table to set user expectations and pick the right operation for time-sensitive workflows.
Response \`_meta.executionTimeMs\` and \`_meta.apiCallsMade\` show actual cost after each call.

| Tier | Latency | API Calls | Examples |
|------|---------|-----------|---------|
| **Instant** (<50ms) | Session/context ops, cached reads | 0 | \`sheets_session.*\`, \`sheets_auth.status\`, repeat reads (ETag cache hit) |
| **Fast** (50-300ms) | Single cell read/write, metadata | 1 | \`sheets_data.read\`, \`sheets_format.set_background\`, \`sheets_core.get\` |
| **Medium** (300ms-2s) | Batch ops, chart create, scout | 1-3 | \`sheets_data.batch_write\`, \`sheets_visualize.chart_create\`, \`sheets_analyze.scout\` |
| **Slow** (2-10s) | AI analysis, large imports, history | 3-10 | \`sheets_analyze.comprehensive\`, \`sheets_composite.import_csv\`, \`sheets_fix.clean\` |
| **Background** (10s+) | Apps Script, revision timeline, BigQuery | 5-20+ | \`sheets_appsscript.run\`, \`sheets_history.timeline\`, \`sheets_bigquery.export_to_bigquery\` |

**Quota guidance**: Google Sheets API allows 60 req/min per user. \`_meta.quotaStatus\` shows live utilization.
Use \`sheets_transaction\` (1 API call for N ops) or \`batch_write\` (1 call for 100 cells) to stay within quota.

## 🔧 MCP 2025-11-25 PROTOCOL FEATURES

**Sampling (SEP-1577)** — AI analysis happens automatically when you call:
\`sheets_analyze.generate_formula\`, \`sheets_visualize.suggest_chart\`, \`sheets_fix.suggest_cleaning\`,
\`sheets_dependencies.model_scenario\`, \`sheets_history.diff_revisions\`, \`sheets_collaborate.comment_add\`.
You do NOT invoke sampling directly — the server requests AI analysis from the client transparently.
If the client doesn't support sampling, these operations degrade gracefully to rule-based logic.

**Elicitation (SEP-1036)** — Destructive operations may open user approval dialogs:
\`sheets_core.delete_sheet\`, \`sheets_dimensions.delete\`, \`sheets_history.revert_to\`, bulk overwrites.
The server uses \`sheets_confirm\` internally. If the client doesn't support elicitation, the server
falls back to \`safety.dryRun\` parameter — always set \`dryRun: true\` first for destructive ops.

**Tasks (SEP-1686)** — Use MCP \`tasks/call\` for background tracking on task-enabled tools.
The transport returns the Task ID, and clients can cancel, track progress, or query status without
waiting on the foreground \`tools/call\` response.

**Transactions** — For 5+ operations, use atomic batching:
1. \`sheets_transaction begin\` (description for audit trail)
2. \`sheets_transaction queue\` (operation: {tool, action, params}) — repeat for each op
3. \`sheets_transaction commit\` — executes all queued ops in a single API call (80-95% savings)
4. On failure: \`sheets_transaction rollback\` restores pre-transaction state

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
\`sheets_appsscript create\` → \`sheets_appsscript update_content\` → \`sheets_appsscript create_version\` → \`sheets_appsscript deploy\` → \`sheets_appsscript run\`

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

**Spreadsheet quality audit:**
\`sheets_composite audit_sheet\` → review findings → \`sheets_composite publish_report\`

**Data pipeline with live data:**
\`sheets_connectors configure\` → \`sheets_composite data_pipeline\` → \`sheets_format batch_format\`

**Spreadsheet migration:**
\`sheets_analyze scout\` (source) → \`sheets_composite migrate_spreadsheet\` → \`sheets_analyze scout\` (verify destination)

**Federation / Remote MCP Workflows:**
\`sheets_federation list_servers\` → \`sheets_federation get_server_tools\` → \`sheets_federation call_remote\` (execute action on remote MCP) → \`sheets_data cross_read\` (optionally fetch results back)

**LLM Continuity Pattern (Session Context):**
\`sheets_session set_active\` (establish context) → \`sheets_data read\` (records last read range) → \`sheets_session get_context\` (retrieve auto-tracked context/history for follow-ups) → use returned context in next action descriptions

## 🪄 INTERACTIVE WIZARDS (Elicitation)

When a supporting MCP client is connected, these actions launch **interactive forms** to collect missing parameters. If the client doesn't support elicitation, parameters use safe defaults and the action proceeds without interruption.

| Action | What the Wizard Asks |
|--------|---------------------|
| \`sheets_core.create\` | Spreadsheet title + locale + timezone (3-field form) |
| \`sheets_collaborate.share_add\` | Recipient email + permission role + notification settings |
| \`sheets_visualize.chart_create\` | Chart type (bar/line/pie/...) → chart title (2-step) |
| \`sheets_format.add_conditional_format_rule\` | Rule preset (highlight_duplicates, color_scale, data_bars, ...) |
| \`sheets_transaction.begin\` | Transaction description for audit trail |

**Any destructive action** (delete_sheet, clear, bulk overwrite) shows a confirmation form before executing.

**Usage tip**: You can omit parameters for wizard-enabled actions and let the user fill them interactively. Example: call \`sheets_core.create\` with no title — the user will be prompted.

## 📏 RANGE STRATEGY (How to Fetch Data Efficiently)

**PRIORITY ORDER — always use the highest-applicable strategy:**

| Priority | Strategy | When to Use | API Cost | Example |
|----------|----------|-------------|----------|---------|
| 1 | **User-provided range** | User specifies cells/range | 1 call | \`sheets_data.read range:"Sheet1!A1:D50"\` |
| 2 | **Metadata-first** | No range specified, need actual data bounds | 2 calls (meta + data) | \`sheets_analyze.scout\` → \`sheets_data.read\` with discovered bounds |
| 3 | **Scout + targeted** | Exploratory analysis | 1-2 calls | \`sheets_analyze.scout\` returns structure → use returned sheet dimensions |
| 4 | **Tiered retrieval** | Full analysis workflows | 1-4 calls (progressive) | \`sheets_analyze.comprehensive\` auto-tiers |
| 5 | **Bounded fallback** | Metadata fetch failed | 1 call | A1:Z1000 (26K cells max) |

**NEVER do these:**
- ❌ Fetch A1:ZZ10000 (260K cells) — always resolve bounds first
- ❌ Use \`includeGridData: true\` without a \`ranges\` parameter — fetches ALL formatting for ALL cells
- ❌ Use full-column references like \`A:Z\` — triggers full grid scan up to max rows
- ❌ Skip field masks on \`spreadsheets.get()\` — metadata calls should use \`fields\` parameter

**ALWAYS do these:**
- ✅ Include sheet name in ranges: \`"Sheet1!A1:D50"\` not \`"A1:D50"\`
- ✅ Use \`sheets_analyze.scout\` first when range is unknown — it returns actual rowCount/columnCount
- ✅ Use \`verbosity:"minimal"\` for reads where you only need values, not metadata
- ✅ Use \`batch_read\` for 3+ ranges — same API cost as individual reads, processed in parallel
- ✅ Cap analysis ranges: 10K rows max for data reads, 1K rows max for formatting scans

**Dynamic range resolution pattern (best practice):**
1. \`sheets_analyze.scout spreadsheetId:"..."\` → returns \`{ sheets: [{ rowCount: 500, columnCount: 8 }] }\`
2. \`sheets_data.read range:"Sheet1!A1:H500"\` ← bounded to actual data

## ❌ ANTI-PATTERNS (What NOT to Do)

- Don't use transactions for single operations — overhead exceeds benefit for <5 ops
- Don't read entire sheet when you only need a few cells — use specific ranges
- Don't retry append on timeout — it's NOT idempotent, you'll duplicate data
- Don't skip sheets_analyze before complex operations — 70%+ of mistakes are preventable
- Don't hardcode sheet names — always get from list_sheets (emoji/unicode issues)
- Don't pass \`includeGridData: true\` to \`spreadsheets.get()\` without explicit \`ranges\` — fetches ALL cell data

## 📝 EXAMPLES: Common Requests → Correct Tool Calls

**"Write 'Hello' in cell A1"** → sheets_data action:"write" range:"Sheet1!A1" values:[["Hello"]]
  (NOT append — write targets a specific cell)

**"Add these rows to the bottom"** → sheets_data action:"append" range:"Sheet1" values:[["row1"],["row2"]]
  (NOT write — append finds the last row automatically)

**"Add a new sheet called Sales"** → sheets_core action:"add_sheet" title:"Sales"
  (NOT sheets_dimensions.insert — that inserts rows/columns, not sheets)

**"Insert 3 rows above row 5"** → sheets_dimensions action:"insert" dimension:"ROWS" startIndex:4 endIndex:7
  (NOT sheets_core — core manages sheets/tabs, dimensions manages rows/columns. Indices are 0-based.)

**"Make the header row bold with blue background"** → sheets_format action:"batch_format" requests:[{range:"Sheet1!1:1", format:{textFormat:{bold:true}}, backgroundColor:{red:0.2,green:0.4,blue:0.8}}]
  (Use batch_format for multiple format changes in one call)

**"Highlight cells above 1000 in red"** → sheets_format action:"add_conditional_format_rule" range:"Sheet1!B2:B100" rulePreset:"custom" condition:{type:"NUMBER_GREATER", values:["1000"]} format:{backgroundColor:{red:1,green:0.8,blue:0.8}}
  (NOT set_data_validation — that restricts input, conditional formatting changes appearance)

**"Share with alice@company.com as editor"** → sheets_collaborate action:"share_add" email:"alice@company.com" role:"writer"
  (Role is "writer" not "editor" — Google Drive API terminology)

**"Import data.csv into a new sheet"** → sheets_composite action:"import_csv" source:"data.csv" createNewSheet:true
  (NOT sheets_data.write — import_csv handles parsing, headers, and type detection)

**"Show formula dependencies for cell D5"** → sheets_dependencies action:"get_dependents" spreadsheetId:"..." cell:"Sheet1!D5"
  (NOT sheets_analyze — analyze examines the whole sheet, dependencies traces specific cell relationships)

**"Undo the last change"** → sheets_history action:"undo"
  (NOT sheets_history.revert_to — undo reverses the last operation, revert_to restores to a specific revision)

**"What's in this spreadsheet? / How many rows?"** → sheets_analyze action:"scout" spreadsheetId:"..."
  (NOT sheets_data.read — scout returns structure metadata (sheet names, row/column counts, detected types) in 1 API call with no cell data fetched)

**"Read the Sales data from A1 to D50"** → sheets_data action:"read" range:"Sheet1!A1:D50"
  (NOT sheets_analyze.scout — you already know the range; scout is only for when range is unknown or structure is needed)

**"Sort this table by Date descending"** → sheets_dimensions action:"sort_range" range:"Sheet1!A1:D100" sortOrder:[{dimensionIndex:0,sortOrder:"DESCENDING"}]
  (NOT sheets_data.write — sort_range is a server-side in-place sort; no data reading or re-writing needed)

**"Freeze the header row"** → sheets_dimensions action:"freeze" frozenRowCount:1
  (NOT sheets_format — freeze is a sheet-level view property, not cell formatting; set frozenColumnCount:1 in the same call to freeze both simultaneously)

**"Remove duplicate rows"** → sheets_composite action:"deduplicate" spreadsheetId:"..." sheetName:"Sheet1"
  (NOT sheets_data.find_replace — deduplicate does full row-level comparison with preview mode; find_replace only matches text patterns in individual cells)

**"Calculate the average of B2:B100 server-side"** → sheets_compute action:"aggregate" spreadsheetId:"..." range:"Sheet1!B2:B100" function:"AVERAGE"
  (NOT sheets_data.read + manual math — compute runs server-side; returns result without transferring all the data to the client)

**"Get the current stock price for AAPL"** → sheets_connectors action:"query" connectorId:"alpha-vantage" params:{symbol:"AAPL",function:"GLOBAL_QUOTE"}
  (NOT sheets_data — connectors fetches live external API data; sheets_data only reads existing cell values)

**"Save a checkpoint before bulk changes so I can restore quickly"** → sheets_session action:"save_checkpoint" sessionId:"before-bulk-update"
  (NOT sheets_history — session checkpoints are in-session fast restore points; history tracks all past operations including cross-session)

**"What cells break if I change B5? Show me the impact"** → sheets_dependencies action:"analyze_impact" spreadsheetId:"..." cell:"Sheet1!B5"
  (NOT sheets_analyze — dependencies traces the specific formula dependency graph for a cell; analyze examines whole-sheet data quality)

**"Clean all the data in this sheet — fix dates, trim whitespace, remove duplicates"** → sheets_fix action:"clean" spreadsheetId:"..." range:"Sheet1!A1:Z1000" mode:"preview"
  (NOT manual find_replace loops — clean auto-detects and fixes 10+ issue types in one pass; use mode:"preview" first to review changes before applying)

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
| QUOTA_EXCEEDED | Too many requests | Wait 60 seconds, use batch operations with smaller chunks |
| INVALID_ARGUMENT | Bad parameter format/value | Check param types, use sheets_analyze.scout for validation |
| CONFLICT | Concurrent modification detected | Use sheets_quality.detect_conflicts, then resolve_conflict |
| TIMEOUT | Request took too long | Reduce range size, use batch_read with smaller chunks |
| AUTH_EXPIRED | Credentials no longer valid | Run sheets_auth.login to refresh token |
| RATE_LIMITED | Too many rapid requests | Use exponential backoff, check sheets_session.get_context |
| NOT_FOUND (chart) | Chart ID doesn't exist | Use sheets_visualize.chart_list to verify chart IDs |
| NOT_FOUND (range) | Named range doesn't exist | Use sheets_advanced.list_named_ranges |
| PROTECTED_RANGE | Range is protected | Use sheets_advanced to check protection |

**General recovery pattern:**
1. Read the error message carefully - it explains what went wrong
2. Check prerequisites (auth? correct spreadsheetId? sheet exists?)
3. Use dryRun:true to test before actual execution
4. For persistent errors, use sheets_analyze action:"comprehensive" to inspect the spreadsheet

## 🔧 ERROR RECOVERY EXAMPLES

| Error | Root Cause | Exact Recovery |
|-------|-----------|----------------|
| PERMISSION_DENIED 403 | Missing OAuth scope or no share access | \`sheets_auth action:"status"\` → check scopes list → re-login if scope missing |
| SHEET_NOT_FOUND | Emoji/unicode mismatch or trailing space in sheet name | \`sheets_core action:"list_sheets"\` → copy exact name from response |
| RATE_LIMITED 429 | Too many rapid sequential calls | Use \`sheets_transaction\` to batch ops; honor \`retryAfterMs\` from error |
| append → duplicate rows | Timeout on first call + naive retry | NEVER retry \`append\` — it is NOT idempotent. Use \`data.write\` for known positions |
| INVALID_RANGE | Missing sheet name prefix | Format must be \`'SheetName!A1:D10'\` — bare \`A1:D10\` fails for multi-sheet files |
| UNAUTHENTICATED | Token expired mid-session | \`sheets_auth action:"status"\` → if expired, \`sheets_auth action:"login"\` |

## 🛡️ SAFETY CHECKLIST

Before destructive operations (delete, clear, overwrite):
- [ ] Use \`dryRun: true\` first to preview changes
- [ ] For >100 cells: Use \`sheets_confirm\` to get user approval
- [ ] For >1000 cells: Consider using \`sheets_transaction\` for atomicity
- [ ] Set \`safety.maxCellsAffected\` to limit blast radius

## 💰 QUOTA & MONITORING

**Quota Limits (Google Sheets API v4):**
- Per-user quota: 60 requests per minute
- Per-project quota: 300 requests per minute
- Check \`_meta.quotaStatus\` in responses — if low, use batch/transaction ops.

**Quota-Saving Strategies:**
1. **Use batch operations** — sheets_data.batch_write (100 cells) ≈ sheets_data.write (1 cell) in quota cost
2. **Enable field masks** — Only fetch needed fields (spreadsheetId,properties(title) vs full metadata)
3. **Leverage local caching** — Same read within 5 minutes returns cached result (ETag 304)
4. **Prefer read operations** — Reads are cheaper than writes; design queries to minimize mutations
5. **Use composite operations** — sheets_composite.import_csv (1 API call) vs manual parse+write (3+ calls)
6. **Batch computations** — sheets_compute.batch_compute (3 operations) ≈ 3 separate calls

**Monitoring:**
- Check \`sheets_session action:"get_alerts"\` every 10-15 operations for quota warnings
- Track quota remaining via \`_meta.quotaRemaining\` before large operations
- Contact Google Cloud Support if quota limits insufficient for workload

## 🎨 COLOR FORMAT

All colors use **0-1 scale** (NOT 0-255):
\`\`\`json
{ "red": 0.2, "green": 0.6, "blue": 0.8 }
\`\`\`

## 📚 RESOURCE DISCOVERY

- Use \`tools/list\` descriptions plus inline \`x-servalsheets.actionParams\` hints as the primary source for request shapes
- Read \`servalsheets://index\` when you need a resource catalog and your client supports MCP resource reads
- Read \`sheets:///{spreadsheetId}/context\` for full structural metadata (sheets, charts, named ranges, protection, filters — 1 API call, no cell data)
- Search \`knowledge:///search?q={query}\` for domain-specific guidance (formulas, API limits, templates)
- Read \`servalsheets://guides/{topic}\` for optimization guides (quota, batching, caching, error recovery)

## 🏗️ ADVANCED SHEET PATTERNS

**Multi-tab spreadsheet with cross-sheet lookups?**
→ \`sheets_agent action:"plan" description:"Create Products + Orders sheets with XLOOKUP from Orders→Products"\`
→ The agent generates the full multi-step plan: create sheets → write headers → inject XLOOKUP formulas

**Full analytics dashboard (KPIs + charts + slicers)?**
→ \`sheets_composite action:"build_dashboard" dataSheet:"Sales" layout:"full_analytics"\`
→ Assembles KPI row, charts, slicers, formatting in one action

**Dependent dropdowns (e.g., Country → Cities)?**
→ \`sheets_format action:"build_dependent_dropdown" parentRange:"Sheet1!A2:A100" dependentRange:"Sheet1!B2:B100" lookupSheet:"Lookup"\`
→ Handles named ranges + INDIRECT formula + data validation automatically

**VLOOKUP detected? Upgrade to XLOOKUP?**
→ \`sheets_analyze action:"analyze_formulas"\` → check \`upgradeOpportunities\` → \`sheets_data action:"write"\` with XLOOKUP formula
→ XLOOKUP is more robust: left-lookup, default value, exact/approximate match control

**Pivot table + interactive slicer?**
→ \`sheets_visualize action:"pivot_create"\` → \`sheets_dimensions action:"create_slicer" dataRange:"same source range"\`
→ Do NOT combine create_slicer with set_basic_filter on the same range

**Dynamic filter formula (show only active rows)?**
→ \`sheets_analyze action:"generate_formula" description:"FILTER formula showing rows where Status column equals Active"\`
→ Returns FILTER formula that spills results dynamically (no manual refresh needed)

**Running total column?**
→ \`sheets_analyze action:"generate_formula" description:"running total of column B starting at row 2"\`
→ Returns \`=SUM($B$2:B2)\` — drag down to extend

**Budget vs. Actuals comparison?**
→ \`sheets_agent action:"plan" description:"Create Budget sheet + Actuals sheet + Variance sheet with formulas =Actuals!B2-Budget!B2"\`

## 🛡️ DATA QUALITY

- Run \`sheets_quality action:"validate"\` before bulk writes to catch type mismatches and missing fields
- Use \`sheets_analyze action:"scout"\` for quick overview (1 API call), \`action:"comprehensive"\` for deep analysis (2 calls)
- Always use \`sheets_confirm action:"request"\` before destructive multi-sheet operations (delete, clear, bulk overwrite)
- After large writes, check \`sheets_session action:"get_alerts"\` for quality regressions
`;

  const deferredSchemaInstructions = `
## 📋 INLINE PARAMETER HINTS (IMPORTANT)

**Tool schemas may be deferred to save tokens.** Treat the tool description and inline
\`x-servalsheets.actionParams\` hints from \`tools/list\` as the canonical source for actions,
required fields, and common request shapes.

**When to re-check inline hints:**
- First time using a tool in this conversation
- When you need to know which actions are available
- When you get validation errors (check required fields for the selected action)
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
