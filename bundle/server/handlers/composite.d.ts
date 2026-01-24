/**
 * ServalSheets - Composite Operations Handler
 *
 * Handles high-level composite operations (import_csv, smart_append, etc.)
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * @module handlers/composite
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { CompositeInput, CompositeOutput } from '../schemas/composite.js';
import type { Intent } from '../core/intent.js';
/**
 * Composite Operations Handler
 *
 * Provides high-level operations that combine multiple API calls.
 */
export declare class CompositeHandler extends BaseHandler<CompositeInput, CompositeOutput> {
    private sheetsApi;
    private compositeService;
    private sheetResolver;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    handle(input: CompositeInput): Promise<CompositeOutput>;
    protected createIntents(_input: CompositeInput): Intent[];
    private handleImportCsv;
    private handleSmartAppend;
    private handleBulkUpdate;
    private handleDeduplicate;
}
//# sourceMappingURL=composite.d.ts.map