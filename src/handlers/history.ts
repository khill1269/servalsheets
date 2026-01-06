/**
 * ServalSheets - History Handler
 *
 * Handles operation history tracking, undo/redo functionality, and debugging.
 */

import { getHistoryService } from '../services/history-service.js';
import { SnapshotService } from '../services/snapshot.js';
import type {
  SheetsHistoryInput,
  SheetsHistoryOutput,
  HistoryResponse,
} from '../schemas/history.js';

export interface HistoryHandlerOptions {
  snapshotService?: SnapshotService;
}

export class HistoryHandler {
  private snapshotService?: SnapshotService;

  constructor(options: HistoryHandlerOptions = {}) {
    this.snapshotService = options.snapshotService;
  }

  async handle(input: SheetsHistoryInput): Promise<SheetsHistoryOutput> {
    const { request } = input;
    const historyService = getHistoryService();

    try {
      let response: HistoryResponse;

      switch (request.action) {
        case 'list': {
          let operations;
          if (request.failuresOnly) {
            operations = historyService.getFailures(request.count);
          } else if (request.spreadsheetId) {
            operations = historyService.getBySpreadsheet(request.spreadsheetId, request.count);
          } else {
            operations = historyService.getRecent(request.count || 10);
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
          const operation = historyService.getById(request.operationId);

          if (!operation) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Operation ${request.operationId} not found`,
                retryable: false,
              },
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
          const operation = historyService.getLastUndoable(request.spreadsheetId);

          if (!operation) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `No undoable operations for spreadsheet ${request.spreadsheetId}`,
                retryable: false,
              },
            };
            break;
          }

          if (!operation.snapshotId) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Operation ${operation.id} has no snapshot for undo`,
                retryable: false,
              },
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
            historyService.markAsUndone(operation.id, request.spreadsheetId);

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
          } catch (error) {
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
          const operation = historyService.getLastRedoable(request.spreadsheetId);

          if (!operation) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `No redoable operations for spreadsheet ${request.spreadsheetId}`,
                retryable: false,
              },
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
              details: { reason: 'Redo requires re-execution of operations which is not yet implemented' },
              retryable: false,
            },
          };
          break;
        }

        case 'revert_to': {
          const operation = historyService.getById(request.operationId);

          if (!operation) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Operation ${request.operationId} not found`,
                retryable: false,
              },
            };
            break;
          }

          if (!operation.snapshotId) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Operation ${operation.id} has no snapshot for revert`,
                retryable: false,
              },
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
          } catch (error) {
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
          let cleared: number;

          if (request.spreadsheetId) {
            cleared = historyService.clearForSpreadsheet(request.spreadsheetId);
          } else {
            historyService.clear();
            cleared = historyService.size();
          }

          response = {
            success: true,
            action: 'clear',
            operationsCleared: cleared,
            message: request.spreadsheetId
              ? `Cleared ${cleared} operation(s) for spreadsheet ${request.spreadsheetId}`
              : `Cleared all ${cleared} operation(s)`,
          };
          break;
        }
      }

      return { response };
    } catch (error) {
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
