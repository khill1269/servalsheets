/**
 * Freeze Operations for sheets_dimensions.
 * Covers: freeze
 */

import type {
  DimensionsFreezeInput,
  DimensionsResponse,
} from '../../schemas/index.js';
import type { DimensionsHandlerAccess } from './internal.js';

// ─── handleFreeze ─────────────────────────────────────────────────────────

export async function handleFreeze(
  ha: DimensionsHandlerAccess,
  input: DimensionsFreezeInput
): Promise<DimensionsResponse> {
  const isRows = input.dimension === 'ROWS';
  const propertyPath = isRows ? 'frozenRowCount' : 'frozenColumnCount';

  await ha.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: input.sheetId,
              gridProperties: {
                [propertyPath]: input.count,
              },
            },
            fields: `gridProperties.${propertyPath}`,
          },
        },
      ],
    },
  });

  const result = ha.success(
    'freeze',
    isRows ? { rowsAffected: input.count } : { columnsAffected: input.count }
  );

  // Wire session context: update sheet schema state with freeze info
  try {
    if (ha.context.sessionContext) {
      ha.context.sessionContext.recordOperation({
        tool: 'sheets_dimensions',
        action: 'freeze',
        spreadsheetId: input.spreadsheetId,
        description: `Froze ${input.count} ${isRows ? 'row(s)' : 'column(s)'} on sheet ${input.sheetId}`,
        undoable: true,
        cellsAffected: input.count,
      });
    }
  } catch {
    /* non-blocking */
  }

  return result;
}
