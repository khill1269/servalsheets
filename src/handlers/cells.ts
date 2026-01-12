/**
 * ServalSheets - Cells Handler
 *
 * Handles sheets_cells tool (notes, validation, hyperlinks, merge, cut, copy)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import { validateHyperlinkUrl } from "../utils/url.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsCellsInput,
  SheetsCellsOutput,
  CellsResponse,
  CellsAddNoteInput,
  CellsGetNoteInput,
  CellsClearNoteInput,
  CellsSetValidationInput,
  CellsClearValidationInput,
  CellsSetHyperlinkInput,
  CellsClearHyperlinkInput,
  CellsMergeInput,
  CellsUnmergeInput,
  CellsGetMergesInput,
  CellsCutInput,
  CellsCopyInput,
} from "../schemas/index.js";
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from "../utils/google-sheets-helpers.js";
import { createRequestKey } from "../utils/request-deduplication.js";
import { confirmDestructiveAction } from "../mcp/elicitation.js";

export class CellsHandler extends BaseHandler<
  SheetsCellsInput,
  SheetsCellsOutput
> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_cells", context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsCellsInput): Promise<SheetsCellsOutput> {
    try {
      // Input is now the action directly (no request wrapper)
      // Phase 1, Task 1.4: Infer missing parameters from context
      const req = this.inferRequestParameters(input) as SheetsCellsInput;

      let response: CellsResponse;
      switch (req.action) {
        case "add_note":
          response = await this.handleAddNote(req as CellsAddNoteInput);
          break;
        case "get_note":
          response = await this.handleGetNote(req as CellsGetNoteInput);
          break;
        case "clear_note":
          response = await this.handleClearNote(req as CellsClearNoteInput);
          break;
        case "set_validation":
          response = await this.handleSetValidation(
            req as CellsSetValidationInput,
          );
          break;
        case "clear_validation":
          response = await this.handleClearValidation(
            req as CellsClearValidationInput,
          );
          break;
        case "set_hyperlink":
          response = await this.handleSetHyperlink(
            req as CellsSetHyperlinkInput,
          );
          break;
        case "clear_hyperlink":
          response = await this.handleClearHyperlink(
            req as CellsClearHyperlinkInput,
          );
          break;
        case "merge":
          response = await this.handleMerge(req as CellsMergeInput);
          break;
        case "unmerge":
          response = await this.handleUnmerge(req as CellsUnmergeInput);
          break;
        case "get_merges":
          response = await this.handleGetMerges(req as CellsGetMergesInput);
          break;
        case "cut":
          response = await this.handleCut(req as CellsCutInput);
          break;
        case "copy":
          response = await this.handleCopy(req as CellsCopyInput);
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
          range:
            "range" in req
              ? typeof req.range === "string"
                ? req.range
                : undefined
              : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsCellsInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    const req = input;
    const baseMetadata = {
      sourceTool: this.toolName,
      sourceAction: req.action,
      priority: 1,
      destructive: [
        "clear_note",
        "clear_validation",
        "clear_hyperlink",
        "cut",
      ].includes(req.action),
    };

    if ("spreadsheetId" in req && req.spreadsheetId) {
      return [
        {
          type: "UPDATE_CELLS",
          target: { spreadsheetId: req.spreadsheetId },
          payload: {},
          metadata: baseMetadata,
        },
      ];
    }
    return [];
  }

  // ============================================================
  // Note Actions
  // ============================================================

  private async handleAddNote(
    input: CellsAddNoteInput,
  ): Promise<CellsResponse> {
    const gridRange = await this.cellToGridRange(
      input.spreadsheetId,
      input.cell,
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [{ note: input.note }] }],
              fields: "note",
            },
          },
        ],
      },
    });

    return this.success("add_note", {});
  }

  private async handleGetNote(
    input: CellsGetNoteInput,
  ): Promise<CellsResponse> {
    // Create deduplication key
    const requestKey = createRequestKey("spreadsheets.get", {
      spreadsheetId: input.spreadsheetId,
      ranges: [input.cell],
      action: "get_note",
    });

    // Deduplicate the API call
    const fetchFn = async (): Promise<unknown> =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        ranges: [input.cell],
        includeGridData: true,
        fields: "sheets.data.rowData.values.note",
      });

    const response = (
      this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(
            requestKey,
            fetchFn,
          )
        : await fetchFn()
    ) as {
      data: {
        sheets?: Array<{
          data?: Array<{
            rowData?: Array<{ values?: Array<{ note?: string }> }>;
          }>;
        }>;
      };
    };

    const note =
      response.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.note ??
      "";
    return this.success("get_note", { note });
  }

  private async handleClearNote(
    input: CellsClearNoteInput,
  ): Promise<CellsResponse> {
    if (input.safety?.dryRun) {
      return this.success("clear_note", {}, undefined, true);
    }

    const gridRange = await this.cellToGridRange(
      input.spreadsheetId,
      input.cell,
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [{ note: "" }] }],
              fields: "note",
            },
          },
        ],
      },
    });

    return this.success("clear_note", {});
  }

  // ============================================================
  // Validation Actions
  // ============================================================

  private async handleSetValidation(
    input: CellsSetValidationInput,
  ): Promise<CellsResponse> {
    if (input.safety?.dryRun) {
      return this.success("set_validation", {}, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    const condition: sheets_v4.Schema$BooleanCondition = {
      type: input.validation.condition.type,
    };

    if (
      input.validation.condition.values &&
      input.validation.condition.values.length > 0
    ) {
      condition.values = input.validation.condition.values.map((v) => ({
        userEnteredValue: v,
      }));
    }

    const rule: sheets_v4.Schema$DataValidationRule = {
      condition,
      inputMessage: input.validation.inputMessage,
      strict: input.validation.strict ?? true,
      showCustomUi: input.validation.showDropdown ?? true,
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: toGridRange(gridRange),
              rule,
            },
          },
        ],
      },
    });

    return this.success("set_validation", {});
  }

  private async handleClearValidation(
    input: CellsClearValidationInput,
  ): Promise<CellsResponse> {
    if (input.safety?.dryRun) {
      return this.success("clear_validation", {}, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: toGridRange(gridRange),
              // Omitting rule clears validation
            },
          },
        ],
      },
    });

    return this.success("clear_validation", {});
  }

  // ============================================================
  // Hyperlink Actions
  // ============================================================

  private async handleSetHyperlink(
    input: CellsSetHyperlinkInput,
  ): Promise<CellsResponse> {
    const validation = validateHyperlinkUrl(input.url);
    if (!validation.ok) {
      return this.error({
        code: "INVALID_PARAMS",
        message: `Invalid hyperlink URL: ${validation.reason}`,
        retryable: false,
        suggestedFix: "Use a valid http or https URL.",
      });
    }

    const gridRange = await this.cellToGridRange(
      input.spreadsheetId,
      input.cell,
    );
    const safeUrl = this.escapeFormulaString(validation.normalized);
    const safeLabel = input.label
      ? this.escapeFormulaString(input.label)
      : undefined;
    const formula = safeLabel
      ? `=HYPERLINK("${safeUrl}","${safeLabel}")`
      : `=HYPERLINK("${safeUrl}")`;

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { formulaValue: formula },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue",
            },
          },
        ],
      },
    });

    return this.success("set_hyperlink", {});
  }

  private escapeFormulaString(value: string): string {
    return value.replace(/"/g, '""');
  }

  private async handleClearHyperlink(
    input: CellsClearHyperlinkInput,
  ): Promise<CellsResponse> {
    if (input.safety?.dryRun) {
      return this.success("clear_hyperlink", {}, undefined, true);
    }

    const gridRange = await this.cellToGridRange(
      input.spreadsheetId,
      input.cell,
    );

    // Get current displayed value first
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.cell,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const currentValue = response.data.values?.[0]?.[0] ?? "";

    // Replace formula with plain value
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { stringValue: String(currentValue) },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue",
            },
          },
        ],
      },
    });

    return this.success("clear_hyperlink", {});
  }

  // ============================================================
  // Merge Actions
  // ============================================================

  private async handleMerge(input: CellsMergeInput): Promise<CellsResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            mergeCells: {
              range: toGridRange(gridRange),
              mergeType: input.mergeType ?? "MERGE_ALL",
            },
          },
        ],
      },
    });

    return this.success("merge", {});
  }

  private async handleUnmerge(
    input: CellsUnmergeInput,
  ): Promise<CellsResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            unmergeCells: {
              range: toGridRange(gridRange),
            },
          },
        ],
      },
    });

    return this.success("unmerge", {});
  }

  private async handleGetMerges(
    input: CellsGetMergesInput,
  ): Promise<CellsResponse> {
    // Create deduplication key
    const requestKey = createRequestKey("spreadsheets.get", {
      spreadsheetId: input.spreadsheetId,
      sheetId: input.sheetId,
      action: "get_merges",
    });

    // Deduplicate the API call
    const fetchFn = async (): Promise<unknown> =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: "sheets.merges,sheets.properties.sheetId",
      });

    const response = (
      this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(
            requestKey,
            fetchFn,
          )
        : await fetchFn()
    ) as {
      data: {
        sheets?: Array<{
          properties?: { sheetId?: number };
          merges?: Array<{
            startRowIndex?: number;
            endRowIndex?: number;
            startColumnIndex?: number;
            endColumnIndex?: number;
          }>;
        }>;
      };
    };

    const sheet = response.data.sheets?.find(
      (s: { properties?: { sheetId?: number } }) =>
        s.properties?.sheetId === input.sheetId,
    );
    const merges = (sheet?.merges ?? []).map(
      (m: {
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      }) => ({
        startRow: m.startRowIndex ?? 0,
        endRow: m.endRowIndex ?? 0,
        startColumn: m.startColumnIndex ?? 0,
        endColumn: m.endColumnIndex ?? 0,
      }),
    );

    return this.success("get_merges", { merges });
  }

  // ============================================================
  // Cut/Copy Actions
  // ============================================================

  private async handleCut(input: CellsCutInput): Promise<CellsResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const sourceRows =
      (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols =
      (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);
    const estimatedCells = sourceRows * sourceCols;

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && estimatedCells > 100) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          "Cut Cells",
          `You are about to cut approximately ${estimatedCells.toLocaleString()} cells from ${rangeA1} to ${input.destination}.\n\nThe source range will be cleared and all content will be moved to the destination.`,
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: "PRECONDITION_FAILED",
            message: "Cut operation cancelled by user",
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn(
          "Elicitation failed for cut, proceeding with operation",
          { error: err },
        );
      }
    }

    if (input.safety?.dryRun) {
      return this.success("cut", {}, undefined, true);
    }

    const destParsed = parseCellReference(input.destination);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            cutPaste: {
              source: toGridRange(sourceRange),
              destination: {
                sheetId: sourceRange.sheetId,
                rowIndex: destParsed.row,
                columnIndex: destParsed.col,
              },
              pasteType: "PASTE_NORMAL",
            },
          },
        ],
      },
    });

    return this.success("cut", {});
  }

  private async handleCopy(input: CellsCopyInput): Promise<CellsResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const destParsed = parseCellReference(input.destination);

    const sourceRows =
      (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols =
      (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            copyPaste: {
              source: toGridRange(sourceRange),
              destination: toGridRange({
                sheetId: sourceRange.sheetId,
                startRowIndex: destParsed.row,
                startColumnIndex: destParsed.col,
                endRowIndex: destParsed.row + sourceRows,
                endColumnIndex: destParsed.col + sourceCols,
              }),
              pasteType: input.pasteType ?? "PASTE_NORMAL",
            },
          },
        ],
      },
    });

    return this.success("copy", {});
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async cellToGridRange(
    spreadsheetId: string,
    cell: string,
  ): Promise<GridRangeInput> {
    const parsed = parseCellReference(cell);
    const sheetId = await this.getSheetId(
      spreadsheetId,
      parsed.sheetName,
      this.sheetsApi,
    );

    return {
      sheetId,
      startRowIndex: parsed.row,
      endRowIndex: parsed.row + 1,
      startColumnIndex: parsed.col,
      endColumnIndex: parsed.col + 1,
    };
  }

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
