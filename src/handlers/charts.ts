/**
 * ServalSheets - Charts Handler
 *
 * Handles sheets_charts tool (chart operations)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsChartsInput,
  SheetsChartsOutput,
  ChartsResponse,
  ChartsCreateInput,
  ChartsUpdateInput,
  ChartsDeleteInput,
  ChartsListInput,
  ChartsGetInput,
  ChartsMoveInput,
  ChartsResizeInput,
  ChartsUpdateDataRangeInput,
  ChartsExportInput,
} from "../schemas/charts.js";
import type { RangeInput } from "../schemas/shared.js";
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from "../utils/google-sheets-helpers.js";

export class ChartsHandler extends BaseHandler<
  SheetsChartsInput,
  SheetsChartsOutput
> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_charts", context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsChartsInput): Promise<SheetsChartsOutput> {
    // Input is now the action directly (no request wrapper)
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(
      input,
    ) as SheetsChartsInput;

    try {
      const req = inferredRequest;
      let response: ChartsResponse;
      switch (req.action) {
        case "create":
          response = await this.handleCreate(req as ChartsCreateInput);
          break;
        case "update":
          response = await this.handleUpdate(req as ChartsUpdateInput);
          break;
        case "delete":
          response = await this.handleDelete(req as ChartsDeleteInput);
          break;
        case "list":
          response = await this.handleList(req as ChartsListInput);
          break;
        case "get":
          response = await this.handleGet(req as ChartsGetInput);
          break;
        case "move":
          response = await this.handleMove(req as ChartsMoveInput);
          break;
        case "resize":
          response = await this.handleResize(req as ChartsResizeInput);
          break;
        case "update_data_range":
          response = await this.handleUpdateDataRange(
            req as ChartsUpdateDataRangeInput,
          );
          break;
        case "export":
          response = await this.handleExport(req as ChartsExportInput);
          break;
        default:
          response = this.error({
            code: "INVALID_PARAMS",
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId:
            "sheetId" in inferredRequest
              ? typeof inferredRequest.sheetId === "number"
                ? inferredRequest.sheetId
                : undefined
              : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsChartsInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    const req = input;
    if ("spreadsheetId" in req && req.spreadsheetId) {
      const destructive = req.action === "delete";
      const type =
        req.action === "create"
          ? "ADD_CHART"
          : req.action === "delete"
            ? "DELETE_CHART"
            : "UPDATE_CHART";

      return [
        {
          type,
          target: { spreadsheetId: req.spreadsheetId },
          payload: {},
          metadata: {
            sourceTool: this.toolName,
            sourceAction: req.action,
            priority: 1,
            destructive,
          },
        },
      ];
    }
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleCreate(
    input: ChartsCreateInput,
  ): Promise<ChartsResponse> {
    const dataRange = await this.toGridRange(
      input.spreadsheetId,
      input.data.sourceRange,
    );
    const position = await this.toOverlayPosition(
      input.spreadsheetId,
      input.position.anchorCell,
      input.position,
    );

    // Route to appropriate chart spec builder based on chart type
    const chartSpec = this.buildChartSpec(
      dataRange,
      input.chartType,
      input.data,
      input.options,
    );

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addChart: {
              chart: {
                spec: chartSpec,
                position,
              },
            },
          },
        ],
      },
    });

    const chartId =
      response.data.replies?.[0]?.addChart?.chart?.chartId ?? undefined;
    return this.success("create", { chartId });
  }

  private async handleUpdate(
    input: ChartsUpdateInput,
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
        input.position,
      );
      requests.push({
        updateEmbeddedObjectPosition: {
          objectId: input.chartId,
          newPosition: position,
          fields: "overlayPosition",
        },
      });
    }

    if (requests.length === 0) {
      return this.success("update", {});
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success("update", {});
  }

  private async handleDelete(
    input: ChartsDeleteInput,
  ): Promise<ChartsResponse> {
    if (input.safety?.dryRun) {
      return this.success("delete", {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteEmbeddedObject: {
              objectId: input.chartId,
            },
          },
        ],
      },
    });

    return this.success("delete", {});
  }

  private async handleList(input: ChartsListInput): Promise<ChartsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets.charts,sheets.properties.sheetId",
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
          chartType: chart.spec?.basicChart?.chartType ?? "UNKNOWN",
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

    return this.success("list", { charts });
  }

  private async handleGet(input: ChartsGetInput): Promise<ChartsResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets.charts",
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const chart of sheet.charts ?? []) {
        if (chart.chartId === input.chartId) {
          const overlay = chart.position?.overlayPosition;
          return this.success("get", {
            charts: [
              {
                chartId: chart.chartId ?? 0,
                chartType: chart.spec?.basicChart?.chartType ?? "UNKNOWN",
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
              },
            ],
          });
        }
      }
    }

    return this.notFoundError("Chart", input.chartId);
  }

  private async handleMove(input: ChartsMoveInput): Promise<ChartsResponse> {
    const position = await this.toOverlayPosition(
      input.spreadsheetId,
      input.position.anchorCell,
      input.position,
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateEmbeddedObjectPosition: {
              objectId: input.chartId,
              newPosition: position,
              fields: "overlayPosition",
            },
          },
        ],
      },
    });

    return this.success("move", {});
  }

  private async handleResize(
    input: ChartsResizeInput,
  ): Promise<ChartsResponse> {
    const currentPosition = await this.fetchChartPosition(
      input.spreadsheetId,
      input.chartId,
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
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
              fields: "overlayPosition",
            },
          },
        ],
      },
    });

    return this.success("resize", {});
  }

  private async handleUpdateDataRange(
    input: ChartsUpdateDataRangeInput,
  ): Promise<ChartsResponse> {
    const dataRange = await this.toGridRange(
      input.spreadsheetId,
      input.data.sourceRange,
    );
    const spec = this.buildBasicChartSpec(
      dataRange,
      undefined,
      input.data,
      undefined,
    );

    if (input.safety?.dryRun) {
      return this.success("update_data_range", {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateChartSpec: {
              chartId: input.chartId,
              spec,
            },
          },
        ],
      },
    });

    return this.success("update_data_range", {});
  }

  private async handleExport(
    _input: ChartsExportInput,
  ): Promise<ChartsResponse> {
    // Exporting charts requires Drive export endpoints which are not wired here.
    return this.error({
      code: "FEATURE_UNAVAILABLE",
      message: "Chart export is not yet available in this server build.",
      retryable: false,
      suggestedFix:
        "Use Google Sheets UI to export or add Drive export integration.",
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private async toGridRange(
    spreadsheetId: string,
    rangeInput: RangeInput,
  ): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, rangeInput);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(
      spreadsheetId,
      parsed.sheetName,
      this.sheetsApi,
    );

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private buildBasicChartSpec(
    dataRange: GridRangeInput,
    chartType: sheets_v4.Schema$BasicChartSpec["chartType"] | undefined,
    data: ChartsCreateInput["data"],
    options?: ChartsCreateInput["options"],
  ): sheets_v4.Schema$ChartSpec {
    const domainColumn = data.categories ?? 0;
    const domainRange: sheets_v4.Schema$GridRange = {
      ...toGridRange(dataRange),
      startColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn,
      endColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn + 1,
    };

    const seriesRanges =
      data.series && data.series.length > 0
        ? data.series.map((s) => ({
            ...toGridRange(dataRange),
            startColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column,
            endColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column + 1,
          }))
        : [
            {
              ...toGridRange(dataRange),
              startColumnIndex: (dataRange.startColumnIndex ?? 0) + 1,
              endColumnIndex: (dataRange.startColumnIndex ?? 0) + 2,
            },
          ];

    return {
      title: options?.title,
      basicChart: {
        chartType: chartType ?? "BAR",
        headerCount: 1,
        domains: [
          {
            domain: {
              sourceRange: { sources: [domainRange] },
            },
          },
        ],
        series: seriesRanges.map((range, idx) => ({
          series: { sourceRange: { sources: [range] } },
          targetAxis: "LEFT_AXIS",
          color: data.series?.[idx]?.color,
        })),
        legendPosition: options?.legendPosition,
        threeDimensional: options?.is3D,
        stackedType: options?.stacked ? "STACKED" : "NOT_STACKED", // Fixed: 'NONE' is invalid, must be 'NOT_STACKED'
      },
    };
  }

  /**
   * Route chart creation to appropriate spec builder based on chart type
   * PIE/DOUGHNUT/TREEMAP/HISTOGRAM/SCORECARD/WATERFALL/CANDLESTICK need specific specs
   * BAR/LINE/AREA/COLUMN/SCATTER/COMBO/STEPPED_AREA use BasicChartSpec
   */
  private buildChartSpec(
    dataRange: GridRangeInput,
    chartType: string | undefined,
    data: ChartsCreateInput["data"],
    options?: ChartsCreateInput["options"],
  ): sheets_v4.Schema$ChartSpec {
    const title = options?.title;
    const gridRange = toGridRange(dataRange);

    switch (chartType) {
      case "PIE":
      case "DOUGHNUT":
        return {
          title,
          pieChart: {
            domain: {
              sourceRange: {
                sources: [
                  {
                    ...gridRange,
                    startColumnIndex:
                      (dataRange.startColumnIndex ?? 0) +
                      (data.categories ?? 0),
                    endColumnIndex:
                      (dataRange.startColumnIndex ?? 0) +
                      (data.categories ?? 0) +
                      1,
                  },
                ],
              },
            },
            series: {
              sourceRange: {
                sources: [
                  {
                    ...gridRange,
                    startColumnIndex:
                      (dataRange.startColumnIndex ?? 0) +
                      (data.series?.[0]?.column ?? 1),
                    endColumnIndex:
                      (dataRange.startColumnIndex ?? 0) +
                      (data.series?.[0]?.column ?? 1) +
                      1,
                  },
                ],
              },
            },
            threeDimensional: options?.is3D,
            pieHole: chartType === "DOUGHNUT" ? (options?.pieHole ?? 0.5) : 0,
            legendPosition: options?.legendPosition,
          },
        };

      case "HISTOGRAM":
        return {
          title,
          histogramChart: {
            series: [
              {
                data: { sourceRange: { sources: [gridRange] } },
              },
            ],
            legendPosition: options?.legendPosition,
          },
        };

      case "SCORECARD":
        return {
          title,
          scorecardChart: {
            keyValueData: {
              sourceRange: { sources: [gridRange] },
            },
            aggregateType: "SUM",
          },
        };

      // BAR, LINE, AREA, COLUMN, SCATTER, COMBO, STEPPED_AREA, and others use BasicChartSpec
      default:
        return this.buildBasicChartSpec(
          dataRange,
          chartType as sheets_v4.Schema$BasicChartSpec["chartType"],
          data,
          options,
        );
    }
  }

  private async toOverlayPosition(
    spreadsheetId: string,
    anchorCell: string,
    position: {
      offsetX?: number;
      offsetY?: number;
      width?: number;
      height?: number;
    },
  ): Promise<sheets_v4.Schema$EmbeddedObjectPosition> {
    const parsed = parseCellReference(anchorCell);
    const sheetId = await this.getSheetId(
      spreadsheetId,
      parsed.sheetName,
      this.sheetsApi,
    );

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
    chartId: number,
  ): Promise<{
    anchorCell: sheets_v4.Schema$GridCoordinate;
    offsetX: number;
    offsetY: number;
  }> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.charts",
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
      anchorCell: {
        sheetId: sheetIdFallback(response.data.sheets),
        rowIndex: 0,
        columnIndex: 0,
      },
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
