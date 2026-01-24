/**
 * ServalSheets - Session Handler
 *
 * Handles session context management operations.
 *
 * @module handlers/session
 */
import { getSessionContext } from '../services/session-context.js';
import { unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';
// ============================================================================
// HANDLER CLASS
// ============================================================================
/**
 * Session handler class for lazy loading
 */
export class SessionHandler {
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
        const result = await handleSheetsSession(input);
        // Apply verbosity filtering (LLM optimization)
        const verbosity = req.verbosity ?? 'standard';
        const filteredResponse = this.applyVerbosityFilter(result.response, verbosity);
        return { response: filteredResponse };
    }
}
// ============================================================================
// HANDLER FUNCTION
// ============================================================================
/**
 * Handle session context operations
 */
export async function handleSheetsSession(input) {
    const session = getSessionContext();
    const req = unwrapRequest(input);
    const { action } = req;
    try {
        switch (action) {
            case 'set_active': {
                const { spreadsheetId, title, sheetNames } = req;
                // Type assertion: refine() validates these are defined for set_active action
                const context = {
                    spreadsheetId: spreadsheetId,
                    title: title,
                    sheetNames: sheetNames,
                    activatedAt: Date.now(),
                };
                session.setActiveSpreadsheet(context);
                return {
                    response: {
                        success: true,
                        action: 'set_active',
                        spreadsheet: context,
                    },
                };
            }
            case 'get_active': {
                return {
                    response: {
                        success: true,
                        action: 'get_active',
                        spreadsheet: session.getActiveSpreadsheet(),
                        recentSpreadsheets: session.getRecentSpreadsheets(),
                    },
                };
            }
            case 'get_context': {
                return {
                    response: {
                        success: true,
                        action: 'get_context',
                        summary: session.getContextSummary(),
                        activeSpreadsheet: session.getActiveSpreadsheet(),
                        lastOperation: session.getLastOperation(),
                        pendingOperation: session.getPendingOperation(),
                        suggestedActions: session.suggestNextActions(),
                    },
                };
            }
            case 'record_operation': {
                const { tool, toolAction, spreadsheetId, range, description, undoable, snapshotId, cellsAffected, } = req;
                // Type assertion: refine() validates required fields are defined for record_operation action
                const operationId = session.recordOperation({
                    tool: tool,
                    action: toolAction,
                    spreadsheetId: spreadsheetId,
                    range,
                    description: description,
                    undoable: undoable,
                    snapshotId,
                    cellsAffected,
                });
                return {
                    response: {
                        success: true,
                        action: 'record_operation',
                        operationId,
                    },
                };
            }
            case 'get_last_operation': {
                return {
                    response: {
                        success: true,
                        action: 'get_last_operation',
                        operation: session.getLastOperation(),
                    },
                };
            }
            case 'get_history': {
                const limit = req.limit ?? 10;
                return {
                    response: {
                        success: true,
                        action: 'get_history',
                        operations: session.getOperationHistory(limit),
                    },
                };
            }
            case 'find_by_reference': {
                const { reference, referenceType } = req;
                // Type assertion: refine() validates these are defined for find_by_reference action
                if (referenceType === 'spreadsheet') {
                    const spreadsheet = session.findSpreadsheetByReference(reference);
                    return {
                        response: {
                            success: true,
                            action: 'find_by_reference',
                            found: spreadsheet !== null,
                            spreadsheet,
                        },
                    };
                }
                else {
                    const operation = session.findOperationByReference(reference);
                    return {
                        response: {
                            success: true,
                            action: 'find_by_reference',
                            found: operation !== null,
                            operation,
                        },
                    };
                }
            }
            case 'update_preferences': {
                const { confirmationLevel, dryRunDefault, snapshotDefault } = req;
                const updates = {};
                if (confirmationLevel) {
                    updates['confirmationLevel'] = confirmationLevel;
                }
                if (dryRunDefault !== undefined || snapshotDefault !== undefined) {
                    updates['defaultSafety'] = {
                        dryRun: dryRunDefault ?? session.getPreferences().defaultSafety.dryRun,
                        createSnapshot: snapshotDefault ?? session.getPreferences().defaultSafety.createSnapshot,
                    };
                }
                session.updatePreferences(updates);
                return {
                    response: {
                        success: true,
                        action: 'update_preferences',
                        preferences: session.getPreferences(),
                    },
                };
            }
            case 'get_preferences': {
                return {
                    response: {
                        success: true,
                        action: 'get_preferences',
                        preferences: session.getPreferences(),
                    },
                };
            }
            case 'set_pending': {
                const { type, step, totalSteps, context } = req;
                // Type assertion: refine() validates these are defined for set_pending action
                session.setPendingOperation({
                    type: type,
                    step: step,
                    totalSteps: totalSteps,
                    context: context,
                });
                return {
                    response: {
                        success: true,
                        action: 'set_pending',
                        pending: session.getPendingOperation(),
                    },
                };
            }
            case 'get_pending': {
                return {
                    response: {
                        success: true,
                        action: 'get_pending',
                        pending: session.getPendingOperation(),
                    },
                };
            }
            case 'clear_pending': {
                session.clearPendingOperation();
                return {
                    response: {
                        success: true,
                        action: 'clear_pending',
                        pending: null,
                    },
                };
            }
            case 'reset': {
                session.reset();
                return {
                    response: {
                        success: true,
                        action: 'reset',
                        message: 'Session context cleared. Ready for a fresh start!',
                    },
                };
            }
            default: {
                const exhaustiveCheck = action;
                throw new ValidationError(`Unknown action: ${exhaustiveCheck}`, 'action');
            }
        }
    }
    catch (error) {
        return {
            response: {
                success: false,
                error: {
                    code: 'SESSION_ERROR',
                    message: error instanceof Error ? error.message : String(error),
                    retryable: false,
                },
            },
        };
    }
}
//# sourceMappingURL=session.js.map