/**
 * ServalSheets - Dimensions Handler
 *
 * Handles sheets_dimensions tool (row/column operations, filtering, and sorting)
 * MCP Protocol: 2025-11-25
 *
 * 28 Actions (LLM Optimized - reduced from 39):
 * Consolidated dimension operations (11):
 * - insert, delete, move, resize, auto_resize, hide, show, freeze, group, ungroup, append
 *   (all accept dimension: 'ROWS' | 'COLUMNS' parameter)
 * Filter/Sort (4): set_basic_filter, clear_basic_filter, get_basic_filter, sort_range
 * Range utility (4): trim_whitespace, randomize_range, text_to_columns, auto_fill
 * Filter views (5): create_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view
 * Slicers (4): create_slicer, update_slicer, delete_slicer, list_slicers
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsDimensionsInput,
  SheetsDimensionsOutput,
  DimensionsResponse,
  DimensionsRequest,
  // Consolidated dimension types (11)
  DimensionsInsertInput,
  DimensionsDeleteInput,
  DimensionsMoveInput,
  DimensionsResizeInput,
  DimensionsAutoResizeInput,
  DimensionsHideInput,
  DimensionsShowInput,
  DimensionsFreezeInput,
  DimensionsGroupInput,
  DimensionsUngroupInput,
  DimensionsAppendInput,
  // Filter/Sort types (4)
  DimensionsSetBasicFilterInput,
  DimensionsClearBasicFilterInput,
  DimensionsGetBasicFilterInput,
  DimensionsSortRangeInput,
  // Range utility types (4)
  DimensionsTrimWhitespaceInput,
  DimensionsRandomizeRangeInput,
  DimensionsTextToColumnsInput,
  DimensionsAutoFillInput,
  // Filter view types (5)
  DimensionsCreateFilterViewInput,
  DimensionsUpdateFilterViewInput,
  DimensionsDeleteFilterViewInput,
  DimensionsListFilterViewsInput,
  DimensionsGetFilterViewInput,
  // Slicer types (4)
  DimensionsCreateSlicerInput,
  DimensionsUpdateSlicerInput,
  DimensionsDeleteSlicerInput,
  DimensionsListSlicersInput,
} from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import {
  buildGridRangeInput,
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
   * Override to add count-to-endIndex conversion (BUG FIX 0.6)
   */
  protected inferRequestParameters<T extends Record<string, unknown>>(request: T): T {
    // First, do standard parameter inference from context
    const inferredReq = super.inferRequestParameters(request);

    // BUG FIX 0.6: Convert count parameter to endIndex for range-based actions
    const rangeActions = new Set(['delete', 'move', 'resize', 'hide', 'show', 'group', 'ungroup']);

    const action = inferredReq['action'] as string;
    if (rangeActions.has(action)) {
      const count = inferredReq['count'];
      const startIndex = inferredReq['startIndex'];
      const endIndex = inferredReq['endIndex'];

      // If count is provided but endIndex is not, convert count to endIndex
      if (count !== undefined && endIndex === undefined && startIndex !== undefined) {
        const countNum = typeof count === 'number' ? count : Number(count);
        const startNum = typeof startIndex === 'number' ? startIndex : Number(startIndex);

        if (!isNaN(countNum) && !isNaN(startNum)) {
          // Create new object with endIndex and without count
          const { count: _c, ...rest } = inferredReq;
          return {
            ...rest,
            endIndex: startNum + countNum,
          } as unknown as T;
        }
      }

      // Remove count field if it exists (even if conversion didn't happen)
      if ('count' in inferredReq) {
        const { count: _c, ...rest } = inferredReq;
        return rest as unknown as T;
      }
    }

    return inferredReq;
  }

  async handle(input: SheetsDimensionsInput): Promise<SheetsDimensionsOutput> {
    // Extract the request from the wrapper
    const rawReq = unwrapRequest<SheetsDimensionsInput['request']>(input);
    // Phase 1, Task 1.4: Infer missing parameters from context (includes count-to-endIndex conversion)
    const req = this.inferRequestParameters(rawReq) as DimensionsRequest;

    try {
      let response: DimensionsResponse;
      switch (req.action) {
        // Consolidated dimension actions (11)
        case 'insert':
          response = await this.handleInsert(req as DimensionsInsertInput);
          break;
        case 'delete':
          response = await this.handleDelete(req as DimensionsDeleteInput);
          break;
        case 'move':
          response = await this.handleMove(req as DimensionsMoveInput);
          break;
        case 'resize':
          response = await this.handleResize(req as DimensionsResizeInput);
          break;
        case 'auto_resize':
          response = await this.handleAutoResize(req as DimensionsAutoResizeInput);
          break;
        case 'hide':
          response = await this.handleHide(req as DimensionsHideInput);
          break;
        case 'show':
          response = await this.handleShow(req as DimensionsShowInput);
          break;
        case 'freeze':
          response = await this.handleFreeze(req as DimensionsFreezeInput);
          break;
        case 'group':
          response = await this.handleGroup(req as DimensionsGroupInput);
          break;
        case 'ungroup':
          response = await this.handleUngroup(req as DimensionsUngroupInput);
          break;
        case 'append':
          response = await this.handleAppend(req as DimensionsAppendInput);
          break;
        // Filter/Sort actions (5)
        case 'set_basic_filter':
          response = await this.handleSetBasicFilter(req as DimensionsSetBasicFilterInput);
          break;
        case 'clear_basic_filter':
          response = await this.handleClearBasicFilter(req as DimensionsClearBasicFilterInput);
          break;
        case 'get_basic_filter':
          response = await this.handleGetBasicFilter(req as DimensionsGetBasicFilterInput);
          break;
        case 'sort_range':
          response = await this.handleSortRange(req as DimensionsSortRangeInput);
          break;
        // Range utility operations (4 new)
        case 'trim_whitespace':
          response = await this.handleTrimWhitespace(req as DimensionsTrimWhitespaceInput);
          break;
        case 'randomize_range':
          response = await this.handleRandomizeRange(req as DimensionsRandomizeRangeInput);
          break;
        case 'text_to_columns':
          response = await this.handleTextToColumns(req as DimensionsTextToColumnsInput);
          break;
        case 'auto_fill':
          response = await this.handleAutoFill(req as DimensionsAutoFillInput);
          break;
        case 'create_filter_view':
          response = await this.handleCreateFilterView(req as DimensionsCreateFilterViewInput);
          break;
        case 'update_filter_view':
          response = await this.handleUpdateFilterView(req as DimensionsUpdateFilterViewInput);
          break;
        case 'delete_filter_view':
          response = await this.handleDeleteFilterView(req as DimensionsDeleteFilterViewInput);
          break;
        case 'list_filter_views':
          response = await this.handleListFilterViews(req as DimensionsListFilterViewsInput);
          break;
        case 'get_filter_view':
          response = await this.handleGetFilterView(req as DimensionsGetFilterViewInput);
          break;
        case 'create_slicer':
          response = await this.handleCreateSlicer(req as DimensionsCreateSlicerInput);
          break;
        case 'update_slicer':
          response = await this.handleUpdateSlicer(req as DimensionsUpdateSlicerInput);
          break;
        case 'delete_slicer':
          response = await this.handleDeleteSlicer(req as DimensionsDeleteSlicerInput);
          break;
        case 'list_slicers':
          response = await this.handleListSlicers(req as DimensionsListSlicersInput);
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
          spreadsheetId: req.spreadsheetId,
          sheetId:
            'sheetId' in req
              ? typeof req.sheetId === 'number'
                ? req.sheetId
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization) - uses base handler implementation
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(
        response,
        verbosity
      ) as DimensionsResponse;

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsDimensionsInput): Intent[] {
    // Extract the request from the wrapper
    const req = unwrapRequest<SheetsDimensionsInput['request']>(input);

    // Filter operations execute directly; no batch compiler intents needed
    if (req.action.startsWith('filter_')) {
      return [];
    }

    const destructiveActions = ['delete', 'move'];
    return [
      {
        type:
          req.action === 'delete'
            ? 'DELETE_DIMENSION'
            : req.action === 'insert' || req.action === 'append'
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
  // Consolidated Dimension Operations (11 actions)
  // LLM Optimized: Single method per operation type with dimension parameter
  // ============================================================

  private async handleInsert(input: DimensionsInsertInput): Promise<DimensionsResponse> {
    const count = input.count ?? 1;

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success(
      'insert',
      input.dimension === 'ROWS' ? { rowsAffected: count } : { columnsAffected: count }
    );
  }

  private async handleDelete(input: DimensionsDeleteInput): Promise<DimensionsResponse> {
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
    const warnings = this.getSafetyWarnings(safetyContext, input.safety);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && count > threshold) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          `Delete ${isRows ? 'Rows' : 'Columns'}`,
          `You are about to delete ${count} ${label} (${label} ${input.startIndex + 1}-${input.endIndex}).\n\nAll data, formatting, and formulas will be permanently removed.`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'PRECONDITION_FAILED',
            message: `${isRows ? 'Row' : 'Column'} deletion cancelled by user`,
            retryable: false,
          });
        }
      } catch (err) {
        this.context.logger?.warn(`Elicitation failed for delete, proceeding with operation`, {
          error: err,
        });
      }
    }

    if (input.safety?.dryRun) {
      const meta = this.generateMeta('delete', input, undefined, { cellsAffected: count });
      if (warnings.length > 0) {
        meta.warnings = this.formatWarnings(warnings);
      }
      return this.success(
        'delete',
        isRows ? { rowsAffected: count } : { columnsAffected: count },
        undefined,
        true,
        meta
      );
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
                dimension: input.dimension,
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
      'delete',
      input,
      isRows ? { rowsAffected: count } : { columnsAffected: count },
      { cellsAffected: count }
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

    return this.success(
      'delete',
      isRows ? { rowsAffected: count } : { columnsAffected: count },
      undefined,
      false,
      meta
    );
  }

  private async handleMove(input: DimensionsMoveInput): Promise<DimensionsResponse> {
    const count = input.endIndex - input.startIndex;
    const isRows = input.dimension === 'ROWS';

    if (input.safety?.dryRun) {
      return this.success(
        'move',
        isRows ? { rowsAffected: count } : { columnsAffected: count },
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

    return this.success('move', isRows ? { rowsAffected: count } : { columnsAffected: count });
  }

  private async handleResize(input: DimensionsResizeInput): Promise<DimensionsResponse> {
    const count = input.endIndex - input.startIndex;
    const isRows = input.dimension === 'ROWS';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success('resize', isRows ? { rowsAffected: count } : { columnsAffected: count });
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

  private async handleHide(input: DimensionsHideInput): Promise<DimensionsResponse> {
    const count = input.endIndex - input.startIndex;
    const isRows = input.dimension === 'ROWS';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success('hide', isRows ? { rowsAffected: count } : { columnsAffected: count });
  }

  private async handleShow(input: DimensionsShowInput): Promise<DimensionsResponse> {
    const count = input.endIndex - input.startIndex;
    const isRows = input.dimension === 'ROWS';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success('show', isRows ? { rowsAffected: count } : { columnsAffected: count });
  }

  private async handleFreeze(input: DimensionsFreezeInput): Promise<DimensionsResponse> {
    const isRows = input.dimension === 'ROWS';
    const propertyPath = isRows ? 'frozenRowCount' : 'frozenColumnCount';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success(
      'freeze',
      isRows ? { rowsAffected: input.count } : { columnsAffected: input.count }
    );
  }

  private async handleGroup(input: DimensionsGroupInput): Promise<DimensionsResponse> {
    const count = input.endIndex - input.startIndex;
    const isRows = input.dimension === 'ROWS';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success('group', isRows ? { rowsAffected: count } : { columnsAffected: count });
  }

  private async handleUngroup(input: DimensionsUngroupInput): Promise<DimensionsResponse> {
    const count = input.endIndex - input.startIndex;
    const isRows = input.dimension === 'ROWS';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success('ungroup', isRows ? { rowsAffected: count } : { columnsAffected: count });
  }

  private async handleAppend(input: DimensionsAppendInput): Promise<DimensionsResponse> {
    const isRows = input.dimension === 'ROWS';

    await this.sheetsApi.spreadsheets.batchUpdate({
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

    return this.success(
      'append',
      isRows ? { rowsAffected: input.count } : { columnsAffected: input.count }
    );
  }

  // ============================================================
  // Filter Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleSetBasicFilter(
    input: DimensionsSetBasicFilterInput
  ): Promise<DimensionsResponse> {
    // v2.0: Enhanced to support incremental updates via optional columnIndex parameter
    // If columnIndex provided: update only that column's criteria (incremental)
    // If columnIndex omitted: replace entire filter (original behavior)

    if (input.columnIndex !== undefined) {
      // Incremental update: merge criteria for specific column
      const currentFilterResponse = await this.handleGetBasicFilter({
        action: 'get_basic_filter',
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        verbosity: 'minimal',
      });

      if (!currentFilterResponse.success || !currentFilterResponse.filter) {
        throw new Error(
          'Cannot update filter criteria: No basic filter exists on this sheet. Use set_basic_filter without columnIndex to create a filter first.'
        );
      }

      // Merge new criteria for the specific column
      const updatedCriteria = {
        ...currentFilterResponse.filter.criteria,
        [input.columnIndex]: input.criteria?.[input.columnIndex] || input.criteria,
      };

      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              setBasicFilter: {
                filter: {
                  range: currentFilterResponse.filter.range,
                  criteria: this.mapCriteria(updatedCriteria),
                },
              },
            },
          ],
        },
      });

      return this.success('set_basic_filter', {
        message: `Updated filter criteria for column ${input.columnIndex}`,
        columnIndex: input.columnIndex,
      });
    }

    // Full filter replacement (original behavior)
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

    return this.success('set_basic_filter', {});
  }

  private async handleClearBasicFilter(
    input: DimensionsClearBasicFilterInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('clear_basic_filter', {}, undefined, true);
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

    return this.success('clear_basic_filter', {});
  }

  private async handleGetBasicFilter(
    input: DimensionsGetBasicFilterInput
  ): Promise<DimensionsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties.sheetId,sheets.basicFilter',
    });

    for (const sheet of response.data.sheets ?? []) {
      if (sheet.properties?.sheetId === input.sheetId && sheet.basicFilter) {
        return this.success('get_basic_filter', {
          filter: {
            range: this.toGridRangeOutput(sheet.basicFilter.range ?? { sheetId: input.sheetId }),
            criteria: sheet.basicFilter.criteria ?? {},
          },
        });
      }
    }

    return this.success('get_basic_filter', {});
  }

  // ============================================================
  // Sort Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleSortRange(input: DimensionsSortRangeInput): Promise<DimensionsResponse> {
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

    return this.success('sort_range', {});
  }

  // ============================================================
  // Range Utility Operations (4 new - Google API coverage completion)
  // ============================================================

  private async handleTrimWhitespace(
    input: DimensionsTrimWhitespaceInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('trim_whitespace', { cellsChanged: 0 }, undefined, true);
    }

    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            trimWhitespace: {
              range: toGridRange(gridRange),
            },
          },
        ],
      },
    });

    const cellsChanged = response.data.replies?.[0]?.trimWhitespace?.cellsChangedCount ?? 0;
    return this.success('trim_whitespace', { cellsChanged });
  }

  private async handleRandomizeRange(
    input: DimensionsRandomizeRangeInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('randomize_range', {}, undefined, true);
    }

    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            randomizeRange: {
              range: toGridRange(gridRange),
            },
          },
        ],
      },
    });

    return this.success('randomize_range', {});
  }

  private async handleTextToColumns(
    input: DimensionsTextToColumnsInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('text_to_columns', {}, undefined, true);
    }

    const gridRange = await this.toGridRange(input.spreadsheetId, input.source);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            textToColumns: {
              source: toGridRange(gridRange),
              delimiterType: input.delimiterType ?? 'AUTODETECT',
              delimiter: input.delimiterType === 'CUSTOM' ? input.delimiter : undefined,
            },
          },
        ],
      },
    });

    return this.success('text_to_columns', {});
  }

  private async handleAutoFill(input: DimensionsAutoFillInput): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('auto_fill', {}, undefined, true);
    }

    // Build the request based on which parameters are provided
    const autoFillRequest: sheets_v4.Schema$AutoFillRequest = {
      useAlternateSeries: input.useAlternateSeries,
    };

    if (input.sourceRange && input.fillLength !== undefined) {
      // SourceAndDestination mode: explicit source and fill direction
      const sourceGridRange = await this.toGridRange(input.spreadsheetId, input.sourceRange);
      autoFillRequest.sourceAndDestination = {
        source: toGridRange(sourceGridRange),
        dimension: input.dimension ?? 'ROWS',
        fillLength: input.fillLength,
      };
    } else if (input.range) {
      // Range mode: auto-detect source data within range
      const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
      autoFillRequest.range = toGridRange(gridRange);
    } else {
      return this.error({
        code: 'INVALID_PARAMS',
        message:
          'auto_fill requires one of two modes: ' +
          '(1) "range" only - fills within range using first row/column as pattern. Example: { "range": "A1:A10" } ' +
          '(2) "sourceRange" + "fillLength" - extends pattern beyond source. Example: { "sourceRange": "A1:A3", "fillLength": 7 }',
        retryable: false,
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ autoFill: autoFillRequest }],
      },
    });

    return this.success('auto_fill', {});
  }

  // ============================================================
  // Filter View Operations (merged from filter-sort.ts)
  // ============================================================

  private async handleCreateFilterView(
    input: DimensionsCreateFilterViewInput
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
    return this.success('create_filter_view', {
      filterViewId: filterViewId ?? undefined,
    });
  }

  private async handleUpdateFilterView(
    input: DimensionsUpdateFilterViewInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_filter_view', {}, undefined, true);
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

    return this.success('update_filter_view', {});
  }

  private async handleDeleteFilterView(
    input: DimensionsDeleteFilterViewInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_filter_view', {}, undefined, true);
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

    return this.success('delete_filter_view', {});
  }

  private async handleListFilterViews(
    input: DimensionsListFilterViewsInput
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

    return this.success('list_filter_views', { filterViews });
  }

  private async handleGetFilterView(
    input: DimensionsGetFilterViewInput
  ): Promise<DimensionsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.filterViews',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const fv of sheet.filterViews ?? []) {
        if (fv.filterViewId === input.filterViewId) {
          return this.success('get_filter_view', {
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

  private async handleCreateSlicer(
    input: DimensionsCreateSlicerInput
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
    return this.success('create_slicer', { slicerId });
  }

  private async handleUpdateSlicer(
    input: DimensionsUpdateSlicerInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_slicer', {}, undefined, true);
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

    return this.success('update_slicer', {});
  }

  private async handleDeleteSlicer(
    input: DimensionsDeleteSlicerInput
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_slicer', {}, undefined, true);
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

    return this.success('delete_slicer', {});
  }

  private async handleListSlicers(input: DimensionsListSlicersInput): Promise<DimensionsResponse> {
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

    return this.success('list_slicers', { slicers });
  }

  // ============================================================
  // Helper Methods (merged from filter-sort.ts)
  // ============================================================

  /**
   * Convert Google API GridRange to application format
   */
  private toGridRangeOutput(range: sheets_v4.Schema$GridRange): GridRangeInput {
    return buildGridRangeInput(
      range.sheetId ?? 0,
      range.startRowIndex ?? undefined,
      range.endRowIndex ?? undefined,
      range.startColumnIndex ?? undefined,
      range.endColumnIndex ?? undefined
    );
  }

  private async toGridRange(spreadsheetId: string, range: RangeInput): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return buildGridRangeInput(
      sheetId,
      parsed.startRow,
      parsed.endRow,
      parsed.startCol,
      parsed.endCol
    );
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
