/**
 * ServalSheets - Filter & Sort Handler
 *
 * Handles sheets_filter_sort tool
 * MCP Protocol: 2025-11-25
 *
 * Actions (per schema):
 * - set_basic_filter, clear_basic_filter, get_basic_filter, update_filter_criteria
 * - sort_range
 * - create_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view
 * - create_slicer, update_slicer, delete_slicer, list_slicers
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsFilterSortInput,
  SheetsFilterSortOutput,
  FilterSortAction,
  FilterSortResponse,
} from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import { parseA1Notation, parseCellReference, toGridRange, type GridRangeInput } from '../utils/google-sheets-helpers.js';
import { RangeResolutionError } from '../core/range-resolver.js';

type ApiFilterCriteria = sheets_v4.Schema$FilterCriteria;

export class FilterSortHandler extends BaseHandler<SheetsFilterSortInput, SheetsFilterSortOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_filter_sort', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsFilterSortInput): Promise<SheetsFilterSortOutput> {
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(input.request) as FilterSortAction;

    try {
      const req = inferredRequest;
      let response: FilterSortResponse;
      switch (req.action) {
        case 'set_basic_filter':
          response = await this.handleSetBasicFilter(req);
          break;
        case 'clear_basic_filter':
          response = await this.handleClearBasicFilter(req);
          break;
        case 'get_basic_filter':
          response = await this.handleGetBasicFilter(req);
          break;
        case 'update_filter_criteria':
          response = await this.handleUpdateFilterCriteria(req);
          break;
        case 'sort_range':
          response = await this.handleSortRange(req);
          break;
        case 'create_filter_view':
          response = await this.handleCreateFilterView(req);
          break;
        case 'update_filter_view':
          response = await this.handleUpdateFilterView(req);
          break;
        case 'delete_filter_view':
          response = await this.handleDeleteFilterView(req);
          break;
        case 'list_filter_views':
          response = await this.handleListFilterViews(req);
          break;
        case 'get_filter_view':
          response = await this.handleGetFilterView(req);
          break;
        case 'create_slicer':
          response = await this.handleCreateSlicer(req);
          break;
        case 'update_slicer':
          response = await this.handleUpdateSlicer(req);
          break;
        case 'delete_slicer':
          response = await this.handleDeleteSlicer(req);
          break;
        case 'list_slicers':
          response = await this.handleListSlicers(req);
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
          sheetId: 'sheetId' in inferredRequest ? (typeof inferredRequest.sheetId === 'number' ? inferredRequest.sheetId : undefined) : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsFilterSortInput): Intent[] {
    // These operations execute directly; no batch compiler intents needed.
    return [];
  }

  // ============================================================
  // Basic filter
  // ============================================================

  private async handleSetBasicFilter(
    input: Extract<FilterSortAction, { action: 'set_basic_filter' }>
  ): Promise<FilterSortResponse> {
    const gridRange = input.range
      ? await this.toGridRange(input.spreadsheetId, input.range)
      : { sheetId: input.sheetId };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          setBasicFilter: {
            filter: {
              range: toGridRange(gridRange),
              criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
            },
          },
        }],
      },
    });

    return this.success('set_basic_filter', {});
  }

  private async handleClearBasicFilter(
    input: Extract<FilterSortAction, { action: 'clear_basic_filter' }>
  ): Promise<FilterSortResponse> {
    if (input.safety?.dryRun) {
      return this.success('clear_basic_filter', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          clearBasicFilter: { sheetId: input.sheetId },
        }],
      },
    });

    return this.success('clear_basic_filter', {});
  }

  private async handleGetBasicFilter(
    input: Extract<FilterSortAction, { action: 'get_basic_filter' }>
  ): Promise<FilterSortResponse> {
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

  private async handleUpdateFilterCriteria(
    input: Extract<FilterSortAction, { action: 'update_filter_criteria' }>
  ): Promise<FilterSortResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_filter_criteria', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          setBasicFilter: {
            filter: {
              range: { sheetId: input.sheetId },
              criteria: {
                [String(input.columnIndex)]: this.mapSingleCriteria(input.criteria),
              },
            },
          },
        }],
      },
    });

    return this.success('update_filter_criteria', {});
  }

  // ============================================================
  // Sort
  // ============================================================

  private async handleSortRange(
    input: Extract<FilterSortAction, { action: 'sort_range' }>
  ): Promise<FilterSortResponse> {
    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          sortRange: {
            range: toGridRange(gridRange),
            sortSpecs: input.sortSpecs.map(spec => ({
              dimensionIndex: spec.columnIndex,
              sortOrder: spec.sortOrder ?? 'ASCENDING',
              foregroundColor: spec.foregroundColor,
              backgroundColor: spec.backgroundColor,
            })),
          },
        }],
      },
    });

    return this.success('sort_range', {});
  }

  // ============================================================
  // Filter views
  // ============================================================

  private async handleCreateFilterView(
    input: Extract<FilterSortAction, { action: 'create_filter_view' }>
  ): Promise<FilterSortResponse> {
    const gridRange = input.range
      ? await this.toGridRange(input.spreadsheetId, input.range)
      : { sheetId: input.sheetId };

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addFilterView: {
            filter: {
              title: input.title,
              range: toGridRange(gridRange),
              criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
              sortSpecs: input.sortSpecs?.map(spec => ({
                dimensionIndex: spec.columnIndex,
                sortOrder: spec.sortOrder ?? 'ASCENDING',
              })),
            },
          },
        }],
      },
    });

    const filterViewId = response.data.replies?.[0]?.addFilterView?.filter?.filterViewId;
    return this.success('create_filter_view', { filterViewId: filterViewId ?? undefined });
  }

  private async handleUpdateFilterView(
    input: Extract<FilterSortAction, { action: 'update_filter_view' }>
  ): Promise<FilterSortResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_filter_view', {}, undefined, true);
    }

    const filter: sheets_v4.Schema$FilterView = {
      filterViewId: input.filterViewId,
      title: input.title,
      criteria: input.criteria ? this.mapCriteria(input.criteria) : undefined,
      sortSpecs: input.sortSpecs?.map(spec => ({
        dimensionIndex: spec.columnIndex,
        sortOrder: spec.sortOrder ?? 'ASCENDING',
      })),
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateFilterView: {
            filter,
            fields: 'title,criteria,sortSpecs',
          },
        }],
      },
    });

    return this.success('update_filter_view', {});
  }

  private async handleDeleteFilterView(
    input: Extract<FilterSortAction, { action: 'delete_filter_view' }>
  ): Promise<FilterSortResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_filter_view', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteFilterView: { filterId: input.filterViewId },
        }],
      },
    });

    return this.success('delete_filter_view', {});
  }

  private async handleListFilterViews(
    input: Extract<FilterSortAction, { action: 'list_filter_views' }>
  ): Promise<FilterSortResponse> {
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
    input: Extract<FilterSortAction, { action: 'get_filter_view' }>
  ): Promise<FilterSortResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.filterViews',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const fv of sheet.filterViews ?? []) {
        if (fv.filterViewId === input.filterViewId) {
          return this.success('get_filter_view', {
            filterViews: [{
              filterViewId: fv.filterViewId ?? 0,
              title: fv.title ?? '',
              range: this.toGridRangeOutput(fv.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
            }],
          });
        }
      }
    }

    return this.error({
      code: 'SHEET_NOT_FOUND',
      message: `Filter view ${input.filterViewId} not found`,
      retryable: false,
    });
  }

  // ============================================================
  // Slicers
  // ============================================================

  private async handleCreateSlicer(
    input: Extract<FilterSortAction, { action: 'create_slicer' }>
  ): Promise<FilterSortResponse> {
    const dataRange = await this.toGridRange(input.spreadsheetId, input.dataRange);
    const anchor = parseCellReference(input.position.anchorCell);

    const batchResponse = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
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
        }],
      },
    });

    const slicerId = batchResponse.data.replies?.[0]?.addSlicer?.slicer?.slicerId ?? undefined;
    return this.success('create_slicer', { slicerId });
  }

  private async handleUpdateSlicer(
    input: Extract<FilterSortAction, { action: 'update_slicer' }>
  ): Promise<FilterSortResponse> {
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
        requests: [{
          updateSlicerSpec: {
            slicerId: input.slicerId,
            spec,
            fields: 'title,filterCriteria',
          },
        }],
      },
    });

    return this.success('update_slicer', {});
  }

  private async handleDeleteSlicer(
    input: Extract<FilterSortAction, { action: 'delete_slicer' }>
  ): Promise<FilterSortResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_slicer', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteEmbeddedObject: { objectId: input.slicerId },
        }],
      },
    });

    return this.success('delete_slicer', {});
  }

  private async handleListSlicers(
    input: Extract<FilterSortAction, { action: 'list_slicers' }>
  ): Promise<FilterSortResponse> {
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
  // Helpers
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

  private async toGridRange(
    spreadsheetId: string,
    range: RangeInput
  ): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private async getSheetId(spreadsheetId: string, sheetName?: string): Promise<number> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheets = response.data.sheets ?? [];
    if (!sheetName) {
      return sheets[0]?.properties?.sheetId ?? 0;
    }

    const match = sheets.find(s => s.properties?.title === sheetName);
    if (!match) {
      throw new RangeResolutionError(
        `Sheet "${sheetName}" not found`,
        'SHEET_NOT_FOUND',
        { sheetName, spreadsheetId },
        false
      );
    }
    return match.properties?.sheetId ?? 0;
  }

  private mapCriteria(input: Record<number, { hiddenValues?: string[]; condition?: { type: string; values?: string[] }; visibleBackgroundColor?: { red?: number; green?: number; blue?: number; alpha?: number }; visibleForegroundColor?: { red?: number; green?: number; blue?: number; alpha?: number } }>): Record<string, ApiFilterCriteria> {
    return Object.entries(input).reduce((acc, [col, crit]) => {
      acc[col] = this.mapSingleCriteria(crit);
      return acc;
    }, {} as Record<string, ApiFilterCriteria>);
  }

  private mapSingleCriteria(crit: { hiddenValues?: string[]; condition?: { type: string; values?: string[] }; visibleBackgroundColor?: { red?: number; green?: number; blue?: number; alpha?: number }; visibleForegroundColor?: { red?: number; green?: number; blue?: number; alpha?: number } }): ApiFilterCriteria {
    return {
      hiddenValues: crit.hiddenValues,
      visibleBackgroundColor: crit.visibleBackgroundColor,
      visibleForegroundColor: crit.visibleForegroundColor,
      condition: crit.condition
        ? {
            type: crit.condition.type as sheets_v4.Schema$BooleanCondition['type'],
            values: crit.condition.values?.map(v => ({ userEnteredValue: v })),
          }
        : undefined,
    };
  }
}
