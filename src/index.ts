/**
 * ServalSheets
 *
 * Production-grade Google Sheets MCP Server
 * 16 tools, 207 actions, safety rails, enterprise features
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 */

// Server
export {
  ServalSheetsServer,
  createServalSheetsServer,
  type ServalSheetsServerOptions,
} from './server.js';

// HTTP/SSE Transport
export {
  createHttpServer,
  startHttpServer,
  startRemoteServer,
  type HttpServerOptions,
} from './http-server.js';

// OAuth Provider
export { OAuthProvider, type OAuthConfig } from './oauth-provider.js';

// Schemas
export * from './schemas/index.js';

// Core
export * from './core/index.js';

// Services
export * from './services/index.js';

// Handlers
export * from './handlers/index.js';

// Version info
export {
  VERSION,
  MCP_PROTOCOL_VERSION,
  VERSION_STRING,
  SERVER_INFO,
  SERVER_ICONS,
} from './version.js';
export const SHEETS_API_VERSION = 'v4';
