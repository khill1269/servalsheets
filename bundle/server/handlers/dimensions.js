/**
 * ServalSheets - Dimensions Handler
 *
 * Handles sheets_dimensions tool (row/column operations, filtering, and sorting)
 * MCP Protocol: 2025-11-25
 *
 * 35 Actions:
 * - insert_rows, insert_columns
 * - delete_rows, delete_columns
 * - move_rows, move_columns
 * - resize_rows, resize_columns, auto_resize
 * - hide_rows, hide_columns, show_rows, show_columns
 * - freeze_rows, freeze_columns
 * - group_rows, group_columns, ungroup_rows, ungroup_columns
 * - append_rows, append_columns
 * - filter_set_basic_filter, filter_clear_basic_filter, filter_get_basic_filter, filter_update_filter_criteria
 * - filter_sort_range
 * - filter_create_filter_view, filter_update_filter_view, filter_delete_filter_view, filter_list_filter_views, filter_get_filter_view
 * - filter_create_slicer, filter_update_slicer, filter_delete_slicer, filter_list_slicers
 */
import { BaseHandler, unwrapRequest } from './base.js';
import { parseA1Notation, parseCellReference, toGridRange, } from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
export class DimensionsHandler extends BaseHandler {
    sheetsApi;
    constructor(context, sheetsApi) {
        super('sheets_dimensions', context);
        this.sheetsApi = sheetsApi;
    }
    async handle(input) {
        // Extract the request from the wrapper
        const rawReq = unwrapRequest(input);
        // Phase 1, Task 1.4: Infer missing parameters from context
        const req = this.inferRequestParameters(rawReq);
        try {
            let response;
            switch (req.action) {
                case 'insert_rows':
                    response = await this.handleInsertRows(req);
                    break;
                case 'insert_columns':
                    response = await this.handleInsertColumns(req);
                    break;
                case 'delete_rows':
                    response = await this.handleDeleteRows(req);
                    break;
                case 'delete_columns':
                    response = await this.handleDeleteColumns(req);
                    break;
                case 'move_rows':
                    response = await this.handleMoveRows(req);
                    break;
                case 'move_columns':
                    response = await this.handleMoveColumns(req);
                    break;
                case 'resize_rows':
                    response = await this.handleResizeRows(req);
                    break;
                case 'resize_columns':
                    response = await this.handleResizeColumns(req);
                    break;
                case 'auto_resize':
                    response = await this.handleAutoResize(req);
                    break;
                case 'hide_rows':
                    response = await this.handleHideRows(req);
                    break;
                case 'hide_columns':
                    response = await this.handleHideColumns(req);
                    break;
                case 'show_rows':
                    response = await this.handleShowRows(req);
                    break;
                case 'show_columns':
                    response = await this.handleShowColumns(req);
                    break;
                case 'freeze_rows':
                    response = await this.handleFreezeRows(req);
                    break;
                case 'freeze_columns':
                    response = await this.handleFreezeColumns(req);
                    break;
                case 'group_rows':
                    response = await this.handleGroupRows(req);
                    break;
                case 'group_columns':
                    response = await this.handleGroupColumns(req);
                    break;
                case 'ungroup_rows':
                    response = await this.handleUngroupRows(req);
                    break;
                case 'ungroup_columns':
                    response = await this.handleUngroupColumns(req);
                    break;
                case 'append_rows':
                    response = await this.handleAppendRows(req);
                    break;
                case 'append_columns':
                    response = await this.handleAppendColumns(req);
                    break;
                case 'set_basic_filter':
                    response = await this.handleSetBasicFilter(req);
                    break;
                case 'clear_basic_filter':
                    response = await this.handleClearBasicFilter(req);
                    break;
                case 'get_basic_filter':
                    response = await this.handleGetBasicFilter(req);
                    break;
                case 'filter_update_filter_criteria':
                    response = await this.handleFilterUpdateFilterCriteria(req);
                    break;
                case 'sort_range':
                    response = await this.handleSortRange(req);
                    break;
                // Range utility operations (4 new)
                case 'trim_whitespace':
                    response = await this.handleTrimWhitespace(req);
                    break;
                case 'randomize_range':
                    response = await this.handleRandomizeRange(req);
                    break;
                case 'text_to_columns':
                    response = await this.handleTextToColumns(req);
                    break;
                case 'auto_fill':
                    response = await this.handleAutoFill(req);
                    break;
                case 'create_filter_view':
                    response = await this.handleCreateFilterView(req);
                    break;
                case 'update_filter_view':
                    response = await this.handleUpdateFilterView(req);
                    break;
                case 'delete_filter_view':
                    response = await this.handleDeleteFilterView(req);
                    break;
                case 'list_filter_views':
                    response = await this.handleListFilterViews(req);
                    break;
                case 'get_filter_view':
                    response = await this.handleGetFilterView(req);
                    break;
                case 'create_slicer':
                    response = await this.handleCreateSlicer(req);
                    break;
                case 'update_slicer':
                    response = await this.handleUpdateSlicer(req);
                    break;
                case 'delete_slicer':
                    response = await this.handleDeleteSlicer(req);
                    break;
                case 'list_slicers':
                    response = await this.handleListSlicers(req);
                    break;
                default:
                    response = this.error({
                        code: 'INVALID_PARAMS',
                        message: `Unknown action: ${req.action}`,
                        retryable: false,
                    });
            }
            // Track context on success
            if (response.success) {
                this.trackContextFromRequest({
                    spreadsheetId: req.spreadsheetId,
                    sheetId: 'sheetId' in req
                        ? typeof req.sheetId === 'number'
                            ? req.sheetId
                            : undefined
                        : undefined,
                });
            }
            // Apply verbosity filtering (LLM optimization) - uses base handler implementation
            const verbosity = req.verbosity ?? 'standard';
            const filteredResponse = super.applyVerbosityFilter(response, verbosity);
            return { response: filteredResponse };
        }
        catch (err) {
            return { response: this.mapError(err) };
        }
    }
    createIntents(input) {
        // Extract the request from the wrapper
        const req = unwrapRequest(input);
        // Filter operations execute directly; no batch compiler intents needed
        if (req.action.startsWith('filter_')) {
            return [];
        }
        const destructiveActions = ['delete_rows', 'delete_columns', 'move_rows', 'move_columns'];
        return [
            {
                type: req.action.startsWith('delete')
                    ? 'DELETE_DIMENSION'
                    : req.action.startsWith('insert') || req.action.startsWith('append')
                        ? 'INSERT_DIMENSION'
                        : 'UPDATE_DIMENSION_PROPERTIES',
                target: { spreadsheetId: req.spreadsheetId, sheetId: req.sheetId },
                payload: {},
                metadata: {
                    sourceTool: this.toolName,
                    sourceAction: req.action,
                    priority: 1,
                    destructive: destructiveActions.includes(req.action),
                },
            },
        ];
    }
    // ============================================================
    // Insert Operations
    // ============================================================
    async handleInsertRows(input) {
        const count = input.count ?? 1;
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.startIndex + count,
                            },
                            inheritFromBefore: input.inheritFromBefore ?? false,
                        },
                    },
                ],
            },
        });
        return this.success('insert_rows', { rowsAffected: count });
    }
    async handleInsertColumns(input) {
        const count = input.count ?? 1;
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.startIndex + count,
                            },
                            inheritFromBefore: input.inheritFromBefore ?? false,
                        },
                    },
                ],
            },
        });
        return this.success('insert_columns', { columnsAffected: count });
    }
    // ============================================================
    // Delete Operations (Destructive)
    // ============================================================
    async handleDeleteRows(input) {
        const rowCount = input.endIndex - input.startIndex;
        // Generate safety warnings
        const safetyContext = {
            affectedRows: rowCount,
            isDestructive: true,
            operationType: 'delete_rows',
            spreadsheetId: input.spreadsheetId,
        };
        const warnings = this.getSafetyWarnings(safetyContext, input.safety);
        // Request confirmation for destructive operation if elicitation is supported
        if (this.context.elicitationServer && rowCount > 5) {
            try {
                const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'Delete Rows', `You are about to delete ${rowCount} row${rowCount > 1 ? 's' : ''} (rows ${input.startIndex + 1}-${input.endIndex}).\n\nAll data, formatting, and formulas in these rows will be permanently removed.`);
                if (!confirmation.confirmed) {
                    return this.error({
                        code: 'PRECONDITION_FAILED',
                        message: 'Row deletion cancelled by user',
                        retryable: false,
                    });
                }
            }
            catch (err) {
                // If elicitation fails, proceed (backward compatibility)
                this.context.logger?.warn('Elicitation failed for delete_rows, proceeding with operation', {
                    error: err,
                });
            }
        }
        if (input.safety?.dryRun) {
            const meta = this.generateMeta('delete_rows', input, undefined, {
                cellsAffected: rowCount,
            });
            if (warnings.length > 0) {
                meta.warnings = this.formatWarnings(warnings);
            }
            return this.success('delete_rows', { rowsAffected: rowCount }, undefined, true, meta);
        }
        // Create snapshot if requested
        const snapshot = await this.createSafetySnapshot(safetyContext, input.safety);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        // Build response with snapshot info if created
        const meta = this.generateMeta('delete_rows', input, { rowsAffected: rowCount }, { cellsAffected: rowCount });
        if (snapshot) {
            const snapshotInfo = this.snapshotInfo(snapshot);
            if (snapshotInfo) {
                meta.snapshot = snapshotInfo;
            }
        }
        if (warnings.length > 0) {
            meta.warnings = this.formatWarnings(warnings);
        }
        return this.success('delete_rows', { rowsAffected: rowCount }, undefined, false, meta);
    }
    async handleDeleteColumns(input) {
        const columnCount = input.endIndex - input.startIndex;
        // Generate safety warnings
        const safetyContext = {
            affectedColumns: columnCount,
            isDestructive: true,
            operationType: 'delete_columns',
            spreadsheetId: input.spreadsheetId,
        };
        const warnings = this.getSafetyWarnings(safetyContext, input.safety);
        // Request confirmation for destructive operation if elicitation is supported
        if (this.context.elicitationServer && columnCount > 3) {
            try {
                const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'Delete Columns', `You are about to delete ${columnCount} column${columnCount > 1 ? 's' : ''} (columns ${input.startIndex}-${input.endIndex - 1}).\n\nAll data, formatting, and formulas in these columns will be permanently removed.`);
                if (!confirmation.confirmed) {
                    return this.error({
                        code: 'PRECONDITION_FAILED',
                        message: 'Column deletion cancelled by user',
                        retryable: false,
                    });
                }
            }
            catch (err) {
                // If elicitation fails, proceed (backward compatibility)
                this.context.logger?.warn('Elicitation failed for delete_columns, proceeding with operation', { error: err });
            }
        }
        if (input.safety?.dryRun) {
            const meta = this.generateMeta('delete_columns', input, undefined, {
                cellsAffected: columnCount,
            });
            if (warnings.length > 0) {
                meta.warnings = this.formatWarnings(warnings);
            }
            return this.success('delete_columns', { columnsAffected: columnCount }, undefined, true, meta);
        }
        // Create snapshot if requested
        const snapshot = await this.createSafetySnapshot(safetyContext, input.safety);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        // Build response with snapshot info if created
        const meta = this.generateMeta('delete_columns', input, { columnsAffected: columnCount }, { cellsAffected: columnCount });
        if (snapshot) {
            const snapshotInfo = this.snapshotInfo(snapshot);
            if (snapshotInfo) {
                meta.snapshot = snapshotInfo;
            }
        }
        if (warnings.length > 0) {
            meta.warnings = this.formatWarnings(warnings);
        }
        return this.success('delete_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        }, undefined, false, meta);
    }
    // ============================================================
    // Move Operations
    // ============================================================
    async handleMoveRows(input) {
        if (input.safety?.dryRun) {
            return this.success('move_rows', { rowsAffected: input.endIndex - input.startIndex }, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        moveDimension: {
                            source: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            destinationIndex: input.destinationIndex,
                        },
                    },
                ],
            },
        });
        return this.success('move_rows', {
            rowsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleMoveColumns(input) {
        if (input.safety?.dryRun) {
            return this.success('move_columns', { columnsAffected: input.endIndex - input.startIndex }, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        moveDimension: {
                            source: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            destinationIndex: input.destinationIndex,
                        },
                    },
                ],
            },
        });
        return this.success('move_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        });
    }
    // ============================================================
    // Resize Operations
    // ============================================================
    async handleResizeRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            properties: {
                                pixelSize: input.pixelSize,
                            },
                            fields: 'pixelSize',
                        },
                    },
                ],
            },
        });
        return this.success('resize_rows', {
            rowsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleResizeColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            properties: {
                                pixelSize: input.pixelSize,
                            },
                            fields: 'pixelSize',
                        },
                    },
                ],
            },
        });
        return this.success('resize_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleAutoResize(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        autoResizeDimensions: {
                            dimensions: {
                                sheetId: input.sheetId,
                                dimension: input.dimension,
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        const count = input.endIndex - input.startIndex;
        return this.success('auto_resize', input.dimension === 'ROWS' ? { rowsAffected: count } : { columnsAffected: count });
    }
    // ============================================================
    // Visibility Operations
    // ============================================================
    async handleHideRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            properties: {
                                hiddenByUser: true,
                            },
                            fields: 'hiddenByUser',
                        },
                    },
                ],
            },
        });
        return this.success('hide_rows', {
            rowsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleHideColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            properties: {
                                hiddenByUser: true,
                            },
                            fields: 'hiddenByUser',
                        },
                    },
                ],
            },
        });
        return this.success('hide_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleShowRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            properties: {
                                hiddenByUser: false,
                            },
                            fields: 'hiddenByUser',
                        },
                    },
                ],
            },
        });
        return this.success('show_rows', {
            rowsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleShowColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                            properties: {
                                hiddenByUser: false,
                            },
                            fields: 'hiddenByUser',
                        },
                    },
                ],
            },
        });
        return this.success('show_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        });
    }
    // ============================================================
    // Freeze Operations
    // ============================================================
    async handleFreezeRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: input.sheetId,
                                gridProperties: {
                                    frozenRowCount: input.frozenRowCount,
                                },
                            },
                            fields: 'gridProperties.frozenRowCount',
                        },
                    },
                ],
            },
        });
        return this.success('freeze_rows', { rowsAffected: input.frozenRowCount });
    }
    async handleFreezeColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: input.sheetId,
                                gridProperties: {
                                    frozenColumnCount: input.frozenColumnCount,
                                },
                            },
                            fields: 'gridProperties.frozenColumnCount',
                        },
                    },
                ],
            },
        });
        return this.success('freeze_columns', {
            columnsAffected: input.frozenColumnCount,
        });
    }
    // ============================================================
    // Group Operations
    // ============================================================
    async handleGroupRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addDimensionGroup: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        return this.success('group_rows', {
            rowsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleGroupColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addDimensionGroup: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        return this.success('group_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleUngroupRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimensionGroup: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'ROWS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        return this.success('ungroup_rows', {
            rowsAffected: input.endIndex - input.startIndex,
        });
    }
    async handleUngroupColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimensionGroup: {
                            range: {
                                sheetId: input.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: input.startIndex,
                                endIndex: input.endIndex,
                            },
                        },
                    },
                ],
            },
        });
        return this.success('ungroup_columns', {
            columnsAffected: input.endIndex - input.startIndex,
        });
    }
    // ============================================================
    // Append Operations
    // ============================================================
    async handleAppendRows(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        appendDimension: {
                            sheetId: input.sheetId,
                            dimension: 'ROWS',
                            length: input.count,
                        },
                    },
                ],
            },
        });
        return this.success('append_rows', { rowsAffected: input.count });
    }
    async handleAppendColumns(input) {
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        appendDimension: {
                            sheetId: input.sheetId,
                            dimension: 'COLUMNS',
                            length: input.count,
                        },
                    },
                ],
            },
        });
        return this.success('append_columns', { columnsAffected: input.count });
    }
    // ============================================================
    // Filter Operations (merged from filter-sort.ts)
    // ============================================================
    async handleSetBasicFilter(input) {
        const gridRange = input.range
            ? await this.toGridRange(input.spreadsheetId, input.range)
            : { sheetId: input.sheetId };
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        setBasicFilter: {
                            filter: {
                                range: toGridRange(gridRange),
                                criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
                            },
                        },
                    },
                ],
            },
        });
        return this.success('set_basic_filter', {});
    }
    async handleClearBasicFilter(input) {
        if (input.safety?.dryRun) {
            return this.success('clear_basic_filter', {}, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        clearBasicFilter: { sheetId: input.sheetId },
                    },
                ],
            },
        });
        return this.success('clear_basic_filter', {});
    }
    async handleGetBasicFilter(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.properties.sheetId,sheets.basicFilter',
        });
        for (const sheet of response.data.sheets ?? []) {
            if (sheet.properties?.sheetId === input.sheetId && sheet.basicFilter) {
                return this.success('get_basic_filter', {
                    filter: {
                        range: this.toGridRangeOutput(sheet.basicFilter.range ?? { sheetId: input.sheetId }),
                        criteria: sheet.basicFilter.criteria ?? {},
                    },
                });
            }
        }
        return this.success('get_basic_filter', {});
    }
    async handleFilterUpdateFilterCriteria(input) {
        if (input.safety?.dryRun) {
            return this.success('filter_update_filter_criteria', {}, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        setBasicFilter: {
                            filter: {
                                range: { sheetId: input.sheetId },
                                criteria: this.mapCriteria(input.criteria),
                            },
                        },
                    },
                ],
            },
        });
        return this.success('filter_update_filter_criteria', {});
    }
    // ============================================================
    // Sort Operations (merged from filter-sort.ts)
    // ============================================================
    async handleSortRange(input) {
        const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        sortRange: {
                            range: toGridRange(gridRange),
                            sortSpecs: input.sortSpecs.map((spec) => ({
                                dimensionIndex: spec.columnIndex,
                                sortOrder: spec.sortOrder ?? 'ASCENDING',
                                foregroundColor: spec.foregroundColor,
                                backgroundColor: spec.backgroundColor,
                            })),
                        },
                    },
                ],
            },
        });
        return this.success('sort_range', {});
    }
    // ============================================================
    // Range Utility Operations (4 new - Google API coverage completion)
    // ============================================================
    async handleTrimWhitespace(input) {
        if (input.safety?.dryRun) {
            return this.success('trim_whitespace', { cellsChanged: 0 }, undefined, true);
        }
        const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
        const response = await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        trimWhitespace: {
                            range: toGridRange(gridRange),
                        },
                    },
                ],
            },
        });
        const cellsChanged = response.data.replies?.[0]?.trimWhitespace?.cellsChangedCount ?? 0;
        return this.success('trim_whitespace', { cellsChanged });
    }
    async handleRandomizeRange(input) {
        if (input.safety?.dryRun) {
            return this.success('randomize_range', {}, undefined, true);
        }
        const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        randomizeRange: {
                            range: toGridRange(gridRange),
                        },
                    },
                ],
            },
        });
        return this.success('randomize_range', {});
    }
    async handleTextToColumns(input) {
        if (input.safety?.dryRun) {
            return this.success('text_to_columns', {}, undefined, true);
        }
        const gridRange = await this.toGridRange(input.spreadsheetId, input.source);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        textToColumns: {
                            source: toGridRange(gridRange),
                            delimiterType: input.delimiterType ?? 'DETECT',
                            delimiter: input.delimiterType === 'CUSTOM' ? input.delimiter : undefined,
                        },
                    },
                ],
            },
        });
        return this.success('text_to_columns', {});
    }
    async handleAutoFill(input) {
        if (input.safety?.dryRun) {
            return this.success('auto_fill', {}, undefined, true);
        }
        // Build the request based on which parameters are provided
        const autoFillRequest = {
            useAlternateSeries: input.useAlternateSeries,
        };
        if (input.sourceRange && input.fillLength !== undefined) {
            // SourceAndDestination mode: explicit source and fill direction
            const sourceGridRange = await this.toGridRange(input.spreadsheetId, input.sourceRange);
            autoFillRequest.sourceAndDestination = {
                source: toGridRange(sourceGridRange),
                dimension: input.dimension ?? 'ROWS',
                fillLength: input.fillLength,
            };
        }
        else if (input.range) {
            // Range mode: auto-detect source data within range
            const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
            autoFillRequest.range = toGridRange(gridRange);
        }
        else {
            return this.error({
                code: 'INVALID_PARAMS',
                message: 'Either range or (sourceRange + fillLength) must be provided',
                retryable: false,
            });
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [{ autoFill: autoFillRequest }],
            },
        });
        return this.success('auto_fill', {});
    }
    // ============================================================
    // Filter View Operations (merged from filter-sort.ts)
    // ============================================================
    async handleCreateFilterView(input) {
        const gridRange = input.range
            ? await this.toGridRange(input.spreadsheetId, input.range)
            : { sheetId: input.sheetId };
        const response = await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addFilterView: {
                            filter: {
                                title: input.title,
                                range: toGridRange(gridRange),
                                criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
                                sortSpecs: input.sortSpecs?.map((spec) => ({
                                    dimensionIndex: spec.columnIndex,
                                    sortOrder: spec.sortOrder ?? 'ASCENDING',
                                })),
                            },
                        },
                    },
                ],
            },
        });
        const filterViewId = response.data.replies?.[0]?.addFilterView?.filter?.filterViewId;
        return this.success('create_filter_view', {
            filterViewId: filterViewId ?? undefined,
        });
    }
    async handleUpdateFilterView(input) {
        if (input.safety?.dryRun) {
            return this.success('update_filter_view', {}, undefined, true);
        }
        const filter = {
            filterViewId: input.filterViewId,
            title: input.title,
            criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
            sortSpecs: input.sortSpecs?.map((spec) => ({
                dimensionIndex: spec.columnIndex,
                sortOrder: spec.sortOrder ?? 'ASCENDING',
            })),
        };
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateFilterView: {
                            filter,
                            fields: 'title,criteria,sortSpecs',
                        },
                    },
                ],
            },
        });
        return this.success('update_filter_view', {});
    }
    async handleDeleteFilterView(input) {
        if (input.safety?.dryRun) {
            return this.success('delete_filter_view', {}, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteFilterView: { filterId: input.filterViewId },
                    },
                ],
            },
        });
        return this.success('delete_filter_view', {});
    }
    async handleListFilterViews(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.filterViews,sheets.properties.sheetId',
        });
        const filterViews = [];
        for (const sheet of response.data.sheets ?? []) {
            if (input.sheetId !== undefined && sheet.properties?.sheetId !== input.sheetId)
                continue;
            for (const fv of sheet.filterViews ?? []) {
                filterViews.push({
                    filterViewId: fv.filterViewId ?? 0,
                    title: fv.title ?? '',
                    range: this.toGridRangeOutput(fv.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
                });
            }
        }
        return this.success('list_filter_views', { filterViews });
    }
    async handleGetFilterView(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.filterViews',
        });
        for (const sheet of response.data.sheets ?? []) {
            for (const fv of sheet.filterViews ?? []) {
                if (fv.filterViewId === input.filterViewId) {
                    return this.success('get_filter_view', {
                        filterViews: [
                            {
                                filterViewId: fv.filterViewId ?? 0,
                                title: fv.title ?? '',
                                range: this.toGridRangeOutput(fv.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
                            },
                        ],
                    });
                }
            }
        }
        return this.notFoundError('Filter view', input.filterViewId);
    }
    // ============================================================
    // Slicer Operations (merged from filter-sort.ts)
    // ============================================================
    async handleCreateSlicer(input) {
        const dataRange = await this.toGridRange(input.spreadsheetId, input.dataRange);
        const anchor = parseCellReference(input.position.anchorCell);
        const batchResponse = await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addSlicer: {
                            slicer: {
                                spec: {
                                    title: input.title,
                                    dataRange: toGridRange(dataRange),
                                    columnIndex: input.filterColumn,
                                },
                                position: {
                                    overlayPosition: {
                                        anchorCell: {
                                            sheetId: dataRange.sheetId,
                                            rowIndex: anchor.row,
                                            columnIndex: anchor.col,
                                        },
                                        offsetXPixels: input.position.offsetX ?? 0,
                                        offsetYPixels: input.position.offsetY ?? 0,
                                        widthPixels: input.position.width ?? 200,
                                        heightPixels: input.position.height ?? 150,
                                    },
                                },
                            },
                        },
                    },
                ],
            },
        });
        const slicerId = batchResponse.data.replies?.[0]?.addSlicer?.slicer?.slicerId ?? undefined;
        return this.success('create_slicer', { slicerId });
    }
    async handleUpdateSlicer(input) {
        if (input.safety?.dryRun) {
            return this.success('update_slicer', {}, undefined, true);
        }
        const spec = {
            title: input.title,
            columnIndex: input.filterColumn,
        };
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateSlicerSpec: {
                            slicerId: input.slicerId,
                            spec,
                            fields: 'title,filterCriteria',
                        },
                    },
                ],
            },
        });
        return this.success('update_slicer', {});
    }
    async handleDeleteSlicer(input) {
        if (input.safety?.dryRun) {
            return this.success('delete_slicer', {}, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteEmbeddedObject: { objectId: input.slicerId },
                    },
                ],
            },
        });
        return this.success('delete_slicer', {});
    }
    async handleListSlicers(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.slicers,sheets.properties.sheetId',
        });
        const slicers = [];
        for (const sheet of response.data.sheets ?? []) {
            if (input.sheetId !== undefined && sheet.properties?.sheetId !== input.sheetId)
                continue;
            for (const slicer of sheet.slicers ?? []) {
                slicers.push({
                    slicerId: slicer.slicerId ?? 0,
                    sheetId: sheet.properties?.sheetId ?? 0,
                    title: slicer.spec?.title ?? undefined,
                });
            }
        }
        return this.success('list_slicers', { slicers });
    }
    // ============================================================
    // Helper Methods (merged from filter-sort.ts)
    // ============================================================
    /**
     * Convert Google API GridRange to application format
     */
    toGridRangeOutput(range) {
        return {
            sheetId: range.sheetId ?? 0,
            startRowIndex: range.startRowIndex ?? undefined,
            endRowIndex: range.endRowIndex ?? undefined,
            startColumnIndex: range.startColumnIndex ?? undefined,
            endColumnIndex: range.endColumnIndex ?? undefined,
        };
    }
    async toGridRange(spreadsheetId, range) {
        const a1 = await this.resolveRange(spreadsheetId, range);
        const parsed = parseA1Notation(a1);
        const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
        return {
            sheetId,
            startRowIndex: parsed.startRow,
            endRowIndex: parsed.endRow,
            startColumnIndex: parsed.startCol,
            endColumnIndex: parsed.endCol,
        };
    }
    mapCriteria(input) {
        return Object.entries(input).reduce((acc, [col, crit]) => {
            acc[col] = this.mapSingleCriteria(crit);
            return acc;
        }, {});
    }
    mapSingleCriteria(crit) {
        return {
            hiddenValues: crit.hiddenValues,
            visibleBackgroundColor: crit.visibleBackgroundColor,
            visibleForegroundColor: crit.visibleForegroundColor,
            condition: crit.condition
                ? {
                    type: crit.condition.type,
                    values: crit.condition.values?.map((v) => ({
                        userEnteredValue: v,
                    })),
                }
                : undefined,
        };
    }
}
//# sourceMappingURL=dimensions.js.map