/**
 * Visibility Operations for sheets_dimensions.
 * Covers: hide, show
 */

import type {
  DimensionsHideInput,
  DimensionsShowInput,
  DimensionsResponse,
} from '../../schemas/index.js';
import type { DimensionsHandlerAccess } from './internal.js';

// ─── handleHide ───────────────────────────────────────────────────────────

export async function handleHide(
  ha: DimensionsHandlerAccess,
  input: DimensionsHideInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';

  // Create snapshot before mutating (hide is reversible but snapshot enables rollback)
  await ha.createSafetySnapshot(
    {
      operationType: 'hide',
      isDestructive: false,
      spreadsheetId: input.spreadsheetId,
    },
    input.safety
  );

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: input.dimension,
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

  const result = ha.success(
    'hide',
    isRows ? { rowsAffected: count } : { columnsAffected: count }
  );

  // Wire session context: track hidden rows/cols
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'hide',
        spreadsheetId: input.spreadsheetId,
        description: `Hidden ${count} ${isRows ? 'row(s)' : 'column(s)'} (${input.dimension} ${input.startIndex}–${input.endIndex}) on sheet ${input.sheetId}`,
        undoable: true,
        cellsAffected: count,
      });
    }
  } catch {
    /* non-blocking */
  }

  return result;
}

// ─── handleShow ───────────────────────────────────────────────────────────

export async function handleShow(
  ha: DimensionsHandlerAccess,
  input: DimensionsShowInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';

  // Create snapshot before mutating (show is reversible but snapshot enables rollback)
  await ha.createSafetySnapshot(
    {
      operationType: 'show',
      isDestructive: false,
      spreadsheetId: input.spreadsheetId,
    },
    input.safety
  );

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: input.dimension,
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

  // Record operation in session context for LLM follow-up references
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'show',
        spreadsheetId: input.spreadsheetId,
        description: `Unhid ${count} ${input.dimension === 'ROWS' ? 'rows' : 'columns'}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success('show', isRows ? { rowsAffected: count } : { columnsAffected: count });
}
