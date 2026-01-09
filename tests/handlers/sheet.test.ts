/**
 * ServalSheets v4 - Sheet Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetHandler } from '../../src/handlers/sheet.js';
import { SheetsSheetOutputSchema } from '../../src/schemas/sheet.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

// Mock Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
    sheets: {
      copyTo: vi.fn(),
    },
  },
});

// Mock context
const createMockContext = (): HandlerContext => ({
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue('Sheet1!A1:Z100'),
    clearCache: vi.fn(),
  } as any,
  policyEnforcer: {
    validateIntents: vi.fn().mockResolvedValue(undefined),
    validateEffectScope: vi.fn().mockResolvedValue(undefined),
  } as any,
});

describe('SheetHandler', () => {
  let handler: SheetHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new SheetHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );
  });

  describe('add action', () => {
    it('should add sheet and return response envelope', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [{
            addSheet: {
              properties: {
                sheetId: 123,
                title: 'New Sheet',
                index: 1,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          }],
        },
      });

      const result = await handler.handle({
          action: 'add',
          spreadsheetId: 'test-id',
          title: 'New Sheet',
      });

      const parsed = SheetsSheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('add');
        expect(result.response.sheet?.sheetId).toBe(123);
        expect(result.response.sheet?.title).toBe('New Sheet');
      }
    });

    it('should add sheet with custom dimensions', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [{
            addSheet: {
              properties: {
                sheetId: 456,
                title: 'Custom',
                index: 0,
                gridProperties: { rowCount: 500, columnCount: 10 },
              },
            },
          }],
        },
      });

      const result = await handler.handle({
          action: 'add',
          spreadsheetId: 'test-id',
          title: 'Custom',
          rowCount: 500,
          columnCount: 10,
      });

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [
              expect.objectContaining({
                addSheet: expect.objectContaining({
                  properties: expect.objectContaining({
                    title: 'Custom',
                    gridProperties: { rowCount: 500, columnCount: 10 },
                  }),
                }),
              }),
            ],
          },
        })
      );
    });
  });

  describe('delete action', () => {
    it('should delete sheet', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: { replies: [{}] },
      });

      const result = await handler.handle({
          action: 'delete',
          spreadsheetId: 'test-id',
          sheetId: 123,
      });

      const parsed = SheetsSheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [{ deleteSheet: { sheetId: 123 } }],
          },
        })
      );
    });

    it('should return alreadyDeleted when sheet missing and allowMissing=true', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 999 } }] },
      });

      const result = await handler.handle({
          action: 'delete',
          spreadsheetId: 'test-id',
          sheetId: 123,
          allowMissing: true,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.alreadyDeleted).toBe(true);
      }
      // Should not call batchUpdate since sheet doesn't exist
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should support dry run', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 123 } }] },
      });

      const result = await handler.handle({
          action: 'delete',
          spreadsheetId: 'test-id',
          sheetId: 123,
          allowMissing: true,
          safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.dryRun).toBe(true);
      }
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('duplicate action', () => {
    it('should duplicate sheet', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [{
            duplicateSheet: {
              properties: {
                sheetId: 789,
                title: 'Sheet1 (Copy)',
                index: 2,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          }],
        },
      });

      const result = await handler.handle({
          action: 'duplicate',
          spreadsheetId: 'test-id',
          sheetId: 0,
          newTitle: 'Sheet1 (Copy)',
      });

      const parsed = SheetsSheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.sheet?.sheetId).toBe(789);
        expect(result.response.sheet?.title).toBe('Sheet1 (Copy)');
      }
    });
  });

  describe('update action', () => {
    it('should update sheet properties', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{
            properties: {
              sheetId: 0,
              title: 'Renamed',
              index: 0,
              hidden: true,
              gridProperties: { rowCount: 1000, columnCount: 26 },
            },
          }],
        },
      });

      const result = await handler.handle({
          action: 'update',
          spreadsheetId: 'test-id',
          sheetId: 0,
          title: 'Renamed',
          hidden: true,
      });

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: 0, title: 'Renamed', hidden: true },
                fields: 'title,hidden',
              },
            }],
          },
        })
      );
    });

    it('should error when no properties provided', async () => {
      const result = await handler.handle({
          action: 'update',
          spreadsheetId: 'test-id',
          sheetId: 0,
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INVALID_PARAMS');
      }
    });
  });

  describe('copy_to action', () => {
    it('should copy sheet to another spreadsheet', async () => {
      mockSheetsApi.spreadsheets.sheets.copyTo.mockResolvedValue({
        data: {
          sheetId: 999,
          title: 'Copied Sheet',
          index: 0,
          gridProperties: { rowCount: 1000, columnCount: 26 },
        },
      });

      const result = await handler.handle({
          action: 'copy_to',
          spreadsheetId: 'source-id',
          sheetId: 0,
          destinationSpreadsheetId: 'dest-id',
      });

      const parsed = SheetsSheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.copiedSheetId).toBe(999);
        expect(result.response.sheet?.title).toBe('Copied Sheet');
      }
    });
  });

  describe('list action', () => {
    it('should list all sheets', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { sheetId: 0, title: 'Sheet1', index: 0, gridProperties: { rowCount: 1000, columnCount: 26 } } },
            { properties: { sheetId: 1, title: 'Sheet2', index: 1, gridProperties: { rowCount: 500, columnCount: 10 }, hidden: true } },
          ],
        },
      });

      const result = await handler.handle({
          action: 'list',
          spreadsheetId: 'test-id',
      });

      const parsed = SheetsSheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.sheets).toHaveLength(2);
        expect(result.response.sheets?.[0].title).toBe('Sheet1');
        expect(result.response.sheets?.[1].hidden).toBe(true);
      }
    });
  });

  describe('get action', () => {
    it('should get single sheet by ID', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { sheetId: 0, title: 'Other', index: 0, gridProperties: { rowCount: 100, columnCount: 5 } } },
            { properties: { sheetId: 123, title: 'Target', index: 1, gridProperties: { rowCount: 2000, columnCount: 52 } } },
          ],
        },
      });

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-id',
          sheetId: 123,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.sheet?.sheetId).toBe(123);
        expect(result.response.sheet?.title).toBe('Target');
        expect(result.response.sheet?.rowCount).toBe(2000);
      }
    });

    it('should error when sheet not found', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 0 } }] },
      });

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-id',
          sheetId: 999,
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('SHEET_NOT_FOUND');
      }
    });
  });

  describe('error handling', () => {
    it('should map 404 errors', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockRejectedValue(
        new Error('404 not found')
      );

      const result = await handler.handle({
          action: 'add',
          spreadsheetId: 'nonexistent',
          title: 'Test',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('SPREADSHEET_NOT_FOUND');
      }
    });

    it('should map 429 rate limit errors', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValue(
        new Error('429 rate limit exceeded')
      );

      const result = await handler.handle({
          action: 'list',
          spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('RATE_LIMITED');
        expect(result.response.error.retryable).toBe(true);
      }
    });
  });
});
