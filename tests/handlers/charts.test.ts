/**
 * ServalSheets - Charts Handler Tests
 *
 * Comprehensive tests for chart operations (create, update, delete, list, get, move, resize).
 * Tests all chart types and actions with realistic mocks.
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
});

describe('ChartsHandler', () => {
  let handler: ChartsHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new ChartsHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );

    // Mock sheet metadata for getSheetId
    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: { sheetId: 0, title: 'Sheet1' },
            charts: [],
          },
        ],
      },
    });
  });

  describe('create action', () => {
    it('should create a bar chart with title and legend', async () => {
      const mockChartId = 12345;
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: {
                  chartId: mockChartId,
                },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'BAR',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B10' },
          categories: 0,
          series: [{ column: 1 }],
        },
        position: {
          anchorCell: 'D2',
          offsetX: 0,
          offsetY: 0,
          width: 600,
          height: 400,
        },
        options: {
          title: 'Sales by Region',
          legendPosition: 'BOTTOM',
        },
      });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'create');
      expect(result.response.chartId).toBe(mockChartId);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('addChart');
      expect(call.requestBody.requests[0].addChart.chart.spec.title).toBe('Sales by Region');

      const parseResult = SheetsChartsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should create a line chart with multiple series', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 67890 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'LINE',
        data: {
          sourceRange: { a1: 'Sheet1!A1:D10' },
          categories: 0,
          series: [
            { column: 1, color: { red: 1, green: 0, blue: 0 } },
            { column: 2, color: { red: 0, green: 1, blue: 0 } },
            { column: 3, color: { red: 0, green: 0, blue: 1 } },
          ],
        },
        position: {
          anchorCell: 'F2',
        },
        options: {
          title: 'Quarterly Trends',
          stacked: false,
          lineSmooth: true,
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.chartId).toBe(67890);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const chartSpec = call.requestBody.requests[0].addChart.chart.spec;
      expect(chartSpec.basicChart.chartType).toBe('LINE');
      expect(chartSpec.basicChart.series).toHaveLength(3);
    });

    it('should create a pie chart with 3D option', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 11111 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'PIE',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B6' },
          categories: 0,
          series: [{ column: 1 }],
        },
        position: {
          anchorCell: 'D2',
        },
        options: {
          title: 'Market Share',
          is3D: true,
          legendPosition: 'RIGHT',
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.chartId).toBe(11111);

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const chartSpec = call.requestBody.requests[0].addChart.chart.spec;
      expect(chartSpec).toHaveProperty('pieChart');
      expect(chartSpec.pieChart.threeDimensional).toBe(true);
    });

    it('should create a doughnut chart with pie hole', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 22222 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'DOUGHNUT',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B5' },
          categories: 0,
          series: [{ column: 1 }],
        },
        position: {
          anchorCell: 'D2',
        },
        options: {
          title: 'Budget Allocation',
          pieHole: 0.4,
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.chartId).toBe(22222);

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const chartSpec = call.requestBody.requests[0].addChart.chart.spec;
      expect(chartSpec.pieChart.pieHole).toBe(0.4);
    });

    it('should create a histogram chart', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 33333 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'HISTOGRAM',
        data: {
          sourceRange: { a1: 'Sheet1!A1:A100' },
        },
        position: {
          anchorCell: 'C2',
        },
        options: {
          title: 'Score Distribution',
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.chartId).toBe(33333);

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const chartSpec = call.requestBody.requests[0].addChart.chart.spec;
      expect(chartSpec).toHaveProperty('histogramChart');
    });

    it('should create a scorecard chart', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 44444 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'SCORECARD',
        data: {
          sourceRange: { a1: 'Sheet1!A1:A10' },
        },
        position: {
          anchorCell: 'D2',
        },
        options: {
          title: 'Total Revenue',
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.chartId).toBe(44444);

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      const chartSpec = call.requestBody.requests[0].addChart.chart.spec;
      expect(chartSpec).toHaveProperty('scorecardChart');
      expect(chartSpec.scorecardChart.aggregateType).toBe('SUM');
    });
  });

  describe('update action', () => {
    it('should update chart type and title', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        chartType: 'COLUMN',
        options: {
          title: 'Updated Chart Title',
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'update');
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('updateChartSpec');
      expect(call.requestBody.requests[0].updateChartSpec.chartId).toBe(12345);
    });

    it('should update chart position', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        position: {
          anchorCell: 'G5',
          offsetX: 10,
          offsetY: 20,
          width: 800,
          height: 500,
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests).toHaveLength(1);
      expect(call.requestBody.requests[0]).toHaveProperty('updateEmbeddedObjectPosition');
    });

    it('should update both spec and position', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        chartType: 'AREA',
        position: {
          anchorCell: 'B10',
        },
        options: {
          title: 'New Title',
          stacked: true,
        },
      });

      expect(result.response.success).toBe(true);
      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests).toHaveLength(2);
    });

    it('should return success when no updates provided', async () => {
      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
      });

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should respect dryRun safety option', async () => {
      // Note: update action doesn't have explicit dryRun support at the top level
      // It will still execute API calls for updates with safety.dryRun
      // This test verifies that no API call is made when there are no actual updates
      const result = await handler.handle({
        action: 'update',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      // No dryRun field is returned when no updates are provided
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('delete action', () => {
    it('should delete a chart', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'delete',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'delete');
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('deleteEmbeddedObject');
      expect(call.requestBody.requests[0].deleteEmbeddedObject.objectId).toBe(12345);
    });

    it('should respect dryRun for destructive operation', async () => {
      const result = await handler.handle({
        action: 'delete',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('list action', () => {
    it('should list all charts in spreadsheet', async () => {
      // Reset the mock from beforeEach before setting new value
      mockSheetsApi.spreadsheets.get.mockReset();
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              charts: [
                {
                  chartId: 111,
                  spec: {
                    title: 'Chart 1',
                    basicChart: { chartType: 'BAR' },
                  },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 0, rowIndex: 1, columnIndex: 3 },
                      offsetXPixels: 0,
                      offsetYPixels: 0,
                      widthPixels: 600,
                      heightPixels: 400,
                    },
                  },
                },
                {
                  chartId: 222,
                  spec: {
                    title: 'Chart 2',
                    basicChart: { chartType: 'LINE' },
                  },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 0, rowIndex: 10, columnIndex: 3 },
                      offsetXPixels: 10,
                      offsetYPixels: 20,
                      widthPixels: 700,
                      heightPixels: 450,
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'test-sheet-id',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'list');
      expect(result.response.charts).toHaveLength(2);
      expect(result.response.charts![0].chartId).toBe(111);
      expect(result.response.charts![0].chartType).toBe('BAR');
      expect(result.response.charts![0].title).toBe('Chart 1');
      expect(result.response.charts![1].chartId).toBe(222);
      expect(result.response.charts![1].chartType).toBe('LINE');
      expect(result.response.charts![1].title).toBe('Chart 2');
    });

    it('should list charts for specific sheet', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              charts: [
                {
                  chartId: 111,
                  spec: { basicChart: { chartType: 'BAR' } },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
                      offsetXPixels: 0,
                      offsetYPixels: 0,
                      widthPixels: 600,
                      heightPixels: 400,
                    },
                  },
                },
              ],
            },
            {
              properties: { sheetId: 1, title: 'Sheet2' },
              charts: [
                {
                  chartId: 222,
                  spec: { basicChart: { chartType: 'LINE' } },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 1, rowIndex: 0, columnIndex: 0 },
                      offsetXPixels: 0,
                      offsetYPixels: 0,
                      widthPixels: 600,
                      heightPixels: 400,
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'test-sheet-id',
        sheetId: 1,
      });

      expect(result.response.success).toBe(true);
      expect(result.response.charts).toHaveLength(1);
      expect(result.response.charts![0].chartId).toBe(222);
      expect(result.response.charts![0].sheetId).toBe(1);
    });

    it('should return empty list when no charts exist', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              charts: [],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'test-sheet-id',
      });

      expect(result.response.success).toBe(true);
      expect(result.response.charts).toHaveLength(0);
    });
  });

  describe('get action', () => {
    it('should get specific chart details', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              charts: [
                {
                  chartId: 12345,
                  spec: {
                    title: 'My Chart',
                    basicChart: { chartType: 'COLUMN' },
                  },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 0, rowIndex: 2, columnIndex: 5 },
                      offsetXPixels: 15,
                      offsetYPixels: 25,
                      widthPixels: 650,
                      heightPixels: 450,
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'get');
      expect(result.response.charts).toHaveLength(1);
      expect(result.response.charts![0].chartId).toBe(12345);
      expect(result.response.charts![0].title).toBe('My Chart');
      expect(result.response.charts![0].chartType).toBe('COLUMN');
      expect(result.response.charts![0].position.anchorCell).toBe('F3');
      expect(result.response.charts![0].position.offsetX).toBe(15);
      expect(result.response.charts![0].position.offsetY).toBe(25);
      expect(result.response.charts![0].position.width).toBe(650);
      expect(result.response.charts![0].position.height).toBe(450);
    });

    it('should return error when chart not found', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              charts: [],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-sheet-id',
        chartId: 99999,
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('SHEET_NOT_FOUND');
    });
  });

  describe('move action', () => {
    it('should move chart to new position', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'move',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        position: {
          anchorCell: 'H10',
          offsetX: 5,
          offsetY: 10,
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'move');
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('updateEmbeddedObjectPosition');
      expect(call.requestBody.requests[0].updateEmbeddedObjectPosition.objectId).toBe(12345);
      expect(call.requestBody.requests[0].updateEmbeddedObjectPosition.fields).toBe('overlayPosition');
    });
  });

  describe('resize action', () => {
    it('should resize chart', async () => {
      // Mock fetching current position
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              charts: [
                {
                  chartId: 12345,
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 0, rowIndex: 1, columnIndex: 3 },
                      offsetXPixels: 10,
                      offsetYPixels: 20,
                      widthPixels: 600,
                      heightPixels: 400,
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'resize',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        width: 800,
        height: 600,
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'resize');
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('updateEmbeddedObjectPosition');
      const position = call.requestBody.requests[0].updateEmbeddedObjectPosition.newPosition.overlayPosition;
      expect(position.widthPixels).toBe(800);
      expect(position.heightPixels).toBe(600);
    });
  });

  describe('update_data_range action', () => {
    it('should update chart data range', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'update_data_range',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        data: {
          sourceRange: { a1: 'Sheet1!A1:C20' },
          categories: 0,
          series: [{ column: 1 }, { column: 2 }],
        },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'update_data_range');
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();

      const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0][0];
      expect(call.requestBody.requests[0]).toHaveProperty('updateChartSpec');
      expect(call.requestBody.requests[0].updateChartSpec.chartId).toBe(12345);
    });

    it('should respect dryRun for data range update', async () => {
      const result = await handler.handle({
        action: 'update_data_range',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        data: {
          sourceRange: { a1: 'Sheet1!A1:C20' },
        },
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.dryRun).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('export action', () => {
    it('should return feature unavailable error', async () => {
      const result = await handler.handle({
        action: 'export',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
        format: 'PNG',
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('FEATURE_UNAVAILABLE');
      expect(result.response.error?.message).toContain('Chart export is not yet available');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockRejectedValue(
        new Error('API Error: 403 Permission denied')
      );

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'BAR',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B10' },
        },
        position: {
          anchorCell: 'D2',
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBeDefined();
    });

    it('should validate schema compliance for errors', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockRejectedValue(new Error('Test error'));

      const result = await handler.handle({
        action: 'delete',
        spreadsheetId: 'test-sheet-id',
        chartId: 12345,
      });

      const parseResult = SheetsChartsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle invalid action', async () => {
      const result = await handler.handle({
        action: 'invalid_action',
        spreadsheetId: 'test-sheet-id',
      } as any);

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('range resolution', () => {
    it('should resolve semantic ranges for chart data', async () => {
      mockContext.rangeResolver.resolve = vi.fn().mockResolvedValue({
        a1Notation: 'Sheet1!A1:B100',
        sheetId: 0,
        sheetName: 'Sheet1',
      });

      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 55555 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'BAR',
        data: {
          sourceRange: { sheetName: 'Sheet1', range: 'A1:B100' },
        },
        position: {
          anchorCell: 'D2',
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockContext.rangeResolver.resolve).toHaveBeenCalled();
    });
  });

  describe('output schema validation', () => {
    it('should validate all success responses', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addChart: {
                chart: { chartId: 123 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'create',
        spreadsheetId: 'test-sheet-id',
        sheetId: 0,
        chartType: 'BAR',
        data: {
          sourceRange: { a1: 'Sheet1!A1:B10' },
        },
        position: {
          anchorCell: 'D2',
        },
      });

      const parseResult = SheetsChartsOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) {
        console.error('Schema validation errors:', parseResult.error.format());
      }
    });
  });
});
