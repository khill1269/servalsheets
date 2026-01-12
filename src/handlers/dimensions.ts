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

import type { sheets_v4 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
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
} from "../schemas/index.js";
import { confirmDestructiveAction } from "../mcp/elicitation.js";

export class DimensionsHandler extends BaseHandler<
  SheetsDimensionsInput,
  SheetsDimensionsOutput
> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_dimensions", context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsDimensionsInput): Promise<SheetsDimensionsOutput> {
    // Input is now the action directly (no request wrapper)
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(
      input,
    ) as SheetsDimensionsInput;

    try {
      const req = inferredRequest;
      let response: DimensionsResponse;
      switch (req.action) {
        case "insert_rows":
          response = await this.handleInsertRows(
            req as DimensionsInsertRowsInput,
          );
          break;
        case "insert_columns":
          response = await this.handleInsertColumns(
            req as DimensionsInsertColumnsInput,
          );
          break;
        case "delete_rows":
          response = await this.handleDeleteRows(
            req as DimensionsDeleteRowsInput,
          );
          break;
        case "delete_columns":
          response = await this.handleDeleteColumns(
            req as DimensionsDeleteColumnsInput,
          );
          break;
        case "move_rows":
          response = await this.handleMoveRows(req as DimensionsMoveRowsInput);
          break;
        case "move_columns":
          response = await this.handleMoveColumns(
            req as DimensionsMoveColumnsInput,
          );
          break;
        case "resize_rows":
          response = await this.handleResizeRows(
            req as DimensionsResizeRowsInput,
          );
          break;
        case "resize_columns":
          response = await this.handleResizeColumns(
            req as DimensionsResizeColumnsInput,
          );
          break;
        case "auto_resize":
          response = await this.handleAutoResize(
            req as DimensionsAutoResizeInput,
          );
          break;
        case "hide_rows":
          response = await this.handleHideRows(req as DimensionsHideRowsInput);
          break;
        case "hide_columns":
          response = await this.handleHideColumns(
            req as DimensionsHideColumnsInput,
          );
          break;
        case "show_rows":
          response = await this.handleShowRows(req as DimensionsShowRowsInput);
          break;
        case "show_columns":
          response = await this.handleShowColumns(
            req as DimensionsShowColumnsInput,
          );
          break;
        case "freeze_rows":
          response = await this.handleFreezeRows(
            req as DimensionsFreezeRowsInput,
          );
          break;
        case "freeze_columns":
          response = await this.handleFreezeColumns(
            req as DimensionsFreezeColumnsInput,
          );
          break;
        case "group_rows":
          response = await this.handleGroupRows(
            req as DimensionsGroupRowsInput,
          );
          break;
        case "group_columns":
          response = await this.handleGroupColumns(
            req as DimensionsGroupColumnsInput,
          );
          break;
        case "ungroup_rows":
          response = await this.handleUngroupRows(
            req as DimensionsUngroupRowsInput,
          );
          break;
        case "ungroup_columns":
          response = await this.handleUngroupColumns(
            req as DimensionsUngroupColumnsInput,
          );
          break;
        case "append_rows":
          response = await this.handleAppendRows(
            req as DimensionsAppendRowsInput,
          );
          break;
        case "append_columns":
          response = await this.handleAppendColumns(
            req as DimensionsAppendColumnsInput,
          );
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

  protected createIntents(input: SheetsDimensionsInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    const req = input;
    const destructiveActions = [
      "delete_rows",
      "delete_columns",
      "move_rows",
      "move_columns",
    ];
    return [
      {
        type: req.action.startsWith("delete")
          ? "DELETE_DIMENSION"
          : req.action.startsWith("insert") || req.action.startsWith("append")
            ? "INSERT_DIMENSION"
            : "UPDATE_DIMENSION_PROPERTIES",
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

  private async handleInsertRows(
    input: DimensionsInsertRowsInput,
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
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.startIndex + count,
              },
              inheritFromBefore: input.inheritFromBefore ?? false,
            },
          },
        ],
      },
    });

    return this.success("insert_rows", { rowsAffected: count });
  }

  private async handleInsertColumns(
    input: DimensionsInsertColumnsInput,
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
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.startIndex + count,
              },
              inheritFromBefore: input.inheritFromBefore ?? false,
            },
          },
        ],
      },
    });

    return this.success("insert_columns", { columnsAffected: count });
  }

  // ============================================================
  // Delete Operations (Destructive)
  // ============================================================

  private async handleDeleteRows(
    input: DimensionsDeleteRowsInput,
  ): Promise<DimensionsResponse> {
    const rowCount = input.endIndex - input.startIndex;

    // Generate safety warnings
    const safetyContext = {
      affectedRows: rowCount,
      isDestructive: true,
      operationType: "delete_rows",
      spreadsheetId: input.spreadsheetId,
    };
    const warnings = this.getSafetyWarnings(safetyContext, input.safety);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && rowCount > 5) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          "Delete Rows",
          `You are about to delete ${rowCount} row${rowCount > 1 ? "s" : ""} (rows ${input.startIndex + 1}-${input.endIndex}).\n\nAll data, formatting, and formulas in these rows will be permanently removed.`,
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: "PRECONDITION_FAILED",
            message: "Row deletion cancelled by user",
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn(
          "Elicitation failed for delete_rows, proceeding with operation",
          { error: err },
        );
      }
    }

    if (input.safety?.dryRun) {
      const meta = this.generateMeta("delete_rows", input, undefined, {
        cellsAffected: rowCount,
      });
      if (warnings.length > 0) {
        meta.warnings = this.formatWarnings(warnings);
      }
      return this.success(
        "delete_rows",
        { rowsAffected: rowCount },
        undefined,
        true,
        meta,
      );
    }

    // Create snapshot if requested
    const snapshot = await this.createSafetySnapshot(
      safetyContext,
      input.safety,
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: input.sheetId,
                dimension: "ROWS",
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
      "delete_rows",
      input,
      { rowsAffected: rowCount },
      { cellsAffected: rowCount },
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
      "delete_rows",
      { rowsAffected: rowCount },
      undefined,
      false,
      meta,
    );
  }

  private async handleDeleteColumns(
    input: DimensionsDeleteColumnsInput,
  ): Promise<DimensionsResponse> {
    const columnCount = input.endIndex - input.startIndex;

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && columnCount > 3) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          "Delete Columns",
          `You are about to delete ${columnCount} column${columnCount > 1 ? "s" : ""} (columns ${input.startIndex}-${input.endIndex - 1}).\n\nAll data, formatting, and formulas in these columns will be permanently removed.`,
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: "PRECONDITION_FAILED",
            message: "Column deletion cancelled by user",
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn(
          "Elicitation failed for delete_columns, proceeding with operation",
          { error: err },
        );
      }
    }

    if (input.safety?.dryRun) {
      return this.success(
        "delete_columns",
        { columnsAffected: columnCount },
        undefined,
        true,
      );
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: input.sheetId,
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success("delete_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Move Operations
  // ============================================================

  private async handleMoveRows(
    input: DimensionsMoveRowsInput,
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success(
        "move_rows",
        { rowsAffected: input.endIndex - input.startIndex },
        undefined,
        true,
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
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              destinationIndex: input.destinationIndex,
            },
          },
        ],
      },
    });

    return this.success("move_rows", {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleMoveColumns(
    input: DimensionsMoveColumnsInput,
  ): Promise<DimensionsResponse> {
    if (input.safety?.dryRun) {
      return this.success(
        "move_columns",
        { columnsAffected: input.endIndex - input.startIndex },
        undefined,
        true,
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
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              destinationIndex: input.destinationIndex,
            },
          },
        ],
      },
    });

    return this.success("move_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Resize Operations
  // ============================================================

  private async handleResizeRows(
    input: DimensionsResizeRowsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: input.sheetId,
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              properties: {
                pixelSize: input.pixelSize,
              },
              fields: "pixelSize",
            },
          },
        ],
      },
    });

    return this.success("resize_rows", {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleResizeColumns(
    input: DimensionsResizeColumnsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: input.sheetId,
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              properties: {
                pixelSize: input.pixelSize,
              },
              fields: "pixelSize",
            },
          },
        ],
      },
    });

    return this.success("resize_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleAutoResize(
    input: DimensionsAutoResizeInput,
  ): Promise<DimensionsResponse> {
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
      "auto_resize",
      input.dimension === "ROWS"
        ? { rowsAffected: count }
        : { columnsAffected: count },
    );
  }

  // ============================================================
  // Visibility Operations
  // ============================================================

  private async handleHideRows(
    input: DimensionsHideRowsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: input.sheetId,
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              properties: {
                hiddenByUser: true,
              },
              fields: "hiddenByUser",
            },
          },
        ],
      },
    });

    return this.success("hide_rows", {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleHideColumns(
    input: DimensionsHideColumnsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: input.sheetId,
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              properties: {
                hiddenByUser: true,
              },
              fields: "hiddenByUser",
            },
          },
        ],
      },
    });

    return this.success("hide_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleShowRows(
    input: DimensionsShowRowsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: input.sheetId,
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              properties: {
                hiddenByUser: false,
              },
              fields: "hiddenByUser",
            },
          },
        ],
      },
    });

    return this.success("show_rows", {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleShowColumns(
    input: DimensionsShowColumnsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: input.sheetId,
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
              properties: {
                hiddenByUser: false,
              },
              fields: "hiddenByUser",
            },
          },
        ],
      },
    });

    return this.success("show_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Freeze Operations
  // ============================================================

  private async handleFreezeRows(
    input: DimensionsFreezeRowsInput,
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
                  frozenRowCount: input.frozenRowCount,
                },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      },
    });

    return this.success("freeze_rows", { rowsAffected: input.frozenRowCount });
  }

  private async handleFreezeColumns(
    input: DimensionsFreezeColumnsInput,
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
              fields: "gridProperties.frozenColumnCount",
            },
          },
        ],
      },
    });

    return this.success("freeze_columns", {
      columnsAffected: input.frozenColumnCount,
    });
  }

  // ============================================================
  // Group Operations
  // ============================================================

  private async handleGroupRows(
    input: DimensionsGroupRowsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success("group_rows", {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleGroupColumns(
    input: DimensionsGroupColumnsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success("group_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleUngroupRows(
    input: DimensionsUngroupRowsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: "ROWS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success("ungroup_rows", {
      rowsAffected: input.endIndex - input.startIndex,
    });
  }

  private async handleUngroupColumns(
    input: DimensionsUngroupColumnsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimensionGroup: {
              range: {
                sheetId: input.sheetId,
                dimension: "COLUMNS",
                startIndex: input.startIndex,
                endIndex: input.endIndex,
              },
            },
          },
        ],
      },
    });

    return this.success("ungroup_columns", {
      columnsAffected: input.endIndex - input.startIndex,
    });
  }

  // ============================================================
  // Append Operations
  // ============================================================

  private async handleAppendRows(
    input: DimensionsAppendRowsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: input.sheetId,
              dimension: "ROWS",
              length: input.count,
            },
          },
        ],
      },
    });

    return this.success("append_rows", { rowsAffected: input.count });
  }

  private async handleAppendColumns(
    input: DimensionsAppendColumnsInput,
  ): Promise<DimensionsResponse> {
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: input.sheetId,
              dimension: "COLUMNS",
              length: input.count,
            },
          },
        ],
      },
    });

    return this.success("append_columns", { columnsAffected: input.count });
  }
}
