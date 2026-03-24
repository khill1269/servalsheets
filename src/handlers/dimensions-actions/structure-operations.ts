/**
 * Structure Operations for sheets_dimensions.
 * Covers: insert, delete, move, group, ungroup, append
 */

import { ErrorCodes } from '../error-codes.js';
import type {
  DimensionsInsertInput,
  DimensionsDeleteInput,
  DimensionsMoveInput,
  DimensionsGroupInput,
  DimensionsUngroupInput,
  DimensionsAppendInput,
  DimensionsResponse,
} from '../../schemas/index.js';
import { confirmDestructiveAction } from '../../mcp/elicitation.js';
import { getBackgroundAnalyzer } from '../../services/background-analyzer.js';
import { getBackgroundAnalysisConfig } from '../../config/env.js';
import type { DimensionsHandlerAccess } from './internal.js';

// ─── handleInsert ─────────────────────────────────────────────────────────

export async function handleInsert(
  ha: DimensionsHandlerAccess,
  input: DimensionsInsertInput
): Promise<DimensionsResponse> {
  const count = input.count ?? 1;
  const isRows = input.dimension === 'ROWS';

  // Create snapshot before mutating (allows rollback)
  await ha.createSafetySnapshot(
    {
      operationType: 'insert',
      isDestructive: false,
      spreadsheetId: input.spreadsheetId,
    },
    input.safety
  );

  // Request confirmation for larger inserts
  if (ha.context.elicitationServer && count > 10) {
    try {
      const confirmation = await confirmDestructiveAction(
        ha.context.elicitationServer,
        `Insert ${isRows ? 'Rows' : 'Columns'}`,
        `You are about to insert ${count} ${isRows ? 'rows' : 'columns'} at index ${input.startIndex + 1}. This will shift existing data.`
      );

      if (!confirmation.confirmed) {
        return ha.error({
          code: ErrorCodes.PRECONDITION_FAILED,
          message: `${isRows ? 'Row' : 'Column'} insertion cancelled by user`,
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    } catch (err) {
      ha.context.logger?.warn(`Elicitation failed for insert, proceeding with operation`, {
        error: err,
      });
    }
  }

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: input.sheetId,
              dimension: input.dimension,
              startIndex: input.startIndex,
              endIndex: input.startIndex + count,
            },
            inheritFromBefore: input.inheritFromBefore ?? false,
          },
        },
      ],
    },
  });

  // Record operation in session context for LLM follow-up references
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'insert',
        spreadsheetId: input.spreadsheetId,
        description: `Inserted ${count} ${input.dimension === 'ROWS' ? 'rows' : 'columns'} at index ${input.startIndex}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success(
    'insert',
    input.dimension === 'ROWS' ? { rowsAffected: count } : { columnsAffected: count }
  );
}

// ─── handleDelete ─────────────────────────────────────────────────────────

export async function handleDelete(
  ha: DimensionsHandlerAccess,
  input: DimensionsDeleteInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';
  const label = isRows ? 'rows' : 'columns';
  const threshold = isRows ? 5 : 3;

  // Generate safety warnings
  const safetyContext = {
    [isRows ? 'affectedRows' : 'affectedColumns']: count,
    isDestructive: true,
    operationType: `delete`,
    spreadsheetId: input.spreadsheetId,
  };
  const warnings = ha.getSafetyWarnings(safetyContext, input.safety);

  // Request confirmation for destructive operation if elicitation is supported
  if (ha.context.elicitationServer && count > threshold) {
    try {
      const confirmation = await confirmDestructiveAction(
        ha.context.elicitationServer,
        `Delete ${isRows ? 'Rows' : 'Columns'}`,
        `You are about to delete ${count} ${label} (${label} ${input.startIndex + 1}-${input.endIndex}).\n\nAll data, formatting, and formulas will be permanently removed.`
      );

      if (!confirmation.confirmed) {
        return ha.error({
          code: ErrorCodes.PRECONDITION_FAILED,
          message: `${isRows ? 'Row' : 'Column'} deletion cancelled by user`,
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    } catch (err) {
      ha.context.logger?.warn(`Elicitation failed for delete, proceeding with operation`, {
        error: err,
      });
    }
  }

  if (input.safety?.dryRun) {
    const meta = ha.generateMeta('delete', input, undefined, { cellsAffected: count });
    if (warnings.length > 0) {
      meta.warnings = ha.formatWarnings(warnings);
    }
    return ha.success(
      'delete',
      isRows ? { rowsAffected: count } : { columnsAffected: count },
      undefined,
      true,
      meta
    );
  }

  // Create snapshot if requested
  const snapshot = await ha.createSafetySnapshot(safetyContext, input.safety);

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
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

  // Trigger background quality analysis after destructive operation
  const analysisConfig = getBackgroundAnalysisConfig();
  if (analysisConfig.enabled && count >= analysisConfig.minCells) {
    const analyzer = getBackgroundAnalyzer();
    // Estimate affected cells (conservative: rows * 26 columns OR columns * 1000 rows)
    const estimatedCells = isRows ? count * 26 : count * 1000;
    analyzer.analyzeInBackground(
      input.spreadsheetId,
      'A1', // Full sheet analysis since dimensions changed
      estimatedCells,
      ha.sheetsApi,
      {
        qualityThreshold: 70,
        minCellsChanged: analysisConfig.minCells,
        debounceMs: analysisConfig.debounceMs,
      }
    );
  }

  // Build response with snapshot info if created
  const meta = ha.generateMeta(
    'delete',
    input,
    isRows ? { rowsAffected: count } : { columnsAffected: count },
    { cellsAffected: count }
  );
  if (snapshot) {
    const snapshotInfo = ha.snapshotInfo(snapshot);
    if (snapshotInfo) {
      const metaWithSnapshot = meta as Record<string, unknown>;
      metaWithSnapshot['snapshot'] = snapshotInfo;
    }
  }
  if (warnings.length > 0) {
    meta.warnings = ha.formatWarnings(warnings);
  }

  // Record operation in session context for LLM follow-up references
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'delete',
        spreadsheetId: input.spreadsheetId,
        description: `Deleted ${count} ${input.dimension === 'ROWS' ? 'rows' : 'columns'} from index ${input.startIndex}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success(
    'delete',
    isRows ? { rowsAffected: count } : { columnsAffected: count },
    undefined,
    false,
    meta
  );
}

// ─── handleMove ───────────────────────────────────────────────────────────

export async function handleMove(
  ha: DimensionsHandlerAccess,
  input: DimensionsMoveInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';

  if (input.safety?.dryRun) {
    return ha.success(
      'move',
      isRows ? { rowsAffected: count } : { columnsAffected: count },
      undefined,
      true
    );
  }

  // Create snapshot before mutating (allows rollback)
  await ha.createSafetySnapshot(
    {
      operationType: 'move',
      isDestructive: false,
      spreadsheetId: input.spreadsheetId,
    },
    input.safety
  );

  // Request confirmation for move operations
  if (ha.context.elicitationServer) {
    try {
      const confirmation = await confirmDestructiveAction(
        ha.context.elicitationServer,
        `Move ${isRows ? 'Rows' : 'Columns'}`,
        `You are about to move ${count} ${isRows ? 'rows' : 'columns'} (indices ${input.startIndex + 1}-${input.endIndex}) to index ${input.destinationIndex + 1}. This will reorder existing data.`
      );

      if (!confirmation.confirmed) {
        return ha.error({
          code: ErrorCodes.PRECONDITION_FAILED,
          message: `${isRows ? 'Row' : 'Column'} move cancelled by user`,
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    } catch (err) {
      ha.context.logger?.warn(`Elicitation failed for move, proceeding with operation`, {
        error: err,
      });
    }
  }

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          moveDimension: {
            source: {
              sheetId: input.sheetId,
              dimension: input.dimension,
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            destinationIndex: input.destinationIndex,
          },
        },
      ],
    },
  });

  // Record operation in session context for LLM follow-up references
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'move',
        spreadsheetId: input.spreadsheetId,
        description: `Moved ${count} ${input.dimension === 'ROWS' ? 'rows' : 'columns'} to index ${input.destinationIndex}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success('move', isRows ? { rowsAffected: count } : { columnsAffected: count });
}

// ─── handleGroup ──────────────────────────────────────────────────────────

export async function handleGroup(
  ha: DimensionsHandlerAccess,
  input: DimensionsGroupInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          addDimensionGroup: {
            range: {
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

  // Record operation in session context for LLM follow-up references
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'group',
        spreadsheetId: input.spreadsheetId,
        description: `Grouped ${count} ${input.dimension === 'ROWS' ? 'rows' : 'columns'}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success('group', isRows ? { rowsAffected: count } : { columnsAffected: count });
}

// ─── handleUngroup ────────────────────────────────────────────────────────

export async function handleUngroup(
  ha: DimensionsHandlerAccess,
  input: DimensionsUngroupInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimensionGroup: {
            range: {
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

  // Record operation in session context for LLM follow-up references
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'ungroup',
        spreadsheetId: input.spreadsheetId,
        description: `Ungrouped ${count} ${input.dimension === 'ROWS' ? 'rows' : 'columns'}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success('ungroup', isRows ? { rowsAffected: count } : { columnsAffected: count });
}

// ─── handleAppend ─────────────────────────────────────────────────────────

export async function handleAppend(
  ha: DimensionsHandlerAccess,
  input: DimensionsAppendInput
): Promise<DimensionsResponse> {
  const isRows = input.dimension === 'ROWS';

  // Create snapshot before mutating (allows rollback)
  await ha.createSafetySnapshot(
    {
      operationType: 'append',
      isDestructive: false,
      spreadsheetId: input.spreadsheetId,
    },
    input.safety
  );

  // Request confirmation for larger appends
  if (ha.context.elicitationServer && (input.count ?? 1) > 10) {
    try {
      const confirmation = await confirmDestructiveAction(
        ha.context.elicitationServer,
        `Append ${isRows ? 'Rows' : 'Columns'}`,
        `You are about to append ${input.count} ${isRows ? 'rows' : 'columns'} to the sheet. This will increase the sheet dimensions.`
      );

      if (!confirmation.confirmed) {
        return ha.error({
          code: ErrorCodes.PRECONDITION_FAILED,
          message: `${isRows ? 'Row' : 'Column'} append cancelled by user`,
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    } catch (err) {
      ha.context.logger?.warn(`Elicitation failed for append, proceeding with operation`, {
        error: err,
      });
    }
  }

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId: input.sheetId,
            dimension: input.dimension,
            length: input.count,
          },
        },
      ],
    },
  });

  return ha.success(
    'append',
    isRows ? { rowsAffected: input.count } : { columnsAffected: input.count }
  );
}
