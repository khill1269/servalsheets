/**
 * ServalSheets - Analyze Handler Tests
 *
 * Tests for AI-powered data analysis using MCP Sampling (SEP-1577).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyzeHandler } from '../../src/handlers/analyze.js';
import { SheetsAnalyzeOutputSchema } from '../../src/schemas/analyze.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import { resetCapabilityCacheService } from '../../src/services/capability-cache.js';

// Mock capability cache at module level
vi.mock('../../src/services/capability-cache.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/capability-cache.js')>(
    '../../src/services/capability-cache.js'
  );
  return {
    ...actual,
    getCapabilitiesWithCache: vi.fn().mockResolvedValue({
      sampling: { supportedMethods: ['createMessage'] },
    }),
  };
});

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    values: {
      get: vi.fn(),
    },
  },
});

// Mock handler context with server support
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
      gridRange: { sheetId: 0 },
      resolution: { method: 'a1_direct', confidence: 1.0, path: '' },
    }),
  } as any,
  server: {
    createMessage: vi.fn(),
  } as any,
  requestId: 'test-request-id',
});

describe('AnalyzeHandler', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: AnalyzeHandler;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset capability cache singleton between tests
    resetCapabilityCacheService();

    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new AnalyzeHandler(mockContext, mockApi as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyze action', () => {
    it('should analyze data with sampling support', async () => {
      // Mock data fetch
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['Name', 'Age', 'Score'],
            ['Alice', '25', '95'],
            ['Bob', '30', '87'],
            ['Charlie', '22', '92'],
          ],
        },
      });

      // Mock sampling response
      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: {
          type: 'text',
          text: JSON.stringify({
            summary: 'Dataset contains 3 records with name, age, and score data',
            analyses: [
              {
                type: 'summary',
                confidence: 'high',
                findings: ['3 complete records', 'No missing values'],
                details: 'Data appears clean and complete',
                recommendations: ['Consider adding more records for trend analysis'],
              },
            ],
            overallQualityScore: 85,
            topInsights: ['High score average', 'Age range 22-30'],
          }),
        },
      });

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary', 'quality'],
      });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('summary');
      expect(result.response).toHaveProperty('analyses');
      expect(result.response.analyses).toHaveLength(1);
      expect(result.response).toHaveProperty('overallQualityScore', 85);

      // Validate against schema
      const parseResult = SheetsAnalyzeOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle no data found error', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] },
      });

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary'],
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NO_DATA');
    });

    it('should handle missing server instance', async () => {
      const contextWithoutServer = { ...mockContext, server: undefined };
      const handlerNoServer = new AnalyzeHandler(contextWithoutServer, mockApi as any);

      const result = await handlerNoServer.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary'],
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('SAMPLING_UNAVAILABLE');
      expect(result.response.error?.message).toContain('MCP Server instance not available');
    });

    it('should handle sampling capability not available', async () => {
      // Override the mock to return no sampling support
      const { getCapabilitiesWithCache } = await import('../../src/services/capability-cache.js');
      vi.mocked(getCapabilitiesWithCache).mockResolvedValueOnce({});

      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['A', 'B']] },
      });

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary'],
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('SAMPLING_UNAVAILABLE');
    });

    it('should handle parse error in LLM response', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['A', 'B'], ['1', '2']] },
      });

      // Mock invalid sampling response
      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: { type: 'text', text: 'invalid json' },
      });

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary'],
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('PARSE_ERROR');
    });

    it('should support different analysis types', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['A', 'B'], ['1', '2']] },
      });

      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: {
          type: 'text',
          text: JSON.stringify({
            summary: 'Test',
            analyses: [
              { type: 'patterns', confidence: 'medium', findings: ['Pattern found'], details: 'Detail' },
              { type: 'anomalies', confidence: 'low', findings: ['No anomalies'], details: 'Clean' },
            ],
            overallQualityScore: 90,
            topInsights: ['Insight 1'],
          }),
        },
      });

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['patterns', 'anomalies', 'trends'],
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('generate_formula action', () => {
    it('should generate formula from description', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [['Product', 'Price', 'Quantity'], ['Apple', '1.50', '10']],
        },
      });

      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: {
          type: 'text',
          text: JSON.stringify({
            formula: '=B2*C2',
            explanation: 'Multiply price by quantity',
            assumptions: ['Columns B and C contain numeric values'],
            alternatives: [{ formula: '=PRODUCT(B2,C2)', useCase: 'Alternative syntax' }],
            tips: ['Use $ for absolute references'],
          }),
        },
      });

      const result = await handler.handle({
        action: 'generate_formula',
        spreadsheetId: 'test-id',
        description: 'Calculate total price',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('formula');
      expect(result.response.formula?.formula).toBe('=B2*C2');
      expect(result.response.formula?.explanation).toBeDefined();

      const parseResult = SheetsAnalyzeOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle formula generation without range context', async () => {
      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: {
          type: 'text',
          text: JSON.stringify({
            formula: '=SUM(A1:A10)',
            explanation: 'Sum values in range',
          }),
        },
      });

      const result = await handler.handle({
        action: 'generate_formula',
        spreadsheetId: 'test-id',
        description: 'Sum the first column',
      });

      expect(result.response.success).toBe(true);
      expect(result.response.formula?.formula).toBe('=SUM(A1:A10)');
    });

    it('should handle formula parse error', async () => {
      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: { type: 'text', text: 'no json here' },
      });

      const result = await handler.handle({
        action: 'generate_formula',
        spreadsheetId: 'test-id',
        description: 'test',
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('PARSE_ERROR');
    });
  });

  describe('suggest_chart action', () => {
    it('should suggest chart types for data', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['Month', 'Sales'],
            ['Jan', '1000'],
            ['Feb', '1500'],
            ['Mar', '1200'],
          ],
        },
      });

      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: {
          type: 'text',
          text: JSON.stringify({
            recommendations: [
              {
                chartType: 'LINE',
                suitabilityScore: 90,
                reasoning: 'Shows trends over time',
                configuration: { categories: 'A2:A4', series: ['B2:B4'] },
                insights: ['Upward trend from Jan to Feb'],
              },
              {
                chartType: 'COLUMN',
                suitabilityScore: 85,
                reasoning: 'Good for comparing values',
                configuration: { categories: 'A2:A4', series: ['B2:B4'] },
              },
            ],
            dataAssessment: {
              dataType: 'time-series',
              rowCount: 3,
              columnCount: 2,
              hasHeaders: true,
            },
          }),
        },
      });

      const result = await handler.handle({
        action: 'suggest_chart',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B4' },
        goal: 'show trends',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('chartRecommendations');
      expect(result.response.chartRecommendations).toHaveLength(2);
      expect(result.response.chartRecommendations![0].chartType).toBe('LINE');

      const parseResult = SheetsAnalyzeOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle empty data range', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] },
      });

      const result = await handler.handle({
        action: 'suggest_chart',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B10' },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('NO_DATA');
    });
  });

  describe('get_stats action', () => {
    it('should return analysis statistics', async () => {
      const result = await handler.handle({
        action: 'get_stats',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('stats');
      expect(result.response.stats).toHaveProperty('totalRequests');
      expect(result.response.stats).toHaveProperty('successRate');

      const parseResult = SheetsAnalyzeOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockApi.spreadsheets.values.get.mockRejectedValue(
        new Error('API Error: 404 Not Found')
      );

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'invalid-id',
        analysisTypes: ['summary'],
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INTERNAL_ERROR');
    });

    it('should handle sampling service errors', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['A', 'B']] },
      });

      mockContext.server!.createMessage = vi.fn().mockRejectedValue(
        new Error('Sampling service unavailable')
      );

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary'],
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('range resolution', () => {
    it('should resolve A1 notation ranges', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['A']] },
      });

      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: { type: 'text', text: JSON.stringify({ summary: 'test', analyses: [], overallQualityScore: 50, topInsights: [] }) },
      });

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:Z100' },
        analysisTypes: ['summary'],
      });

      expect(mockApi.spreadsheets.values.get).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:Z100',
        })
      );
    });

    it('should use default range when not specified', async () => {
      mockApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['A']] },
      });

      mockContext.server!.createMessage = vi.fn().mockResolvedValue({
        content: { type: 'text', text: JSON.stringify({ summary: 'test', analyses: [], overallQualityScore: 50, topInsights: [] }) },
      });

      await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-id',
        analysisTypes: ['summary'],
      });

      expect(mockApi.spreadsheets.values.get).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'A:ZZ',
        })
      );
    });
  });
});
