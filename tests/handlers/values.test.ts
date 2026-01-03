/**
 * ServalSheets v4 - Values Handler Tests
 * 
 * Verifies handler output matches outputSchema (flat structure)
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
      gridRange: { sheetId: 0 },
      resolution: { method: 'a1_direct', confidence: 1.0, path: '' },
    }),
    clearCache: vi.fn(),
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
    it('should return FLAT output matching schema', async () => {
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

      // Verify flat structure (NOT nested in 'data')
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'read');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('range');
      expect(result).not.toHaveProperty('data'); // Should NOT have nested data

      // Verify values are at top level
      expect((result as any).values).toEqual([['A', 'B'], ['1', '2']]);

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

      expect(result).toHaveProperty('success', true);
      expect((result as any).truncated).toBe(true);
      expect((result as any).values.length).toBeLessThanOrEqual(100);
    });
  });

  describe('write action', () => {
    it('should return FLAT output matching schema', async () => {
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

      // Verify flat structure
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'write');
      expect(result).toHaveProperty('updatedCells', 4);
      expect(result).toHaveProperty('updatedRows', 2);
      expect(result).toHaveProperty('updatedRange', 'Sheet1!A1:B2');
      expect(result).not.toHaveProperty('data');

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

      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('updatedCells');
      
      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('append action', () => {
    it('should return FLAT output matching schema', async () => {
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

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'append');
      expect(result).toHaveProperty('updatedCells', 3);
      expect(result).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('clear action', () => {
    it('should return FLAT output matching schema', async () => {
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

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'clear');
      expect(result).toHaveProperty('updatedRange');
      expect(result).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('batch_read action', () => {
    it('should return FLAT output with valueRanges', async () => {
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

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'batch_read');
      expect(result).toHaveProperty('valueRanges');
      expect((result as any).valueRanges).toHaveLength(2);
      expect(result).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('find action', () => {
    it('should return FLAT output with matches array', async () => {
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

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'find');
      expect(result).toHaveProperty('matches');
      expect((result as any).matches).toHaveLength(2);
      expect(result).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('replace action', () => {
    it('should return FLAT output with replacementsCount', async () => {
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

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('action', 'replace');
      expect(result).toHaveProperty('replacementsCount', 5);
      expect(result).not.toHaveProperty('data');

      // Validate against Zod schema
      const parseResult = SheetsValuesOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('Error responses', () => {
    it('should return error in flat structure for API errors', async () => {
      // Mock the API call to reject
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('Requested entity was not found.')
      );

      const result = await handler.handle({
        action: 'read',
        spreadsheetId: 'invalid-id',
        range: { a1: 'Sheet1!A1' },
      });

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect((result as any).error).toHaveProperty('code');
      expect((result as any).error).toHaveProperty('message');

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

      expect(result).toHaveProperty('success', false);
      expect((result as any).error.code).toBe('SPREADSHEET_NOT_FOUND');
      expect((result as any).error.retryable).toBe(false);
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

      expect(result).toHaveProperty('success', false);
      expect((result as any).error.code).toBe('RATE_LIMITED');
      expect((result as any).error.retryable).toBe(true);
      expect((result as any).error.retryAfterMs).toBeDefined();
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

      expect(result).toHaveProperty('success', false);
      expect((result as any).error.code).toBe('PERMISSION_DENIED');
      expect((result as any).error.retryable).toBe(false);
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

      expect(result).toHaveProperty('success', false);
      expect((result as any).error.code).toBe('INTERNAL_ERROR');
    });
  });
});
