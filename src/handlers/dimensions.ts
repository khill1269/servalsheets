/**
 * ServalSheets - Dimensions Handler
 *
 * Handles sheets_dimensions tool (row/column operations, filtering, and sorting)
 * MCP Protocol: 2025-11-25
 *
 * 35 Actions:
 * - insert_rows, insert_columns
 * - delete_rows, delete_columns
 * - move_rows, move_columns
 * - resize_rows, resize_columns, auto_resize
 * - hide_rows, hide_columns, show_rows, show_columns
 * - freeze_rows, freeze_columns
 * - group_rows, group_columns, ungroup_rows, ungroup_columns
 * - append_rows, append_columns
 * - filter_set_basic_filter, filter_clear_basic_filter, filter_get_basic_filter, filter_update_filter_criteria
 * - filter_sort_range
 * - filter_create_filter_view, filter_update_filter_view, filter_delete_filter_view, filter_list_filter_views, filter_get_filter_view
 * - filter_create_slicer, filter_update_slicer, filter_delete_slicer, filter_list_slicers
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsDimensionsInput,
  SheetsDimensionsOutput,
  DimensionsResponse,
  DimensionsInsertRowsInput,
  DimensionsInsertColumnsInput,
  DimensionsDeleteRowsInput,
  DimensionsDeleteColumnsInput,
  DimensionsMoveRowsInput,
  DimensionsMoveColumnsInput,
  DimensionsResizeRowsInput,
  DimensionsResizeColumnsInput,
  DimensionsAutoResizeInput,
  DimensionsHideRowsInput,
  DimensionsHideColumnsInput,
  DimensionsShowRowsInput,
  DimensionsShowColumnsInput,
  DimensionsFreezeRowsInput,
  DimensionsFreezeColumnsInput,
  DimensionsGroupRowsInput,
  DimensionsGroupColumnsInput,
  DimensionsUngroupRowsInput,
  DimensionsUngroupColumnsInput,
  DimensionsAppendRowsInput,
  DimensionsAppendColumnsInput,
  DimensionsFilterSetBasicFilterInput,
  DimensionsFilterClearBasicFilterInput,
  DimensionsFilterGetBasicFilterInput,
  DimensionsFilterUpdateFilterCriteriaInput,
  DimensionsFilterSortRangeInput,
  DimensionsFilterCreateFilterViewInput,
  DimensionsFilterUpdateFilterViewInput,
  DimensionsFilterDeleteFilterViewInput,
  DimensionsFilterListFilterViewsInput,
  DimensionsFilterGetFilterViewInput,
  DimensionsFilterCreateSlicerInput,
  DimensionsFilterUpdateSlicerInput,
  DimensionsFilterDeleteSlicerInput,
  DimensionsFilterListSlicersInput,
} from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';

type ApiFilterCriteria = sheets_v4.Schema$FilterCriteria;

export class DimensionsHandler extends BaseHandler<SheetsDimensionsInput, SheetsDimensionsOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_dimensions', context);
    this.sheetsApi = sheetsApi;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: DimensionsResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): DimensionsResponse {
    if (!response.success || verbosity === 'standard') {
      return response; // No filtering for errors or standard verbosity
    }

    if (verbosity === 'minimal') {
      // Minimal: Return only essential fields (~40% token reduction)
      const filtered = { ...response };

      // Keep only: success, action, and primary result field
      const minimalResponse: DimensionsResponse = {
        success: true,
        action: filtered.action,
      };

      // Copy primary result fields
      const primaryFields = [
        'inserted',
        'deleted',
        'moved',
        'resized',
        'hidden',
        'shown',
        'frozen',
        'grouped',
        'ungrouped',
        'appended',
        'filter',
        'filterView',
        'slicer',
        'filterViews',
        'slicers',
      ];
      for (const field of primaryFields) {
        if (field in filtered) {
          (minimalResponse as Record<string, unknown>)[field] = (
            filtered as Record<string, unknown>
          )[field];
        }
      }

      // Omit: _meta, detailed dimension info, etc.
      return minimalResponse;
    }

    // Detailed: Add extra metadata (future enhancement)
    return response;
  }

  async handle(input: SheetsDimensionsInput): Promise<SheetsDimensionsOutput> {
    // Input is now the action directly (no request wrapper)
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(input) as SheetsDimensionsInput;

    try {
      const req = inferredRequest;
      let response: DimensionsResponse;
      switch (req.action) {
        case 'insert_rows':
          response = await this.handleInsertRows(req as DimensionsInsertRowsInput);
          break;
        case 'insert_columns':
          response = await this.handleInsertColumns(req as DimensionsInsertColumnsInput);
          break;
        case 'delete_rows':
          response = await this.handleDeleteRows(req as DimensionsDeleteRowsInput);
          break;
        case 'delete_columns':
          response = await this.handleDeleteColumns(req as DimensionsDeleteColumnsInput);
          break;
        case 'move_rows':
          response = await this.handleMoveRows(req as DimensionsMoveRowsInput);
          break;
        case 'move_columns':
          response = await this.handleMoveColumns(req as DimensionsMoveColumnsInput);
          break;
        case 'resize_rows':
          response = await this.handleResizeRows(req as DimensionsResizeRowsInput);
          break;
        case 'resize_columns':
          response = await this.handleResizeColumns(req as DimensionsResizeColumnsInput);
          break;
        case 'auto_resize':
          response = await this.handleAutoResize(req as DimensionsAutoResizeInput);
          break;
        case 'hide_rows':
          response = await this.handleHideRows(req as DimensionsHideRowsInput);
          break;
        case 'hide_columns':
          response = await this.handleHideColumns(req as DimensionsHideColumnsInput);
          break;
        case 'show_rows':
          response = await this.handleShowRows(req as DimensionsShowRowsInput);
          break;
        case 'show_columns':
          response = await this.handleShowColumns(req as DimensionsShowColumnsInput);
          break;
        case 'freeze_rows':
          response = await this.handleFreezeRows(req as DimensionsFreezeRowsInput);
          break;
        case 'freeze_columns':
          response = await this.handleFreezeColumns(req as DimensionsFreezeColumnsInput);
          break;
        case 'group_rows':
          response = await this.handleGroupRows(req as DimensionsGroupRowsInput);
          break;
        case 'group_columns':
          response = await this.handleGroupColumns(req as DimensionsGroupColumnsInput);
          break;
        case 'ungroup_rows':
          response = await this.handleUngroupRows(req as DimensionsUngroupRowsInput);
          break;
        case 'ungroup_columns':
          response = await this.handleUngroupColumns(req as DimensionsUngroupColumnsInput);
          break;
        case 'append_rows':
          response = await this.handleAppendRows(req as DimensionsAppendRowsInput);
          break;
        case 'append_columns':
          response = await this.handleAppendColumns(req as DimensionsAppendColumnsInput);
          break;
        case 'filter_set_basic_filter':
          response = await this.handleFilterSetBasicFilter(
            req as DimensionsFilterSetBasicFilterInput
          );
          break;
        case 'filter_clear_basic_filter':
          response = await this.handleFilterClearBasicFilter(
            req as DimensionsFilterClearBasicFilterInput
          );
          break;
        case 'filter_get_basic_filter':
          response = await this.handleFilterGetBasicFilter(
            req as DimensionsFilterGetBasicFilterInput
          );
          break;
        case 'filter_update_filter_criteria':
          response = await this.handleFilterUpdateFilterCriteria(
            req as DimensionsFilterUpdateFilterCriteriaInput
          );
          break;
        case 'filter_sort_range':
          response = await this.handleFilterSortRange(req as DimensionsFilterSortRangeInput);
          break;
        case 'filter_create_filter_view':
          response = await this.handleFilterCreateFilterView(
            req as DimensionsFilterCreateFilterViewInput
          );
          break;
        case 'filter_update_filter_view':
          response = await this.handleFilterUpdateFilterView(
            req as DimensionsFilterUpdateFilterViewInput
          );
          break;
        case 'filter_delete_filter_view':
          response = await this.handleFilterDeleteFilterView(
            req as DimensionsFilterDeleteFilterViewInput
          );
          break;
        case 'filter_list_filter_views':
          response = await this.handleFilterListFilterViews(
            req as DimensionsFilterListFilterViewsInput
          );
          break;
        case 'filter_get_filter_view':
          response = await this.handleFilterGetFilterView(
            req as DimensionsFilterGetFilterViewInput
          );
          break;
        case 'filter_create_slicer':
          response = await this.handleFilterCreateSlicer(req as DimensionsFilterCreateSlicerInput);
          break;
        case 'filter_update_slicer':
          response = await this.handleFilterUpdateSlicer(req as DimensionsFilterUpdateSlicerInput);
          break;
        case 'filter_delete_slicer':
          response = await this.handleFilterDeleteSlicer(req as DimensionsFilterDeleteSlicerInput);
          break;
        case 'filter_list_slicers':
          response = await this.handleFilterListSlicers(req as DimensionsFilterListSlicersInput);
          break;
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId:
            'sheetId' in inferredRequest
              ? typeof inferredRequest.sheetId === 'number'
                ? inferredRequest.sheetId
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = inferredRequest.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsDimensionsInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    const req = input;

    // Filter operations execute directly; no batch compiler intents needed
    if (req.action.startsWith('filter_')) {
      return [];
    }

    const destructiveActions = ['delete_rows', 'delete_columns', 'move_rows', 'move_columns'];
    return [
      {
        type: req.action.startsWith('delete')
          ? 'DELETE_DIMENSION'
          : req.action.startsWith('insert') || req.action.startsWith('append')
            ? 'INSERT_DIMENSION'
            : 'UPDATE_DIMENSION_PROPERTIES',
        target: { spreadsheetId: req.spreadsheetId!, sheetId: req.sheetId! },
        payload: {},
        metadata: {
          sourceTool: this.toolName,
          sourceAction: req.action,
          priority: 1,
          destructive: destructiveActions.includes(req.action),
        },
      },
    ];
  }

  // ============================================================
  // Insert Operations
  // ============================================================

  private async handleInsertRows(input: DimensionsInsertRowsInput): Promise<DimensionsResponse> {
    const count = input.count ?? 1;

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: input.sheetId,
                dimension: 'ROWS',
                startIndex: input.startIndex,
                endIndex: input.startIndex + count,
              },
              inheritFromBefore: input.inheritFromBefore ?? false,
            },
          },
        ],
      },
    });

    return this.success('insert_rows', { rowsAffected: count });
  }

  private async handleInsertColumns(
    input: DimensionsInsertColumnsInput
  ): Promise<DimensionsResponse> {
    const count = input.count ?? 1;

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: input.sheetId,
                dimension: 'COLUMNS',
                startIndex: input.startIndex,
                endIndex: input.startIndex + count,
              },
              inheritFromBefore: input.inheritFromBefore ?? false,
            },
          },
        ],
      },
    });

    return this.success('insert_columns', { columnsAffected: count });
  }

  // ============================================================
  // Delete Operations (Destructive)
  // ============================================================

  private async handleDeleteRows(input: DimensionsDeleteRowsInput): Promise<DimensionsResponse> {
    const rowCount = input.endIndex - input.startIndex;

    // Generate safety warnings
    const safetyContext = {
      affectedRows: rowCount,
      isDestructive: true,
      operationType: 'delete_rows',
      spreadsheetId: input.spreadsheetId,
    };
    const warnings = this.getSafetyWarnings(safetyContext, input.safety);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && rowCount > 5) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          'Delete Rows',
          `You are about to delete ${rowCount} row${rowCount > 1 ? 's' : ''} (rows ${input.startIndex + 1}-${input.endIndex}).\n\nAll data, formatting, and formulas in these rows will be permanently removed.`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'PRECONDITION_FAILED',
            message: 'Row deletion cancelled by user',
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn('Elicitation failed for delete_rows, proceeding with operation', {
          error: err,
        });
      }
    }

    if (input.safety?.dryRun) {
      const meta = this.generateMeta('delete_rows', input, undefined, {
        cellsAffected: rowCount,
      });
      if (warnings.length > 0) {
        meta.warnings = this.formatWarnings(warnings);
      }
      return this.success('delete_rows', { rowsAffected: rowCount }, undefined, true, meta);
    }

    // Create snapshot if requested
    const snapshot = await this.createSafetySnapshot(safetyContext, input.safety);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: input.sheetId,
                dimension: 'ROWS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    // Build response with snapshot info if created
    const meta = this.generateMeta(
      'delete_rows',
      input,
      { rowsAffected: rowCount },
      { cellsAffected: rowCount }
    );
    if (snapshot) {
      const snapshotInfo = this.snapshotInfo(snapshot);
      if (snapshotInfo) {
        meta.snapshot = snapshotInfo;
      }
    }
    if (warnings.length > 0) {
      meta.warnings = this.formatWarnings(warnings);
    }

    return this.success('delete_rows', { rowsAffected: rowCount }, undefined, false, meta);
  }

  private async handleDeleteColumns(
    input: DimensionsDeleteColumnsInput
  ): Promise<DimensionsResponse> {
    const columnCount = input.endIndex - input.startIndex;

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && columnCount > 3) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          'Delete Columns',
          `You are about to delete ${columnCount} column${columnCount > 1 ? 's' : ''} (columns ${input.startIndex}-${input.endIndex - 1}).\n\nAll data, formatting, and formulas in these columns will be permanently removed.`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'PRECONDITION_FAILED',
            message: 'Column deletion cancelled by user',
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn(
          'Elicitation failed for delete_columns, proceeding with operation',
          { error: err }
        );
      }
    }

    if (input.safety?.dryRun) {
      return this.success('delete_columns', { columnsAffected: columnCount }, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: input.sheetId,
                dimension: 'COLUMNS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success('delete_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Move Operations
  // ============================================================

  private async handleMoveRows(input: DimensionsMoveRowsInput): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success(
        'move_rows',
        { rowsAffected: input.endIndex - input.startIndex },
        undefined,
        true
      );
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId: input.sheetId,
                dimension: 'ROWS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              destinationIndex: input.destinationIndex,
            },
          },
        ],
      },
    });

    return this.success('move_rows', {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleMoveColumns(input: DimensionsMoveColumnsInput): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success(
        'move_columns',
        { columnsAffected: input.endIndex - input.startIndex },
        undefined,
        true
      );
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId: input.sheetId,
                dimension: 'COLUMNS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              destinationIndex: input.destinationIndex,
            },
          },
        ],
      },
    });

    return this.success('move_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Resize Operations
  // ============================================================

  private async handleResizeRows(input: DimensionsResizeRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
          },
        ],
      },
    });

    return this.success('resize_rows', {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleResizeColumns(
    input: DimensionsResizeColumnsInput
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
          },
        ],
      },
    });

    return this.success('resize_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleAutoResize(input: DimensionsAutoResizeInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
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
    return this.success(
      'auto_resize',
      input.dimension === 'ROWS' ? { rowsAffected: count } : { columnsAffected: count }
    );
  }

  // ============================================================
  // Visibility Operations
  // ============================================================

  private async handleHideRows(input: DimensionsHideRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
          },
        ],
      },
    });

    return this.success('hide_rows', {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleHideColumns(input: DimensionsHideColumnsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
          },
        ],
      },
    });

    return this.success('hide_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleShowRows(input: DimensionsShowRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
          },
        ],
      },
    });

    return this.success('show_rows', {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleShowColumns(input: DimensionsShowColumnsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
          },
        ],
      },
    });

    return this.success('show_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Freeze Operations
  // ============================================================

  private async handleFreezeRows(input: DimensionsFreezeRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: input.sheetId,
                gridProperties: {
                  frozenRowCount: input.frozenRowCount,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });

    return this.success('freeze_rows', { rowsAffected: input.frozenRowCount });
  }

  private async handleFreezeColumns(
    input: DimensionsFreezeColumnsInput
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: input.sheetId,
                gridProperties: {
                  frozenColumnCount: input.frozenColumnCount,
                },
              },
              fields: 'gridProperties.frozenColumnCount',
            },
          },
        ],
      },
    });

    return this.success('freeze_columns', {
      columnsAffected: input.frozenColumnCount,
    });
  }

  // ============================================================
  // Group Operations
  // ============================================================

  private async handleGroupRows(input: DimensionsGroupRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: 'ROWS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success('group_rows', {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleGroupColumns(
    input: DimensionsGroupColumnsInput
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: 'COLUMNS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success('group_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleUngroupRows(input: DimensionsUngroupRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: 'ROWS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success('ungroup_rows', {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleUngroupColumns(
    input: DimensionsUngroupColumnsInput
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: 'COLUMNS',
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success('ungroup_columns', {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Append Operations
  // ============================================================

  private async handleAppendRows(input: DimensionsAppendRowsInput): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: input.sheetId,
              dimension: 'ROWS',
              length: input.count,
            },
          },
        ],
      },
    });

    return this.success('append_rows', { rowsAffected: input.count });
  }

  private async handleAppendColumns(
    input: DimensionsAppendColumnsInput
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: input.sheetId,
              dimension: 'COLUMNS',
              length: input.count,
            },
          },
        ],
      },
    });

    return this.success('append_columns', { columnsAffected: input.count });
  }

  // ============================================================
  // Filter Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleFilterSetBasicFilter(
    input: DimensionsFilterSetBasicFilterInput
  ): Promise<DimensionsResponse> {
    const gridRange = input.range
      ? await this.toGridRange(input.spreadsheetId, input.range)
      : { sheetId: input.sheetId };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            setBasicFilter: {
              filter: {
                range: toGridRange(gridRange),
                criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
              },
            },
          },
        ],
      },
    });

    return this.success('filter_set_basic_filter', {});
  }

  private async handleFilterClearBasicFilter(
    input: DimensionsFilterClearBasicFilterInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('filter_clear_basic_filter', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            clearBasicFilter: { sheetId: input.sheetId },
          },
        ],
      },
    });

    return this.success('filter_clear_basic_filter', {});
  }

  private async handleFilterGetBasicFilter(
    input: DimensionsFilterGetBasicFilterInput
  ): Promise<DimensionsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties.sheetId,sheets.basicFilter',
    });

    for (const sheet of response.data.sheets ?? []) {
      if (sheet.properties?.sheetId === input.sheetId && sheet.basicFilter) {
        return this.success('filter_get_basic_filter', {
          filter: {
            range: this.toGridRangeOutput(sheet.basicFilter.range ?? { sheetId: input.sheetId }),
            criteria: sheet.basicFilter.criteria ?? {},
          },
        });
      }
    }

    return this.success('filter_get_basic_filter', {});
  }

  private async handleFilterUpdateFilterCriteria(
    input: DimensionsFilterUpdateFilterCriteriaInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('filter_update_filter_criteria', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            setBasicFilter: {
              filter: {
                range: { sheetId: input.sheetId },
                criteria: this.mapCriteria(input.criteria),
              },
            },
          },
        ],
      },
    });

    return this.success('filter_update_filter_criteria', {});
  }

  // ============================================================
  // Sort Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleFilterSortRange(
    input: DimensionsFilterSortRangeInput
  ): Promise<DimensionsResponse> {
    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            sortRange: {
              range: toGridRange(gridRange),
              sortSpecs: input.sortSpecs.map((spec) => ({
                dimensionIndex: spec.columnIndex,
                sortOrder: spec.sortOrder ?? 'ASCENDING',
                foregroundColor: spec.foregroundColor,
                backgroundColor: spec.backgroundColor,
              })),
            },
          },
        ],
      },
    });

    return this.success('filter_sort_range', {});
  }

  // ============================================================
  // Filter View Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleFilterCreateFilterView(
    input: DimensionsFilterCreateFilterViewInput
  ): Promise<DimensionsResponse> {
    const gridRange = input.range
      ? await this.toGridRange(input.spreadsheetId, input.range)
      : { sheetId: input.sheetId };

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addFilterView: {
              filter: {
                title: input.title,
                range: toGridRange(gridRange),
                criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
                sortSpecs: input.sortSpecs?.map((spec) => ({
                  dimensionIndex: spec.columnIndex,
                  sortOrder: spec.sortOrder ?? 'ASCENDING',
                })),
              },
            },
          },
        ],
      },
    });

    const filterViewId = response.data.replies?.[0]?.addFilterView?.filter?.filterViewId;
    return this.success('filter_create_filter_view', {
      filterViewId: filterViewId ?? undefined,
    });
  }

  private async handleFilterUpdateFilterView(
    input: DimensionsFilterUpdateFilterViewInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('filter_update_filter_view', {}, undefined, true);
    }

    const filter: sheets_v4.Schema$FilterView = {
      filterViewId: input.filterViewId,
      title: input.title,
      criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
      sortSpecs: input.sortSpecs?.map((spec) => ({
        dimensionIndex: spec.columnIndex,
        sortOrder: spec.sortOrder ?? 'ASCENDING',
      })),
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateFilterView: {
              filter,
              fields: 'title,criteria,sortSpecs',
            },
          },
        ],
      },
    });

    return this.success('filter_update_filter_view', {});
  }

  private async handleFilterDeleteFilterView(
    input: DimensionsFilterDeleteFilterViewInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('filter_delete_filter_view', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteFilterView: { filterId: input.filterViewId },
          },
        ],
      },
    });

    return this.success('filter_delete_filter_view', {});
  }

  private async handleFilterListFilterViews(
    input: DimensionsFilterListFilterViewsInput
  ): Promise<DimensionsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.filterViews,sheets.properties.sheetId',
    });

    const filterViews: Array<{
      filterViewId: number;
      title: string;
      range: {
        sheetId: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
    }> = [];

    for (const sheet of response.data.sheets ?? []) {
      if (input.sheetId !== undefined && sheet.properties?.sheetId !== input.sheetId) continue;
      for (const fv of sheet.filterViews ?? []) {
        filterViews.push({
          filterViewId: fv.filterViewId ?? 0,
          title: fv.title ?? '',
          range: this.toGridRangeOutput(fv.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
        });
      }
    }

    return this.success('filter_list_filter_views', { filterViews });
  }

  private async handleFilterGetFilterView(
    input: DimensionsFilterGetFilterViewInput
  ): Promise<DimensionsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.filterViews',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const fv of sheet.filterViews ?? []) {
        if (fv.filterViewId === input.filterViewId) {
          return this.success('filter_get_filter_view', {
            filterViews: [
              {
                filterViewId: fv.filterViewId ?? 0,
                title: fv.title ?? '',
                range: this.toGridRangeOutput(
                  fv.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }
                ),
              },
            ],
          });
        }
      }
    }

    return this.notFoundError('Filter view', input.filterViewId);
  }

  // ============================================================
  // Slicer Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleFilterCreateSlicer(
    input: DimensionsFilterCreateSlicerInput
  ): Promise<DimensionsResponse> {
    const dataRange = await this.toGridRange(input.spreadsheetId, input.dataRange);
    const anchor = parseCellReference(input.position.anchorCell);

    const batchResponse = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSlicer: {
              slicer: {
                spec: {
                  title: input.title,
                  dataRange: toGridRange(dataRange),
                  columnIndex: input.filterColumn,
                },
                position: {
                  overlayPosition: {
                    anchorCell: {
                      sheetId: dataRange.sheetId,
                      rowIndex: anchor.row,
                      columnIndex: anchor.col,
                    },
                    offsetXPixels: input.position.offsetX ?? 0,
                    offsetYPixels: input.position.offsetY ?? 0,
                    widthPixels: input.position.width ?? 200,
                    heightPixels: input.position.height ?? 150,
                  },
                },
              },
            },
          },
        ],
      },
    });

    const slicerId = batchResponse.data.replies?.[0]?.addSlicer?.slicer?.slicerId ?? undefined;
    return this.success('filter_create_slicer', { slicerId });
  }

  private async handleFilterUpdateSlicer(
    input: DimensionsFilterUpdateSlicerInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('filter_update_slicer', {}, undefined, true);
    }

    const spec: sheets_v4.Schema$SlicerSpec = {
      title: input.title,
      columnIndex: input.filterColumn,
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSlicerSpec: {
              slicerId: input.slicerId,
              spec,
              fields: 'title,filterCriteria',
            },
          },
        ],
      },
    });

    return this.success('filter_update_slicer', {});
  }

  private async handleFilterDeleteSlicer(
    input: DimensionsFilterDeleteSlicerInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('filter_delete_slicer', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteEmbeddedObject: { objectId: input.slicerId },
          },
        ],
      },
    });

    return this.success('filter_delete_slicer', {});
  }

  private async handleFilterListSlicers(
    input: DimensionsFilterListSlicersInput
  ): Promise<DimensionsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.slicers,sheets.properties.sheetId',
    });

    const slicers: Array<{
      slicerId: number;
      sheetId: number;
      title?: string;
    }> = [];
    for (const sheet of response.data.sheets ?? []) {
      if (input.sheetId !== undefined && sheet.properties?.sheetId !== input.sheetId) continue;
      for (const slicer of sheet.slicers ?? []) {
        slicers.push({
          slicerId: slicer.slicerId ?? 0,
          sheetId: sheet.properties?.sheetId ?? 0,
          title: slicer.spec?.title ?? undefined,
        });
      }
    }

    return this.success('filter_list_slicers', { slicers });
  }

  // ============================================================
  // Helper Methods (merged from filter-sort.ts)
  // ============================================================

  /**
   * Convert Google API GridRange to application format
   */
  private toGridRangeOutput(range: sheets_v4.Schema$GridRange): {
    sheetId: number;
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
  } {
    return {
      sheetId: range.sheetId ?? 0,
      startRowIndex: range.startRowIndex ?? undefined,
      endRowIndex: range.endRowIndex ?? undefined,
      startColumnIndex: range.startColumnIndex ?? undefined,
      endColumnIndex: range.endColumnIndex ?? undefined,
    };
  }

  private async toGridRange(spreadsheetId: string, range: RangeInput): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private mapCriteria(
    input: Record<
      number,
      {
        hiddenValues?: string[];
        condition?: { type: string; values?: string[] };
        visibleBackgroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        visibleForegroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
      }
    >
  ): Record<string, ApiFilterCriteria> {
    return Object.entries(input).reduce(
      (acc, [col, crit]) => {
        acc[col] = this.mapSingleCriteria(crit);
        return acc;
      },
      {} as Record<string, ApiFilterCriteria>
    );
  }

  private mapSingleCriteria(crit: {
    hiddenValues?: string[];
    condition?: { type: string; values?: string[] };
    visibleBackgroundColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    visibleForegroundColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
  }): ApiFilterCriteria {
    return {
      hiddenValues: crit.hiddenValues,
      visibleBackgroundColor: crit.visibleBackgroundColor,
      visibleForegroundColor: crit.visibleForegroundColor,
      condition: crit.condition
        ? {
            type: crit.condition.type as sheets_v4.Schema$BooleanCondition['type'],
            values: crit.condition.values?.map((v) => ({
              userEnteredValue: v,
            })),
          }
        : undefined,
    };
  }
}
