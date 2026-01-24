/**
 * ServalSheets - Core Handler (Consolidated)
 *
 * Handles sheets_core tool (15 actions total):
 * - Spreadsheet operations (8): get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list
 * - Sheet/tab operations (7): add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet
 *
 * Consolidates legacy sheets_spreadsheet + sheets_sheet handlers
 * MCP Protocol: 2025-11-25
 */
import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsCoreInput, SheetsCoreOutput } from '../schemas/index.js';
export declare class SheetsCoreHandler extends BaseHandler<SheetsCoreInput, SheetsCoreOutput> {
    private sheetsApi;
    private driveApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive);
    handle(input: SheetsCoreInput): Promise<SheetsCoreOutput>;
    /**
     * Apply verbosity filtering with core-specific customization
     * Uses base handler's applyVerbosityFilter and adds spreadsheet-specific logic
     */
    private applyCoreVerbosityFilter;
    protected createIntents(input: SheetsCoreInput): Intent[];
    /**
     * Get spreadsheet metadata
     */
    private handleGet;
    /**
     * Create a new spreadsheet
     */
    private handleCreate;
    /**
     * Copy spreadsheet to Drive
     */
    private handleCopy;
    /**
     * Update spreadsheet properties
     */
    private handleUpdateProperties;
    /**
     * Get spreadsheet URL
     */
    private handleGetUrl;
    /**
     * Batch get multiple spreadsheets
     */
    private handleBatchGet;
    /**
     * Get comprehensive metadata for analysis
     */
    private handleGetComprehensive;
    /**
     * List user's spreadsheets
     */
    private handleList;
    /**
     * Add a new sheet/tab
     */
    private handleAddSheet;
    /**
     * Delete a sheet/tab
     */
    private handleDeleteSheet;
    /**
     * Duplicate a sheet/tab
     */
    private handleDuplicateSheet;
    /**
     * Update sheet/tab properties
     */
    private handleUpdateSheet;
    /**
     * Copy sheet/tab to another spreadsheet
     */
    private handleCopySheetTo;
    /**
     * List all sheets/tabs in a spreadsheet
     */
    private handleListSheets;
    /**
     * Get info for a specific sheet/tab
     */
    private handleGetSheet;
    /**
     * Convert Google API tab color to our schema format
     */
    private convertTabColor;
    /**
     * Check if a sheet exists in a spreadsheet
     */
    private sheetExists;
}
//# sourceMappingURL=core.d.ts.map