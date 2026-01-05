/**
 * ServalSheets - Rules Handler
 * 
 * Handles sheets_rules tool (conditional formatting & data validation)
 * MCP Protocol: 2025-11-25
 * 
 * 8 Actions:
 * - add_conditional_format, update_conditional_format, delete_conditional_format, list_conditional_formats
 * - add_data_validation, clear_data_validation, list_data_validations
 * - add_preset_rule
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsRulesInput,
  SheetsRulesOutput,
  RulesAction,
  RulesResponse,
} from '../schemas/index.js';
import { parseA1Notation, toGridRange, type GridRangeInput } from '../utils/google-sheets-helpers.js';
import { RangeResolutionError } from '../core/range-resolver.js';

// Valid condition types from schema
type ConditionType = 
  | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ'
  | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN'
  | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH'
  | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE'
  | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN'
  | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST'
  | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN';

export class RulesHandler extends BaseHandler<SheetsRulesInput, SheetsRulesOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_rules', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsRulesInput): Promise<SheetsRulesOutput> {
    try {
      const req = input.request;
      let response: RulesResponse;
      switch (req.action) {
        case 'add_conditional_format':
          response = await this.handleAddConditionalFormat(req);
          break;
        case 'update_conditional_format':
          response = await this.handleUpdateConditionalFormat(req);
          break;
        case 'delete_conditional_format':
          response = await this.handleDeleteConditionalFormat(req);
          break;
        case 'list_conditional_formats':
          response = await this.handleListConditionalFormats(req);
          break;
        case 'add_data_validation':
          response = await this.handleAddDataValidation(req);
          break;
        case 'clear_data_validation':
          response = await this.handleClearDataValidation(req);
          break;
        case 'list_data_validations':
          response = await this.handleListDataValidations(req);
          break;
        case 'add_preset_rule':
          response = await this.handleAddPresetRule(req);
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

  protected createIntents(input: SheetsRulesInput): Intent[] {
    const req = input.request;
    const destructiveActions = ['update_conditional_format', 'delete_conditional_format', 'clear_data_validation'];
    return [{
      type: 'UPDATE_CONDITIONAL_FORMAT',
      target: { spreadsheetId: req.spreadsheetId },
      payload: {},
      metadata: {
        sourceTool: this.toolName,
        sourceAction: req.action,
        priority: 1,
        destructive: destructiveActions.includes(req.action),
      },
    }];
  }

  // ============================================================
  // Conditional Format Actions
  // ============================================================

  private async handleAddConditionalFormat(
    input: Extract<RulesAction, { action: 'add_conditional_format' }>
  ): Promise<RulesResponse> {
    const gridRange = await this.resolveGridRange(input.spreadsheetId, input.sheetId, input.range);
    
    let rule: sheets_v4.Schema$ConditionalFormatRule;
    
    if (input.rule.type === 'boolean') {
      rule = {
        ranges: [toGridRange(gridRange)],
        booleanRule: {
          condition: {
            type: input.rule.condition.type,
            values: input.rule.condition.values?.map(v => ({ userEnteredValue: v })),
          },
          format: {
            backgroundColor: input.rule.format.backgroundColor,
            textFormat: input.rule.format.textFormat,
          },
        },
      };
    } else {
      // Gradient rule
      rule = {
        ranges: [toGridRange(gridRange)],
        gradientRule: {
          minpoint: {
            type: input.rule.minpoint.type,
            value: input.rule.minpoint.value,
            color: input.rule.minpoint.color,
          },
          midpoint: input.rule.midpoint ? {
            type: input.rule.midpoint.type,
            value: input.rule.midpoint.value,
            color: input.rule.midpoint.color,
          } : undefined,
          maxpoint: {
            type: input.rule.maxpoint.type,
            value: input.rule.maxpoint.value,
            color: input.rule.maxpoint.color,
          },
        },
      };
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addConditionalFormatRule: {
            rule,
            index: input.index ?? 0,
          },
        }],
      },
    });

    return this.success('add_conditional_format', { ruleIndex: input.index ?? 0 });
  }

  private async handleUpdateConditionalFormat(
    input: Extract<RulesAction, { action: 'update_conditional_format' }>
  ): Promise<RulesResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_conditional_format', { ruleIndex: input.ruleIndex }, undefined, true);
    }

    // Get current rule to modify
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.conditionalFormats',
    });

    const sheet = response.data.sheets?.find(s => s.properties?.sheetId === input.sheetId);
    const currentRule = sheet?.conditionalFormats?.[input.ruleIndex];
    
    if (!currentRule) {
      return this.error({
        code: 'RANGE_NOT_FOUND',
        message: `Conditional format rule at index ${input.ruleIndex} not found`,
        retryable: false,
      });
    }

    if (input.rule) {
      if (input.rule.type === 'boolean') {
        currentRule.booleanRule = {
          condition: {
            type: input.rule.condition.type,
            values: input.rule.condition.values?.map(v => ({ userEnteredValue: v })),
          },
          format: {
            backgroundColor: input.rule.format.backgroundColor,
            textFormat: input.rule.format.textFormat,
          },
        };
      } else {
        currentRule.gradientRule = {
          minpoint: {
            type: input.rule.minpoint.type,
            value: input.rule.minpoint.value,
            color: input.rule.minpoint.color,
          },
          midpoint: input.rule.midpoint ? {
            type: input.rule.midpoint.type,
            value: input.rule.midpoint.value,
            color: input.rule.midpoint.color,
          } : undefined,
          maxpoint: {
            type: input.rule.maxpoint.type,
            value: input.rule.maxpoint.value,
            color: input.rule.maxpoint.color,
          },
        };
      }
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateConditionalFormatRule: {
            rule: currentRule,
            index: input.ruleIndex,
            sheetId: input.sheetId,
            newIndex: input.newIndex,
          },
        }],
      },
    });

    return this.success('update_conditional_format', { ruleIndex: input.newIndex ?? input.ruleIndex });
  }

  private async handleDeleteConditionalFormat(
    input: Extract<RulesAction, { action: 'delete_conditional_format' }>
  ): Promise<RulesResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_conditional_format', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteConditionalFormatRule: {
            sheetId: input.sheetId,
            index: input.ruleIndex,
          },
        }],
      },
    });

    return this.success('delete_conditional_format', {});
  }

  private async handleListConditionalFormats(
    input: Extract<RulesAction, { action: 'list_conditional_formats' }>
  ): Promise<RulesResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.conditionalFormats,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find(s => s.properties?.sheetId === input.sheetId);
    const rules = (sheet?.conditionalFormats ?? []).map((rule, index) => ({
      index,
      type: rule.booleanRule ? 'boolean' : 'gradient',
      ranges: (rule.ranges ?? []).map(r => ({
        sheetId: r.sheetId ?? 0,
        startRowIndex: r.startRowIndex ?? undefined,
        endRowIndex: r.endRowIndex ?? undefined,
        startColumnIndex: r.startColumnIndex ?? undefined,
        endColumnIndex: r.endColumnIndex ?? undefined,
      })),
    }));

    return this.success('list_conditional_formats', { rules });
  }

  // ============================================================
  // Data Validation Actions
  // ============================================================

  private async handleAddDataValidation(
    input: Extract<RulesAction, { action: 'add_data_validation' }>
  ): Promise<RulesResponse> {
    const gridRange = await this.resolveRangeInput(input.spreadsheetId, input.range);

    const condition: sheets_v4.Schema$BooleanCondition = {
      type: input.condition.type,
    };
    
    if (input.condition.values && input.condition.values.length > 0) {
      condition.values = input.condition.values.map(v => ({ userEnteredValue: v }));
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          setDataValidation: {
            range: toGridRange(gridRange),
            rule: {
              condition,
              inputMessage: input.inputMessage,
              strict: input.strict ?? true,
              showCustomUi: input.showDropdown ?? true,
            },
          },
        }],
      },
    });

    return this.success('add_data_validation', {});
  }

  private async handleClearDataValidation(
    input: Extract<RulesAction, { action: 'clear_data_validation' }>
  ): Promise<RulesResponse> {
    if (input.safety?.dryRun) {
      return this.success('clear_data_validation', {}, undefined, true);
    }

    const gridRange = await this.resolveRangeInput(input.spreadsheetId, input.range);

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

    return this.success('clear_data_validation', {});
  }

  private async handleListDataValidations(
    input: Extract<RulesAction, { action: 'list_data_validations' }>
  ): Promise<RulesResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      ranges: [],
      includeGridData: true,
      fields: 'sheets.data.rowData.values.dataValidation,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find(s => s.properties?.sheetId === input.sheetId);
    const validations: Array<{
      range: { sheetId: number; startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number };
      condition: { type: ConditionType; values?: string[] };
    }> = [];

    // Extract validations from grid data
    sheet?.data?.forEach((data) => {
      data.rowData?.forEach((row, rowIdx) => {
        row.values?.forEach((cell, colIdx) => {
          if (cell.dataValidation?.condition) {
            const condType = cell.dataValidation.condition.type as ConditionType;
            validations.push({
              range: {
                sheetId: input.sheetId,
                startRowIndex: rowIdx,
                endRowIndex: rowIdx + 1,
                startColumnIndex: colIdx,
                endColumnIndex: colIdx + 1,
              },
              condition: {
                type: condType,
                values: cell.dataValidation.condition.values?.map(v => v.userEnteredValue ?? ''),
              },
            });
          }
        });
      });
    });

    return this.success('list_data_validations', { validations });
  }

  // ============================================================
  // Preset Rules
  // ============================================================

  private async handleAddPresetRule(
    input: Extract<RulesAction, { action: 'add_preset_rule' }>
  ): Promise<RulesResponse> {
    const gridRange = await this.resolveGridRange(input.spreadsheetId, input.sheetId, input.range);
    const googleRange = toGridRange(gridRange);
    
    let request: sheets_v4.Schema$Request;

    switch (input.preset) {
      case 'highlight_duplicates':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=COUNTIF($A:$A,A1)>1' }] },
                format: { backgroundColor: { red: 1, green: 0.9, blue: 0.9 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'highlight_blanks':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'BLANK' },
                format: { backgroundColor: { red: 1, green: 1, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'highlight_errors':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISERROR(A1)' }] },
                format: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'color_scale_green_red':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: { type: 'MIN', color: { red: 0.8, green: 1, blue: 0.8 } },
                maxpoint: { type: 'MAX', color: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'color_scale_blue_red':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: { type: 'MIN', color: { red: 0.8, green: 0.8, blue: 1 } },
                maxpoint: { type: 'MAX', color: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'data_bars':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: { type: 'MIN', color: { red: 1, green: 1, blue: 1 } },
                maxpoint: { type: 'MAX', color: { red: 0.2, green: 0.6, blue: 0.9 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'top_10_percent':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=A1>=PERCENTILE($A:$A,0.9)' }] },
                format: { backgroundColor: { red: 0.8, green: 1, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'bottom_10_percent':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=A1<=PERCENTILE($A:$A,0.1)' }] },
                format: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'above_average':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=A1>AVERAGE($A:$A)' }] },
                format: { backgroundColor: { red: 0.8, green: 1, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'below_average':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=A1<AVERAGE($A:$A)' }] },
                format: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown preset: ${input.preset}`,
          retryable: false,
        });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests: [request] },
    });

    return this.success('add_preset_rule', { ruleIndex: 0 });
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async resolveGridRange(
    spreadsheetId: string,
    sheetId: number,
    range: { a1?: string } | { namedRange?: string } | { semantic?: unknown } | { grid?: unknown }
  ): Promise<GridRangeInput> {
    if ('a1' in range && range.a1) {
      const parsed = parseA1Notation(range.a1);
      return {
        sheetId,
        startRowIndex: parsed.startRow,
        endRowIndex: parsed.endRow,
        startColumnIndex: parsed.startCol,
        endColumnIndex: parsed.endCol,
      };
    }
    
    if ('grid' in range && range.grid) {
      const grid = range.grid as { sheetId: number; startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number };
      return {
        sheetId: grid.sheetId ?? sheetId,
        startRowIndex: grid.startRowIndex,
        endRowIndex: grid.endRowIndex,
        startColumnIndex: grid.startColumnIndex,
        endColumnIndex: grid.endColumnIndex,
      };
    }
    
    // For named ranges, resolve via API
    if ('namedRange' in range && range.namedRange) {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'namedRanges',
      });
      
      const namedRange = response.data.namedRanges?.find(nr => nr.name === range.namedRange);
      if (namedRange?.range) {
        return {
          sheetId: namedRange.range.sheetId ?? sheetId,
          startRowIndex: namedRange.range.startRowIndex ?? 0,
          endRowIndex: namedRange.range.endRowIndex ?? 1000,
          startColumnIndex: namedRange.range.startColumnIndex ?? 0,
          endColumnIndex: namedRange.range.endColumnIndex ?? 26,
        };
      }
    }

    throw new RangeResolutionError(
      'Could not resolve range - ambiguous input',
      'RANGE_RESOLUTION_FAILED',
      { input: range, spreadsheetId, sheetId },
      false
    );
  }

  private async resolveRangeInput(
    spreadsheetId: string,
    range: { a1?: string } | { namedRange?: string } | { semantic?: unknown } | { grid?: unknown }
  ): Promise<GridRangeInput> {
    if ('a1' in range && range.a1) {
      const parsed = parseA1Notation(range.a1);
      const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);
      return {
        sheetId,
        startRowIndex: parsed.startRow,
        endRowIndex: parsed.endRow,
        startColumnIndex: parsed.startCol,
        endColumnIndex: parsed.endCol,
      };
    }
    
    if ('grid' in range && range.grid) {
      const grid = range.grid as { sheetId: number; startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number };
      return {
        sheetId: grid.sheetId,
        startRowIndex: grid.startRowIndex,
        endRowIndex: grid.endRowIndex,
        startColumnIndex: grid.startColumnIndex,
        endColumnIndex: grid.endColumnIndex,
      };
    }
    
    // For named ranges, resolve via API
    if ('namedRange' in range && range.namedRange) {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'namedRanges',
      });
      
      const namedRange = response.data.namedRanges?.find(nr => nr.name === range.namedRange);
      if (namedRange?.range) {
        return {
          sheetId: namedRange.range.sheetId ?? 0,
          startRowIndex: namedRange.range.startRowIndex ?? 0,
          endRowIndex: namedRange.range.endRowIndex ?? 1000,
          startColumnIndex: namedRange.range.startColumnIndex ?? 0,
          endColumnIndex: namedRange.range.endColumnIndex ?? 26,
        };
      }
    }

    throw new RangeResolutionError(
      'Could not resolve range - ambiguous input',
      'RANGE_RESOLUTION_FAILED',
      { input: range, spreadsheetId },
      false
    );
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
      throw new RangeResolutionError(
        `Sheet "${sheetName}" not found`,
        'SHEET_NOT_FOUND',
        { sheetName, spreadsheetId },
        false
      );
    }

    return sheet.properties?.sheetId ?? 0;
  }
}
