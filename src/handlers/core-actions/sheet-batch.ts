/**
 * ServalSheets - Sheet Batch Operations
 *
 * Handles: batch_delete_sheets, batch_update_sheets, clear_sheet, move_sheet
 */

import type { CoreHandlerAccess } from './internal.js';
import { ValidationError } from '../../core/errors.js';

export async function handleBatchDeleteSheets(
  ha: CoreHandlerAccess,
  req: { spreadsheetId: string; sheetIds: number[] }
) {
  if (!req.spreadsheetId || !req.sheetIds || req.sheetIds.length === 0) {
    return ha._mapError(
      new ValidationError('spreadsheetId and sheetIds are required', 'spreadsheetId')
    );
  }

  try {
    // Confirm destructive action
    await ha._confirmOperation({
      description: `Delete ${req.sheetIds.length} sheet(s)`,
      impact: 'This action cannot be undone',
    });

    // Create snapshot before deletion
    await ha._createSnapshot(req.spreadsheetId);

    // Delete sheets
    const requests: any[] = req.sheetIds.map((sheetId) => ({
      deleteSheet: { sheetId },
    }));

    await ha.api.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: { requests },
    });

    return ha._makeSuccess('batch_delete_sheets', {
      sheetsDeleted: req.sheetIds.length,
      message: `Successfully deleted ${req.sheetIds.length} sheet(s)`,
    });
  } catch (error) {
    return ha._mapError(error);
  }
}

export async function handleBatchUpdateSheets(
  ha: CoreHandlerAccess,
  req: { spreadsheetId: string; updates: any[] }
) {
  if (!req.spreadsheetId || !req.updates || req.updates.length === 0) {
    return ha._mapError(
      new ValidationError('spreadsheetId and updates are required', 'spreadsheetId')
    );
  }

  try {
    const requests = req.updates.map((update) => ({
      updateSheetProperties: {
        fields: 'title,hidden,index',
        properties: update,
      },
    }));

    await ha.api.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: { requests },
    });

    return ha._makeSuccess('batch_update_sheets', {
      sheetsUpdated: req.updates.length,
      message: `Successfully updated ${req.updates.length} sheet(s)`,
    });
  } catch (error) {
    return ha._mapError(error);
  }
}

export async function handleClearSheet(
  ha: CoreHandlerAccess,
  req: { spreadsheetId: string; sheetId: number; clearFormats?: boolean }
) {
  if (!req.spreadsheetId || req.sheetId === undefined) {
    return ha._mapError(
      new ValidationError('spreadsheetId and sheetId are required', 'spreadsheetId')
    );
  }

  try {
    // Create snapshot before clearing
    await ha._createSnapshot(req.spreadsheetId);

    const range = `'Sheet'!A:Z`; // TODO: Get actual sheet name
    const fields = req.clearFormats ? 'userEnteredFormat,userEnteredValue' : 'userEnteredValue';

    await ha.api.spreadsheets.values.clear({
      spreadsheetId: req.spreadsheetId,
      range,
    });

    return ha._makeSuccess('clear_sheet', {
      message: 'Sheet cleared successfully',
    });
  } catch (error) {
    return ha._mapError(error);
  }
}

export async function handleMoveSheet(
  ha: CoreHandlerAccess,
  req: { spreadsheetId: string; sheetId: number; newIndex: number }
) {
  if (!req.spreadsheetId || req.sheetId === undefined || req.newIndex === undefined) {
    return ha._mapError(
      new ValidationError('spreadsheetId, sheetId, and newIndex are required', 'spreadsheetId')
    );
  }

  try {
    await ha.api.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            moveSheet: {
              sheetId: req.sheetId,
              index: req.newIndex,
            },
          },
        ],
      },
    });

    return ha._makeSuccess('move_sheet', {
      message: `Sheet moved to index ${req.newIndex}`,
    });
  } catch (error) {
    return ha._mapError(error);
  }
}
