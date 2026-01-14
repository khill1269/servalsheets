/**
 * ServalSheets v4 - Values Handler Tests
 * 
 * Verifies handler output matches outputSchema (response envelope)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValuesHandler } from '../../src/handlers/values.js';
import { SheetsValuesOutputSchema } from '../../src/schemas/values.js';
import type { HandlerContext } from '../../src/handlers/base.js';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    values: {
      get: vi.fn(),
      update: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      batchGet: vi.fn(),
      batchUpdate: vi.fn(),
      batchClear: vi.fn(),
    },
    batchUpdate: vi.fn(),
  },
});

// Mock handler context
const createMockContext = (): HandlerContext => ({
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
    executeAll: vi.fn(),
    executeWithSafety: vi.fn(async (options: any) => {
      if (options.safety?.dryRun) {
        return {
          success: true,
          spreadsheetId: options.spreadsheetId,
          responses: [],
          dryRun: true,
          diff: undefined,
        };
      }
      await options.operation();
      return {
        success: true,
        spreadsheetId: options.spreadsheetId,
        responses: [],
        dryRun: false,
        diff: undefined,
      };
    }),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({
      a1Notation: 'Sheet1!A1:B2',
      sheetId: 0,
      sheetName: 'Sheet1',
      gridRange: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 },
      resolution: { method: 'a1_direct', confidence: 1.0, path: '' },
    }),
    clearCache: vi.fn(),
  } as any,
  // Add authentication mock to prevent AUTH_REQUIRED errors
  isAuthenticated: true,
  googleClient: {
    sheets: {
      spreadsheets: {
        values: {
          get: vi.fn(),
          update: vi.fn(),
          append: vi.fn(),
          clear: vi.fn(),
          batchGet: vi.fn(),
          batchUpdate: vi.fn(),
          batchClear: vi.fn(),
        },
        batchUpdate: vi.fn(),
      },
    },
  } as any,
});

describe('ValuesHandler Output Schema Compliance', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: ValuesHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new ValuesHandler(mockContext, mockApi as any);
  });

  describe('read action', () => {
  it('should return response envelope matching schema', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [['A', 'B'], ['1', '2']],
          range: 'Sheet1!A1:B2',
          majorDimension: 'ROWS',
        },
      });

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1:B2' },
      });

      // Verify response envelope (NOT nested in 'data')
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'read');
      expect(result.response).toHaveProperty('values');
      expect(result.response).toHaveProperty('range');
      expect(result.response).not.toHaveProperty('data'); // Should NOT have nested data

      // Verify values are at response top level
      expect(result.response.values).toEqual([['A', 'B'], ['1', '2']]);

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should include truncated flag for large results', async () => {
      // Create large dataset (> 10000 cells)
      const largeValues = Array(200).fill(null).map(() => 
        Array(100).fill('x')
      );

      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: largeValues,
          range: 'Sheet1!A1:CV200',
          majorDimension: 'ROWS',
        },
      });

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1:CV200' },
      });

      expect(result.response).toHaveProperty('success', true);
      expect(result.response.truncated).toBe(true);
      expect(result.response.values?.length).toBeLessThanOrEqual(100);
    });
  });

  describe('write action', () => {
    it('should return response envelope matching schema', async () => {
      mockApi.spreadsheets.values.update.mockResolvedValue({
        data: {
          updatedCells: 4,
          updatedRows: 2,
          updatedColumns: 2,
          updatedRange: 'Sheet1!A1:B2',
        },
      });

      const result = await handler.handle({
          action: 'write',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1:B2' },
          values: [['A', 'B'], ['1', '2']],
      });

      // Verify response envelope
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'write');
      expect(result.response).toHaveProperty('updatedCells', 4);
      expect(result.response).toHaveProperty('updatedRows', 2);
      expect(result.response).toHaveProperty('updatedRange', 'Sheet1!A1:B2');
      expect(result.response).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should return dryRun at top level', async () => {
      const result = await handler.handle({
          action: 'write',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1' },
          values: [['Test']],
          safety: { dryRun: true },
      });

      expect(result.response).toHaveProperty('dryRun', true);
      expect(result.response).toHaveProperty('updatedCells');
      
      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('append action', () => {
    it('should return response envelope matching schema', async () => {
      mockApi.spreadsheets.values.append.mockResolvedValue({
        data: {
          updates: {
            updatedCells: 3,
            updatedRows: 3,
            updatedColumns: 1,
            updatedRange: 'Sheet1!A10:A12',
          },
        },
      });

      const result = await handler.handle({
          action: 'append',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1' },
          values: [['Row1'], ['Row2'], ['Row3']],
      });

      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'append');
      expect(result.response).toHaveProperty('updatedCells', 3);
      expect(result.response).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('clear action', () => {
    it('should return response envelope matching schema', async () => {
      mockApi.spreadsheets.values.clear.mockResolvedValue({
        data: {
          clearedRange: 'Sheet1!A1:Z100',
        },
      });

      const result = await handler.handle({
          action: 'clear',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1:Z100' },
      });

      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'clear');
      expect(result.response).toHaveProperty('updatedRange');
      expect(result.response).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('batch_read action', () => {
    it('should return response envelope with valueRanges', async () => {
      mockApi.spreadsheets.values.batchGet.mockResolvedValue({
        data: {
          valueRanges: [
            { range: 'Sheet1!A1:A10', values: [['a'], ['b']] },
            { range: 'Sheet1!B1:B10', values: [['1'], ['2']] },
          ],
        },
      });

      const result = await handler.handle({
          action: 'batch_read',
          spreadsheetId: 'test-id',
          ranges: [
            { a1: 'Sheet1!A1:A10' },
            { a1: 'Sheet1!B1:B10' },
          ],
      });

      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'batch_read');
      expect(result.response).toHaveProperty('valueRanges');
      expect(result.response.valueRanges).toHaveLength(2);
      expect(result.response).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('find action', () => {
    it('should return response envelope with matches array', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [['foo', 'bar'], ['baz', 'foo']],
          range: 'Sheet1!A1:B2',
        },
      });

      const result = await handler.handle({
          action: 'find',
          spreadsheetId: 'test-id',
          query: 'foo',
      });

      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'find');
      expect(result.response).toHaveProperty('matches');
      expect(result.response.matches).toHaveLength(2);
      expect(result.response).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('replace action', () => {
    it('should return response envelope with replacementsCount', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [{ findReplace: { occurrencesChanged: 5 } }],
        },
      });

      const result = await handler.handle({
          action: 'replace',
          spreadsheetId: 'test-id',
          find: 'old',
          replacement: 'new',
      });

      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'replace');
      expect(result.response).toHaveProperty('replacementsCount', 5);
      expect(result.response).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('Error responses', () => {
    it('should return error in response envelope for API errors', async () => {
      // Mock the API call to reject
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('Requested entity was not found.')
      );

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'invalid-id',
          range: { a1: 'Sheet1!A1' },
      });

      expect(result.response).toHaveProperty('success', false);
      expect(result.response).toHaveProperty('error');
      expect(result.response.error).toHaveProperty('code');
      expect(result.response.error).toHaveProperty('message');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should map Google 404 to SPREADSHEET_NOT_FOUND', async () => {
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('Requested entity was not found.')
      );

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'invalid-id',
          range: { a1: 'Sheet1!A1' },
      });

      expect(result.response).toHaveProperty('success', false);
      expect(result.response.error.code).toBe('SPREADSHEET_NOT_FOUND');
      expect(result.response.error.retryable).toBe(false);
    });

    it('should map Google 429 to RATE_LIMITED with retryAfterMs', async () => {
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('Rate Limit Exceeded')
      );

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1' },
      });

      expect(result.response).toHaveProperty('success', false);
      expect(result.response.error.code).toBe('RATE_LIMITED');
      expect(result.response.error.retryable).toBe(true);
      expect(result.response.error.retryAfterMs).toBeDefined();
    });

    it('should map Google 403 to PERMISSION_DENIED', async () => {
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('The caller does not have permission')
      );

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1' },
      });

      expect(result.response).toHaveProperty('success', false);
      expect(result.response.error.code).toBe('PERMISSION_DENIED');
      expect(result.response.error.retryable).toBe(false);
    });

    it('should handle unknown errors gracefully', async () => {
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('Something unexpected happened')
      );

      const result = await handler.handle({
          action: 'read',
          spreadsheetId: 'test-id',
          range: { a1: 'Sheet1!A1' },
      });

      expect(result.response).toHaveProperty('success', false);
      expect(result.response.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
