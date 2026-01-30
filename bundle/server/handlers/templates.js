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
import { BaseHandler, unwrapRequest } from './base.js';
import { TemplateStore } from '../services/template-store.js';
import { logger } from '../utils/logger.js';
export class SheetsTemplatesHandler extends BaseHandler {
    sheetsApi;
    driveApi;
    templateStore;
    constructor(context, sheetsApi, driveApi) {
        super('sheets_templates', context);
        this.sheetsApi = sheetsApi;
        this.driveApi = driveApi;
        this.templateStore = new TemplateStore(driveApi);
    }
    async handle(input) {
        // 1. Unwrap request from wrapper
        const rawReq = unwrapRequest(input);
        // 2. Require auth
        this.requireAuth();
        try {
            // 3. Dispatch to action handler
            const req = rawReq;
            let response;
            switch (req.action) {
                case 'list':
                    response = await this.handleList(req);
                    break;
                case 'get':
                    response = await this.handleGet(req);
                    break;
                case 'create':
                    response = await this.handleCreate(req);
                    break;
                case 'apply':
                    response = await this.handleApply(req);
                    break;
                case 'update':
                    response = await this.handleUpdate(req);
                    break;
                case 'delete':
                    response = await this.handleDelete(req);
                    break;
                case 'preview':
                    response = await this.handlePreview(req);
                    break;
                case 'import_builtin':
                    response = await this.handleImportBuiltin(req);
                    break;
                default:
                    response = this.error({
                        code: 'INVALID_PARAMS',
                        message: `Unknown action: ${req.action}`,
                        retryable: false,
                    });
            }
            // 4. Return wrapped response
            return { response };
        }
        catch (err) {
            return { response: this.mapError(err) };
        }
    }
    // Required by BaseHandler
    createIntents(_input) {
        return []; // Templates don't use batch compiler
    }
    /**
     * List all templates
     */
    async handleList(req) {
        try {
            const userTemplates = await this.templateStore.list(req.category);
            let builtinTemplates = [];
            if (req.includeBuiltin) {
                const builtins = await this.templateStore.listBuiltinTemplates();
                builtinTemplates = builtins.map((b) => ({
                    id: `builtin:${b.id}`,
                    name: b.name,
                    description: b.description,
                    category: b.category,
                    sheetCount: b.sheets.length,
                }));
            }
            const allTemplates = [...userTemplates, ...builtinTemplates];
            return this.success('list', {
                templates: allTemplates,
                totalTemplates: allTemplates.length,
                builtinCount: builtinTemplates.length,
            });
        }
        catch (error) {
            logger.error('Failed to list templates', { error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Get template details
     */
    async handleGet(req) {
        try {
            // Check if it's a builtin template
            if (req.templateId.startsWith('builtin:')) {
                const builtinId = req.templateId.replace('builtin:', '');
                const builtin = await this.templateStore.getBuiltinTemplate(builtinId);
                if (!builtin) {
                    return this.error({
                        code: 'NOT_FOUND',
                        message: `Builtin template not found: ${builtinId}`,
                        retryable: false,
                    });
                }
                return this.success('get', {
                    template: {
                        id: req.templateId,
                        name: builtin.name,
                        description: builtin.description,
                        category: builtin.category,
                        version: '1.0.0',
                        sheets: builtin.sheets,
                    },
                });
            }
            const template = await this.templateStore.get(req.templateId);
            if (!template) {
                return this.error({
                    code: 'NOT_FOUND',
                    message: `Template not found: ${req.templateId}`,
                    retryable: false,
                });
            }
            return this.success('get', { template });
        }
        catch (error) {
            logger.error('Failed to get template', { templateId: req.templateId, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to get template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Create template from spreadsheet
     */
    async handleCreate(req) {
        try {
            // Get spreadsheet metadata
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: req.spreadsheetId,
                includeGridData: req.includeData ?? false,
                fields: req.includeData ? 'sheets(properties,data)' : 'sheets(properties)',
            });
            const sheets = spreadsheet.data.sheets || [];
            const templateSheets = sheets.map((sheet) => ({
                name: sheet.properties?.title || 'Sheet',
                rowCount: sheet.properties?.gridProperties?.rowCount || 1000,
                columnCount: sheet.properties?.gridProperties?.columnCount || 26,
                frozenRowCount: sheet.properties?.gridProperties?.frozenRowCount ?? undefined,
                frozenColumnCount: sheet.properties?.gridProperties?.frozenColumnCount ?? undefined,
                // Extract headers from first row if data is included
                headers: req.includeData && sheet.data?.[0]?.rowData?.[0]?.values
                    ? sheet.data[0].rowData[0].values
                        .map((cell) => cell.formattedValue || '')
                        .filter((v) => v)
                    : undefined,
            }));
            const template = await this.templateStore.create({
                name: req.name,
                description: req.description,
                category: req.category,
                version: '1.0.0',
                sheets: templateSheets,
            });
            return this.success('create', { template });
        }
        catch (error) {
            logger.error('Failed to create template', { spreadsheetId: req.spreadsheetId, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to create template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Apply template to create new spreadsheet
     */
    async handleApply(req) {
        try {
            // Get template (user or builtin)
            let templateData;
            if (req.templateId.startsWith('builtin:')) {
                const builtinId = req.templateId.replace('builtin:', '');
                const builtin = await this.templateStore.getBuiltinTemplate(builtinId);
                if (!builtin) {
                    return this.error({
                        code: 'NOT_FOUND',
                        message: `Builtin template not found: ${builtinId}`,
                        retryable: false,
                    });
                }
                templateData = { sheets: builtin.sheets };
            }
            else {
                const template = await this.templateStore.get(req.templateId);
                if (!template) {
                    return this.error({
                        code: 'NOT_FOUND',
                        message: `Template not found: ${req.templateId}`,
                        retryable: false,
                    });
                }
                templateData = template;
            }
            // Build spreadsheet create request
            const createRequest = {
                properties: {
                    title: req.title,
                },
                sheets: templateData.sheets.map((sheet, index) => ({
                    properties: {
                        sheetId: index,
                        title: sheet.name,
                        gridProperties: {
                            rowCount: sheet.rowCount || 1000,
                            columnCount: sheet.columnCount || 26,
                            frozenRowCount: sheet.frozenRowCount,
                            frozenColumnCount: sheet.frozenColumnCount,
                        },
                    },
                })),
            };
            // Create spreadsheet
            const response = await this.sheetsApi.spreadsheets.create({
                requestBody: createRequest,
            });
            const spreadsheetId = response.data.spreadsheetId;
            const spreadsheetUrl = response.data.spreadsheetUrl;
            // Apply headers if defined
            const requests = [];
            for (let i = 0; i < templateData.sheets.length; i++) {
                const sheet = templateData.sheets[i];
                if (!sheet)
                    continue;
                if (sheet.headers && sheet.headers.length > 0) {
                    requests.push({
                        updateCells: {
                            rows: [
                                {
                                    values: sheet.headers.map((header) => ({
                                        userEnteredValue: { stringValue: header },
                                        userEnteredFormat: { textFormat: { bold: true } },
                                    })),
                                },
                            ],
                            fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
                            start: {
                                sheetId: i,
                                rowIndex: 0,
                                columnIndex: 0,
                            },
                        },
                    });
                }
                // Apply column widths if defined
                if (sheet.columnWidths) {
                    for (let col = 0; col < sheet.columnWidths.length; col++) {
                        const width = sheet.columnWidths[col];
                        if (width === undefined)
                            continue;
                        requests.push({
                            updateDimensionProperties: {
                                range: {
                                    sheetId: i,
                                    dimension: 'COLUMNS',
                                    startIndex: col,
                                    endIndex: col + 1,
                                },
                                properties: {
                                    pixelSize: width,
                                },
                                fields: 'pixelSize',
                            },
                        });
                    }
                }
            }
            // Add named ranges if defined
            if (templateData.namedRanges) {
                for (const namedRange of templateData.namedRanges) {
                    requests.push({
                        addNamedRange: {
                            namedRange: {
                                name: namedRange.name,
                                range: this.parseA1Range(namedRange.range, response.data.sheets || []),
                            },
                        },
                    });
                }
            }
            // Apply batch updates if any
            if (requests.length > 0) {
                await this.sheetsApi.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: { requests },
                });
            }
            // Move to folder if specified
            if (req.folderId) {
                try {
                    await this.driveApi.files.update({
                        fileId: spreadsheetId,
                        addParents: req.folderId,
                        fields: 'id',
                    });
                }
                catch (moveError) {
                    logger.warn('Failed to move spreadsheet to folder', {
                        folderId: req.folderId,
                        error: moveError,
                    });
                    // Don't fail the whole operation for this
                }
            }
            logger.info('Applied template', {
                templateId: req.templateId,
                spreadsheetId,
                title: req.title,
            });
            return this.success('apply', {
                spreadsheetId,
                spreadsheetUrl,
            });
        }
        catch (error) {
            logger.error('Failed to apply template', { templateId: req.templateId, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to apply template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Update template
     */
    async handleUpdate(req) {
        try {
            if (req.templateId.startsWith('builtin:')) {
                return this.error({
                    code: 'INVALID_REQUEST',
                    message: 'Cannot update builtin templates. Use import_builtin first.',
                    retryable: false,
                });
            }
            const template = await this.templateStore.update(req.templateId, {
                name: req.name,
                description: req.description,
                category: req.category,
                sheets: req.sheets,
                namedRanges: req.namedRanges,
                metadata: req.metadata,
            });
            return this.success('update', { template });
        }
        catch (error) {
            logger.error('Failed to update template', { templateId: req.templateId, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to update template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Delete template
     */
    async handleDelete(req) {
        try {
            if (req.templateId.startsWith('builtin:')) {
                return this.error({
                    code: 'INVALID_REQUEST',
                    message: 'Cannot delete builtin templates.',
                    retryable: false,
                });
            }
            const deleted = await this.templateStore.delete(req.templateId);
            return this.success('delete', { deleted });
        }
        catch (error) {
            logger.error('Failed to delete template', { templateId: req.templateId, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to delete template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Preview template structure
     */
    async handlePreview(req) {
        try {
            // Get template (user or builtin)
            let templateData;
            if (req.templateId.startsWith('builtin:')) {
                const builtinId = req.templateId.replace('builtin:', '');
                const builtin = await this.templateStore.getBuiltinTemplate(builtinId);
                if (!builtin) {
                    return this.error({
                        code: 'NOT_FOUND',
                        message: `Builtin template not found: ${builtinId}`,
                        retryable: false,
                    });
                }
                templateData = {
                    name: builtin.name,
                    description: builtin.description,
                    sheets: builtin.sheets,
                };
            }
            else {
                const template = await this.templateStore.get(req.templateId);
                if (!template) {
                    return this.error({
                        code: 'NOT_FOUND',
                        message: `Template not found: ${req.templateId}`,
                        retryable: false,
                    });
                }
                templateData = template;
            }
            return this.success('preview', {
                preview: {
                    name: templateData.name,
                    description: templateData.description,
                    sheets: templateData.sheets.map((s) => ({
                        name: s.name,
                        headers: s.headers,
                        rowCount: s.rowCount,
                        columnCount: s.columnCount,
                    })),
                    namedRanges: templateData.namedRanges?.map((nr) => nr.name),
                },
            });
        }
        catch (error) {
            logger.error('Failed to preview template', { templateId: req.templateId, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to preview template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Import builtin template to user's collection
     */
    async handleImportBuiltin(req) {
        try {
            const builtin = await this.templateStore.getBuiltinTemplate(req.builtinName);
            if (!builtin) {
                return this.error({
                    code: 'NOT_FOUND',
                    message: `Builtin template not found: ${req.builtinName}`,
                    retryable: false,
                });
            }
            const template = await this.templateStore.create({
                name: req.customName || builtin.name,
                description: builtin.description,
                category: builtin.category,
                version: '1.0.0',
                sheets: builtin.sheets,
            });
            return this.success('import_builtin', {
                template,
                importedTemplateId: template.id,
            });
        }
        catch (error) {
            logger.error('Failed to import builtin template', { builtinName: req.builtinName, error });
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Failed to import builtin template: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    /**
     * Parse A1 notation range to GridRange
     */
    parseA1Range(a1Range, sheets) {
        // Simple parser - handles "Sheet1!A1:B10" format
        const match = a1Range.match(/^(.+?)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) {
            logger.debug(`Invalid A1 range format: ${a1Range}`);
            return {}; // OK: Explicit empty for invalid format (caller handles gracefully)
        }
        const [, sheetName, startCol, startRow, endCol, endRow] = match;
        // Validate all captured groups exist
        if (!sheetName || !startCol || !startRow || !endCol || !endRow) {
            logger.debug(`Incomplete A1 range components: ${a1Range}`);
            return {}; // OK: Explicit empty for invalid format (caller handles gracefully)
        }
        const sheet = sheets.find((s) => s.properties?.title === sheetName);
        const sheetId = sheet?.properties?.sheetId ?? 0;
        return {
            sheetId,
            startRowIndex: parseInt(startRow, 10) - 1,
            endRowIndex: parseInt(endRow, 10),
            startColumnIndex: this.letterToColumn(startCol.toUpperCase()),
            endColumnIndex: this.letterToColumn(endCol.toUpperCase()) + 1,
        };
    }
}
//# sourceMappingURL=templates.js.map