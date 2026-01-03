/**
 * ServalSheets v4 - Dry Run Safety Tests
 * 
 * Verifies that dry_run=true prevents mutations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValuesHandler } from '../../src/handlers/values.js';
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
      a1Notation: 'Sheet1!A1:C10',
      sheetId: 0,
      sheetName: 'Sheet1',
      gridRange: { sheetId: 0 },
      resolution: { method: 'a1_direct', confidence: 1.0, path: '' },
    }),
    clearCache: vi.fn(),
  } as any,
});

describe('Dry Run Safety', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: ValuesHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new ValuesHandler(mockContext, mockApi as any);
  });

  describe('ValuesHandler - write action', () => {
    it('should NOT call API when dryRun=true', async () => {
      const result = await handler.handle({
        action: 'write',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1' },
        values: [['Test Value']],
        safety: { dryRun: true },
      });

      // API should NOT be called
      expect(mockApi.spreadsheets.values.update).not.toHaveBeenCalled();
      
      // Should return success with dryRun flag
      expect(result).toMatchObject({
        success: true,
        action: 'write',
        dryRun: true,
        updatedCells: 1,
        updatedRows: 1,
      });
    });

    it('should call API when dryRun=false', async () => {
      mockApi.spreadsheets.values.update.mockResolvedValue({
        data: {
          updatedCells: 1,
          updatedRows: 1,
          updatedColumns: 1,
          updatedRange: 'Sheet1!A1',
        },
      });

      const result = await handler.handle({
        action: 'write',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1' },
        values: [['Test Value']],
        safety: { dryRun: false },
      });

      // API should be called
      expect(mockApi.spreadsheets.values.update).toHaveBeenCalledTimes(1);
      
      // Should return success without dryRun flag
      expect(result).toMatchObject({
        success: true,
        action: 'write',
      });
      expect(result).not.toHaveProperty('dryRun');
    });

    it('should call API when safety is not provided', async () => {
      mockApi.spreadsheets.values.update.mockResolvedValue({
        data: {
          updatedCells: 1,
          updatedRows: 1,
          updatedColumns: 1,
          updatedRange: 'Sheet1!A1',
        },
      });

      await handler.handle({
        action: 'write',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1' },
        values: [['Test Value']],
      });

      // API should be called when no safety options
      expect(mockApi.spreadsheets.values.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('ValuesHandler - append action', () => {
    it('should NOT call API when dryRun=true', async () => {
      const result = await handler.handle({
        action: 'append',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1' },
        values: [['Row 1'], ['Row 2'], ['Row 3']],
        safety: { dryRun: true },
      });

      // API should NOT be called
      expect(mockApi.spreadsheets.values.append).not.toHaveBeenCalled();
      
      // Should return estimated counts
      expect(result).toMatchObject({
        success: true,
        action: 'append',
        dryRun: true,
        updatedCells: 3,
        updatedRows: 3,
      });
    });
  });

  describe('ValuesHandler - clear action', () => {
    it('should NOT call API when dryRun=true', async () => {
      const result = await handler.handle({
        action: 'clear',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1:Z100' },
        safety: { dryRun: true },
      });

      // API should NOT be called
      expect(mockApi.spreadsheets.values.clear).not.toHaveBeenCalled();
      
      // Should return success with dryRun flag
      expect(result).toMatchObject({
        success: true,
        action: 'clear',
        dryRun: true,
        updatedRange: 'Sheet1!A1:C10', // From mock resolver
      });
    });
  });

  describe('ValuesHandler - batch_write action', () => {
    it('should NOT call API when dryRun=true', async () => {
      const result = await handler.handle({
        action: 'batch_write',
        spreadsheetId: 'test-spreadsheet-id',
        data: [
          { range: { a1: 'Sheet1!A1' }, values: [['A']] },
          { range: { a1: 'Sheet1!B1' }, values: [['B']] },
        ],
        safety: { dryRun: true },
      });

      // API should NOT be called
      expect(mockApi.spreadsheets.values.batchUpdate).not.toHaveBeenCalled();
      
      // Should return estimated counts
      expect(result).toMatchObject({
        success: true,
        action: 'batch_write',
        dryRun: true,
        updatedCells: 2,
      });
    });
  });

  describe('ValuesHandler - batch_clear action', () => {
    it('should NOT call API when dryRun=true', async () => {
      const result = await handler.handle({
        action: 'batch_clear',
        spreadsheetId: 'test-spreadsheet-id',
        ranges: [
          { a1: 'Sheet1!A1:A10' },
          { a1: 'Sheet1!B1:B10' },
        ],
        safety: { dryRun: true },
      });

      // API should NOT be called
      expect(mockApi.spreadsheets.values.batchClear).not.toHaveBeenCalled();
      
      // Should return success with dryRun flag
      expect(result).toMatchObject({
        success: true,
        action: 'batch_clear',
        dryRun: true,
      });
    });
  });

  describe('ValuesHandler - replace action', () => {
    it('should NOT mutate when dryRun=true (should count matches only)', async () => {
      // Mock the find operation
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [['foo', 'bar'], ['foo', 'baz']],
          range: 'Sheet1!A1:B2',
        },
      });

      const result = await handler.handle({
        action: 'replace',
        spreadsheetId: 'test-spreadsheet-id',
        find: 'foo',
        replacement: 'replaced',
        safety: { dryRun: true },
      });

      // batchUpdate (which does the replace) should NOT be called
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
      
      // Should return count of matches
      expect(result).toMatchObject({
        success: true,
        action: 'replace',
        dryRun: true,
        replacementsCount: 2, // Two cells contain 'foo'
      });
    });
  });

  describe('Read operations should not be affected by dryRun', () => {
    it('read action should call API regardless of dryRun', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [['A', 'B'], ['1', '2']],
          range: 'Sheet1!A1:B2',
          majorDimension: 'ROWS',
        },
      });

      const result = await handler.handle({
        action: 'read',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1:B2' },
        // Note: read doesn't have safety options in schema
      });

      // API should be called
      expect(mockApi.spreadsheets.values.get).toHaveBeenCalledTimes(1);
      
      // Should return data
      expect(result).toMatchObject({
        success: true,
        action: 'read',
        values: [['A', 'B'], ['1', '2']],
      });
    });
  });
});
