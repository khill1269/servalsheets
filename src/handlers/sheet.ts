/**
 * ServalSheets - Sheet Handler
 *
 * Handles sheets_sheet tool (add, delete, duplicate, update, copy_to, list, get)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsSheetInput,
  SheetsSheetOutput,
  SheetInfo,
  SheetResponse,
  SheetAddInput,
  SheetDeleteInput,
  SheetDuplicateInput,
  SheetUpdateInput,
  SheetCopyToInput,
  SheetListInput,
  SheetGetInput,
} from "../schemas/index.js";
import { confirmDestructiveAction } from "../mcp/elicitation.js";
import { getRequestLogger } from "../utils/request-context.js";

export class SheetHandler extends BaseHandler<
  SheetsSheetInput,
  SheetsSheetOutput
> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_sheet", context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsSheetInput): Promise<SheetsSheetOutput> {
    // Input is now the action directly (no request wrapper)
    try {
      // Phase 1, Task 1.4: Infer missing parameters from context
      const req = this.inferRequestParameters(input) as SheetsSheetInput;

      let response: SheetResponse;
      switch (req.action) {
        case "add":
          response = await this.handleAdd(req);
          break;
        case "delete":
          response = await this.handleDelete(req);
          break;
        case "duplicate":
          response = await this.handleDuplicate(req);
          break;
        case "update":
          response = await this.handleUpdate(req);
          break;
        case "copy_to":
          response = await this.handleCopyTo(req);
          break;
        case "list":
          response = await this.handleList(req);
          break;
        case "get":
          response = await this.handleGet(req);
          break;
        default:
          response = this.error({
            code: "INVALID_PARAMS",
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }

      // Phase 1, Task 1.4: Track context after successful operation
      if (response.success && "spreadsheetId" in req) {
        this.trackContextFromRequest({
          spreadsheetId: req.spreadsheetId,
          sheetId:
            "sheetId" in req
              ? typeof req.sheetId === "number"
                ? req.sheetId
                : undefined
              : undefined,
          sheetName:
            response.success && "sheetName" in response
              ? typeof response.sheetName === "string"
                ? response.sheetName
                : undefined
              : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsSheetInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    switch (input.action) {
      case "add":
        return [
          {
            type: "ADD_SHEET",
            target: { spreadsheetId: input.spreadsheetId },
            payload: { title: input.title },
            metadata: {
              sourceTool: this.toolName,
              sourceAction: "add",
              priority: 1,
              destructive: false,
            },
          },
        ];
      case "delete":
        return [
          {
            type: "DELETE_SHEET",
            target: {
              spreadsheetId: input.spreadsheetId,
              sheetId: input.sheetId,
            },
            payload: {},
            metadata: {
              sourceTool: this.toolName,
              sourceAction: "delete",
              priority: 1,
              destructive: true,
            },
          },
        ];
      case "duplicate":
        return [
          {
            type: "DUPLICATE_SHEET",
            target: {
              spreadsheetId: input.spreadsheetId,
              sheetId: input.sheetId,
            },
            payload: { newTitle: input.newTitle },
            metadata: {
              sourceTool: this.toolName,
              sourceAction: "duplicate",
              priority: 1,
              destructive: false,
            },
          },
        ];
      case "update":
        return [
          {
            type: "UPDATE_SHEET_PROPERTIES",
            target: {
              spreadsheetId: input.spreadsheetId,
              sheetId: input.sheetId,
            },
            payload: { title: input.title, hidden: input.hidden },
            metadata: {
              sourceTool: this.toolName,
              sourceAction: "update",
              priority: 1,
              destructive: false,
            },
          },
        ];
      default:
        return [];
    }
  }

  private async handleAdd(input: SheetAddInput): Promise<SheetResponse> {
    const sheetProperties: sheets_v4.Schema$SheetProperties = {
      title: input.title,
      hidden: input.hidden ?? false,
      gridProperties: {
        rowCount: input.rowCount ?? 1000,
        columnCount: input.columnCount ?? 26,
      },
    };

    // Only add optional properties if defined
    if (input.index !== undefined) {
      sheetProperties.index = input.index;
    }
    if (input.tabColor) {
      sheetProperties.tabColor = {
        red: input.tabColor.red,
        green: input.tabColor.green,
        blue: input.tabColor.blue,
        alpha: input.tabColor.alpha,
      };
    }

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: { properties: sheetProperties },
          },
        ],
      },
    });

    const newSheet = response.data.replies?.[0]?.addSheet?.properties;
    const sheet: SheetInfo = {
      sheetId: newSheet?.sheetId ?? 0,
      title: newSheet?.title ?? input.title,
      index: newSheet?.index ?? 0,
      rowCount: newSheet?.gridProperties?.rowCount ?? input.rowCount ?? 1000,
      columnCount:
        newSheet?.gridProperties?.columnCount ?? input.columnCount ?? 26,
      hidden: newSheet?.hidden ?? false,
      tabColor: this.convertTabColor(newSheet?.tabColor),
    };

    return this.success("add", { sheet });
  }

  private async handleDelete(input: SheetDeleteInput): Promise<SheetResponse> {
    // Check if sheet exists when allowMissing is true
    if (input.allowMissing) {
      const exists = await this.sheetExists(input.spreadsheetId, input.sheetId);
      if (!exists) {
        return this.success("delete", { alreadyDeleted: true });
      }
    }

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.samplingServer && !input.safety?.dryRun) {
      try {
        // Check if client supports form elicitation before attempting confirmation
        const server = this.context
          .samplingServer as unknown as import("../mcp/elicitation.js").ElicitationServer;
        const caps = server.getClientCapabilities?.();

        // Only request confirmation if client supports form-based elicitation
        if (caps?.elicitation?.form) {
          const confirmation = await confirmDestructiveAction(
            server,
            "Delete Sheet",
            `This will permanently delete sheet with ID ${input.sheetId} from spreadsheet ${input.spreadsheetId}. This action cannot be undone.`,
          );

          if (!confirmation.confirmed) {
            return this.error({
              code: "INVALID_REQUEST",
              message: "Operation cancelled by user",
              retryable: false,
            });
          }
        }
        // If client doesn't support elicitation, proceed without confirmation
      } catch (error) {
        // If elicitation fails, proceed (backward compatibility)
        getRequestLogger().warn("Elicitation failed for delete operation", {
          error,
        });
      }
    }

    // Dry run support
    if (input.safety?.dryRun) {
      return this.success("delete", {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ deleteSheet: { sheetId: input.sheetId } }],
      },
    });

    return this.success("delete", {});
  }

  private async handleDuplicate(
    input: SheetDuplicateInput,
  ): Promise<SheetResponse> {
    const duplicateRequest: sheets_v4.Schema$DuplicateSheetRequest = {
      sourceSheetId: input.sheetId,
    };

    if (input.insertIndex !== undefined) {
      duplicateRequest.insertSheetIndex = input.insertIndex;
    }
    if (input.newTitle !== undefined) {
      duplicateRequest.newSheetName = input.newTitle;
    }

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ duplicateSheet: duplicateRequest }],
      },
    });

    const newSheet = response.data.replies?.[0]?.duplicateSheet?.properties;
    const sheet: SheetInfo = {
      sheetId: newSheet?.sheetId ?? 0,
      title: newSheet?.title ?? "",
      index: newSheet?.index ?? 0,
      rowCount: newSheet?.gridProperties?.rowCount ?? 0,
      columnCount: newSheet?.gridProperties?.columnCount ?? 0,
      hidden: newSheet?.hidden ?? false,
    };

    return this.success("duplicate", { sheet });
  }

  private async handleUpdate(input: SheetUpdateInput): Promise<SheetResponse> {
    // Build properties and fields mask
    const properties: sheets_v4.Schema$SheetProperties = {
      sheetId: input.sheetId,
    };
    const fields: string[] = [];

    if (input.title !== undefined) {
      properties.title = input.title;
      fields.push("title");
    }
    if (input.index !== undefined) {
      properties.index = input.index;
      fields.push("index");
    }
    if (input.hidden !== undefined) {
      properties.hidden = input.hidden;
      fields.push("hidden");
    }
    if (input.tabColor !== undefined) {
      properties.tabColor = {
        red: input.tabColor.red,
        green: input.tabColor.green,
        blue: input.tabColor.blue,
        alpha: input.tabColor.alpha,
      };
      fields.push("tabColor");
    }
    if (input.rightToLeft !== undefined) {
      properties.rightToLeft = input.rightToLeft;
      fields.push("rightToLeft");
    }

    if (fields.length === 0) {
      return this.error({
        code: "INVALID_PARAMS",
        message: "No properties to update",
        retryable: false,
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties,
              fields: fields.join(","),
            },
          },
        ],
      },
    });

    // Fetch updated sheet info
    const updated = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets.properties",
    });

    const sheetData = updated.data.sheets?.find(
      (s) => s.properties?.sheetId === input.sheetId,
    );
    if (!sheetData?.properties) {
      return this.error({
        code: "SHEET_NOT_FOUND",
        message: `Sheet ${input.sheetId} not found after update`,
        retryable: false,
      });
    }

    const sheet: SheetInfo = {
      sheetId: sheetData.properties.sheetId ?? 0,
      title: sheetData.properties.title ?? "",
      index: sheetData.properties.index ?? 0,
      rowCount: sheetData.properties.gridProperties?.rowCount ?? 0,
      columnCount: sheetData.properties.gridProperties?.columnCount ?? 0,
      hidden: sheetData.properties.hidden ?? false,
      tabColor: this.convertTabColor(sheetData.properties.tabColor),
    };

    return this.success("update", { sheet });
  }

  private async handleCopyTo(input: SheetCopyToInput): Promise<SheetResponse> {
    const response = await this.sheetsApi.spreadsheets.sheets.copyTo({
      spreadsheetId: input.spreadsheetId,
      sheetId: input.sheetId,
      requestBody: {
        destinationSpreadsheetId: input.destinationSpreadsheetId,
      },
    });

    const sheet: SheetInfo = {
      sheetId: response.data.sheetId ?? 0,
      title: response.data.title ?? "",
      index: response.data.index ?? 0,
      rowCount: response.data.gridProperties?.rowCount ?? 0,
      columnCount: response.data.gridProperties?.columnCount ?? 0,
      hidden: response.data.hidden ?? false,
    };

    return this.success("copy_to", {
      sheet,
      copiedSheetId: response.data.sheetId ?? 0,
    });
  }

  private async handleList(input: SheetListInput): Promise<SheetResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets.properties",
    });

    const sheets: SheetInfo[] = (response.data.sheets ?? []).map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? "",
      index: s.properties?.index ?? 0,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
      hidden: s.properties?.hidden ?? false,
      tabColor: this.convertTabColor(s.properties?.tabColor),
    }));

    return this.success("list", { sheets });
  }

  private async handleGet(input: SheetGetInput): Promise<SheetResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets.properties",
    });

    const sheetData = response.data.sheets?.find(
      (s) => s.properties?.sheetId === input.sheetId,
    );
    if (!sheetData?.properties) {
      return this.error({
        code: "SHEET_NOT_FOUND",
        message: `Sheet ${input.sheetId} not found`,
        retryable: false,
      });
    }

    const sheet: SheetInfo = {
      sheetId: sheetData.properties.sheetId ?? 0,
      title: sheetData.properties.title ?? "",
      index: sheetData.properties.index ?? 0,
      rowCount: sheetData.properties.gridProperties?.rowCount ?? 0,
      columnCount: sheetData.properties.gridProperties?.columnCount ?? 0,
      hidden: sheetData.properties.hidden ?? false,
      tabColor: this.convertTabColor(sheetData.properties.tabColor),
    };

    return this.success("get", { sheet });
  }

  /**
   * Convert Google API tab color to our schema format
   */
  private convertTabColor(
    tabColor: sheets_v4.Schema$Color | null | undefined,
  ): SheetInfo["tabColor"] {
    // OK: Explicit empty - typed as optional, no tab color set
    if (!tabColor) return undefined;
    return {
      red: tabColor.red ?? 0,
      green: tabColor.green ?? 0,
      blue: tabColor.blue ?? 0,
      alpha: tabColor.alpha ?? 1,
    };
  }

  /**
   * Check if a sheet exists in a spreadsheet
   */
  private async sheetExists(
    spreadsheetId: string,
    sheetId: number,
  ): Promise<boolean> {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.sheetId",
      });
      return (
        response.data.sheets?.some((s) => s.properties?.sheetId === sheetId) ??
        false
      );
    } catch {
      return false;
    }
  }
}
