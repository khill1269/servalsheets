/**
 * ServalSheets v4 - Pivot Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PivotHandler } from '../../src/handlers/pivot.js';
import { SheetsPivotOutputSchema } from '../../src/schemas/pivot.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
  },
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B5' }),
  } as any,
});

describe('PivotHandler', () => {
  let handler: PivotHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new PivotHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );

    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1', gridProperties: { rowCount: 10, columnCount: 5 } } }] },
    });
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [] } });
  });

  it('creates a pivot table', async () => {
    const result = await handler.handle({
      action: 'create',
      spreadsheetId: 'sheet-id',
      sourceRange: { a1: 'Sheet1!A1:B5' },
      values: [{ sourceColumnOffset: 1, summarizeFunction: 'SUM' }],
    });

    const parsed = SheetsPivotOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pivotTable?.sheetId).toBeDefined();
    }
    expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();
  });

  it('returns list of pivot tables', async () => {
    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [{
          properties: { sheetId: 0, title: 'Sheet1' },
          data: [{ rowData: [{ values: [{ pivotTable: { source: { sheetId: 0 } } }] }] }],
        }],
      },
    });

    const result = await handler.handle({
      action: 'list',
      spreadsheetId: 'sheet-id',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pivotTables?.[0].title).toBe('Sheet1');
    }
  });

  it('supports dryRun on delete', async () => {
    const result = await handler.handle({
      action: 'delete',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      safety: { dryRun: true },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.dryRun).toBe(true);
    }
    expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });
});
