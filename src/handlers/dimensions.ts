/**
 * ServalSheets - Dimensions Handler
 * 
 * Handles sheets_dimensions tool (row/column operations)
 * MCP Protocol: 2025-11-25
 * 
 * 21 Actions:
 * - insert_rows, insert_columns
 * - delete_rows, delete_columns  
 * - move_rows, move_columns
 * - resize_rows, resize_columns, auto_resize
 * - hide_rows, hide_columns, show_rows, show_columns
 * - freeze_rows, freeze_columns
 * - group_rows, group_columns, ungroup_rows, ungroup_columns
 * - append_rows, append_columns
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsDimensionsInput, SheetsDimensionsOutput } from '../schemas/index.js';

export class DimensionsHandler extends BaseHandler<SheetsDimensionsInput, SheetsDimensionsOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_dimensions', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsDimensionsInput): Promise<SheetsDimensionsOutput> {
    try {
      switch (input.action) {
        case 'insert_rows':
          return await this.handleInsertRows(input);
        case 'insert_columns':
          return await this.handleInsertColumns(input);
        case 'delete_rows':
          return await this.handleDeleteRows(input);
        case 'delete_columns':
          return await this.handleDeleteColumns(input);
        case 'move_rows':
          return await this.handleMoveRows(input);
        case 'move_columns':
          return await this.handleMoveColumns(input);
        case 'resize_rows':
          return await this.handleResizeRows(input);
        case 'resize_columns':
          return await this.handleResizeColumns(input);
        case 'auto_resize':
          return await this.handleAutoResize(input);
        case 'hide_rows':
          return await this.handleHideRows(input);
        case 'hide_columns':
          return await this.handleHideColumns(input);
        case 'show_rows':
          return await this.handleShowRows(input);
        case 'show_columns':
          return await this.handleShowColumns(input);
        case 'freeze_rows':
          return await this.handleFreezeRows(input);
        case 'freeze_columns':
          return await this.handleFreezeColumns(input);
        case 'group_rows':
          return await this.handleGroupRows(input);
        case 'group_columns':
          return await this.handleGroupColumns(input);
        case 'ungroup_rows':
          return await this.handleUngroupRows(input);
        case 'ungroup_columns':
          return await this.handleUngroupColumns(input);
        case 'append_rows':
          return await this.handleAppendRows(input);
        case 'append_columns':
          return await this.handleAppendColumns(input);
        default:
          return this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(input as { action: string }).action}`,
            retryable: false,
          });
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  protected createIntents(input: SheetsDimensionsInput): Intent[] {
    const destructiveActions = ['delete_rows', 'delete_columns', 'move_rows', 'move_columns'];
    return [{
      type: input.action.startsWith('delete') ? 'DELETE_DIMENSION' : 
            input.action.startsWith('insert') || input.action.startsWith('append') ? 'INSERT_DIMENSION' : 
            'UPDATE_DIMENSION_PROPERTIES',
      target: { spreadsheetId: input.spreadsheetId, sheetId: input.sheetId },
      payload: {},
      metadata: {
        sourceTool: this.toolName,
        sourceAction: input.action,
        priority: 1,
        destructive: destructiveActions.includes(input.action),
      },
    }];
  }

  // ============================================================
  // Insert Operations
  // ============================================================

  private async handleInsertRows(
    input: Extract<SheetsDimensionsInput, { action: 'insert_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    const count = input.count ?? 1;
    
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.startIndex + count,
            },
            inheritFromBefore: input.inheritFromBefore ?? false,
          },
        }],
      },
    });

    return this.success('insert_rows', { rowsAffected: count });
  }

  private async handleInsertColumns(
    input: Extract<SheetsDimensionsInput, { action: 'insert_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    const count = input.count ?? 1;
    
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.startIndex + count,
            },
            inheritFromBefore: input.inheritFromBefore ?? false,
          },
        }],
      },
    });

    return this.success('insert_columns', { columnsAffected: count });
  }

  // ============================================================
  // Delete Operations (Destructive)
  // ============================================================

  private async handleDeleteRows(
    input: Extract<SheetsDimensionsInput, { action: 'delete_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    if (input.safety?.dryRun) {
      return this.success('delete_rows', { rowsAffected: input.endIndex - input.startIndex }, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    return this.success('delete_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleDeleteColumns(
    input: Extract<SheetsDimensionsInput, { action: 'delete_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    if (input.safety?.dryRun) {
      return this.success('delete_columns', { columnsAffected: input.endIndex - input.startIndex }, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    return this.success('delete_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  // ============================================================
  // Move Operations
  // ============================================================

  private async handleMoveRows(
    input: Extract<SheetsDimensionsInput, { action: 'move_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    if (input.safety?.dryRun) {
      return this.success('move_rows', { rowsAffected: input.endIndex - input.startIndex }, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          moveDimension: {
            source: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            destinationIndex: input.destinationIndex,
          },
        }],
      },
    });

    return this.success('move_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleMoveColumns(
    input: Extract<SheetsDimensionsInput, { action: 'move_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    if (input.safety?.dryRun) {
      return this.success('move_columns', { columnsAffected: input.endIndex - input.startIndex }, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          moveDimension: {
            source: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            destinationIndex: input.destinationIndex,
          },
        }],
      },
    });

    return this.success('move_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  // ============================================================
  // Resize Operations
  // ============================================================

  private async handleResizeRows(
    input: Extract<SheetsDimensionsInput, { action: 'resize_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            properties: {
              pixelSize: input.pixelSize,
            },
            fields: 'pixelSize',
          },
        }],
      },
    });

    return this.success('resize_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleResizeColumns(
    input: Extract<SheetsDimensionsInput, { action: 'resize_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            properties: {
              pixelSize: input.pixelSize,
            },
            fields: 'pixelSize',
          },
        }],
      },
    });

    return this.success('resize_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  private async handleAutoResize(
    input: Extract<SheetsDimensionsInput, { action: 'auto_resize' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          autoResizeDimensions: {
            dimensions: {
              sheetId: input.sheetId,
              dimension: input.dimension,
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    const count = input.endIndex - input.startIndex;
    return this.success('auto_resize', 
      input.dimension === 'ROWS' ? { rowsAffected: count } : { columnsAffected: count }
    );
  }

  // ============================================================
  // Visibility Operations
  // ============================================================

  private async handleHideRows(
    input: Extract<SheetsDimensionsInput, { action: 'hide_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            properties: {
              hiddenByUser: true,
            },
            fields: 'hiddenByUser',
          },
        }],
      },
    });

    return this.success('hide_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleHideColumns(
    input: Extract<SheetsDimensionsInput, { action: 'hide_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            properties: {
              hiddenByUser: true,
            },
            fields: 'hiddenByUser',
          },
        }],
      },
    });

    return this.success('hide_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  private async handleShowRows(
    input: Extract<SheetsDimensionsInput, { action: 'show_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            properties: {
              hiddenByUser: false,
            },
            fields: 'hiddenByUser',
          },
        }],
      },
    });

    return this.success('show_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleShowColumns(
    input: Extract<SheetsDimensionsInput, { action: 'show_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
            properties: {
              hiddenByUser: false,
            },
            fields: 'hiddenByUser',
          },
        }],
      },
    });

    return this.success('show_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  // ============================================================
  // Freeze Operations
  // ============================================================

  private async handleFreezeRows(
    input: Extract<SheetsDimensionsInput, { action: 'freeze_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId: input.sheetId,
              gridProperties: {
                frozenRowCount: input.frozenRowCount,
              },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        }],
      },
    });

    return this.success('freeze_rows', { rowsAffected: input.frozenRowCount });
  }

  private async handleFreezeColumns(
    input: Extract<SheetsDimensionsInput, { action: 'freeze_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId: input.sheetId,
              gridProperties: {
                frozenColumnCount: input.frozenColumnCount,
              },
            },
            fields: 'gridProperties.frozenColumnCount',
          },
        }],
      },
    });

    return this.success('freeze_columns', { columnsAffected: input.frozenColumnCount });
  }

  // ============================================================
  // Group Operations
  // ============================================================

  private async handleGroupRows(
    input: Extract<SheetsDimensionsInput, { action: 'group_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addDimensionGroup: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    return this.success('group_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleGroupColumns(
    input: Extract<SheetsDimensionsInput, { action: 'group_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addDimensionGroup: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    return this.success('group_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  private async handleUngroupRows(
    input: Extract<SheetsDimensionsInput, { action: 'ungroup_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimensionGroup: {
            range: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    return this.success('ungroup_rows', { rowsAffected: input.endIndex - input.startIndex });
  }

  private async handleUngroupColumns(
    input: Extract<SheetsDimensionsInput, { action: 'ungroup_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimensionGroup: {
            range: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              startIndex: input.startIndex,
              endIndex: input.endIndex,
            },
          },
        }],
      },
    });

    return this.success('ungroup_columns', { columnsAffected: input.endIndex - input.startIndex });
  }

  // ============================================================
  // Append Operations
  // ============================================================

  private async handleAppendRows(
    input: Extract<SheetsDimensionsInput, { action: 'append_rows' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId: input.sheetId,
            dimension: 'ROWS',
            length: input.count,
          },
        }],
      },
    });

    return this.success('append_rows', { rowsAffected: input.count });
  }

  private async handleAppendColumns(
    input: Extract<SheetsDimensionsInput, { action: 'append_columns' }>
  ): Promise<SheetsDimensionsOutput> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId: input.sheetId,
            dimension: 'COLUMNS',
            length: input.count,
          },
        }],
      },
    });

    return this.success('append_columns', { columnsAffected: input.count });
  }
}
