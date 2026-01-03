/**
 * ServalSheets v4 - Filter/Sort Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterSortHandler } from '../../src/handlers/filter-sort.js';
import { SheetsFilterSortOutputSchema } from '../../src/schemas/filter-sort.js';
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
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B10' }),
  } as any,
});

describe('FilterSortHandler', () => {
  let handler: FilterSortHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new FilterSortHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );

    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
    });
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [] } });
  });

  it('sets a basic filter', async () => {
    const result = await handler.handle({
      action: 'set_basic_filter',
      spreadsheetId: 'sheet-id',
      range: { a1: 'Sheet1!A1:B10' },
      sheetId: 0,
    });

    const parsed = SheetsFilterSortOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();
  });

  it('clears filter with dryRun', async () => {
    const result = await handler.handle({
      action: 'clear_basic_filter',
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
