/**
 * Resize Operations for sheets_dimensions.
 * Covers: resize, auto_resize
 */

import type {
  DimensionsResizeInput,
  DimensionsAutoResizeInput,
  DimensionsResponse,
} from '../../schemas/index.js';
import type { DimensionsHandlerAccess } from './internal.js';

// ─── handleResize ─────────────────────────────────────────────────────────

export async function handleResize(
  ha: DimensionsHandlerAccess,
  input: DimensionsResizeInput
): Promise<DimensionsResponse> {
  const count = input.endIndex - input.startIndex;
  const isRows = input.dimension === 'ROWS';

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
              pixelSize: input.pixelSize,
            },
            fields: 'pixelSize',
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
        action: 'resize',
        spreadsheetId: input.spreadsheetId,
        description: `Resized ${input.dimension === 'ROWS' ? 'rows' : 'columns'} to ${input.pixelSize}px`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return ha.success('resize', isRows ? { rowsAffected: count } : { columnsAffected: count });
}

// ─── handleAutoResize ─────────────────────────────────────────────────────

export async function handleAutoResize(
  ha: DimensionsHandlerAccess,
  input: DimensionsAutoResizeInput
): Promise<DimensionsResponse> {
  await ha.sheetsApi.spreadsheets.batchUpdate({
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
  return ha.success(
    'auto_resize',
    input.dimension === 'ROWS' ? { rowsAffected: count } : { columnsAffected: count }
  );
}
