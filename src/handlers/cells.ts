/**
 * ServalSheets - Cells Handler
 * 
 * Handles sheets_cells tool (notes, validation, hyperlinks, merge, cut, copy)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import { validateHyperlinkUrl } from '../utils/url.js';
import type { Intent } from '../core/intent.js';
import type { SheetsCellsInput, SheetsCellsOutput } from '../schemas/index.js';
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-api.js';

export class CellsHandler extends BaseHandler<SheetsCellsInput, SheetsCellsOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_cells', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsCellsInput): Promise<SheetsCellsOutput> {
    try {
      switch (input.action) {
        case 'add_note':
          return await this.handleAddNote(input);
        case 'get_note':
          return await this.handleGetNote(input);
        case 'clear_note':
          return await this.handleClearNote(input);
        case 'set_validation':
          return await this.handleSetValidation(input);
        case 'clear_validation':
          return await this.handleClearValidation(input);
        case 'set_hyperlink':
          return await this.handleSetHyperlink(input);
        case 'clear_hyperlink':
          return await this.handleClearHyperlink(input);
        case 'merge':
          return await this.handleMerge(input);
        case 'unmerge':
          return await this.handleUnmerge(input);
        case 'get_merges':
          return await this.handleGetMerges(input);
        case 'cut':
          return await this.handleCut(input);
        case 'copy':
          return await this.handleCopy(input);
        default:
          return this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(input as { action: string }).action}`,
            retryable: false,
          });
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  protected createIntents(input: SheetsCellsInput): Intent[] {
    const baseMetadata = {
      sourceTool: this.toolName,
      sourceAction: input.action,
      priority: 1,
      destructive: ['clear_note', 'clear_validation', 'clear_hyperlink', 'cut'].includes(input.action),
    };

    if ('spreadsheetId' in input) {
      return [{
        type: 'UPDATE_CELLS',
        target: { spreadsheetId: input.spreadsheetId },
        payload: {},
        metadata: baseMetadata,
      }];
    }
    return [];
  }

  // ============================================================
  // Note Actions
  // ============================================================

  private async handleAddNote(
    input: Extract<SheetsCellsInput, { action: 'add_note' }>
  ): Promise<SheetsCellsOutput> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: toGridRange(gridRange),
            rows: [{ values: [{ note: input.note }] }],
            fields: 'note',
          },
        }],
      },
    });

    return this.success('add_note', {});
  }

  private async handleGetNote(
    input: Extract<SheetsCellsInput, { action: 'get_note' }>
  ): Promise<SheetsCellsOutput> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      ranges: [input.cell],
      includeGridData: true,
      fields: 'sheets.data.rowData.values.note',
    });

    const note = response.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.note ?? '';
    return this.success('get_note', { note });
  }

  private async handleClearNote(
    input: Extract<SheetsCellsInput, { action: 'clear_note' }>
  ): Promise<SheetsCellsOutput> {
    if (input.safety?.dryRun) {
      return this.success('clear_note', {}, undefined, true);
    }

    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: toGridRange(gridRange),
            rows: [{ values: [{ note: '' }] }],
            fields: 'note',
          },
        }],
      },
    });

    return this.success('clear_note', {});
  }

  // ============================================================
  // Validation Actions
  // ============================================================

  private async handleSetValidation(
    input: Extract<SheetsCellsInput, { action: 'set_validation' }>
  ): Promise<SheetsCellsOutput> {
    if (input.safety?.dryRun) {
      return this.success('set_validation', {}, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    
    const condition: sheets_v4.Schema$BooleanCondition = {
      type: input.validation.condition.type,
    };
    
    if (input.validation.condition.values && input.validation.condition.values.length > 0) {
      condition.values = input.validation.condition.values.map(v => ({ userEnteredValue: v }));
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
        requests: [{
          setDataValidation: {
            range: toGridRange(gridRange),
            rule,
          },
        }],
      },
    });

    return this.success('set_validation', {});
  }

  private async handleClearValidation(
    input: Extract<SheetsCellsInput, { action: 'clear_validation' }>
  ): Promise<SheetsCellsOutput> {
    if (input.safety?.dryRun) {
      return this.success('clear_validation', {}, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          setDataValidation: {
            range: toGridRange(gridRange),
            // Omitting rule clears validation
          },
        }],
      },
    });

    return this.success('clear_validation', {});
  }

  // ============================================================
  // Hyperlink Actions
  // ============================================================

  private async handleSetHyperlink(
    input: Extract<SheetsCellsInput, { action: 'set_hyperlink' }>
  ): Promise<SheetsCellsOutput> {
    const validation = validateHyperlinkUrl(input.url);
    if (!validation.ok) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Invalid hyperlink URL: ${validation.reason}`,
        retryable: false,
        suggestedFix: 'Use a valid http or https URL.',
      });
    }

    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);
    const safeUrl = this.escapeFormulaString(validation.normalized);
    const safeLabel = input.label ? this.escapeFormulaString(input.label) : undefined;
    const formula = safeLabel
      ? `=HYPERLINK("${safeUrl}","${safeLabel}")`
      : `=HYPERLINK("${safeUrl}")`;

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: toGridRange(gridRange),
            rows: [{
              values: [{
                userEnteredValue: { formulaValue: formula },
              }],
            }],
            fields: 'userEnteredValue',
          },
        }],
      },
    });

    return this.success('set_hyperlink', {});
  }

  private escapeFormulaString(value: string): string {
    return value.replace(/"/g, '""');
  }

  private async handleClearHyperlink(
    input: Extract<SheetsCellsInput, { action: 'clear_hyperlink' }>
  ): Promise<SheetsCellsOutput> {
    if (input.safety?.dryRun) {
      return this.success('clear_hyperlink', {}, undefined, true);
    }

    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    // Get current displayed value first
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.cell,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const currentValue = response.data.values?.[0]?.[0] ?? '';

    // Replace formula with plain value
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: toGridRange(gridRange),
            rows: [{
              values: [{
                userEnteredValue: { stringValue: String(currentValue) },
              }],
            }],
            fields: 'userEnteredValue',
          },
        }],
      },
    });

    return this.success('clear_hyperlink', {});
  }

  // ============================================================
  // Merge Actions
  // ============================================================

  private async handleMerge(
    input: Extract<SheetsCellsInput, { action: 'merge' }>
  ): Promise<SheetsCellsOutput> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          mergeCells: {
            range: toGridRange(gridRange),
            mergeType: input.mergeType ?? 'MERGE_ALL',
          },
        }],
      },
    });

    return this.success('merge', {});
  }

  private async handleUnmerge(
    input: Extract<SheetsCellsInput, { action: 'unmerge' }>
  ): Promise<SheetsCellsOutput> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          unmergeCells: {
            range: toGridRange(gridRange),
          },
        }],
      },
    });

    return this.success('unmerge', {});
  }

  private async handleGetMerges(
    input: Extract<SheetsCellsInput, { action: 'get_merges' }>
  ): Promise<SheetsCellsOutput> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.merges,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find(s => s.properties?.sheetId === input.sheetId);
    const merges = (sheet?.merges ?? []).map(m => ({
      startRow: m.startRowIndex ?? 0,
      endRow: m.endRowIndex ?? 0,
      startColumn: m.startColumnIndex ?? 0,
      endColumn: m.endColumnIndex ?? 0,
    }));

    return this.success('get_merges', { merges });
  }

  // ============================================================
  // Cut/Copy Actions
  // ============================================================

  private async handleCut(
    input: Extract<SheetsCellsInput, { action: 'cut' }>
  ): Promise<SheetsCellsOutput> {
    if (input.safety?.dryRun) {
      return this.success('cut', {}, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const destParsed = parseCellReference(input.destination);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          cutPaste: {
            source: toGridRange(sourceRange),
            destination: {
              sheetId: sourceRange.sheetId,
              rowIndex: destParsed.row,
              columnIndex: destParsed.col,
            },
            pasteType: 'PASTE_NORMAL',
          },
        }],
      },
    });

    return this.success('cut', {});
  }

  private async handleCopy(
    input: Extract<SheetsCellsInput, { action: 'copy' }>
  ): Promise<SheetsCellsOutput> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const destParsed = parseCellReference(input.destination);

    const sourceRows = (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols = (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          copyPaste: {
            source: toGridRange(sourceRange),
            destination: toGridRange({
              sheetId: sourceRange.sheetId,
              startRowIndex: destParsed.row,
              startColumnIndex: destParsed.col,
              endRowIndex: destParsed.row + sourceRows,
              endColumnIndex: destParsed.col + sourceCols,
            }),
            pasteType: input.pasteType ?? 'PASTE_NORMAL',
          },
        }],
      },
    });

    return this.success('copy', {});
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async cellToGridRange(spreadsheetId: string, cell: string): Promise<GridRangeInput> {
    const parsed = parseCellReference(cell);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);

    return {
      sheetId,
      startRowIndex: parsed.row,
      endRowIndex: parsed.row + 1,
      startColumnIndex: parsed.col,
      endColumnIndex: parsed.col + 1,
    };
  }

  private async a1ToGridRange(spreadsheetId: string, a1: string): Promise<GridRangeInput> {
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

    const sheet = sheets.find(s => s.properties?.title === sheetName);
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    return sheet.properties?.sheetId ?? 0;
  }
}
