/**
 * ServalSheets - History Handler
 *
 * Handles operation history tracking, undo/redo functionality, and debugging.
 */
import { getHistoryService } from '../services/history-service.js';
import { createNotFoundError } from '../utils/error-factory.js';
import { unwrapRequest } from './base.js';
export class HistoryHandler {
    snapshotService;
    constructor(options = {}) {
        this.snapshotService = options.snapshotService;
    }
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    applyVerbosityFilter(response, verbosity) {
        if (!response.success || verbosity === 'standard') {
            return response;
        }
        if (verbosity === 'minimal') {
            // For minimal verbosity, strip _meta field
            const { _meta, ...rest } = response;
            return rest;
        }
        return response;
    }
    async handle(input) {
        const req = unwrapRequest(input);
        const historyService = getHistoryService();
        try {
            let response;
            switch (req.action) {
                case 'list': {
                    let operations;
                    if (req.failuresOnly) {
                        operations = historyService.getFailures(req.count);
                    }
                    else if (req.spreadsheetId) {
                        operations = historyService.getBySpreadsheet(req.spreadsheetId, req.count);
                    }
                    else {
                        operations = historyService.getRecent(req.count || 10);
                    }
                    response = {
                        success: true,
                        action: 'list',
                        operations: operations.map((op) => ({
                            id: op.id,
                            tool: op.tool,
                            action: op.action,
                            spreadsheetId: op.spreadsheetId,
                            range: undefined,
                            success: op.result === 'success',
                            duration: op.duration,
                            timestamp: new Date(op.timestamp).getTime(),
                            error: op.errorMessage,
                        })),
                        message: `Retrieved ${operations.length} operation(s)`,
                    };
                    break;
                }
                case 'get': {
                    const operation = historyService.getById(req.operationId);
                    if (!operation) {
                        response = {
                            success: false,
                            error: createNotFoundError({
                                resourceType: 'operation',
                                resourceId: req.operationId,
                                searchSuggestion: 'Use action "list" to see available operation IDs',
                            }),
                        };
                        break;
                    }
                    response = {
                        success: true,
                        action: 'get',
                        operation: {
                            id: operation.id,
                            tool: operation.tool,
                            action: operation.action,
                            params: operation.params,
                            result: operation.result === 'success' ? 'success' : operation.result,
                            spreadsheetId: operation.spreadsheetId,
                            range: undefined,
                            success: operation.result === 'success',
                            duration: operation.duration,
                            timestamp: new Date(operation.timestamp).getTime(),
                            error: operation.errorMessage,
                        },
                        message: 'Operation retrieved',
                    };
                    break;
                }
                case 'stats': {
                    const stats = historyService.getStats();
                    response = {
                        success: true,
                        action: 'stats',
                        stats: {
                            totalOperations: stats.totalOperations,
                            successfulOperations: stats.successfulOperations,
                            failedOperations: stats.failedOperations,
                            successRate: stats.successRate,
                            avgDuration: stats.averageDuration,
                            operationsByTool: {},
                            recentFailures: stats.failedOperations,
                        },
                        message: `${stats.totalOperations} operation(s) tracked, ${stats.successRate.toFixed(1)}% success rate`,
                    };
                    break;
                }
                case 'undo': {
                    const operation = historyService.getLastUndoable(req.spreadsheetId);
                    if (!operation) {
                        response = {
                            success: false,
                            error: createNotFoundError({
                                resourceType: 'operation',
                                resourceId: 'undoable operation',
                                searchSuggestion: 'No undoable operations exist for this spreadsheet. Check operation history with action "list"',
                                parentResourceId: req.spreadsheetId,
                            }),
                        };
                        break;
                    }
                    if (!operation.snapshotId) {
                        response = {
                            success: false,
                            error: createNotFoundError({
                                resourceType: 'snapshot',
                                resourceId: operation.id,
                                searchSuggestion: 'This operation was not snapshotted and cannot be undone. Enable snapshot creation for future operations.',
                            }),
                        };
                        break;
                    }
                    if (!this.snapshotService) {
                        response = {
                            success: false,
                            error: {
                                code: 'SERVICE_NOT_INITIALIZED',
                                message: 'Snapshot service not available',
                                retryable: false,
                            },
                        };
                        break;
                    }
                    try {
                        // Restore from snapshot
                        const restoredId = await this.snapshotService.restore(operation.snapshotId);
                        // Mark as undone in history
                        historyService.markAsUndone(operation.id, req.spreadsheetId);
                        response = {
                            success: true,
                            action: 'undo',
                            restoredSpreadsheetId: restoredId,
                            operationRestored: {
                                id: operation.id,
                                tool: operation.tool,
                                action: operation.action,
                                timestamp: new Date(operation.timestamp).getTime(),
                            },
                            message: `Undid ${operation.tool}.${operation.action} operation`,
                        };
                    }
                    catch (error) {
                        response = {
                            success: false,
                            error: {
                                code: 'SNAPSHOT_RESTORE_FAILED',
                                message: error instanceof Error ? error.message : String(error),
                                retryable: true,
                            },
                        };
                    }
                    break;
                }
                case 'redo': {
                    const operation = historyService.getLastRedoable(req.spreadsheetId);
                    if (!operation) {
                        response = {
                            success: false,
                            error: createNotFoundError({
                                resourceType: 'operation',
                                resourceId: 'redoable operation',
                                searchSuggestion: 'No redoable operations exist. You can only redo operations that were previously undone.',
                                parentResourceId: req.spreadsheetId,
                            }),
                        };
                        break;
                    }
                    /**
                     * Redo functionality is not yet implemented.
                     *
                     * Implementation would require:
                     * 1. Re-executing the original operation with stored parameters
                     * 2. Validating that the spreadsheet state allows re-execution
                     * 3. Managing the redo stack properly after execution
                     *
                     * For now, we return a clear error instead of attempting partial functionality.
                     */
                    response = {
                        success: false,
                        error: {
                            code: 'FEATURE_UNAVAILABLE',
                            message: 'Redo functionality is not yet implemented. Only undo operations are currently supported.',
                            details: {
                                reason: 'Redo requires re-execution of operations which is not yet implemented',
                            },
                            retryable: false,
                        },
                    };
                    break;
                }
                case 'revert_to': {
                    const operation = historyService.getById(req.operationId);
                    if (!operation) {
                        response = {
                            success: false,
                            error: createNotFoundError({
                                resourceType: 'operation',
                                resourceId: req.operationId,
                                searchSuggestion: 'Use action "list" to see available operation IDs',
                            }),
                        };
                        break;
                    }
                    if (!operation.snapshotId) {
                        response = {
                            success: false,
                            error: createNotFoundError({
                                resourceType: 'snapshot',
                                resourceId: operation.id,
                                searchSuggestion: 'This operation was not snapshotted and cannot be reverted. Enable snapshot creation for future operations.',
                            }),
                        };
                        break;
                    }
                    if (!this.snapshotService) {
                        response = {
                            success: false,
                            error: {
                                code: 'SERVICE_NOT_INITIALIZED',
                                message: 'Snapshot service not available',
                                retryable: false,
                            },
                        };
                        break;
                    }
                    try {
                        // Restore from snapshot (state before this operation)
                        const restoredId = await this.snapshotService.restore(operation.snapshotId);
                        response = {
                            success: true,
                            action: 'revert_to',
                            restoredSpreadsheetId: restoredId,
                            operationRestored: {
                                id: operation.id,
                                tool: operation.tool,
                                action: operation.action,
                                timestamp: new Date(operation.timestamp).getTime(),
                            },
                            message: `Reverted to state before ${operation.tool}.${operation.action} operation`,
                        };
                    }
                    catch (error) {
                        response = {
                            success: false,
                            error: {
                                code: 'SNAPSHOT_RESTORE_FAILED',
                                message: error instanceof Error ? error.message : String(error),
                                retryable: true,
                            },
                        };
                    }
                    break;
                }
                case 'clear': {
                    let cleared;
                    if (req.spreadsheetId) {
                        cleared = historyService.clearForSpreadsheet(req.spreadsheetId);
                    }
                    else {
                        historyService.clear();
                        cleared = historyService.size();
                    }
                    response = {
                        success: true,
                        action: 'clear',
                        operationsCleared: cleared,
                        message: req.spreadsheetId
                            ? `Cleared ${cleared} operation(s) for spreadsheet ${req.spreadsheetId}`
                            : `Cleared all ${cleared} operation(s)`,
                    };
                    break;
                }
                default:
                    response = {
                        success: false,
                        error: {
                            code: 'INVALID_PARAMS',
                            message: `Unknown action: ${req.action}`,
                            retryable: false,
                        },
                    };
            }
            // Apply verbosity filtering (LLM optimization)
            const verbosity = req.verbosity ?? 'standard';
            const filteredResponse = this.applyVerbosityFilter(response, verbosity);
            return { response: filteredResponse };
        }
        catch (error) {
            // Catch-all for unexpected errors
            return {
                response: {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: error instanceof Error ? error.message : String(error),
                        retryable: false,
                    },
                },
            };
        }
    }
}
//# sourceMappingURL=history.js.map