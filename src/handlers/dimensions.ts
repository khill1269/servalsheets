/**
 * ServalSheets - Dimensions Handler
 *
 * Handles sheets_dimensions tool (row/column operations, filtering, and sorting)
 * MCP Protocol: 2025-11-25
 *
 * 30 Actions (delegated to submodules):
 * Consolidated dimension operations (11):
 * - insert, delete, move, resize, auto_resize, hide, show, freeze, group, ungroup, append
 *   (all accept dimension: 'ROWS' | 'COLUMNS' parameter)
 * Filter/Sort (5): set_basic_filter, clear_basic_filter, get_basic_filter, sort_range, delete_duplicates
 * Range utility (4): trim_whitespace, randomize_range, text_to_columns, auto_fill
 * Filter views (6): create_filter_view, duplicate_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view
 * Slicers (4): create_slicer, update_slicer, delete_slicer, list_slicers
 */

import { ErrorCodes } from './error-codes.js';
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
  // Filter/Sort types (5)
  DimensionsSetBasicFilterInput,
  DimensionsClearBasicFilterInput,
  DimensionsGetBasicFilterInput,
  DimensionsSortRangeInput,
  DimensionsDeleteDuplicatesInput,
  // Range utility types (4)
  DimensionsTrimWhitespaceInput,
  DimensionsRandomizeRangeInput,
  DimensionsTextToColumnsInput,
  DimensionsAutoFillInput,
  // Filter view types (6)
  DimensionsCreateFilterViewInput,
  DimensionsDuplicateFilterViewInput,
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
import {
  handleInsert,
  handleDelete,
  handleMove,
  handleGroup,
  handleUngroup,
  handleAppend,
} from './dimensions-actions/structure-operations.js';
import { handleFreeze } from './dimensions-actions/freeze-operations.js';
import { handleResize, handleAutoResize } from './dimensions-actions/resize-operations.js';
import { handleHide, handleShow } from './dimensions-actions/visibility-operations.js';
import {
  handleSetBasicFilter,
  handleClearBasicFilter,
  handleGetBasicFilter,
  handleSortRange,
  handleTrimWhitespace,
  handleRandomizeRange,
  handleTextToColumns,
  handleAutoFill,
  handleDeleteDuplicates,
} from './dimensions-actions/filter-sort-operations.js';
import {
  handleCreateFilterView,
  handleDuplicateFilterView,
  handleUpdateFilterView,
  handleDeleteFilterView,
  handleListFilterViews,
  handleGetFilterView,
} from './dimensions-actions/filter-view-operations.js';
import {
  handleCreateSlicer,
  handleUpdateSlicer,
  handleDeleteSlicer,
  handleListSlicers,
} from './dimensions-actions/slicer-operations.js';

export class DimensionsHandler extends BaseHandler<SheetsDimensionsInput, SheetsDimensionsOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private static readonly ACTIONS_REQUIRING_SHEET_ID = new Set<string>([
    'insert',
    'delete',
    'move',
    'resize',
    'auto_resize',
    'hide',
    'show',
    'freeze',
    'group',
    'ungroup',
    'append',
    'clear_basic_filter',
    'get_basic_filter',
  ]);
  private static readonly ACTIONS_REQUIRING_EXPLICIT_TARGET = new Set<string>([
    'set_basic_filter',
    'clear_basic_filter',
    'get_basic_filter',
    'sort_range',
  ]);

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
    const action = inferredReq['action'] as string;

    // Filter/sort operations must not borrow stale range or sheet targets from context.
    if (DimensionsHandler.ACTIONS_REQUIRING_EXPLICIT_TARGET.has(action)) {
      const requestHasExplicitRange = request['range'] !== undefined;
      const requestHasExplicitSheetTarget =
        request['sheetId'] !== undefined || request['sheetName'] !== undefined;

      if (!requestHasExplicitRange && 'range' in inferredReq) {
        const { range: _range, ...rest } = inferredReq;
        if (!requestHasExplicitSheetTarget && 'sheetId' in rest && action !== 'sort_range') {
          const { sheetId: _sheetId, ...withoutSheetId } = rest;
          return withoutSheetId as T;
        }
        return rest as T;
      }

      if (!requestHasExplicitSheetTarget && 'sheetId' in inferredReq && action !== 'sort_range') {
        const { sheetId: _sheetId, ...rest } = inferredReq;
        return rest as T;
      }
    }

    // BUG FIX 0.6: Convert count parameter to endIndex for range-based actions
    const rangeActions = new Set(['delete', 'move', 'resize', 'hide', 'show', 'group', 'ungroup']);
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
      const sheetResolutionError = await this.resolveSheetIdIfNeeded(req);
      if (sheetResolutionError) {
        return { response: sheetResolutionError };
      }

      const ha = this.buildHandlerAccess();
      let response: DimensionsResponse;
      switch (req.action) {
        // Consolidated dimension actions (11)
        case 'insert':
          response = await handleInsert(ha, req as DimensionsInsertInput);
          break;
        case 'delete':
          response = await handleDelete(ha, req as DimensionsDeleteInput);
          break;
        case 'move':
          response = await handleMove(ha, req as DimensionsMoveInput);
          break;
        case 'resize':
          response = await handleResize(ha, req as DimensionsResizeInput);
          break;
        case 'auto_resize':
          response = await handleAutoResize(ha, req as DimensionsAutoResizeInput);
          break;
        case 'hide':
          response = await handleHide(ha, req as DimensionsHideInput);
          break;
        case 'show':
          response = await handleShow(ha, req as DimensionsShowInput);
          break;
        case 'freeze':
          response = await handleFreeze(ha, req as DimensionsFreezeInput);
          break;
        case 'group':
          response = await handleGroup(ha, req as DimensionsGroupInput);
          break;
        case 'ungroup':
          response = await handleUngroup(ha, req as DimensionsUngroupInput);
          break;
        case 'append':
          response = await handleAppend(ha, req as DimensionsAppendInput);
          break;
        // Filter/Sort actions (5)
        case 'set_basic_filter':
          response = await handleSetBasicFilter(ha, req as DimensionsSetBasicFilterInput);
          break;
        case 'clear_basic_filter':
          response = await handleClearBasicFilter(ha, req as DimensionsClearBasicFilterInput);
          break;
        case 'get_basic_filter':
          response = await handleGetBasicFilter(ha, req as DimensionsGetBasicFilterInput);
          break;
        case 'sort_range':
          response = await handleSortRange(ha, req as DimensionsSortRangeInput);
          break;
        // Range utility operations (5)
        case 'delete_duplicates':
          response = await handleDeleteDuplicates(ha, req as DimensionsDeleteDuplicatesInput);
          break;
        case 'trim_whitespace':
          response = await handleTrimWhitespace(ha, req as DimensionsTrimWhitespaceInput);
          break;
        case 'randomize_range':
          response = await handleRandomizeRange(ha, req as DimensionsRandomizeRangeInput);
          break;
        case 'text_to_columns':
          response = await handleTextToColumns(ha, req as DimensionsTextToColumnsInput);
          break;
        case 'auto_fill':
          response = await handleAutoFill(ha, req as DimensionsAutoFillInput);
          break;
        // Filter view actions (6)
        case 'create_filter_view':
          response = await handleCreateFilterView(ha, req as DimensionsCreateFilterViewInput);
          break;
        case 'duplicate_filter_view':
          response = await handleDuplicateFilterView(ha, req as DimensionsDuplicateFilterViewInput);
          break;
        case 'update_filter_view':
          response = await handleUpdateFilterView(ha, req as DimensionsUpdateFilterViewInput);
          break;
        case 'delete_filter_view':
          response = await handleDeleteFilterView(ha, req as DimensionsDeleteFilterViewInput);
          break;
        case 'list_filter_views':
          response = await handleListFilterViews(ha, req as DimensionsListFilterViewsInput);
          break;
        case 'get_filter_view':
          response = await handleGetFilterView(ha, req as DimensionsGetFilterViewInput);
          break;
        // Slicer actions (4)
        case 'create_slicer':
          response = await handleCreateSlicer(ha, req as DimensionsCreateSlicerInput);
          break;
        case 'update_slicer':
          response = await handleUpdateSlicer(ha, req as DimensionsUpdateSlicerInput);
          break;
        case 'delete_slicer':
          response = await handleDeleteSlicer(ha, req as DimensionsDeleteSlicerInput);
          break;
        case 'list_slicers':
          response = await handleListSlicers(ha, req as DimensionsListSlicersInput);
          break;
        default: {
          const _exhaustiveCheck: never = req;
          response = this.error({
            code: ErrorCodes.INVALID_PARAMS,
            message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
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

  private async resolveSheetIdIfNeeded(req: DimensionsRequest): Promise<DimensionsResponse | null> {
    const request = req as Record<string, unknown>;
    const hasSheetId = typeof request['sheetId'] === 'number';
    const actionNeedsSheetId =
      DimensionsHandler.ACTIONS_REQUIRING_SHEET_ID.has(req.action) ||
      (req.action === 'set_basic_filter' && request['range'] === undefined) ||
      (req.action === 'create_filter_view' && request['range'] === undefined);

    if (!actionNeedsSheetId || hasSheetId) {
      return null;
    }

    const sheetName = request['sheetName'];
    if (typeof sheetName !== 'string' || sheetName.trim().length === 0) {
      if (req.action === 'set_basic_filter' && request['range'] === undefined) {
        return this.error({
          code: ErrorCodes.INVALID_PARAMS,
          message:
            'set_basic_filter requires an explicit range or sheetId/sheetName. Context-inferred targets are not used for filter operations.',
          retryable: false,
          suggestedFix:
            'Provide range like "Sheet1!A1:D100" or a valid sheetId/sheetName from sheets_core.list_sheets.',
        });
      }

      return this.error({
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Either sheetId (number) or sheetName (string) is required',
        retryable: false,
        suggestedFix: 'Provide sheetId from sheets_core.list_sheets or a valid sheetName',
      });
    }

    const resolvedSheetId = await this.getSheetId(req.spreadsheetId, sheetName, this.sheetsApi);
    request['sheetId'] = resolvedSheetId;
    return null;
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
        target: {
          spreadsheetId: req.spreadsheetId!,
          sheetId: (req as { sheetId?: number }).sheetId!,
        },
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

  /** Build a DimensionsHandlerAccess adapter for sub-module functions */
  private buildHandlerAccess(): import('./dimensions-actions/internal.js').DimensionsHandlerAccess {
    return {
      success: this.success.bind(
        this
      ) as import('./dimensions-actions/internal.js').DimensionsHandlerAccess['success'],
      error: this.error.bind(this),
      notFoundError: (t: string, id: string | number) => this.notFoundError(t, String(id)),
      generateMeta: this.generateMeta.bind(this),
      getSafetyWarnings: this.getSafetyWarnings.bind(this),
      formatWarnings: this.formatWarnings.bind(this),
      createSafetySnapshot: this.createSafetySnapshot.bind(this),
      snapshotInfo: this.snapshotInfo.bind(
        this
      ) as import('./dimensions-actions/internal.js').DimensionsHandlerAccess['snapshotInfo'],
      rangeToGridRange: this.rangeToGridRange.bind(this),
      gridRangeToOutput: this.gridRangeToOutput.bind(this),
      getSheetId: this.getSheetId.bind(this),
      sendProgress: this.sendProgress.bind(this),
      context: this.context,
      sheetsApi: this.sheetsApi,
    };
  }
}
