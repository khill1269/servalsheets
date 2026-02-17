/**
 * ServalSheets - Version Information
 *
 * Single source of truth for version numbers.
 * Import this instead of hardcoding versions.
 */

import type { Icon } from '@modelcontextprotocol/sdk/types.js';

/** Current version - sync with package.json */
export const VERSION = '1.6.0';

/** Protocol version */
export const MCP_PROTOCOL_VERSION = '2025-11-25';

/** Server info for MCP initialization */
export const SERVER_INFO = {
  name: 'servalsheets',
  version: VERSION,
  protocolVersion: MCP_PROTOCOL_VERSION,
} as const;

/** Server icon metadata for client UIs (inline SVG to avoid dead GitHub asset URLs) */
export const SERVER_ICONS: Icon[] = [
  {
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNnoiLz48cGF0aCBkPSJNMTQgMnY2aDYiLz48cGF0aCBkPSJNOCAxM2g4Ii8+PHBhdGggZD0iTTggMTdoOCIvPjwvc3ZnPg==',
    mimeType: 'image/svg+xml',
  },
];

/** Human-readable version string */
export const VERSION_STRING = `ServalSheets v${VERSION} (MCP ${MCP_PROTOCOL_VERSION})`;
