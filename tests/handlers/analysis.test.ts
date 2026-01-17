/**
 * ServalSheets v4 - Analysis Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisHandler } from '../../src/handlers/analysis.js';
import { SheetsAnalysisOutputSchema } from '../../src/schemas/analysis.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

const createMockSheetsApi = () => ({
  spreadsheets: {
    values: {
      get: vi.fn(),
    },
    get: vi.fn(),
  },
});

const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {} as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B3' }),
  } as any,
});

describe('AnalysisHandler', () => {
  let handler: AnalysisHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new AnalysisHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );

    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: { values: [['A', 'B'], [1, 2], [3, 4]] },
    });
    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1', gridProperties: { rowCount: 10, columnCount: 5 } }, charts: [] }] },
    });
  });

  it('runs data quality check', async () => {
    const result = await handler.handle({
        action: 'data_quality',
        spreadsheetId: 'sheet-id',
    });

    const parsed = SheetsAnalysisOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
  });

  it('compares ranges', async () => {
    mockSheetsApi.spreadsheets.values.get
      .mockResolvedValueOnce({ data: { values: [['A'], [1]] } })
      .mockResolvedValueOnce({ data: { values: [['A'], [2]] } });

    const result = await handler.handle({
        action: 'compare_ranges',
        spreadsheetId: 'sheet-id',
        range1: { a1: 'Sheet1!A1:A2' },
        range2: { a1: 'Sheet1!A1:A2' },
    });

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.comparison?.diffCount).toBeGreaterThan(0);
    }
  });
});
