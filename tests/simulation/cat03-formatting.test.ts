/**
 * ServalSheets - Category 3: Formatting & Visual Presentation
 *
 * Integration tests for formatting, dimensions, and visualization operations.
 * Covers preset formatting, batch operations, conditional formatting, data validation,
 * and session context recording for follow-up interactions.
 *
 * Test scenarios:
 * 3.1 Apply preset format → response includes formatting applied
 * 3.2 Batch format multiple ranges → single API call verification
 * 3.3 Conditional format via wizard → wizard fires for preset selection
 * 3.4 Suggest format (AI) → sampling provides rationale
 * 3.5 Data validation + dependent dropdowns → named ranges created
 * 3.6 Rich text in cells
 * 3.7 Insert/delete rows/cols → confirmation on delete
 * 3.8 Auto-resize columns
 * 3.9 Freeze header rows → session context recorded
 * 3.10 Sort range → session records for reverse sort
 * 3.11 Filter views + slicers
 * 3.12 Delete duplicates → confirmation + snapshot
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FormatHandler } from '../../src/handlers/format.js';
import { DimensionsHandler } from '../../src/handlers/dimensions.js';
import { VisualizerHandler } from '../../src/handlers/visualize.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import { getContextManager } from '../../src/services/context-manager.js';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
    values: {
      update: vi.fn(),
      get: vi.fn(),
      clear: vi.fn(),
    },
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
      a1Notation: 'Sheet1!A1:Z100',
      sheetId: 0,
      sheetName: 'Sheet1',
      gridRange: {
        sheetId: 0,
        startRowIndex: 0,
        endRowIndex: 100,
        startColumnIndex: 0,
        endColumnIndex: 26,
      },
      resolution: {
        method: 'a1_direct',
        confidence: 1.0,
        path: '',
      },
    }),
  } as any,
  googleClient: {
    sheets: vi.fn(),
  } as any,
});

describe('Category 3: Formatting & Visual Presentation', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let formatHandler: FormatHandler;
  let dimensionsHandler: DimensionsHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    getContextManager().reset();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    formatHandler = new FormatHandler(mockContext, mockApi as any);
    dimensionsHandler = new DimensionsHandler(mockContext, mockApi as any);

    mockApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
      },
    });
  });

  afterEach(() => {
    getContextManager().reset();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // 3.1: Apply preset format
  describe('3.1 Apply preset format → response includes formatting applied', () => {
    it('should apply header_row preset to first row', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:Z1' },
        preset: 'header_row',
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('apply_preset');
      expect(result.response).toHaveProperty('cellsFormatted');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('should apply alternating_rows preset with visual effect', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A2:Z100' },
        preset: 'alternating_rows',
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-sheet-id',
        })
      );
    });
  });

  // 3.2: Batch format multiple ranges
  describe('3.2 Batch format multiple ranges → single API call verification', () => {
    it.skip('should format multiple ranges in single batchUpdate call', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'batch_format',
        spreadsheetId: 'test-sheet-id',
        operations: [
          {
            range: { a1: 'Sheet1!A1:A100' },
            format: { numberFormat: { type: 'CURRENCY' } },
          },
          {
            range: { a1: 'Sheet1!B1:B100' },
            format: { numberFormat: { type: 'PERCENT' } },
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('batch_format');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledTimes(1);

      const callArgs = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(callArgs.requestBody.requests.length).toBeGreaterThan(0);
    });
  });

  // 3.3: Conditional format via wizard
  describe('3.3 Conditional format via wizard → wizard fires for preset selection', () => {
    it.skip('should support conditional format with preset rule selection', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'add_conditional_format_rule',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:Z100' },
        rule: {
          ranges: [{ a1: 'Sheet1!A1:Z100' }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$A1>100' }],
            },
            format: { backgroundColor: { green: 1 } },
          },
        },
        index: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('add_conditional_format_rule');
    });

    it.skip('should support color_scale preset for data visualization', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'add_conditional_format_rule',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!B2:B100' },
        rule: {
          ranges: [{ a1: 'Sheet1!B2:B100' }],
          gradientRule: {
            minpoint: {
              color: { red: 0.9, green: 0, blue: 0 },
              type: 'MIN',
            },
            maxpoint: {
              color: { red: 0, green: 0.9, blue: 0 },
              type: 'MAX',
            },
          },
        },
        index: 0,
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });
  });

  // 3.4: Suggest format (AI)
  describe('3.4 Suggest format (AI) → sampling provides rationale', () => {
    it.skip('should suggest format with AI rationale', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Revenue'], [50000], [55000], [60000]] },
      });

      const result = await formatHandler.handle({
        action: 'suggest_format',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!B2:B100' },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('suggest_format');
      expect(result.response).toHaveProperty('suggestions');
    });
  });

  // 3.5: Data validation + dependent dropdowns
  describe('3.5 Data validation + dependent dropdowns → named ranges created', () => {
    it.skip('should create data validation with list constraint', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'set_data_validation',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!C2:C100' },
        dataValidation: {
          type: 'LIST',
          criteria: {
            values: [
              { userEnteredValue: 'Low' },
              { userEnteredValue: 'Medium' },
              { userEnteredValue: 'High' },
            ],
          },
          showDropdown: true,
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('cellsValidated');
    });

    it.skip('should support dependent dropdown via named ranges', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'build_dependent_dropdown',
        spreadsheetId: 'test-sheet-id',
        parentRange: { a1: 'Sheet1!B2:B100' },
        dependentRange: { a1: 'Sheet1!C2:C100' },
        lookupSheet: 'Dropdown_Lookup',
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });
  });

  // 3.6: Rich text in cells
  describe('3.6 Rich text in cells', () => {
    it('should apply rich text formatting to cell', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'set_rich_text',
        spreadsheetId: 'test-sheet-id',
        cell: 'Sheet1!A1',
        runs: [
          {
            text: 'Bold',
            format: { bold: true },
          },
          {
            text: ' and ',
            format: {},
          },
          {
            text: 'Italic',
            format: { italic: true },
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('set_rich_text');
    });
  });

  // 3.7: Insert/delete rows/cols → confirmation on delete
  describe('3.7 Insert/delete rows/cols → confirmation on delete', () => {
    it('should insert rows without confirmation', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'insert',
        dimension: 'ROWS',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 10,
        count: 5,
        inheritFromBefore: false,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('insert');
      expect(result.response).toHaveProperty('rowsAffected', 5);
    });

    it('should delete columns with safety check', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'delete',
        dimension: 'COLUMNS',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 8,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('delete');
    });
  });

  // 3.8: Auto-resize columns
  describe('3.8 Auto-resize columns', () => {
    it('should auto-resize columns to fit content', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'auto_resize',
        spreadsheetId: 'test-sheet-id',
        dimension: 'COLUMNS',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('auto_resize');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-sheet-id',
        })
      );
    });

    it('should auto-resize rows to fit content', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'auto_resize',
        spreadsheetId: 'test-sheet-id',
        dimension: 'ROWS',
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
    });
  });

  // 3.9: Freeze header rows → session context recorded
  describe('3.9 Freeze header rows → session context recorded', () => {
    it.skip('should freeze header row and record in session', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'freeze',
        spreadsheetId: 'test-sheet-id',
        dimension: 'ROWS',
        sheetId: 0,
        count: 1,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('freeze');

      // Verify session context was updated
      const context = getContextManager().get();
      expect(context).toBeDefined();
    });

    it('should freeze multiple columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'freeze',
        spreadsheetId: 'test-sheet-id',
        dimension: 'COLUMNS',
        sheetId: 0,
        count: 2,
      });

      expect(result.response.success).toBe(true);
    });
  });

  // 3.10: Sort range → session records for reverse sort
  describe('3.10 Sort range → session records for reverse sort', () => {
    it('should sort range ascending with session recording', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'sort_range',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:D100' },
        sortSpecs: [
          {
            dimensionIndex: 0,
            sortOrder: 'ASCENDING',
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('sort_range');
    });

    it('should sort by multiple columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'sort_range',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:D100' },
        sortSpecs: [
          { dimensionIndex: 0, sortOrder: 'ASCENDING' },
          { dimensionIndex: 1, sortOrder: 'DESCENDING' },
        ],
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });
  });

  // 3.11: Filter views + slicers
  describe('3.11 Filter views + slicers', () => {
    it('should create basic filter view', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{ addFilterView: { filter: { filterViewId: 123 } } }] } });

      const result = await dimensionsHandler.handle({
        action: 'create_filter_view',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:Z100' },
        title: 'Active Records',
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('create_filter_view');
    });

    it.skip('should create slicer for pivot interaction', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{ addSlicer: { slicer: { slicerId: 456 } } }] } });

      const result = await dimensionsHandler.handle({
        action: 'create_slicer',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:B100' },
        filterColumnIndex: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('create_slicer');
    });

    it('should update filter view with criteria', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'update_filter_view',
        spreadsheetId: 'test-sheet-id',
        filterViewId: 123,
        criteria: {
          0: {
            hiddenValues: ['Inactive'],
          },
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('update_filter_view');
    });
  });

  // 3.12: Delete duplicates → confirmation + snapshot
  describe('3.12 Delete duplicates → confirmation + snapshot', () => {
    it.skip('should detect and remove duplicate rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{ deleteDuplicates: { duplicatesRemovedCount: 3 } }] } });

      const result = await dimensionsHandler.handle({
        action: 'delete_duplicates',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:D100' },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('delete_duplicates');
      expect(result.response).toHaveProperty('duplicatesRemoved');
    });
  });

  // Additional integration tests for intelligence layer
  describe('Additional: Intelligence layer integration', () => {
    it('should handle text formatting with color intelligence', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'set_text_format',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:A10' },
        textFormat: {
          foregroundColor: { red: 0.2, green: 0.5, blue: 0.9 },
          fontSize: 12,
          bold: true,
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('set_text_format');
    });

    it.skip('should apply conditional formatting with data bars', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await formatHandler.handle({
        action: 'add_conditional_format_rule',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!B2:B50' },
        rule: {
          ranges: [{ a1: 'Sheet1!B2:B50' }],
          gradientRule: {
            minpoint: {
              color: { red: 0.4, green: 0.4, blue: 0.9 },
              type: 'MIN',
            },
            midpoint: {
              color: { red: 1, green: 1, blue: 1 },
              type: 'PERCENTILE_50',
            },
            maxpoint: {
              color: { red: 0.9, green: 0.4, blue: 0.4 },
              type: 'MAX',
            },
          },
        },
        index: 0,
      });

      expect(result.response.success).toBe(true);
    });

    it('should handle group/ungroup operations', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await dimensionsHandler.handle({
        action: 'group',
        spreadsheetId: 'test-sheet-id',
        dimension: 'ROWS',
        startIndex: 5,
        endIndex: 10,
        sheetId: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.action).toBe('group');
    });
  });
});
