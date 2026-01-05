/**
 * ServalSheets
 * 
 * Production-grade Google Sheets MCP Server
 * 15 tools, 156 actions, safety rails, enterprise features
 * 
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 */

// Server
export { ServalSheetsServer, createServalSheetsServer, type ServalSheetsServerOptions } from './server.js';

// HTTP/SSE Transport
export { createHttpServer, type HttpServerOptions } from './http-server.js';

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
export const VERSION = '1.2.0';
export const MCP_PROTOCOL_VERSION = '2025-11-25';
export const SHEETS_API_VERSION = 'v4';
