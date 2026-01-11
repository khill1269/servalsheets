/**
 * ServalSheets - Rules Handler Tests
 *
 * Tests for conditional formatting and data validation operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RulesHandler } from '../../src/handlers/rules.js';
import { SheetsRulesOutputSchema } from '../../src/schemas/rules.js';
import type { HandlerContext } from '../../src/handlers/base.js';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
  },
});

// Mock handler context
const createMockContext = (): HandlerContext => ({
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
    executeAll: vi.fn(),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({
      a1Notation: 'Sheet1!A1:B10',
      sheetId: 0,
      sheetName: 'Sheet1',
    }),
  } as any,
});

describe('RulesHandler', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: RulesHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new RulesHandler(mockContext, mockApi as any);

    // Mock sheet metadata for getSheetId and range resolution
    mockApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          { properties: { sheetId: 0, title: 'Sheet1' } },
        ],
      },
    });
  });

  describe('add_conditional_format action', () => {
    it('should add boolean conditional format rule', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'A1:A10' },
        rule: {
          type: 'boolean',
          condition: {
            type: 'NUMBER_GREATER',
            values: ['100'],
          },
          format: {
            backgroundColor: { red: 1, green: 0, blue: 0 },
          },
        },
      });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'add_conditional_format');
      expect(result.response).toHaveProperty('ruleIndex', 0);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('addConditionalFormatRule');
      expect(call.requestBody.requests[0].addConditionalFormatRule.rule.booleanRule).toBeDefined();

      const parseResult = SheetsRulesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should add gradient conditional format rule', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'B1:B10' },
        rule: {
          type: 'gradient',
          minpoint: {
            type: 'MIN',
            color: { red: 0.8, green: 1, blue: 0.8 },
          },
          maxpoint: {
            type: 'MAX',
            color: { red: 1, green: 0.8, blue: 0.8 },
          },
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].addConditionalFormatRule.rule.gradientRule).toBeDefined();
    });

    it('should add gradient rule with midpoint', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'C1:C10' },
        rule: {
          type: 'gradient',
          minpoint: {
            type: 'MIN',
            color: { red: 0.8, green: 0.8, blue: 1 },
          },
          midpoint: {
            type: 'PERCENTILE',
            value: '50',
            color: { red: 1, green: 1, blue: 1 },
          },
          maxpoint: {
            type: 'MAX',
            color: { red: 1, green: 0.8, blue: 0.8 },
          },
        },
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const gradientRule = call.requestBody.requests[0].addConditionalFormatRule.rule.gradientRule;
      expect(gradientRule.midpoint).toBeDefined();
      expect(gradientRule.midpoint.value).toBe('50');
    });

    it('should support custom rule index', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'A1:A10' },
        rule: {
          type: 'boolean',
          condition: {
            type: 'TEXT_CONTAINS',
            values: ['ERROR'],
          },
          format: {
            backgroundColor: { red: 1, green: 0.9, blue: 0.9 },
            textFormat: { bold: true },
          },
        },
        index: 2,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.ruleIndex).toBe(2);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].addConditionalFormatRule.index).toBe(2);
    });
  });

  describe('update_conditional_format action', () => {
    it('should update existing conditional format rule', async () => {
      // Mock get to return existing rule
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              conditionalFormats: [
                {
                  ranges: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10 }],
                  booleanRule: {
                    condition: {
                      type: 'NUMBER_GREATER',
                      values: [{ userEnteredValue: '50' }],
                    },
                    format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
                  },
                },
              ],
            },
          ],
        },
      });

      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 0,
        rule: {
          type: 'boolean',
          condition: {
            type: 'NUMBER_GREATER',
            values: ['100'],
          },
          format: {
            backgroundColor: { red: 0, green: 1, blue: 0 },
          },
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'update_conditional_format');
      expect(result.response.ruleIndex).toBe(0);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('updateConditionalFormatRule');
    });

    it('should respect dryRun safety option', async () => {
      const result = await handler.handle({
        action: 'update_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 0,
        rule: {
          type: 'boolean',
          condition: { type: 'BLANK' },
          format: { backgroundColor: { red: 1, green: 1, blue: 0 } },
        },
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should handle rule not found', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              conditionalFormats: [],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'update_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 0,
        rule: {
          type: 'boolean',
          condition: { type: 'BLANK' },
          format: { backgroundColor: { red: 1, green: 1, blue: 0 } },
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('RANGE_NOT_FOUND');
    });

    it('should support changing rule position', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              conditionalFormats: [
                {
                  ranges: [{ sheetId: 0 }],
                  booleanRule: {
                    condition: { type: 'BLANK' },
                    format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
                  },
                },
              ],
            },
          ],
        },
      });

      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 0,
        newIndex: 2,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.ruleIndex).toBe(2);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].updateConditionalFormatRule.newIndex).toBe(2);
    });
  });

  describe('delete_conditional_format action', () => {
    it('should delete conditional format rule', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'delete_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 1,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'delete_conditional_format');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('deleteConditionalFormatRule');
      expect(call.requestBody.requests[0].deleteConditionalFormatRule.index).toBe(1);
    });

    it('should respect dryRun for destructive operation', async () => {
      const result = await handler.handle({
        action: 'delete_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 0,
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('list_conditional_formats action', () => {
    it('should list all conditional format rules in a sheet', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              conditionalFormats: [
                {
                  ranges: [
                    { sheetId: 0, startRowIndex: 0, endRowIndex: 10 },
                  ],
                  booleanRule: {
                    condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '100' }] },
                    format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
                  },
                },
                {
                  ranges: [
                    { sheetId: 0, startRowIndex: 0, endRowIndex: 10 },
                  ],
                  gradientRule: {
                    minpoint: { type: 'MIN', color: { red: 0.8, green: 1, blue: 0.8 } },
                    maxpoint: { type: 'MAX', color: { red: 1, green: 0.8, blue: 0.8 } },
                  },
                },
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list_conditional_formats',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.rules).toBeDefined();
      expect(result.response.rules).toHaveLength(2);
      expect(result.response.rules![0].type).toBe('boolean');
      expect(result.response.rules![1].type).toBe('gradient');
      expect(result.response.rules![0].index).toBe(0);
      expect(result.response.rules![1].index).toBe(1);
    });

    it('should handle empty rules list', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              conditionalFormats: [],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list_conditional_formats',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.rules).toHaveLength(0);
    });

    it('should truncate large rule lists with pagination', async () => {
      // Create 60 mock rules (exceeds 50 limit)
      const mockRules = Array(60).fill(null).map((_, i) => ({
        ranges: [{ sheetId: 0, startRowIndex: i, endRowIndex: i + 1 }],
        booleanRule: {
          condition: { type: 'BLANK' },
          format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
        },
      }));

      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              conditionalFormats: mockRules,
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list_conditional_formats',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.rules).toHaveLength(50);
      expect(result.response.truncated).toBe(true);
      expect(result.response.totalCount).toBe(60);
    });
  });

  describe('add_data_validation action', () => {
    it('should add data validation rule', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_data_validation',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'A1:A10' },
        condition: {
          type: 'ONE_OF_LIST',
          values: ['Option 1', 'Option 2', 'Option 3'],
        },
        inputMessage: 'Please select a valid option',
        strict: true,
        showDropdown: true,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'add_data_validation');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('setDataValidation');
      const validation = call.requestBody.requests[0].setDataValidation.rule;
      expect(validation.condition.type).toBe('ONE_OF_LIST');
      expect(validation.condition.values).toHaveLength(3);
      expect(validation.strict).toBe(true);
      expect(validation.showCustomUi).toBe(true);
      expect(validation.inputMessage).toBe('Please select a valid option');
    });

    it('should add number range validation', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_data_validation',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'B1:B10' },
        condition: {
          type: 'NUMBER_BETWEEN',
          values: ['0', '100'],
        },
        strict: true,
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const validation = call.requestBody.requests[0].setDataValidation.rule;
      expect(validation.condition.type).toBe('NUMBER_BETWEEN');
      expect(validation.condition.values).toHaveLength(2);
    });

    it('should add date validation', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_data_validation',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'C1:C10' },
        condition: {
          type: 'DATE_AFTER',
          values: ['2024-01-01'],
        },
        inputMessage: 'Enter a date after January 1, 2024',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].setDataValidation.rule.condition.type).toBe('DATE_AFTER');
    });
  });

  describe('clear_data_validation action', () => {
    it('should clear data validation from range', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'clear_data_validation',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'A1:A10' },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'clear_data_validation');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('setDataValidation');
      // Rule should be undefined/omitted to clear validation
      expect(call.requestBody.requests[0].setDataValidation.rule).toBeUndefined();
    });

    it('should respect dryRun for destructive operation', async () => {
      const result = await handler.handle({
        action: 'clear_data_validation',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'A1:A10' },
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('list_data_validations action', () => {
    it('should list data validations in a sheet', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              data: [
                {
                  rowData: [
                    {
                      values: [
                        {
                          dataValidation: {
                            condition: {
                              type: 'ONE_OF_LIST',
                              values: [
                                { userEnteredValue: 'A' },
                                { userEnteredValue: 'B' },
                              ],
                            },
                          },
                        },
                      ],
                    },
                    {
                      values: [
                        {
                          dataValidation: {
                            condition: {
                              type: 'NUMBER_GREATER',
                              values: [{ userEnteredValue: '0' }],
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list_data_validations',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.validations).toBeDefined();
      expect(result.response.validations).toHaveLength(2);
      expect(result.response.validations![0].condition.type).toBe('ONE_OF_LIST');
      expect(result.response.validations![1].condition.type).toBe('NUMBER_GREATER');
    });

    it('should handle sheet with no validations', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0 },
              data: [{ rowData: [] }],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list_data_validations',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.validations).toHaveLength(0);
    });
  });

  describe('add_preset_rule action', () => {
    it('should add highlight_duplicates preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'A1:A100' },
        preset: 'highlight_duplicates',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'add_preset_rule');
      expect(result.response.ruleIndex).toBe(0);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const rule = call.requestBody.requests[0].addConditionalFormatRule.rule;
      expect(rule.booleanRule.condition.type).toBe('CUSTOM_FORMULA');
    });

    it('should add highlight_blanks preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'B1:B100' },
        preset: 'highlight_blanks',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].addConditionalFormatRule.rule.booleanRule.condition.type).toBe('BLANK');
    });

    it('should add color_scale_green_red preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'C1:C100' },
        preset: 'color_scale_green_red',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const rule = call.requestBody.requests[0].addConditionalFormatRule.rule;
      expect(rule.gradientRule).toBeDefined();
      expect(rule.gradientRule.minpoint.type).toBe('MIN');
      expect(rule.gradientRule.maxpoint.type).toBe('MAX');
    });

    it('should add data_bars preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'D1:D100' },
        preset: 'data_bars',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].addConditionalFormatRule.rule.gradientRule).toBeDefined();
    });

    it('should add top_10_percent preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'E1:E100' },
        preset: 'top_10_percent',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const rule = call.requestBody.requests[0].addConditionalFormatRule.rule;
      expect(rule.booleanRule.condition.type).toBe('CUSTOM_FORMULA');
      expect(rule.booleanRule.condition.values[0].userEnteredValue).toContain('PERCENTILE');
      expect(rule.booleanRule.condition.values[0].userEnteredValue).toContain('0.9');
    });

    it('should add above_average preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'F1:F100' },
        preset: 'above_average',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const formula = call.requestBody.requests[0].addConditionalFormatRule.rule.booleanRule.condition.values[0].userEnteredValue;
      expect(formula).toContain('AVERAGE');
    });

    it('should error on unknown preset', async () => {
      const result = await handler.handle({
        action: 'add_preset_rule',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'A1:A100' },
        preset: 'invalid_preset' as any,
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(
        new Error('API Error: 403 Permission denied')
      );

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'A1:A10' },
        rule: {
          type: 'boolean',
          condition: { type: 'BLANK' },
          format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBeDefined();
    });

    it('should validate schema compliance for errors', async () => {
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(new Error('Test error'));

      const result = await handler.handle({
        action: 'delete_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        ruleIndex: 0,
      });

      const parseResult = SheetsRulesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle unknown action', async () => {
      const result = await handler.handle({
        action: 'invalid_action',
        spreadsheetId: 'test-sheet-id',
      } as any);

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('range resolution', () => {
    it('should resolve grid range from A1 notation', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { a1: 'A1:B10' },
        rule: {
          type: 'boolean',
          condition: { type: 'NOT_BLANK' },
          format: { backgroundColor: { red: 0.9, green: 1, blue: 0.9 } },
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('should resolve named range', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          namedRanges: [
            {
              name: 'MyRange',
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 10,
                startColumnIndex: 0,
                endColumnIndex: 5,
              },
            },
          ],
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: { namedRange: 'MyRange' },
        rule: {
          type: 'boolean',
          condition: { type: 'BLANK' },
          format: { backgroundColor: { red: 1, green: 1, blue: 0.8 } },
        },
      });

      expect(result.response.success).toBe(true);
    });

    it('should resolve grid range directly', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'add_conditional_format',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        range: {
          grid: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 10,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
        },
        rule: {
          type: 'boolean',
          condition: { type: 'TEXT_IS_EMAIL' },
          format: { textFormat: { italic: true } },
        },
      });

      expect(result.response.success).toBe(true);
    });
  });
});
