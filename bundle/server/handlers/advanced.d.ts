/**
 * ServalSheets - Advanced Handler
 *
 * Handles sheets_advanced tool (named ranges, protections, metadata, banding)
 * MCP Protocol: 2025-11-25
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsAdvancedInput, SheetsAdvancedOutput } from '../schemas/index.js';
export declare class AdvancedHandler extends BaseHandler<SheetsAdvancedInput, SheetsAdvancedOutput> {
    private sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    handle(input: SheetsAdvancedInput): Promise<SheetsAdvancedOutput>;
    protected createIntents(input: SheetsAdvancedInput): Intent[];
    private handleAddNamedRange;
    private handleUpdateNamedRange;
    private handleDeleteNamedRange;
    private handleListNamedRanges;
    private handleGetNamedRange;
    private handleAddProtectedRange;
    private handleUpdateProtectedRange;
    private handleDeleteProtectedRange;
    private handleListProtectedRanges;
    private handleSetMetadata;
    private handleGetMetadata;
    private handleDeleteMetadata;
    private handleAddBanding;
    private handleUpdateBanding;
    private handleDeleteBanding;
    private handleListBanding;
    private handleCreateTable;
    private handleDeleteTable;
    private handleListTables;
    private handleAddPersonChip;
    private handleAddDriveChip;
    private handleAddRichLinkChip;
    private handleListChips;
    private toGridRange;
    private mapNamedRange;
    private mapProtectedRange;
    /**
     * Convert Google Sheets Schema$GridRange (with nullable fields) to our GridRange type
     */
    private toGridRangeOutput;
}
//# sourceMappingURL=advanced.d.ts.map