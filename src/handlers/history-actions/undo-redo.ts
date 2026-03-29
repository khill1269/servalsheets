/**
 * History handler submodule — undo, redo, revert_to actions
 */

import { ErrorCodes } from '../error-codes.js';
import { getHistoryService } from '../../services/history-service.js';
import { createNotFoundError } from '../../utils/error-factory.js';
import type { HistoryResponse } from '../../schemas/history.js';
import type { SnapshotService } from '../../services/snapshot.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import { requestSafetyConfirmation } from '../../utils/safety-helpers.js';

interface UndoReq {
  action: 'undo';
  spreadsheetId?: string;
}

interface RedoReq {
  action: 'redo';
  spreadsheetId?: string;
}

interface RevertToReq {
  action: 'revert_to';
  operationId?: string;
  safety?: { dryRun?: boolean };
}

async function confirmHistoryMutation(params: {
  server: ElicitationServer | undefined;
  action: 'undo' | 'redo' | 'revert_to';
  spreadsheetId?: string;
  details: string;
  affectedCells?: number;
  cancelledMessage: string;
}): Promise<HistoryResponse | null> {
  const confirmation = await requestSafetyConfirmation({
    server: params.server,
    operation: params.action,
    details: params.details,
    context: {
      toolName: 'sheets_history',
      actionName: params.action,
      operationType: params.action,
      isDestructive: true,
      affectedCells: params.affectedCells,
      spreadsheetId: params.spreadsheetId,
    },
  });

  if (confirmation.confirmed) {
    return null;
  }

  return {
    success: false,
    error: {
      code: ErrorCodes.OPERATION_CANCELLED,
      message: confirmation.reason || params.cancelledMessage,
      retryable: false,
    },
  };
}

export async function handleUndo(
  req: UndoReq,
  snapshotService: SnapshotService | undefined,
  server: ElicitationServer | undefined
): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const operation = historyService.getLastUndoable(req.spreadsheetId!);

  if (!operation) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'operation',
        resourceId: 'undoable operation',
        searchSuggestion:
          'No undoable operations exist for this spreadsheet. Check operation history with action "list"',
        parentResourceId: req.spreadsheetId,
      }),
    };
  }

  if (!operation.snapshotId) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'snapshot',
        resourceId: operation.id,
        searchSuggestion:
          'This operation was not snapshotted and cannot be undone. Enable snapshot creation for future operations.',
      }),
    };
  }

  if (!snapshotService) {
    return {
      success: false,
      error: {
        code: ErrorCodes.SERVICE_NOT_INITIALIZED,
        message: 'Snapshot service not available',
        retryable: false,
      },
    };
  }

  // Create safety snapshot before undoing
  await snapshotService.create(req.spreadsheetId!, 'pre-undo backup');

  const undoBlocked = await confirmHistoryMutation({
    server,
    action: 'undo',
    spreadsheetId: req.spreadsheetId,
    details: 'Reverts the most recent change to this spreadsheet',
    affectedCells: operation.cellsAffected,
    cancelledMessage: 'Undo cancelled by user',
  });
  if (undoBlocked) {
    return undoBlocked;
  }

  try {
    const restoredId = await snapshotService.restore(operation.snapshotId);
    historyService.markAsUndone(operation.id, req.spreadsheetId!);

    return {
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
    return {
      success: false,
      error: {
        code: ErrorCodes.SNAPSHOT_RESTORE_FAILED,
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    };
  }
}

export async function handleRedo(
  req: RedoReq,
  snapshotService: SnapshotService | undefined,
  server: ElicitationServer | undefined
): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const operation = historyService.getLastRedoable(req.spreadsheetId!);

  if (!operation) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'operation',
        resourceId: 'redoable operation',
        searchSuggestion:
          'No redoable operations exist. You can only redo operations that were previously undone.',
        parentResourceId: req.spreadsheetId,
      }),
    };
  }

  if (!operation.snapshotId) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'snapshot',
        resourceId: operation.id,
        searchSuggestion:
          'This operation was not snapshotted and cannot be redone. Enable snapshot creation for future operations.',
      }),
    };
  }

  if (!snapshotService) {
    return {
      success: false,
      error: {
        code: ErrorCodes.SERVICE_NOT_INITIALIZED,
        message: 'Snapshot service not available',
        retryable: false,
      },
    };
  }

  // Create safety snapshot before redoing
  await snapshotService.create(req.spreadsheetId!, 'pre-redo backup');

  const redoBlocked = await confirmHistoryMutation({
    server,
    action: 'redo',
    spreadsheetId: req.spreadsheetId,
    details: 'Re-applies the previously undone change',
    affectedCells: operation.cellsAffected,
    cancelledMessage: 'Redo cancelled by user',
  });
  if (redoBlocked) {
    return redoBlocked;
  }

  try {
    const restoredId = await snapshotService.restore(operation.snapshotId);
    historyService.markAsRedone(operation.id, req.spreadsheetId!);

    return {
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
    return {
      success: false,
      error: {
        code: ErrorCodes.SNAPSHOT_RESTORE_FAILED,
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    };
  }
}

export async function handleRevertTo(
  req: RevertToReq,
  snapshotService: SnapshotService | undefined,
  server: ElicitationServer | undefined
): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const operation = historyService.getById(req.operationId!);

  if (!operation) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'operation',
        resourceId: req.operationId!,
        searchSuggestion: 'Use action "list" to see available operation IDs',
      }),
    };
  }

  if (!operation.snapshotId) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'snapshot',
        resourceId: operation.id,
        searchSuggestion:
          'This operation was not snapshotted and cannot be reverted. Enable snapshot creation for future operations.',
      }),
    };
  }

  if (!snapshotService) {
    return {
      success: false,
      error: {
        code: ErrorCodes.SERVICE_NOT_INITIALIZED,
        message: 'Snapshot service not available',
        retryable: false,
      },
    };
  }

  // ISSUE-011: dryRun mode — return what would be reverted without executing
  if (req.safety?.dryRun) {
    return {
      success: true,
      action: 'revert_to',
      dryRun: true,
      wouldRevert: {
        operationId: operation.id,
        tool: operation.tool,
        action: operation.action,
        timestamp: new Date(operation.timestamp).getTime(),
        snapshotId: operation.snapshotId,
        spreadsheetId: operation.spreadsheetId,
      },
      message: `[DRY RUN] Would revert to state before ${operation.tool}.${operation.action} — pass safety.dryRun:false to execute`,
    };
  }

  // Create safety snapshot before reverting
  await snapshotService.create(operation.spreadsheetId!, 'pre-revert backup');

  const revertBlocked = await confirmHistoryMutation({
    server,
    action: 'revert_to',
    spreadsheetId: operation.spreadsheetId,
    details: `Restore the spreadsheet to the snapshot captured before operation ${req.operationId}. All later changes will be discarded.`,
    affectedCells: operation.cellsAffected,
    cancelledMessage: 'Revert cancelled by user',
  });
  if (revertBlocked) {
    return revertBlocked;
  }

  try {
    const restoredId = await snapshotService.restore(operation.snapshotId);

    return {
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
    return {
      success: false,
      error: {
        code: ErrorCodes.SNAPSHOT_RESTORE_FAILED,
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    };
  }
}
