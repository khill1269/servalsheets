/**
 * ServalSheets - Version Information
 *
 * Single source of truth for version numbers.
 * Import this instead of hardcoding versions.
 */
/** Current version - sync with package.json */
export const VERSION = '1.4.0';
/** Protocol version */
export const MCP_PROTOCOL_VERSION = '2025-11-25';
/** Server info for MCP initialization */
export const SERVER_INFO = {
    name: 'servalsheets',
    version: VERSION,
    protocolVersion: MCP_PROTOCOL_VERSION,
};
/** Server icon metadata for client UIs */
export const SERVER_ICONS = [
    {
        src: 'https://raw.githubusercontent.com/khill1269/servalsheets/main/assets/serval-icon.png',
        mimeType: 'image/png',
        sizes: ['1536x1024'],
    },
];
/** Human-readable version string */
export const VERSION_STRING = `ServalSheets v${VERSION} (MCP ${MCP_PROTOCOL_VERSION})`;
//# sourceMappingURL=version.js.map