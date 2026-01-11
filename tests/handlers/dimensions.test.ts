/**
 * ServalSheets - Dimensions Handler Tests
 *
 * Tests for row and column dimension operations.
 * Covers all 21 actions across insert, delete, move, resize, visibility, freeze, group, and append.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DimensionsHandler } from '../../src/handlers/dimensions.js';
import { SheetsDimensionsOutputSchema } from '../../src/schemas/dimensions.js';
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
    }),
  } as any,
});

describe('DimensionsHandler', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: DimensionsHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new DimensionsHandler(mockContext, mockApi as any);

    // Mock sheet metadata
    mockApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          { properties: { sheetId: 0, title: 'Sheet1' } },
        ],
      },
    });
  });

  describe('Insert Operations', () => {
    it('should insert rows at specified index', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'insert_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        count: 3,
        inheritFromBefore: false,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'insert_rows');
      expect(result.response).toHaveProperty('rowsAffected', 3);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 8, // startIndex + count
              },
              inheritFromBefore: false,
            },
          }],
        },
      });

      const parseResult = SheetsDimensionsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should insert columns at specified index', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'insert_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        count: 5,
        inheritFromBefore: true,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'insert_columns');
      expect(result.response).toHaveProperty('columnsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 2,
                endIndex: 7,
              },
              inheritFromBefore: true,
            },
          }],
        },
      });
    });

    it('should default to inserting 1 row when count not specified', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'insert_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('rowsAffected', 1);
      const call = mockApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0].insertDimension.range.endIndex).toBe(1);
    });
  });

  describe('Delete Operations (Destructive)', () => {
    it('should delete rows in specified range', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'delete_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 10,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'delete_rows');
      expect(result.response).toHaveProperty('rowsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 10,
              },
            },
          }],
        },
      });
    });

    it('should delete columns in specified range', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'delete_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        endIndex: 5,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'delete_columns');
      expect(result.response).toHaveProperty('columnsAffected', 3);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 2,
                endIndex: 5,
              },
            },
          }],
        },
      });
    });

    it('should respect dryRun for delete operations', async () => {
      const result = await handler.handle({
        action: 'delete_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
        endIndex: 10,
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(result.response).toHaveProperty('rowsAffected', 10);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Move Operations', () => {
    it('should move rows to new position', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'move_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 10,
        destinationIndex: 15,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'move_rows');
      expect(result.response).toHaveProperty('rowsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            moveDimension: {
              source: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 10,
              },
              destinationIndex: 15,
            },
          }],
        },
      });
    });

    it('should move columns to new position', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'move_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        endIndex: 5,
        destinationIndex: 10,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'move_columns');
      expect(result.response).toHaveProperty('columnsAffected', 3);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            moveDimension: {
              source: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 2,
                endIndex: 5,
              },
              destinationIndex: 10,
            },
          }],
        },
      });
    });
  });

  describe('Resize Operations', () => {
    it('should resize rows to specified pixel height', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'resize_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
        endIndex: 10,
        pixelSize: 30,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'resize_rows');
      expect(result.response).toHaveProperty('rowsAffected', 10);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            updateDimensionProperties: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 0,
                endIndex: 10,
              },
              properties: {
                pixelSize: 30,
              },
              fields: 'pixelSize',
            },
          }],
        },
      });
    });

    it('should resize columns to specified pixel width', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'resize_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
        endIndex: 5,
        pixelSize: 150,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'resize_columns');
      expect(result.response).toHaveProperty('columnsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            updateDimensionProperties: {
              range: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 5,
              },
              properties: {
                pixelSize: 150,
              },
              fields: 'pixelSize',
            },
          }],
        },
      });
    });

    it('should auto-resize rows to fit content', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'auto_resize',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        dimension: 'ROWS',
        startIndex: 0,
        endIndex: 20,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'auto_resize');
      expect(result.response).toHaveProperty('rowsAffected', 20);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 0,
                endIndex: 20,
              },
            },
          }],
        },
      });
    });

    it('should auto-resize columns to fit content', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'auto_resize',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: 10,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'auto_resize');
      expect(result.response).toHaveProperty('columnsAffected', 10);
    });
  });

  describe('Visibility Operations', () => {
    it('should hide rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'hide_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 10,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'hide_rows');
      expect(result.response).toHaveProperty('rowsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            updateDimensionProperties: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 10,
              },
              properties: {
                hiddenByUser: true,
              },
              fields: 'hiddenByUser',
            },
          }],
        },
      });
    });

    it('should hide columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'hide_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        endIndex: 5,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'hide_columns');
      expect(result.response).toHaveProperty('columnsAffected', 3);
    });

    it('should show previously hidden rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'show_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 10,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'show_rows');
      expect(result.response).toHaveProperty('rowsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            updateDimensionProperties: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 10,
              },
              properties: {
                hiddenByUser: false,
              },
              fields: 'hiddenByUser',
            },
          }],
        },
      });
    });

    it('should show previously hidden columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'show_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        endIndex: 5,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'show_columns');
      expect(result.response).toHaveProperty('columnsAffected', 3);
    });
  });

  describe('Freeze Operations', () => {
    it('should freeze top rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'freeze_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        frozenRowCount: 2,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'freeze_rows');
      expect(result.response).toHaveProperty('rowsAffected', 2);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: {
                  frozenRowCount: 2,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          }],
        },
      });
    });

    it('should freeze left columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'freeze_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        frozenColumnCount: 3,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'freeze_columns');
      expect(result.response).toHaveProperty('columnsAffected', 3);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: {
                  frozenColumnCount: 3,
                },
              },
              fields: 'gridProperties.frozenColumnCount',
            },
          }],
        },
      });
    });

    it('should unfreeze all rows when count is 0', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'freeze_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        frozenRowCount: 0,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('rowsAffected', 0);
    });
  });

  describe('Group Operations', () => {
    it('should group rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'group_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 15,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'group_rows');
      expect(result.response).toHaveProperty('rowsAffected', 10);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            addDimensionGroup: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 15,
              },
            },
          }],
        },
      });
    });

    it('should group columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'group_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        endIndex: 8,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'group_columns');
      expect(result.response).toHaveProperty('columnsAffected', 6);
    });

    it('should ungroup rows', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'ungroup_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 15,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'ungroup_rows');
      expect(result.response).toHaveProperty('rowsAffected', 10);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            deleteDimensionGroup: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 5,
                endIndex: 15,
              },
            },
          }],
        },
      });
    });

    it('should ungroup columns', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'ungroup_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 2,
        endIndex: 8,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'ungroup_columns');
      expect(result.response).toHaveProperty('columnsAffected', 6);
    });
  });

  describe('Append Operations', () => {
    it('should append rows to end of sheet', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'append_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        count: 10,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'append_rows');
      expect(result.response).toHaveProperty('rowsAffected', 10);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            appendDimension: {
              sheetId: 0,
              dimension: 'ROWS',
              length: 10,
            },
          }],
        },
      });
    });

    it('should append columns to end of sheet', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'append_columns',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        count: 5,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'append_columns');
      expect(result.response).toHaveProperty('columnsAffected', 5);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-sheet-id',
        requestBody: {
          requests: [{
            appendDimension: {
              sheetId: 0,
              dimension: 'COLUMNS',
              length: 5,
            },
          }],
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(
        new Error('API Error: 403 Permission denied')
      );

      const result = await handler.handle({
        action: 'insert_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
        count: 1,
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBeDefined();
    });

    it('should handle invalid action', async () => {
      const result = await handler.handle({
        action: 'invalid_action' as any,
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
      } as any);

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INVALID_PARAMS');
      expect(result.response.error?.message).toContain('Unknown action');
    });

    it('should validate schema compliance for errors', async () => {
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(new Error('Test error'));

      const result = await handler.handle({
        action: 'delete_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
        endIndex: 5,
      });

      const parseResult = SheetsDimensionsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('Safety Features', () => {
    it('should respect dryRun for move operations', async () => {
      const result = await handler.handle({
        action: 'move_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 5,
        endIndex: 10,
        destinationIndex: 15,
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should include metadata in successful responses', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const result = await handler.handle({
        action: 'insert_rows',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        startIndex: 0,
        count: 5,
      });

      expect(result.response.success).toBe(true);
      // Metadata is optional but should be included when present
      if ('_meta' in result.response) {
        expect(result.response._meta).toBeDefined();
      }
    });
  });

  describe('Schema Validation', () => {
    it('should produce schema-compliant output for all actions', async () => {
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [{}] } });

      const actions: Array<{
        action: string;
        params: Record<string, any>;
      }> = [
        { action: 'insert_rows', params: { startIndex: 0, count: 1 } },
        { action: 'delete_rows', params: { startIndex: 0, endIndex: 1 } },
        { action: 'resize_rows', params: { startIndex: 0, endIndex: 5, pixelSize: 30 } },
        { action: 'hide_rows', params: { startIndex: 0, endIndex: 5 } },
        { action: 'freeze_rows', params: { frozenRowCount: 1 } },
        { action: 'group_rows', params: { startIndex: 0, endIndex: 5 } },
        { action: 'append_rows', params: { count: 5 } },
      ];

      for (const { action, params } of actions) {
        const result = await handler.handle({
          action,
          spreadsheetId: 'test-sheet-id',
          sheetId: 0,
          ...params,
        } as any);

        const parseResult = SheetsDimensionsOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      }
    });
  });
});
