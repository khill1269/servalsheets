/**
 * ServalSheets - Charts Handler
 *
 * Handles sheets_charts tool (chart operations)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsChartsInput,
  SheetsChartsOutput,
  ChartsAction,
  ChartsResponse,
} from '../schemas/charts.js';
import type { RangeInput } from '../schemas/shared.js';
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import { RangeResolutionError } from '../core/range-resolver.js';

export class ChartsHandler extends BaseHandler<SheetsChartsInput, SheetsChartsOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_charts', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsChartsInput): Promise<SheetsChartsOutput> {
    try {
      const req = input.request;
      let response: ChartsResponse;
      switch (req.action) {
        case 'create':
          response = await this.handleCreate(req);
          break;
        case 'update':
          response = await this.handleUpdate(req);
          break;
        case 'delete':
          response = await this.handleDelete(req);
          break;
        case 'list':
          response = await this.handleList(req);
          break;
        case 'get':
          response = await this.handleGet(req);
          break;
        case 'move':
          response = await this.handleMove(req);
          break;
        case 'resize':
          response = await this.handleResize(req);
          break;
        case 'update_data_range':
          response = await this.handleUpdateDataRange(req);
          break;
        case 'export':
          response = await this.handleExport(req);
          break;
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }
      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsChartsInput): Intent[] {
    const req = input.request;
    if ('spreadsheetId' in req) {
      const destructive = req.action === 'delete';
      const type = req.action === 'create'
        ? 'ADD_CHART'
        : req.action === 'delete'
        ? 'DELETE_CHART'
        : 'UPDATE_CHART';

      return [{
        type,
        target: { spreadsheetId: req.spreadsheetId },
        payload: {},
        metadata: {
          sourceTool: this.toolName,
          sourceAction: req.action,
          priority: 1,
          destructive,
        },
      }];
    }
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleCreate(
    input: Extract<ChartsAction, { action: 'create' }>
  ): Promise<ChartsResponse> {
    const dataRange = await this.toGridRange(input.spreadsheetId, input.data.sourceRange);
    const position = await this.toOverlayPosition(input.spreadsheetId, input.position.anchorCell, input.position);

    const chartSpec = this.buildBasicChartSpec(dataRange, input.chartType, input.data, input.options);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addChart: {
            chart: {
              spec: chartSpec,
              position,
            },
          },
        }],
      },
    });

    const chartId = response.data.replies?.[0]?.addChart?.chart?.chartId ?? undefined;
    return this.success('create', { chartId });
  }

  private async handleUpdate(
    input: Extract<ChartsAction, { action: 'update' }>
  ): Promise<ChartsResponse> {
    const requests: sheets_v4.Schema$Request[] = [];
    const specUpdates: sheets_v4.Schema$ChartSpec = {};

    if (input.chartType) {
      specUpdates.basicChart = { chartType: input.chartType };
    }
    if (input.options?.title) {
      specUpdates.title = input.options.title;
    }

    if (Object.keys(specUpdates).length > 0) {
      requests.push({
        updateChartSpec: {
          chartId: input.chartId,
          spec: specUpdates,
        },
      });
    }

    if (input.position) {
      const position = await this.toOverlayPosition(
        input.spreadsheetId,
        input.position.anchorCell,
        input.position
      );
      requests.push({
        updateEmbeddedObjectPosition: {
          objectId: input.chartId,
          newPosition: position,
          fields: 'overlayPosition',
        },
      });
    }

    if (requests.length === 0) {
      return this.success('update', {});
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('update', {});
  }

  private async handleDelete(
    input: Extract<ChartsAction, { action: 'delete' }>
  ): Promise<ChartsResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteEmbeddedObject: {
            objectId: input.chartId,
          },
        }],
      },
    });

    return this.success('delete', {});
  }

  private async handleList(
    input: Extract<ChartsAction, { action: 'list' }>
  ): Promise<ChartsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts,sheets.properties.sheetId',
    });

    const charts: Array<{
      chartId: number;
      chartType: string;
      sheetId: number;
      title?: string;
      position: {
        anchorCell: string;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
      };
    }> = [];

    for (const sheet of response.data.sheets ?? []) {
      const sheetId = sheet.properties?.sheetId ?? 0;
      if (input.sheetId !== undefined && sheetId !== input.sheetId) continue;

      for (const chart of sheet.charts ?? []) {
        const overlay = chart.position?.overlayPosition;
        charts.push({
          chartId: chart.chartId ?? 0,
          chartType: chart.spec?.basicChart?.chartType ?? 'UNKNOWN',
          sheetId,
          title: chart.spec?.title ?? undefined,
          position: {
            anchorCell: overlay?.anchorCell
              ? this.formatAnchorCell(overlay.anchorCell)
              : `${this.columnToLetter(0)}1`,
            offsetX: overlay?.offsetXPixels ?? 0,
            offsetY: overlay?.offsetYPixels ?? 0,
            width: overlay?.widthPixels ?? 600,
            height: overlay?.heightPixels ?? 400,
          },
        });
      }
    }

    return this.success('list', { charts });
  }

  private async handleGet(
    input: Extract<ChartsAction, { action: 'get' }>
  ): Promise<ChartsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const chart of sheet.charts ?? []) {
        if (chart.chartId === input.chartId) {
          const overlay = chart.position?.overlayPosition;
          return this.success('get', {
            charts: [{
              chartId: chart.chartId ?? 0,
              chartType: chart.spec?.basicChart?.chartType ?? 'UNKNOWN',
              sheetId: overlay?.anchorCell?.sheetId ?? 0,
              title: chart.spec?.title ?? undefined,
              position: {
                anchorCell: overlay?.anchorCell
                  ? this.formatAnchorCell(overlay.anchorCell)
                  : `${this.columnToLetter(0)}1`,
                offsetX: overlay?.offsetXPixels ?? 0,
                offsetY: overlay?.offsetYPixels ?? 0,
                width: overlay?.widthPixels ?? 600,
                height: overlay?.heightPixels ?? 400,
              },
            }],
          });
        }
      }
    }

    return this.error({
      code: 'SHEET_NOT_FOUND',
      message: `Chart ${input.chartId} not found`,
      retryable: false,
    });
  }

  private async handleMove(
    input: Extract<ChartsAction, { action: 'move' }>
  ): Promise<ChartsResponse> {
    const position = await this.toOverlayPosition(input.spreadsheetId, input.position.anchorCell, input.position);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateEmbeddedObjectPosition: {
            objectId: input.chartId,
            newPosition: position,
            fields: 'overlayPosition',
          },
        }],
      },
    });

    return this.success('move', {});
  }

  private async handleResize(
    input: Extract<ChartsAction, { action: 'resize' }>
  ): Promise<ChartsResponse> {
    const currentPosition = await this.fetchChartPosition(input.spreadsheetId, input.chartId);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateEmbeddedObjectPosition: {
            objectId: input.chartId,
            newPosition: {
              overlayPosition: {
                anchorCell: currentPosition.anchorCell,
                offsetXPixels: currentPosition.offsetX,
                offsetYPixels: currentPosition.offsetY,
                widthPixels: input.width,
                heightPixels: input.height,
              },
            },
            fields: 'overlayPosition',
          },
        }],
      },
    });

    return this.success('resize', {});
  }

  private async handleUpdateDataRange(
    input: Extract<ChartsAction, { action: 'update_data_range' }>
  ): Promise<ChartsResponse> {
    const dataRange = await this.toGridRange(input.spreadsheetId, input.data.sourceRange);
    const spec = this.buildBasicChartSpec(dataRange, undefined, input.data, undefined);

    if (input.safety?.dryRun) {
      return this.success('update_data_range', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateChartSpec: {
            chartId: input.chartId,
            spec,
          },
        }],
      },
    });

    return this.success('update_data_range', {});
  }

  private async handleExport(
    input: Extract<ChartsAction, { action: 'export' }>
  ): Promise<ChartsResponse> {
    // Exporting charts requires Drive export endpoints which are not wired here.
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: 'Chart export is not yet available in this server build.',
      retryable: false,
      suggestedFix: 'Use Google Sheets UI to export or add Drive export integration.',
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private async toGridRange(
    spreadsheetId: string,
    rangeInput: RangeInput
  ): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, rangeInput);
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

  private buildBasicChartSpec(
    dataRange: GridRangeInput,
    chartType: sheets_v4.Schema$BasicChartSpec['chartType'] | undefined,
    data: Extract<ChartsAction, { action: 'create' | 'update_data_range' }>['data'],
    options?: Extract<ChartsAction, { action: 'create' | 'update' }>['options']
  ): sheets_v4.Schema$ChartSpec {
    const domainColumn = data.categories ?? 0;
    const domainRange: sheets_v4.Schema$GridRange = {
      ...toGridRange(dataRange),
      startColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn,
      endColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn + 1,
    };

    const seriesRanges = (data.series && data.series.length > 0)
      ? data.series.map((s) => ({
          ...toGridRange(dataRange),
          startColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column,
          endColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column + 1,
        }))
      : [{
          ...toGridRange(dataRange),
          startColumnIndex: (dataRange.startColumnIndex ?? 0) + 1,
          endColumnIndex: (dataRange.startColumnIndex ?? 0) + 2,
        }];

    return {
      title: options?.title,
      basicChart: {
        chartType: chartType ?? 'BAR',
        headerCount: 1,
        domains: [{
          domain: {
            sourceRange: { sources: [domainRange] },
          },
        }],
        series: seriesRanges.map((range, idx) => ({
          series: { sourceRange: { sources: [range] } },
          targetAxis: 'LEFT_AXIS',
          color: data.series?.[idx]?.color,
        })),
        legendPosition: options?.legendPosition,
        threeDimensional: options?.is3D,
        stackedType: options?.stacked ? 'STACKED' : 'NONE',
      },
    };
  }

  private async toOverlayPosition(
    spreadsheetId: string,
    anchorCell: string,
    position: { offsetX?: number; offsetY?: number; width?: number; height?: number }
  ): Promise<sheets_v4.Schema$EmbeddedObjectPosition> {
    const parsed = parseCellReference(anchorCell);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);

    return {
      overlayPosition: {
        anchorCell: {
          sheetId,
          rowIndex: parsed.row,
          columnIndex: parsed.col,
        },
        offsetXPixels: position.offsetX ?? 0,
        offsetYPixels: position.offsetY ?? 0,
        widthPixels: position.width ?? 600,
        heightPixels: position.height ?? 400,
      },
    };
  }

  private async fetchChartPosition(
    spreadsheetId: string,
    chartId: number
  ): Promise<{ anchorCell: sheets_v4.Schema$GridCoordinate; offsetX: number; offsetY: number }> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.charts',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const chart of sheet.charts ?? []) {
        if (chart.chartId === chartId) {
          const overlay = chart.position?.overlayPosition;
          if (overlay?.anchorCell) {
            return {
              anchorCell: overlay.anchorCell,
              offsetX: overlay.offsetXPixels ?? 0,
              offsetY: overlay.offsetYPixels ?? 0,
            };
          }
        }
      }
    }

    // Fallback anchor
    return {
      anchorCell: { sheetId: sheetIdFallback(response.data.sheets), rowIndex: 0, columnIndex: 0 },
      offsetX: 0,
      offsetY: 0,
    };
  }

  private formatAnchorCell(anchor: sheets_v4.Schema$GridCoordinate): string {
    const colLetter = this.columnToLetter(anchor.columnIndex ?? 0);
    const rowNumber = (anchor.rowIndex ?? 0) + 1;
    return `${colLetter}${rowNumber}`;
  }
}

function sheetIdFallback(sheets?: sheets_v4.Schema$Sheet[]): number {
  return sheets?.[0]?.properties?.sheetId ?? 0;
}
