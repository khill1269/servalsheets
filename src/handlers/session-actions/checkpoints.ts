/**
 * Session checkpoint action handlers.
 * Covers: save_checkpoint, load_checkpoint, list_checkpoints, delete_checkpoint
 */

import { ErrorCodes } from '../error-codes.js';
import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';
import {
  saveCheckpoint,
  loadCheckpoint,
  loadCheckpointByTimestamp,
  listCheckpointsForSession,
  listAllCheckpoints,
  deleteCheckpoint,
  isCheckpointsEnabled,
  getOperationCount,
  type Checkpoint,
} from '../../utils/checkpoint.js';
import { sendProgress } from '../../utils/request-context.js';

export async function handleSaveCheckpoint(
  session: SessionContextManager,
  req: {
    action: 'save_checkpoint';
    sessionId?: string;
    description?: string;
  }
): Promise<SheetsSessionOutput> {
  if (!isCheckpointsEnabled()) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.CHECKPOINTS_DISABLED,
          message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
          retryable: false,
        },
      },
    };
  }

  await sendProgress(0, 100, 'Saving checkpoint...');
  const { sessionId, description } = req;
  const activeSpreadsheet = session.getActiveSpreadsheet();
  const history = session.getOperationHistory(100);

  const checkpoint: Checkpoint = {
    sessionId: sessionId!,
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
    description,
    completedSteps: getOperationCount(),
    completedOperations: history.map((op) => `${op.tool}.${op.action}`),
    spreadsheetId: activeSpreadsheet?.spreadsheetId,
    spreadsheetTitle: activeSpreadsheet?.title,
    sheetNames: activeSpreadsheet?.sheetNames,
    lastRange: activeSpreadsheet?.lastRange,
    context: {},
    // UserPreferences is a typed interface; Checkpoint.preferences is
    // Record<string, unknown>. The runtime values are always compatible.
    preferences: session.getPreferences() as unknown as Record<string, unknown>,
  };

  const filepath = await saveCheckpoint(checkpoint);
  await sendProgress(100, 100, 'Checkpoint saved');

  return {
    response: {
      success: true,
      action: 'save_checkpoint',
      checkpointPath: filepath,
      checkpoint: {
        sessionId: checkpoint.sessionId,
        timestamp: checkpoint.timestamp,
        createdAt: checkpoint.createdAt,
        description: checkpoint.description,
        completedSteps: checkpoint.completedSteps,
        spreadsheetTitle: checkpoint.spreadsheetTitle,
      },
      message: `Checkpoint saved. Resume with: sheets_session.load_checkpoint({sessionId: "${sessionId}"})`,
    },
  };
}

export async function handleLoadCheckpoint(
  session: SessionContextManager,
  req: {
    action: 'load_checkpoint';
    sessionId?: string;
    timestamp?: number;
  }
): Promise<SheetsSessionOutput> {
  if (!isCheckpointsEnabled()) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.CHECKPOINTS_DISABLED,
          message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
          retryable: false,
        },
      },
    };
  }

  const { sessionId, timestamp } = req;
  const checkpoint = timestamp
    ? await loadCheckpointByTimestamp(sessionId!, timestamp)
    : await loadCheckpoint(sessionId!);

  if (!checkpoint) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.CHECKPOINT_NOT_FOUND,
          message: `No checkpoint found for session "${sessionId}"`,
          retryable: false,
        },
      },
    };
  }

  // Restore session state
  if (checkpoint.spreadsheetId && checkpoint.spreadsheetTitle) {
    session.setActiveSpreadsheet({
      spreadsheetId: checkpoint.spreadsheetId,
      title: checkpoint.spreadsheetTitle,
      sheetNames: checkpoint.sheetNames || [],
      activatedAt: Date.now(),
      lastRange: checkpoint.lastRange,
    });
  }

  return {
    response: {
      success: true,
      action: 'load_checkpoint',
      checkpoint: {
        sessionId: checkpoint.sessionId,
        timestamp: checkpoint.timestamp,
        createdAt: checkpoint.createdAt,
        description: checkpoint.description,
        completedSteps: checkpoint.completedSteps,
        spreadsheetTitle: checkpoint.spreadsheetTitle,
      },
      message: `Resumed from checkpoint. ${checkpoint.completedSteps} steps already completed.`,
    },
  };
}

export async function handleListCheckpoints(
  req: {
    action: 'list_checkpoints';
    sessionId?: string;
  }
): Promise<SheetsSessionOutput> {
  if (!isCheckpointsEnabled()) {
    return {
      response: {
        success: true,
        action: 'list_checkpoints',
        checkpoints: [],
        message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
      },
    };
  }

  const { sessionId } = req;
  const checkpoints = sessionId
    ? await listCheckpointsForSession(sessionId)
    : await listAllCheckpoints();

  return {
    response: {
      success: true,
      action: 'list_checkpoints',
      checkpoints,
    },
  };
}

export async function handleDeleteCheckpoint(
  req: {
    action: 'delete_checkpoint';
    sessionId?: string;
    timestamp?: number;
  }
): Promise<SheetsSessionOutput> {
  if (!isCheckpointsEnabled()) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.CHECKPOINTS_DISABLED,
          message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
          retryable: false,
        },
      },
    };
  }

  const { sessionId, timestamp } = req;
  const deleted = await deleteCheckpoint(sessionId!, timestamp);

  return {
    response: {
      success: true,
      action: 'delete_checkpoint',
      deleted,
      message: deleted
        ? `Checkpoint(s) deleted for session "${sessionId}"`
        : `No checkpoints found for session "${sessionId}"`,
    },
  };
}
