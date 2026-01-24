/**
 * ServalSheets - Handler Index
 *
 * Lazy-loading handler factory for faster initialization.
 *
 * Architectural Notes (MCP 2025-11-25):
 * - Claude (LLM) does planning and orchestration
 * - sheets_confirm uses Elicitation (SEP-1036) for user confirmation
 * - sheets_analyze uses Sampling (SEP-1577) for AI analysis
 * - Removed: planning, insights (anti-patterns that duplicated LLM capabilities)
 */
export * from './base.js';
export * from './optimization.js';
export type { SheetsDataHandler } from './data.js';
export type { FormatHandler } from './format.js';
export type { DimensionsHandler } from './dimensions.js';
export type { AdvancedHandler } from './advanced.js';
export type { TransactionHandler } from './transaction.js';
export type { QualityHandler } from './quality.js';
export type { HistoryHandler } from './history.js';
export type { ConfirmHandler } from './confirm.js';
export type { AnalyzeHandler } from './analyze.js';
export type { CompositeHandler } from './composite.js';
export type { SessionHandler } from './session.js';
export type { SheetsCoreHandler } from './core.js';
export type { VisualizeHandler } from './visualize.js';
export type { CollaborateHandler } from './collaborate.js';
export type { SheetsTemplatesHandler } from './templates.js';
export type { SheetsBigQueryHandler } from './bigquery.js';
export type { SheetsAppsScriptHandler } from './appsscript.js';
import type { sheets_v4, drive_v3 } from 'googleapis';
import type { bigquery_v2 } from 'googleapis';
import type { HandlerContext } from './base.js';
export interface HandlerFactoryOptions {
    context: HandlerContext;
    sheetsApi: sheets_v4.Sheets;
    driveApi: drive_v3.Drive;
    bigqueryApi?: bigquery_v2.Bigquery;
}
export interface Handlers {
    data: import('./data.js').SheetsDataHandler;
    format: import('./format.js').FormatHandler;
    dimensions: import('./dimensions.js').DimensionsHandler;
    advanced: import('./advanced.js').AdvancedHandler;
    transaction: import('./transaction.js').TransactionHandler;
    quality: import('./quality.js').QualityHandler;
    history: import('./history.js').HistoryHandler;
    confirm: import('./confirm.js').ConfirmHandler;
    analyze: import('./analyze.js').AnalyzeHandler;
    fix: import('./fix.js').FixHandler;
    composite: import('./composite.js').CompositeHandler;
    session: import('./session.js').SessionHandler;
    core: import('./core.js').SheetsCoreHandler;
    visualize: import('./visualize.js').VisualizeHandler;
    collaborate: import('./collaborate.js').CollaborateHandler;
    templates: import('./templates.js').SheetsTemplatesHandler;
    bigquery: import('./bigquery.js').SheetsBigQueryHandler;
    appsscript: import('./appsscript.js').SheetsAppsScriptHandler;
}
/**
 * Lazy-loading handler factory
 * Handlers are only imported and instantiated when first accessed
 * Provides ~30% faster initialization for typical usage
 */
export declare function createHandlers(options: HandlerFactoryOptions): Handlers;
//# sourceMappingURL=index.d.ts.map