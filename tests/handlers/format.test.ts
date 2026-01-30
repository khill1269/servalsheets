/**
 * ServalSheets - Format Handler Tests
 *
 * Tests for cell formatting operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FormatHandler } from '../../src/handlers/format.js';
import { SheetsFormatOutputSchema } from '../../src/schemas/format.js';
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
      a1Notation: 'Sheet1!A1:B2',
      sheetId: 0,
      sheetName: 'Sheet1',
      gridRange: {
        sheetId: 0,
        startRowIndex: 0,
        endRowIndex: 2,
        startColumnIndex: 0,
        endColumnIndex: 2,
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

describe('FormatHandler', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: FormatHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new FormatHandler(mockContext, mockApi as any);

    // Mock sheet metadata for getSheetId
    mockApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('set_format action', () => {
    it('should apply comprehensive cell formatting', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        format: {
          backgroundColor: { red: 1, green: 0, blue: 0 },
          textFormat: { bold: true },
        },
      });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'set_format');
      expect(result.response).toHaveProperty('cellsFormatted');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const parseResult = SheetsFormatOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should respect dryRun safety option', async () => {
      const result = await handler.handle({
        action: 'set_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should handle multiple format properties', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        format: {
          backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
          textFormat: { bold: true, italic: true, fontSize: 12 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP',
        },
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].repeatCell.fields).toContain('backgroundColor');
      expect(call.requestBody.requests[0].repeatCell.fields).toContain('textFormat');
    });
  });

  describe('set_background action', () => {
    it('should set background color', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_background',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        color: { red: 1, green: 1, blue: 0 },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('cellsFormatted');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].repeatCell.fields).toBe(
        'userEnteredFormat.backgroundColor'
      );
    });
  });

  describe('set_text_format action', () => {
    it('should set text formatting', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_text_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        textFormat: {
          bold: true,
          italic: false,
          fontSize: 14,
          fontFamily: 'Arial',
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(
        call.requestBody.requests[0].repeatCell.cell.userEnteredFormat.textFormat
      ).toMatchObject({
        bold: true,
        italic: false,
        fontSize: 14,
      });
    });
  });

  describe('set_number_format action', () => {
    it('should set number format', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_number_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        numberFormat: {
          type: 'CURRENCY',
          pattern: '$#,##0.00',
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(
        call.requestBody.requests[0].repeatCell.cell.userEnteredFormat.numberFormat
      ).toMatchObject({
        type: 'CURRENCY',
        pattern: '$#,##0.00',
      });
    });
  });

  describe('set_alignment action', () => {
    it('should set horizontal and vertical alignment', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_alignment',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        horizontal: 'CENTER',
        vertical: 'MIDDLE',
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('should set wrap strategy', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_alignment',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        wrapStrategy: 'WRAP',
      });

      expect(result.response.success).toBe(true);
    });

    it('should error when no alignment properties specified', async () => {
      const result = await handler.handle({
        action: 'set_alignment',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('set_borders action', () => {
    it('should set cell borders', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const borderStyle = {
        style: 'SOLID' as const,
        color: { red: 0, green: 0, blue: 0 },
      };

      const result = await handler.handle({
        action: 'set_borders',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle,
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('updateBorders');
    });

    it('should set inner borders', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const borderStyle = {
        style: 'DOTTED' as const,
        color: { red: 0.5, green: 0.5, blue: 0.5 },
      };

      const result = await handler.handle({
        action: 'set_borders',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:C5' },
        innerHorizontal: borderStyle,
        innerVertical: borderStyle,
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('clear_format action', () => {
    it('should clear all formatting', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'clear_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].repeatCell.fields).toBe('userEnteredFormat');
    });

    it('should respect dryRun for destructive operation', async () => {
      const result = await handler.handle({
        action: 'clear_format',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('apply_preset action', () => {
    it('should apply header_row preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:Z1' },
        preset: 'header_row',
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const request = call.requestBody.requests[0].repeatCell;
      expect(request.cell.userEnteredFormat.textFormat.bold).toBe(true);
    });

    it('should apply alternating_rows preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A2:Z100' },
        preset: 'alternating_rows',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('addBanding');
    });

    it('should apply currency preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!B2:B100' },
        preset: 'currency',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const format = call.requestBody.requests[0].repeatCell.cell.userEnteredFormat.numberFormat;
      expect(format.type).toBe('CURRENCY');
    });

    it('should apply percentage preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!C2:C100' },
        preset: 'percentage',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const format = call.requestBody.requests[0].repeatCell.cell.userEnteredFormat.numberFormat;
      expect(format.type).toBe('PERCENT');
    });

    it('should apply date preset', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A2:A100' },
        preset: 'date',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const format = call.requestBody.requests[0].repeatCell.cell.userEnteredFormat.numberFormat;
      expect(format.type).toBe('DATE');
    });

    it('should apply conditional formatting presets', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'apply_preset',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!D2:D100' },
        preset: 'highlight_positive',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('addConditionalFormatRule');
    });
  });

  describe('auto_fit action', () => {
    it('should auto-fit both rows and columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'auto_fit',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:C10' },
        dimension: 'BOTH',
      });

      expect(result.response.success).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests).toHaveLength(2); // One for rows, one for columns
    });

    it('should auto-fit only rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'auto_fit',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:C10' },
        dimension: 'ROWS',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests).toHaveLength(1);
      expect(call.requestBody.requests[0].autoResizeDimensions.dimensions.dimension).toBe('ROWS');
    });

    it('should auto-fit only columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'auto_fit',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:C10' },
        dimension: 'COLUMNS',
      });

      expect(result.response.success).toBe(true);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].autoResizeDimensions.dimensions.dimension).toBe(
        'COLUMNS'
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(
        new Error('API Error: 403 Permission denied')
      );

      const result = await handler.handle({
        action: 'set_background',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        color: { red: 1, green: 0, blue: 0 },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBeDefined();
    });

    it('should handle sheet not found', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: { sheets: [] },
      });

      const result = await handler.handle({
        action: 'set_background',
        spreadsheetId: 'test-id',
        range: { a1: 'NonExistent!A1:B2' },
        color: { red: 1, green: 0, blue: 0 },
      });

      expect(result.response.success).toBe(false);
    });

    it('should validate schema compliance for errors', async () => {
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(new Error('Test error'));

      const result = await handler.handle({
        action: 'set_background',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        color: { red: 1, green: 0, blue: 0 },
      });

      const parseResult = SheetsFormatOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('range resolution', () => {
    it('should resolve semantic ranges', async () => {
      mockContext.rangeResolver.resolve = vi.fn().mockResolvedValue({
        a1Notation: 'Sheet1!A1:Z1',
        sheetId: 0,
      });
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'set_background',
        spreadsheetId: 'test-id',
        range: { sheetName: 'Sheet1', range: 'A1:Z1' },
        color: { red: 1, green: 0, blue: 0 },
      });

      expect(result.response.success).toBe(true);
      expect(mockContext.rangeResolver.resolve).toHaveBeenCalled();
    });
  });
});
