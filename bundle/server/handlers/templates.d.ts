/**
 * ServalSheets - Templates Handler
 *
 * Handles sheets_templates tool (8 actions):
 * - list: List all saved templates
 * - get: Get template details
 * - create: Save spreadsheet as template
 * - apply: Create spreadsheet from template
 * - update: Update template definition
 * - delete: Delete template
 * - preview: Preview template structure
 * - import_builtin: Import from knowledge base
 *
 * Storage: Google Drive appDataFolder (hidden, user-specific)
 * Required scope: https://www.googleapis.com/auth/drive.appdata
 *
 * MCP Protocol: 2025-11-25
 */
import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsTemplatesInput, SheetsTemplatesOutput } from '../schemas/index.js';
export declare class SheetsTemplatesHandler extends BaseHandler<SheetsTemplatesInput, SheetsTemplatesOutput> {
    private sheetsApi;
    private driveApi;
    private templateStore;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi: drive_v3.Drive);
    handle(input: SheetsTemplatesInput): Promise<SheetsTemplatesOutput>;
    protected createIntents(_input: SheetsTemplatesInput): Intent[];
    /**
     * List all templates
     */
    private handleList;
    /**
     * Get template details
     */
    private handleGet;
    /**
     * Create template from spreadsheet
     */
    private handleCreate;
    /**
     * Apply template to create new spreadsheet
     */
    private handleApply;
    /**
     * Update template
     */
    private handleUpdate;
    /**
     * Delete template
     */
    private handleDelete;
    /**
     * Preview template structure
     */
    private handlePreview;
    /**
     * Import builtin template to user's collection
     */
    private handleImportBuiltin;
    /**
     * Parse A1 notation range to GridRange
     */
    private parseA1Range;
}
//# sourceMappingURL=templates.d.ts.map