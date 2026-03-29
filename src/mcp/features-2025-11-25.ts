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
  sheets_transaction: { taskSupport: 'optional' },
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

## STARTUP SEQUENCE (MANDATORY — follow in order)

1. **Auth check:** \`sheets_auth action:"status"\` — BEFORE any other tool. If \`authenticated: false\`: \`sheets_auth action:"login"\` → show authUrl → user provides code → \`sheets_auth action:"callback" code:"..."\`
2. **Connector discovery:** \`sheets_session action:"get_context"\` — response includes \`connectorOnboarding\` with structured next-call guidance. ASK the user which connectors they want before configuring. For each chosen connector: \`sheets_connectors action:"configure" connectorId:"..."\` — zero-auth connectors configure instantly; API key and OAuth connectors will prompt the user via secure URL elicitation (localhost page). For multi-connector setup: use \`sheets_confirm action:"wizard_start"\` with steps for each connector.
3. **Set context:** \`sheets_session action:"set_active" spreadsheetId:"1ABC..."\` — enables omitting spreadsheetId and using column names as ranges.

## WORKFLOW

**Optimal sequence:** session.set_active → analyze.scout → plan → quality.validate (if >100 cells) → execute (batch/transaction for 3+ ops) → record_operation → history.undo if needed

**ALWAYS call \`sheets_session action:"record_operation"\` after each significant write, format, or structural change.** This populates session history for undo support and natural-language reference resolution.

**Before writing to formula-containing ranges:** call \`sheets_quality action:"analyze_impact"\` to assess affected formulas and risk level.

## 5-GROUP MENTAL MODEL (Start Here)

Classify the user's intent into a group, then pick the tool:

**GROUP 1 — Data I/O** → \`sheets_data\` · \`sheets_composite\` · \`sheets_compute\` · \`sheets_connectors\`
→ "read", "write", "append", "import", "export", "calculate", "fetch"

**GROUP 2 — Appearance** → \`sheets_format\` · \`sheets_visualize\` · \`sheets_dimensions\`
→ "format", "color", "bold", "chart", "freeze", "sort", "hide", "resize", "filter"

**GROUP 3 — Structure** → \`sheets_core\` · \`sheets_collaborate\` · \`sheets_advanced\` · \`sheets_templates\`
→ "create spreadsheet", "add sheet", "share", "protect", "named range"

**GROUP 4 — Analysis & Quality** → \`sheets_analyze\` · \`sheets_fix\` · \`sheets_quality\` · \`sheets_dependencies\`
→ "analyze", "what's in", "find issues", "clean", "dependencies", "what-if"

**GROUP 5 — Automation** → \`sheets_history\` · \`sheets_session\` · \`sheets_transaction\` · \`sheets_agent\` · \`sheets_auth\` · \`sheets_confirm\` · \`sheets_webhook\` · \`sheets_appsscript\` · \`sheets_bigquery\` · \`sheets_federation\`
→ "undo", "automate", "trigger", "run script", "transaction", "authenticate"

**Tiebreaker:** GROUP 1 for cell values, GROUP 2 for appearance only.

**Common routing anchors:**
- Delete a worksheet/tab → \`sheets_core action:"delete_sheet"\`
- Share or comment → \`sheets_collaborate action:"share_add"\` / \`comment_add\`
- Preview risky mutations → add \`safety: { dryRun: true }\` or use \`sheets_confirm\`
- Large datasets (\`>10K rows\`) → prefer \`batch_read\` / batching first; for warehouse-scale joins use \`sheets_bigquery\`

## CRITICAL RULES

**Data Integrity:**
- append is NOT idempotent — never retry on timeout
- find_replace for patterns, write for known cells — don't use find_replace for targeted updates
- UNFORMATTED_VALUE for numeric reads — avoids locale-formatted strings breaking calculations
- USER_ENTERED for formula writes — RAW writes formula text literally
- batch_write for formula fill — not sequential writes
- Validate formulas after writes — Sheets API returns 200 even for #ERROR! cells

**API Efficiency:**
- batch_format max 100 operations per call
- verbosity:"minimal" to save tokens
- Operation batching strategy: 1-2 ops → direct calls; 3-4 same-type → batch_write/batch_format; 5+ mixed → sheets_transaction (begin→queue→commit, 80-95% API savings)

**Multi-Step Work:**
- 3+ tool calls → use \`sheets_agent action:"plan"\` + \`sheets_agent action:"execute" interactiveMode:true\` — provides typed steps, rollback, and checkpoint support
- Do NOT use \`execute_pipeline\` for complex multi-step workflows — it lacks rollback and checkpoint support
- Transactions support: write, format, dimension operations. Non-batchable ops (add_note, hyperlinks, metadata) must be called directly after commit.
- \`batch_operations\` supports: sheets_data, sheets_format, sheets_dimensions, sheets_core only. For other tools, call directly.

**Structural:**
- Always include sheet name in ranges: \`"Sheet1!A1:D10"\` not \`"A1:D10"\`
- Never type emoji sheet names — copy from \`sheets_core.list_sheets\`
- 0-based indices for insert/delete: row 1 = index 0

**Analysis:**
- scout only when needed — skip when user provides specific cell/range or structural command

## ERROR SELF-CORRECTION (TAER)

1. **Think** — read \`error.fixableVia\`, \`error._learnedFix\`, \`error.suggestedRecoveryActions\`
2. **Analyze** — check \`error.retryable\`, \`error.retryAfterMs\`
3. **Execute** — call fixableVia or suggestedRecoveryActions[0] (pre-filled params included)
4. **Review** — verify fix, retry original; after 2 failures use \`sheets_analyze.scout\`

Key fixes: SHEET_NOT_FOUND → \`list_sheets\` (emoji mismatch); INVALID_RANGE → add row bounds; QUOTA_EXCEEDED → use transactions/batching.

## QUICK REFERENCE

- **Formula locale**: Non-English → \`;\` separator, \`,\` decimal (check \`spreadsheetLocale\`)
- **Colors**: 0-1 scale (NOT 0-255): \`{ "red": 0.2, "green": 0.6, "blue": 0.8 }\`
- **Advanced topics (AI features, MCP protocol, transactions)** → read \`guide://advanced-usage\`

## WHEN TO READ REFERENCE RESOURCES

Read these via \`resources/read\` only when needed — do NOT pre-load all of them:

- **AI features, MCP protocol details, formula locale, or color format** → read \`guide://advanced-usage\`
- **Tool selection error, ambiguous intent, or "list/delete/create/get" could match multiple tools** → read \`guide://tool-selection\`
- **SHEET_NOT_FOUND, INVALID_RANGE, or any error after 1 failed retry** → read \`guide://error-reference\`
- **Multi-step workflow or tool chaining** → read \`guide://workflows\`
- **Large dataset or performance concern** → read \`guide://range-strategy\`
- **Unsure about confirmations** → read \`guide://safety-confirmation\` and \`guide://confirmation-examples\`
- **Domain-specific question (formula syntax, API limits)** → search \`knowledge:///search?q={query}\`
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
