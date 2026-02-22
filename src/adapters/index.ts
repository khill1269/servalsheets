/**
 * ServalSheets - Backend Adapters
 *
 * SpreadsheetBackend implementations for specific platforms.
 */
export { GoogleSheetsBackend } from './google-sheets-backend.js';
export { ExcelOnlineBackend } from './excel-online-backend.js';
export type { GraphClient, GraphRequest, ExcelOnlineConfig } from './excel-online-backend.js';
export { NotionBackend } from './notion-backend.js';
export type { NotionClient, NotionBackendConfig } from './notion-backend.js';
export { AirtableBackend } from './airtable-backend.js';
export type { AirtableClient, AirtableBackendConfig } from './airtable-backend.js';
