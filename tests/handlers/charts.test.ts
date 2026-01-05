/**
 * ServalSheets v4 - Charts Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartsHandler } from '../../src/handlers/charts.js';
import { SheetsChartsOutputSchema } from '../../src/schemas/charts.js';
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
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B2' }),
  } as any,
});

describe('ChartsHandler', () => {
  let handler: ChartsHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new ChartsHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );

    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' }, charts: [] }],
      },
    });
  });

  it('creates a chart and returns chartId', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ addChart: { chart: { chartId: 123 } } }] },
    });

    const result = await handler.handle({
      request: {
        action: 'create',
        spreadsheetId: 'sheet-id',
        sheetId: 0,
        chartType: 'BAR',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B2' },
        },
        position: {
          anchorCell: 'Sheet1!A1',
          offsetX: 0,
          offsetY: 0,
          width: 400,
          height: 300,
        },
      },
    });

    const parsed = SheetsChartsOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.chartId).toBe(123);
    }
  });

  it('returns charts from list action', async () => {
    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [{
          properties: { sheetId: 0 },
          charts: [{
            chartId: 5,
            spec: { basicChart: { chartType: 'BAR' }, title: 'My Chart' },
            position: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 0, columnIndex: 0 }, widthPixels: 300, heightPixels: 200 } },
          }],
        }],
      },
    });

    const result = await handler.handle({
      request: {
        action: 'list',
        spreadsheetId: 'sheet-id',
      },
    });

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.charts).toHaveLength(1);
      expect(result.response.charts?.[0].chartId).toBe(5);
    }
  });

  it('supports dryRun on delete', async () => {
    const result = await handler.handle({
      request: {
        action: 'delete',
        spreadsheetId: 'sheet-id',
        chartId: 7,
        safety: { dryRun: true },
      },
    });

    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.dryRun).toBe(true);
    }
    expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });
});
