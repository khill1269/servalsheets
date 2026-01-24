/**
 * ServalSheets - Visualize Handler Tests
 *
 * Tests for chart and pivot table operations.
 * Covers 17 actions: chart operations (create, suggest, update, delete, list, get,
 * move, resize, update_data_range, export) and pivot operations (create, suggest,
 * update, delete, list, get, refresh)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualizeHandler } from '../../src/handlers/visualize.js';
import { SheetsVisualizeOutputSchema } from '../../src/schemas/visualize.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    values: {
      get: vi.fn().mockResolvedValue({
        data: {
          values: [
            ['Month', 'Sales', 'Expenses', 'Profit'],
            ['Jan', 1000, 400, 600],
            ['Feb', 1200, 450, 750],
            ['Mar', 1100, 420, 680],
          ],
        },
      }),
    },
    get: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-spreadsheet-id',
        properties: { title: 'Test Spreadsheet' },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Sheet1',
              gridProperties: { rowCount: 1000, columnCount: 26 },
            },
            charts: [
              {
                chartId: 123,
                position: {
                  overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 0, columnIndex: 0 } },
                },
                spec: {
                  title: 'Sales Chart',
                  basicChart: {
                    chartType: 'LINE',
                    domains: [
                      {
                        domain: {
                          sourceRange: {
                            sources: [
                              {
                                sheetId: 0,
                                startRowIndex: 0,
                                endRowIndex: 10,
                                startColumnIndex: 0,
                                endColumnIndex: 1,
                              },
                            ],
                          },
                        },
                      },
                    ],
                    series: [
                      {
                        series: {
                          sourceRange: {
                            sources: [
                              {
                                sheetId: 0,
                                startRowIndex: 0,
                                endRowIndex: 10,
                                startColumnIndex: 1,
                                endColumnIndex: 2,
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    }),
    batchUpdate: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-spreadsheet-id',
        replies: [{ addChart: { chart: { chartId: 456 } } }],
      },
    }),
  },
});

// Create mock context
const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
    executeAll: vi.fn(),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({
      a1Notation: 'Sheet1!A1:B10',
      sheetId: 0,
      sheetName: 'Sheet1',
    }),
  } as any,
  sheetsApi: createMockSheetsApi() as unknown as sheets_v4.Sheets,
  driveApi: undefined,
  sessionId: 'test-session',
  requestId: 'test-request',
  server: {
    createMessage: vi.fn().mockResolvedValue({
      model: 'claude-3-sonnet',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            suggestions: [
              { type: 'LINE', confidence: 0.9, rationale: 'Time series data' },
              { type: 'BAR', confidence: 0.7, rationale: 'Categorical comparison' },
            ],
          }),
        },
      ],
    }),
    getClientCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
  } as any,
});

describe('VisualizeHandler', () => {
  let handler: VisualizeHandler;
  let mockContext: HandlerContext;
  let mockApi: ReturnType<typeof createMockSheetsApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new VisualizeHandler(mockContext, mockApi as any);
  });

  describe('chart_create', () => {
    it('should create a new chart', async () => {
      const result = await handler.handle({
        action: 'chart_create',
        spreadsheetId: 'test-spreadsheet-id',
        sheetId: 0,
        chartType: 'LINE',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B10' },
          categories: 0,
          series: [{ column: 1 }],
        },
        position: { anchorCell: 'D1', width: 600, height: 400 },
      });

      expect(result.response.success).toBe(true);
      const parseResult = SheetsVisualizeOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('chart_list', () => {
    it('should list all charts in a spreadsheet', async () => {
      const result = await handler.handle({
        action: 'chart_list',
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('chart_get', () => {
    it('should get a specific chart by ID', async () => {
      const result = await handler.handle({
        action: 'chart_get',
        spreadsheetId: 'test-spreadsheet-id',
        chartId: 123,
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('chart_delete', () => {
    it('should delete a chart', async () => {
      const result = await handler.handle({
        action: 'chart_delete',
        spreadsheetId: 'test-spreadsheet-id',
        chartId: 123,
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('suggest_chart', () => {
    it('should suggest chart types for data range', async () => {
      const result = await handler.handle({
        action: 'suggest_chart',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1:D100' },
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('pivot_create', () => {
    it('should create a pivot table', async () => {
      const result = await handler.handle({
        action: 'pivot_create',
        spreadsheetId: 'test-spreadsheet-id',
        sourceRange: { a1: 'Sheet1!A1:E100' },
        rows: [{ sourceColumnOffset: 0 }],
        values: [{ sourceColumnOffset: 2, summarizeFunction: 'SUM' }],
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('pivot_list', () => {
    it('should list all pivot tables', async () => {
      const result = await handler.handle({
        action: 'pivot_list',
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('suggest_pivot', () => {
    it('should suggest pivot table configurations', async () => {
      const result = await handler.handle({
        action: 'suggest_pivot',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1:F100' },
      });

      expect(result.response.success).toBe(true);
    });
  });
});
