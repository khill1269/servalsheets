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
import { BaseHandler, unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';
import { CompositeOperationsService, } from '../services/composite-operations.js';
import { initializeSheetResolver } from '../services/sheet-resolver.js';
import { getRequestLogger } from '../utils/request-context.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
// ============================================================================
// Handler
// ============================================================================
/**
 * Composite Operations Handler
 *
 * Provides high-level operations that combine multiple API calls.
 */
export class CompositeHandler extends BaseHandler {
    sheetsApi;
    compositeService;
    sheetResolver;
    constructor(context, sheetsApi) {
        super('sheets_composite', context);
        this.sheetsApi = sheetsApi;
        // Initialize sheet resolver
        this.sheetResolver = initializeSheetResolver(sheetsApi);
        // Initialize composite operations service
        this.compositeService = new CompositeOperationsService(sheetsApi, this.sheetResolver);
    }
    async handle(input) {
        const req = unwrapRequest(input);
        const logger = getRequestLogger();
        this.trackSpreadsheetId(req.spreadsheetId);
        try {
            let response;
            switch (req.action) {
                case 'import_csv':
                    response = await this.handleImportCsv(req);
                    break;
                case 'smart_append':
                    response = await this.handleSmartAppend(req);
                    break;
                case 'bulk_update':
                    response = await this.handleBulkUpdate(req);
                    break;
                case 'deduplicate':
                    response = await this.handleDeduplicate(req);
                    break;
                default: {
                    // Exhaustive check - TypeScript ensures this is unreachable
                    const _exhaustiveCheck = req;
                    throw new ValidationError(`Unknown action: ${req.action}`, 'action', 'import_csv | smart_append | bulk_update | deduplicate');
                }
            }
            // Track context - all actions have spreadsheetId
            this.trackContextFromRequest({
                spreadsheetId: req.spreadsheetId,
            });
            // Apply verbosity filtering - all actions now have verbosity field
            const verbosity = req.verbosity ?? 'standard';
            const filteredResponse = super.applyVerbosityFilter(response, verbosity);
            return { response: filteredResponse };
        }
        catch (error) {
            logger.error('Composite operation failed', {
                action: req.action,
                error: error instanceof Error ? error.message : String(error),
            });
            return { response: this.mapError(error) };
        }
    }
    createIntents(_input) {
        // Composite operations use services directly, not intents
        return [];
    }
    // ==========================================================================
    // Action Handlers
    // ==========================================================================
    async handleImportCsv(input) {
        const result = await this.compositeService.importCsv({
            spreadsheetId: input.spreadsheetId,
            sheet: input.sheet !== undefined
                ? typeof input.sheet === 'string'
                    ? input.sheet
                    : input.sheet
                : undefined,
            csvData: input.csvData,
            delimiter: input.delimiter,
            hasHeader: input.hasHeader,
            mode: input.mode,
            newSheetName: input.newSheetName,
            skipEmptyRows: input.skipEmptyRows,
            trimValues: input.trimValues,
        });
        const cellsAffected = result.rowsImported * result.columnsImported;
        return this.success('import_csv', {
            ...result,
            mutation: {
                cellsAffected,
                reversible: false,
            },
        });
    }
    async handleSmartAppend(input) {
        const result = await this.compositeService.smartAppend({
            spreadsheetId: input.spreadsheetId,
            sheet: input.sheet,
            data: input.data,
            matchHeaders: input.matchHeaders,
            createMissingColumns: input.createMissingColumns,
            skipEmptyRows: input.skipEmptyRows,
        });
        const cellsAffected = result.rowsAppended * result.columnsMatched.length;
        return this.success('smart_append', {
            ...result,
            mutation: {
                cellsAffected,
                reversible: false,
            },
        });
    }
    async handleBulkUpdate(input) {
        // Safety check: dry-run mode
        if (input.safety?.dryRun) {
            return {
                success: true,
                action: 'bulk_update',
                rowsUpdated: 0,
                rowsCreated: 0,
                keysNotFound: [],
                cellsModified: 0,
                mutation: {
                    cellsAffected: 0,
                    reversible: false,
                },
                _meta: this.generateMeta('bulk_update', input, {}, { cellsAffected: 0 }),
            };
        }
        // Request confirmation if elicitation available and large update
        const estimatedUpdates = input.updates.length;
        if (estimatedUpdates > 10 && this.context.elicitationServer) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'bulk_update', `Perform bulk update of ${estimatedUpdates} records in spreadsheet ${input.spreadsheetId}. This will modify multiple cells based on key column matches. This action cannot be easily undone.`);
            if (!confirmation.confirmed) {
                return {
                    success: false,
                    error: {
                        code: 'PRECONDITION_FAILED',
                        message: confirmation.reason || 'User cancelled the operation',
                        retryable: false,
                    },
                };
            }
        }
        // Create snapshot if requested
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'bulk_update',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
            affectedCells: estimatedUpdates * Object.keys(input.updates[0] || {}).length,
        }, input.safety);
        const result = await this.compositeService.bulkUpdate({
            spreadsheetId: input.spreadsheetId,
            sheet: input.sheet,
            keyColumn: input.keyColumn,
            updates: input.updates,
            createUnmatched: input.createUnmatched,
        });
        return {
            success: true,
            action: 'bulk_update',
            ...result,
            mutation: {
                cellsAffected: result.cellsModified,
                reversible: false,
            },
            snapshotId: snapshot?.snapshotId,
            _meta: this.generateMeta('bulk_update', input, result, {
                cellsAffected: result.cellsModified,
            }),
        };
    }
    async handleDeduplicate(input) {
        // Safety check: preview mode (dry-run equivalent)
        if (input.preview) {
            const result = await this.compositeService.deduplicate({
                spreadsheetId: input.spreadsheetId,
                sheet: input.sheet,
                keyColumns: input.keyColumns,
                keep: input.keep,
                preview: true,
            });
            return {
                success: true,
                action: 'deduplicate',
                ...result,
                mutation: result.rowsDeleted > 0
                    ? {
                        cellsAffected: result.rowsDeleted,
                        reversible: false,
                    }
                    : undefined,
                _meta: this.generateMeta('deduplicate', input, result, { cellsAffected: result.rowsDeleted }),
            };
        }
        // Safety check: dry-run mode
        if (input.safety?.dryRun) {
            return {
                success: true,
                action: 'deduplicate',
                totalRows: 0,
                uniqueRows: 0,
                duplicatesFound: 0,
                rowsDeleted: 0,
                _meta: this.generateMeta('deduplicate', input, {}, { cellsAffected: 0 }),
            };
        }
        // First run in preview mode to get count
        const previewResult = await this.compositeService.deduplicate({
            spreadsheetId: input.spreadsheetId,
            sheet: input.sheet,
            keyColumns: input.keyColumns,
            keep: input.keep,
            preview: true,
        });
        // Request confirmation if elicitation available and many duplicates found
        if (previewResult.duplicatesFound > 0 && this.context.elicitationServer) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'deduplicate', `Remove ${previewResult.duplicatesFound} duplicate rows from spreadsheet ${input.spreadsheetId}. Keeping ${input.keep || 'first'} occurrence of each duplicate. This action cannot be undone.`);
            if (!confirmation.confirmed) {
                return {
                    success: false,
                    error: {
                        code: 'PRECONDITION_FAILED',
                        message: confirmation.reason || 'User cancelled the operation',
                        retryable: false,
                    },
                };
            }
        }
        // Create snapshot if requested
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'deduplicate',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
            affectedRows: previewResult.duplicatesFound,
        }, input.safety);
        // Execute the actual deduplication
        const result = await this.compositeService.deduplicate({
            spreadsheetId: input.spreadsheetId,
            sheet: input.sheet,
            keyColumns: input.keyColumns,
            keep: input.keep,
            preview: false,
        });
        return {
            success: true,
            action: 'deduplicate',
            ...result,
            mutation: result.rowsDeleted > 0
                ? {
                    cellsAffected: result.rowsDeleted,
                    reversible: false,
                }
                : undefined,
            snapshotId: snapshot?.snapshotId,
            _meta: this.generateMeta('deduplicate', input, result, { cellsAffected: result.rowsDeleted }),
        };
    }
}
//# sourceMappingURL=composite.js.map