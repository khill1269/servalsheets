/**
 * History handler submodule — undo, redo, revert_to actions
 */

import { ErrorCodes } from '../error-codes.js';
import { getHistoryService } from '../../services/history-service.js';
import { createNotFoundError } from '../../utils/error-factory.js';
import type { HistoryResponse } from '../../schemas/history.js';
import type { SnapshotService } from '../../services/snapshot.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';

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

  // Confirm destructive action
  if (server) {
    const { confirmDestructiveAction } = await import('../../mcp/elicitation.js');
    const confirmation = await confirmDestructiveAction(
      server,
      'Undo last operation',
      'Reverts the most recent change to this spreadsheet'
    );
    if (!confirmation.confirmed) {
      return {
        success: false,
        error: {
          code: ErrorCodes.OPERATION_CANCELLED,
          message: 'Undo cancelled by user',
          retryable: false,
        },
      };
    }
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

  // Confirm destructive action
  if (server) {
    const { confirmDestructiveAction } = await import('../../mcp/elicitation.js');
    const confirmation = await confirmDestructiveAction(
      server,
      'Redo last undone operation',
      'Re-applies the previously undone change'
    );
    if (!confirmation.confirmed) {
      return {
        success: false,
        error: {
          code: ErrorCodes.OPERATION_CANCELLED,
          message: 'Redo cancelled by user',
          retryable: false,
        },
      };
    }
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

  // Confirm destructive action
  if (server) {
    const { confirmDestructiveAction } = await import('../../mcp/elicitation.js');
    const confirmation = await confirmDestructiveAction(
      server,
      `Revert to revision ${req.operationId}`,
      'All changes after this revision will be lost'
    );
    if (!confirmation.confirmed) {
      return {
        success: false,
        error: {
          code: ErrorCodes.OPERATION_CANCELLED,
          message: 'Revert cancelled by user',
          retryable: false,
        },
      };
    }
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
