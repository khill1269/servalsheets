/**
 * ServalSheets - Pivot Handler
 *
 * Handles sheets_pivot tool (pivot table operations)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsPivotInput,
  SheetsPivotOutput,
  PivotResponse,
  PivotCreateInput,
  PivotUpdateInput,
  PivotDeleteInput,
  PivotListInput,
  PivotGetInput,
  PivotRefreshInput,
} from "../schemas/index.js";
import type { RangeInput } from "../schemas/shared.js";
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from "../utils/google-sheets-helpers.js";
import { RangeResolutionError } from "../core/range-resolver.js";

type PivotSuccess = Extract<PivotResponse, { success: true }>;

export class PivotHandler extends BaseHandler<
  SheetsPivotInput,
  SheetsPivotOutput
> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_pivot", context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsPivotInput): Promise<SheetsPivotOutput> {
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(
      input,
    ) as SheetsPivotInput;

    try {
      const req = inferredRequest;
      let response: PivotResponse;
      switch (req.action) {
        case "create":
          response = await this.handleCreate(req as PivotCreateInput);
          break;
        case "update":
          response = await this.handleUpdate(req as PivotUpdateInput);
          break;
        case "delete":
          response = await this.handleDelete(req as PivotDeleteInput);
          break;
        case "list":
          response = await this.handleList(req as PivotListInput);
          break;
        case "get":
          response = await this.handleGet(req as PivotGetInput);
          break;
        case "refresh":
          response = await this.handleRefresh(req as PivotRefreshInput);
          break;
        default:
          response = this.error({
            code: "INVALID_PARAMS",
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }

      // Track context on success
      if (response.success && inferredRequest.spreadsheetId) {
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

  protected createIntents(input: SheetsPivotInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    const req = input;
    if ("spreadsheetId" in req && req.spreadsheetId) {
      const mutatingActions: Array<SheetsPivotInput["action"]> = [
        "create",
        "update",
        "delete",
        "refresh",
      ];
      if (!mutatingActions.includes(req.action)) {
        return [];
      }

      const destructiveActions: Array<SheetsPivotInput["action"]> = ["delete"];
      const type =
        req.action === "create"
          ? "ADD_PIVOT_TABLE"
          : req.action === "delete"
            ? "DELETE_PIVOT_TABLE"
            : "UPDATE_PIVOT_TABLE";

      return [
        {
          type,
          target: { spreadsheetId: req.spreadsheetId },
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
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleCreate(
    input: PivotCreateInput,
  ): Promise<PivotResponse> {
    const sourceRange = await this.toGridRange(
      input.spreadsheetId,
      input.sourceRange,
    );
    const destination = await this.toDestination(
      input.spreadsheetId,
      input.destinationCell,
      input.destinationSheetId,
    );

    const pivot: sheets_v4.Schema$PivotTable = {
      source: toGridRange(sourceRange),
      rows: input.rows?.map(this.mapPivotGroup) ?? [],
      columns: input.columns?.map(this.mapPivotGroup) ?? [],
      values: input.values.map(this.mapPivotValue),
      filterSpecs: input.filters?.map(this.mapPivotFilter),
    };

    const _response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              start: destination,
              fields: "pivotTable",
              rows: [
                {
                  values: [
                    {
                      pivotTable: pivot,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    const sheetId = destination.sheetId ?? 0;
    return this.success("create", {
      pivotTable: {
        sheetId,
        sourceRange,
        rowGroups: pivot.rows?.length ?? 0,
        columnGroups: pivot.columns?.length ?? 0,
        values: pivot.values?.length ?? 0,
      },
    });
  }

  private async handleUpdate(
    input: PivotUpdateInput,
  ): Promise<PivotResponse> {
    const sheetId = input.sheetId;
    const pivotRange = await this.findPivotRange(input.spreadsheetId, sheetId);

    if (!pivotRange) {
      return this.error({
        code: "SHEET_NOT_FOUND",
        message: `Pivot on sheet ${sheetId} not found`,
        retryable: false,
      });
    }

    const pivot: sheets_v4.Schema$PivotTable = {
      source: pivotRange,
      rows: input.rows?.map(this.mapPivotGroup),
      columns: input.columns?.map(this.mapPivotGroup),
      values: input.values?.map(this.mapPivotValue),
      filterSpecs: input.filters?.map(this.mapPivotFilter),
    };

    if (input.safety?.dryRun) {
      return this.success("update", {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              start: {
                sheetId,
                rowIndex: pivotRange.startRowIndex ?? 0,
                columnIndex: pivotRange.startColumnIndex ?? 0,
              },
              fields: "pivotTable",
              rows: [
                {
                  values: [
                    {
                      pivotTable: pivot,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    return this.success("update", {});
  }

  private async handleDelete(
    input: PivotDeleteInput,
  ): Promise<PivotResponse> {
    if (input.safety?.dryRun) {
      return this.success("delete", {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: { sheetId: input.sheetId },
          },
        ],
      },
    });

    return this.success("delete", {});
  }

  private async handleList(
    input: PivotListInput,
  ): Promise<PivotResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets.properties,sheets.data.rowData.values.pivotTable",
    });

    const pivotTables: NonNullable<PivotSuccess["pivotTables"]> = [];

    for (const sheet of response.data.sheets ?? []) {
      const hasPivot = sheet.data?.some((d) =>
        d.rowData?.some((r) => r.values?.some((v) => v.pivotTable)),
      );
      if (hasPivot) {
        pivotTables.push({
          sheetId: sheet.properties?.sheetId ?? 0,
          title: sheet.properties?.title ?? "",
        });
      }
    }

    return this.success("list", { pivotTables });
  }

  private async handleGet(
    input: PivotGetInput,
  ): Promise<PivotResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      ranges: [`'${input.sheetId}'!1:1`],
      includeGridData: true,
      fields:
        "sheets.data.rowData.values.pivotTable,sheets.properties.sheetId,sheets.properties.title",
    });

    for (const sheet of response.data.sheets ?? []) {
      if (sheet.properties?.sheetId !== input.sheetId) continue;
      for (const data of sheet.data ?? []) {
        for (const row of data.rowData ?? []) {
          for (const value of row.values ?? []) {
            if (value.pivotTable) {
              const pt = value.pivotTable;
              const sourceRange = this.normalizeGridRange(
                pt.source,
                input.sheetId,
              );
              return this.success("get", {
                pivotTable: {
                  sheetId: input.sheetId,
                  sourceRange,
                  rowGroups: pt.rows?.length ?? 0,
                  columnGroups: pt.columns?.length ?? 0,
                  values: pt.values?.length ?? 0,
                },
              });
            }
          }
        }
      }
    }

    return this.error({
      code: "SHEET_NOT_FOUND",
      message: `Pivot on sheet ${input.sheetId} not found`,
      retryable: false,
    });
  }

  private async handleRefresh(
    input: PivotRefreshInput,
  ): Promise<PivotResponse> {
    // Sheets API does not expose explicit pivot refresh; rewriting pivot triggers refresh.
    const getInput: PivotGetInput = {
      action: "get",
      spreadsheetId: input.spreadsheetId,
      sheetId: input.sheetId,
    };
    const getResult = await this.handleGet(getInput);
    if (!getResult.success || !getResult.pivotTable) {
      return getResult;
    }

    // Rewrite pivot to force refresh
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              start: {
                sheetId: input.sheetId,
                rowIndex: getResult.pivotTable.sourceRange.startRowIndex ?? 0,
                columnIndex:
                  getResult.pivotTable.sourceRange.startColumnIndex ?? 0,
              },
              fields: "pivotTable",
              rows: [
                {
                  values: [
                    {
                      pivotTable: {
                        source: getResult.pivotTable.sourceRange,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    return this.success("refresh", {});
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
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private async toDestination(
    spreadsheetId: string,
    destinationCell?: string,
    destinationSheetId?: number,
  ): Promise<sheets_v4.Schema$GridCoordinate> {
    if (destinationCell) {
      const parsed = parseCellReference(destinationCell);
      const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);
      return { sheetId, rowIndex: parsed.row, columnIndex: parsed.col };
    }

    if (destinationSheetId !== undefined) {
      return { sheetId: destinationSheetId, rowIndex: 0, columnIndex: 0 };
    }

    // Default: new sheet
    const newSheet = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: { properties: { title: "Pivot Table" } },
          },
        ],
      },
    });
    const sheetId =
      newSheet.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    return { sheetId, rowIndex: 0, columnIndex: 0 };
  }

  private async getSheetId(
    spreadsheetId: string,
    sheetName?: string,
  ): Promise<number> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });

    const sheets = response.data.sheets ?? [];
    if (!sheetName) {
      return sheets[0]?.properties?.sheetId ?? 0;
    }

    const match = sheets.find((s) => s.properties?.title === sheetName);
    if (!match) {
      throw new RangeResolutionError(
        `Sheet "${sheetName}" not found`,
        "SHEET_NOT_FOUND",
        { sheetName, spreadsheetId },
        false,
      );
    }
    return match.properties?.sheetId ?? 0;
  }

  private mapPivotGroup = (
    group: NonNullable<PivotCreateInput["rows"]>[number],
  ): sheets_v4.Schema$PivotGroup => ({
    sourceColumnOffset: group.sourceColumnOffset,
    showTotals: group.showTotals,
    sortOrder: group.sortOrder,
    groupRule: group.groupRule
      ? {
          dateTimeRule: group.groupRule.dateTimeRule
            ? { type: group.groupRule.dateTimeRule.type }
            : undefined,
          manualRule: group.groupRule.manualRule
            ? {
                groups: group.groupRule.manualRule.groups.map((ruleGroup) => ({
                  groupName: { stringValue: ruleGroup.groupName },
                  items: ruleGroup.items.map((item) => ({ stringValue: item })),
                })),
              }
            : undefined,
          histogramRule: group.groupRule.histogramRule
            ? {
                interval: group.groupRule.histogramRule.interval,
                start: group.groupRule.histogramRule.start,
                end: group.groupRule.histogramRule.end,
              }
            : undefined,
        }
      : undefined,
  });

  private mapPivotValue = (
    value: NonNullable<PivotCreateInput["values"]>[number],
  ): sheets_v4.Schema$PivotValue => ({
    sourceColumnOffset: value.sourceColumnOffset,
    summarizeFunction: value.summarizeFunction,
    name: value.name,
    calculatedDisplayType: value.calculatedDisplayType,
  });

  private mapPivotFilter = (
    filter: NonNullable<PivotCreateInput["filters"]>[number],
  ): sheets_v4.Schema$PivotFilterSpec => ({
    columnOffsetIndex: filter.sourceColumnOffset,
    filterCriteria: {
      visibleValues: filter.filterCriteria.visibleValues,
      condition: filter.filterCriteria.condition
        ? {
            type: filter.filterCriteria.condition
              .type as sheets_v4.Schema$BooleanCondition["type"],
            values: filter.filterCriteria.condition.values?.map((value) => ({
              userEnteredValue: value,
            })),
          }
        : undefined,
    },
  });

  private normalizeGridRange(
    range: sheets_v4.Schema$GridRange | undefined,
    fallbackSheetId: number,
  ): GridRangeInput {
    return {
      sheetId: range?.sheetId ?? fallbackSheetId,
      startRowIndex: range?.startRowIndex ?? undefined,
      endRowIndex: range?.endRowIndex ?? undefined,
      startColumnIndex: range?.startColumnIndex ?? undefined,
      endColumnIndex: range?.endColumnIndex ?? undefined,
    };
  }

  private async findPivotRange(
    spreadsheetId: string,
    sheetId: number,
  ): Promise<sheets_v4.Schema$GridRange | null> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties,sheets.data.rowData.values.pivotTable",
    });

    for (const sheet of response.data.sheets ?? []) {
      if (sheet.properties?.sheetId !== sheetId) continue;
      for (const data of sheet.data ?? []) {
        for (const row of data.rowData ?? []) {
          for (const value of row.values ?? []) {
            if (value.pivotTable?.source) {
              return value.pivotTable.source;
            }
          }
        }
      }
    }
    return null;
  }
}
