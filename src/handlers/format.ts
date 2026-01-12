/**
 * ServalSheets - Format Handler
 *
 * Handles sheets_format tool (formatting operations)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsFormatInput,
  SheetsFormatOutput,
  FormatResponse,
} from "../schemas/index.js";
import {
  parseA1Notation,
  toGridRange,
  estimateCellCount,
  type GridRangeInput,
} from "../utils/google-sheets-helpers.js";
import { confirmDestructiveAction } from "../mcp/elicitation.js";

export class FormatHandler extends BaseHandler<
  SheetsFormatInput,
  SheetsFormatOutput
> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_format", context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsFormatInput): Promise<SheetsFormatOutput> {
    // Input is now the action directly (no request wrapper)

    // Require authentication before proceeding
    this.requireAuth();

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(
      input,
    ) as SheetsFormatInput;

    try {
      const response = await this.executeAction(inferredRequest);

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
          range:
            "range" in inferredRequest
              ? typeof inferredRequest.range === "string"
                ? inferredRequest.range
                : undefined
              : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsFormatInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    if ("spreadsheetId" in input) {
      return [
        {
          type: "UPDATE_CELLS",
          target: { spreadsheetId: input.spreadsheetId },
          payload: {},
          metadata: {
            sourceTool: this.toolName,
            sourceAction: input.action,
            priority: 1,
            destructive: input.action === "clear_format",
          },
        },
      ];
    }
    return [];
  }

  /**
   * Execute action and return response (extracted for task/non-task paths)
   */
  private async executeAction(
    request: SheetsFormatInput,
  ): Promise<FormatResponse> {
    switch (request.action) {
      case "set_format":
        return await this.handleSetFormat(
          request as SheetsFormatInput & { action: "set_format" },
        );
      case "set_background":
        return await this.handleSetBackground(
          request as SheetsFormatInput & { action: "set_background" },
        );
      case "set_text_format":
        return await this.handleSetTextFormat(
          request as SheetsFormatInput & { action: "set_text_format" },
        );
      case "set_number_format":
        return await this.handleSetNumberFormat(
          request as SheetsFormatInput & { action: "set_number_format" },
        );
      case "set_alignment":
        return await this.handleSetAlignment(
          request as SheetsFormatInput & { action: "set_alignment" },
        );
      case "set_borders":
        return await this.handleSetBorders(
          request as SheetsFormatInput & { action: "set_borders" },
        );
      case "clear_format":
        return await this.handleClearFormat(
          request as SheetsFormatInput & { action: "clear_format" },
        );
      case "apply_preset":
        return await this.handleApplyPreset(
          request as SheetsFormatInput & { action: "apply_preset" },
        );
      case "auto_fit":
        return await this.handleAutoFit(
          request as SheetsFormatInput & { action: "auto_fit" },
        );
      default:
        return this.error({
          code: "INVALID_PARAMS",
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  // ============================================================
  // Format Actions
  // ============================================================

  private async handleSetFormat(
    input: SheetsFormatInput & { action: "set_format" },
  ): Promise<FormatResponse> {
    if (input.safety?.dryRun) {
      return this.success("set_format", { cellsFormatted: 0 }, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const format = input.format!;

    const cellFormat: sheets_v4.Schema$CellFormat = {};
    const fields: string[] = [];

    if (format.backgroundColor) {
      cellFormat.backgroundColor = format.backgroundColor;
      fields.push("backgroundColor");
    }
    if (format.textFormat) {
      cellFormat.textFormat = format.textFormat;
      fields.push("textFormat");
    }
    if (format.horizontalAlignment) {
      cellFormat.horizontalAlignment = format.horizontalAlignment;
      fields.push("horizontalAlignment");
    }
    if (format.verticalAlignment) {
      cellFormat.verticalAlignment = format.verticalAlignment;
      fields.push("verticalAlignment");
    }
    if (format.wrapStrategy) {
      cellFormat.wrapStrategy = format.wrapStrategy;
      fields.push("wrapStrategy");
    }
    if (format.numberFormat) {
      cellFormat.numberFormat = format.numberFormat;
      fields.push("numberFormat");
    }
    if (format.borders) {
      cellFormat.borders = format.borders;
      fields.push("borders");
    }

    const googleRange = toGridRange(gridRange);
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: { userEnteredFormat: cellFormat },
              fields: `userEnteredFormat(${fields.join(",")})`,
            },
          },
        ],
      },
    });

    return this.success("set_format", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetBackground(
    input: SheetsFormatInput & { action: "set_background" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: {
                userEnteredFormat: {
                  backgroundColor: input.color!,
                },
              },
              fields: "userEnteredFormat.backgroundColor",
            },
          },
        ],
      },
    });

    return this.success("set_background", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetTextFormat(
    input: SheetsFormatInput & { action: "set_text_format" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: {
                userEnteredFormat: {
                  textFormat: input.textFormat!,
                },
              },
              fields: "userEnteredFormat.textFormat",
            },
          },
        ],
      },
    });

    return this.success("set_text_format", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetNumberFormat(
    input: SheetsFormatInput & { action: "set_number_format" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: {
                userEnteredFormat: {
                  numberFormat: input.numberFormat!,
                },
              },
              fields: "userEnteredFormat.numberFormat",
            },
          },
        ],
      },
    });

    return this.success("set_number_format", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetAlignment(
    input: SheetsFormatInput & { action: "set_alignment" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    const cellFormat: sheets_v4.Schema$CellFormat = {};
    const fields: string[] = [];

    if (input.horizontal) {
      cellFormat.horizontalAlignment = input.horizontal;
      fields.push("horizontalAlignment");
    }
    if (input.vertical) {
      cellFormat.verticalAlignment = input.vertical;
      fields.push("verticalAlignment");
    }
    if (input.wrapStrategy) {
      cellFormat.wrapStrategy = input.wrapStrategy;
      fields.push("wrapStrategy");
    }

    if (fields.length === 0) {
      return this.error({
        code: "INVALID_PARAMS",
        message: "No alignment properties specified",
        retryable: false,
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: { userEnteredFormat: cellFormat },
              fields: `userEnteredFormat(${fields.join(",")})`,
            },
          },
        ],
      },
    });

    return this.success("set_alignment", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetBorders(
    input: SheetsFormatInput & { action: "set_borders" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    const updateBordersRequest: sheets_v4.Schema$UpdateBordersRequest = {
      range: googleRange,
      top: input.top,
      bottom: input.bottom,
      left: input.left,
      right: input.right,
      innerHorizontal: input.innerHorizontal,
      innerVertical: input.innerVertical,
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ updateBorders: updateBordersRequest }],
      },
    });

    return this.success("set_borders", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleClearFormat(
    input: SheetsFormatInput & { action: "clear_format" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);
    const estimatedCells = estimateCellCount(googleRange);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && estimatedCells > 500) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          "Clear Formatting",
          `You are about to clear all formatting from approximately ${estimatedCells.toLocaleString()} cells in range ${rangeA1}.\n\nAll number formats, colors, borders, and text styling will be removed. Cell values will not be affected.`,
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: "PRECONDITION_FAILED",
            message: "Clear formatting operation cancelled by user",
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn(
          "Elicitation failed for clear_format, proceeding with operation",
          { error: err },
        );
      }
    }

    if (input.safety?.dryRun) {
      return this.success(
        "clear_format",
        { cellsFormatted: 0 },
        undefined,
        true,
      );
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: { userEnteredFormat: {} },
              fields: "userEnteredFormat",
            },
          },
        ],
      },
    });

    return this.success("clear_format", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleApplyPreset(
    input: SheetsFormatInput & { action: "apply_preset" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);
    const requests: sheets_v4.Schema$Request[] = [];

    switch (input.preset!) {
      case "header_row":
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
                horizontalAlignment: "CENTER",
              },
            },
            fields:
              "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        });
        break;

      case "alternating_rows":
        requests.push({
          addBanding: {
            bandedRange: {
              range: googleRange,
              rowProperties: {
                firstBandColor: { red: 1, green: 1, blue: 1 },
                secondBandColor: { red: 0.95, green: 0.95, blue: 0.95 },
              },
            },
          },
        });
        break;

      case "total_row":
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                textFormat: { bold: true },
                borders: {
                  top: {
                    style: "SOLID_MEDIUM",
                    color: { red: 0, green: 0, blue: 0 },
                  },
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,borders.top)",
          },
        });
        break;

      case "currency":
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        });
        break;

      case "percentage":
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "PERCENT", pattern: "0.00%" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        });
        break;

      case "date":
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        });
        break;

      case "highlight_positive":
        requests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: "NUMBER_GREATER",
                  values: [{ userEnteredValue: "0" }],
                },
                format: {
                  backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
                },
              },
            },
            index: 0,
          },
        });
        break;

      case "highlight_negative":
        requests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: "NUMBER_LESS",
                  values: [{ userEnteredValue: "0" }],
                },
                format: {
                  backgroundColor: { red: 0.95, green: 0.85, blue: 0.85 },
                },
              },
            },
            index: 0,
          },
        });
        break;
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success("apply_preset", {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleAutoFit(
    input: SheetsFormatInput & { action: "auto_fit" },
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const requests: sheets_v4.Schema$Request[] = [];

    const dimension = input.dimension ?? "BOTH";
    if (dimension === "ROWS" || dimension === "BOTH") {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: gridRange.sheetId,
            dimension: "ROWS",
            startIndex: gridRange.startRowIndex,
            endIndex: gridRange.endRowIndex,
          },
        },
      });
    }

    if (dimension === "COLUMNS" || dimension === "BOTH") {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: gridRange.sheetId,
            dimension: "COLUMNS",
            startIndex: gridRange.startColumnIndex,
            endIndex: gridRange.endColumnIndex,
          },
        },
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success("auto_fit", {});
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async a1ToGridRange(
    spreadsheetId: string,
    a1: string,
  ): Promise<GridRangeInput> {
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
}
