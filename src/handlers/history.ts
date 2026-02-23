/**
 * ServalSheets - History Handler
 *
 * Handles operation history tracking, undo/redo functionality, and debugging.
 */

import type { drive_v3, sheets_v4 } from 'googleapis';
import { getHistoryService } from '../services/history-service.js';
import { SnapshotService } from '../services/snapshot.js';
import { createNotFoundError } from '../utils/error-factory.js';
import type {
  SheetsHistoryInput,
  SheetsHistoryOutput,
  HistoryResponse,
  HistoryTimelineInput,
  HistoryDiffRevisionsInput,
  HistoryRestoreCellsInput,
} from '../schemas/history.js';
import { unwrapRequest } from './base.js';
import {
  getTimeline,
  diffRevisions,
  restoreCells,
} from '../services/revision-timeline.js';

export interface HistoryHandlerOptions {
  snapshotService?: SnapshotService;
  driveApi?: drive_v3.Drive;
  sheetsApi?: sheets_v4.Sheets;
}

export class HistoryHandler {
  private snapshotService?: SnapshotService;
  private driveApi?: drive_v3.Drive;
  private sheetsApi?: sheets_v4.Sheets;

  constructor(options: HistoryHandlerOptions = {}) {
    this.snapshotService = options.snapshotService;
    this.driveApi = options.driveApi;
    this.sheetsApi = options.sheetsApi;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: HistoryResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): HistoryResponse {
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // For minimal verbosity, strip _meta field
      const { _meta, ...rest } = response as Record<string, unknown>;
      return rest as HistoryResponse;
    }

    return response;
  }

  async handle(input: SheetsHistoryInput): Promise<SheetsHistoryOutput> {
    const req = unwrapRequest<SheetsHistoryInput['request']>(input);
    const historyService = getHistoryService();

    try {
      let response: HistoryResponse;

      switch (req.action) {
        case 'list': {
          let operations;
          if (req.failuresOnly) {
            operations = historyService.getFailures(req.count);
          } else if (req.spreadsheetId) {
            operations = historyService.getBySpreadsheet(req.spreadsheetId, req.count);
          } else {
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
          const operation = historyService.getById(req.operationId!);

          if (!operation) {
            response = {
              success: false,
              error: createNotFoundError({
                resourceType: 'operation',
                resourceId: req.operationId!,
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
              params: operation.params as Record<
                string,
                string | number | boolean | null | unknown[] | Record<string, unknown>
              >,
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
          const operation = historyService.getLastUndoable(req.spreadsheetId!);

          if (!operation) {
            response = {
              success: false,
              error: createNotFoundError({
                resourceType: 'operation',
                resourceId: 'undoable operation',
                searchSuggestion:
                  'No undoable operations exist for this spreadsheet. Check operation history with action "list"',
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
                searchSuggestion:
                  'This operation was not snapshotted and cannot be undone. Enable snapshot creation for future operations.',
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
            historyService.markAsUndone(operation.id, req.spreadsheetId!);

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
          const operation = historyService.getLastRedoable(req.spreadsheetId!);

          if (!operation) {
            response = {
              success: false,
              error: createNotFoundError({
                resourceType: 'operation',
                resourceId: 'redoable operation',
                searchSuggestion:
                  'No redoable operations exist. You can only redo operations that were previously undone.',
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
                searchSuggestion:
                  'This operation was not snapshotted and cannot be redone. Enable snapshot creation for future operations.',
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

            // Mark as redone in history
            historyService.markAsRedone(operation.id, req.spreadsheetId!);

            response = {
              success: true,
              action: 'redo',
              restoredSpreadsheetId: restoredId,
              operationRestored: {
                id: operation.id,
                tool: operation.tool,
                action: operation.action,
                timestamp: new Date(operation.timestamp).getTime(),
              },
              message: `Redid ${operation.tool}.${operation.action} operation`,
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

        case 'revert_to': {
          const operation = historyService.getById(req.operationId!);

          if (!operation) {
            response = {
              success: false,
              error: createNotFoundError({
                resourceType: 'operation',
                resourceId: req.operationId!,
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
                searchSuggestion:
                  'This operation was not snapshotted and cannot be reverted. Enable snapshot creation for future operations.',
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

          if (req.spreadsheetId) {
            cleared = historyService.clearForSpreadsheet(req.spreadsheetId);
          } else {
            cleared = historyService.size();
            historyService.clear();
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
        case 'timeline': {
          if (!this.driveApi) {
            response = {
              success: false,
              error: { code: 'INTERNAL_ERROR', message: 'Drive API not available for timeline', retryable: false },
            };
            break;
          }
          const timelineReq = req as HistoryTimelineInput;
          const entries = await getTimeline(this.driveApi, timelineReq.spreadsheetId, {
            since: timelineReq.since,
            until: timelineReq.until,
            limit: timelineReq.limit,
          });
          response = {
            success: true,
            action: 'timeline',
            timeline: entries,
            message: `Found ${entries.length} revision(s)`,
          };
          break;
        }

        case 'diff_revisions': {
          if (!this.driveApi) {
            response = {
              success: false,
              error: { code: 'INTERNAL_ERROR', message: 'Drive API not available for diff', retryable: false },
            };
            break;
          }
          const diffReq = req as HistoryDiffRevisionsInput;
          const diff = await diffRevisions(
            this.driveApi,
            diffReq.spreadsheetId,
            diffReq.revisionId1,
            diffReq.revisionId2
          );
          response = {
            success: true,
            action: 'diff_revisions',
            diff,
            message: diff.summary.metadataOnly
              ? 'Metadata comparison only — cell-level diff unavailable for this revision pair'
              : `Found ${diff.cellChanges?.length ?? 0} cell change(s)`,
          };
          break;
        }

        case 'restore_cells': {
          if (!this.driveApi || !this.sheetsApi) {
            response = {
              success: false,
              error: { code: 'INTERNAL_ERROR', message: 'Drive/Sheets API not available for restore', retryable: false },
            };
            break;
          }
          const restoreReq = req as HistoryRestoreCellsInput;

          if (restoreReq.safety?.dryRun) {
            response = {
              success: true,
              action: 'restore_cells',
              restored: restoreReq.cells.map((c) => ({ cell: c })),
              message: `Dry run: would restore ${restoreReq.cells.length} cell(s) from revision ${restoreReq.revisionId}`,
            };
            break;
          }

          // Create snapshot before restoring
          let snapshotId: string | undefined;
          if (restoreReq.safety?.createSnapshot !== false && this.snapshotService) {
            snapshotId = await this.snapshotService.create(restoreReq.spreadsheetId, 'Pre-restore backup');
          }

          const restored = await restoreCells(
            this.driveApi,
            this.sheetsApi,
            restoreReq.spreadsheetId,
            restoreReq.revisionId,
            restoreReq.cells
          );
          response = {
            success: true,
            action: 'restore_cells',
            restored,
            snapshotId,
            message: `Restored ${restored.length} cell(s) from revision ${restoreReq.revisionId}`,
          };
          break;
        }

        default:
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Unknown action: ${(req as { action: string }).action}`,
              retryable: false,
              suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
            },
          };
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
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
