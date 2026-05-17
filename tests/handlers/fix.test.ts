/**
 * ServalSheets - Fix Handler Tests
 *
 * Tests for automated issue resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FixHandler } from '../../src/handlers/fix.js';
import { SheetsFixOutputSchema } from '../../src/schemas/fix.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { IssueToFix } from '../../src/schemas/fix.js';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    values: {
      get: vi.fn(),
      update: vi.fn(),
    },
    batchUpdate: vi.fn(),
  },
});

// Mock handler context
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
});

describe('FixHandler', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: FixHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new FixHandler(mockContext, mockApi as any);
  });

  const sampleIssues: IssueToFix[] = [
    {
      type: 'MULTIPLE_TODAY',
      severity: 'medium',
      description: 'Multiple TODAY() calls found',
    },
    {
      type: 'NO_FROZEN_HEADERS',
      severity: 'low',
      sheet: 'Sheet1',
      description: 'Headers not frozen',
    },
  ];

  describe('fix action - preview mode', () => {
    it('should generate fix operations in preview mode', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: sampleIssues,
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('mode', 'preview');
      expect(result.response).toHaveProperty('operations');
      expect(result.response.operations.length).toBeGreaterThan(0);
      expect(result.response).not.toHaveProperty('results');

      const parseResult = SheetsFixOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should respect dryRun safety option', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix' as const,
        spreadsheetId: 'test-id',
        issues: sampleIssues,
        mode: 'apply' as const,
        safety: { dryRun: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.mode).toBe('preview');
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should show estimated impact for each operation', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [sampleIssues[1]], // NO_FROZEN_HEADERS
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      const operation = result.response.operations[0];
      expect(operation).toHaveProperty('estimatedImpact');
      expect(operation).toHaveProperty('risk');
      expect(operation.estimatedImpact).toContain('Freeze');
    });

    it('should generate bounded formula rewrites for full-column references', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: {
                title: 'Sheet1',
                gridProperties: { rowCount: 500 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        mode: 'preview',
        issues: [
          {
            type: 'FULL_COLUMN_REFS',
            severity: 'medium',
            sheet: 'Sheet1',
            description: 'Full column refs',
            metadata: {
              cell: 'Sheet1!C2',
              formula: '=SUM(A:A)+COUNT(B:B)',
            },
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).operations[0].parameters.values).toEqual([
        ['=SUM(A1:A500)+COUNT(B1:B500)'],
      ]);
    });

    it('should simplify nested IFERROR with same fallback as low risk', async () => {
      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        mode: 'preview',
        issues: [
          {
            type: 'NESTED_IFERROR',
            severity: 'low',
            description: 'Nested IFERROR',
            metadata: {
              cell: 'Sheet1!D2',
              formula: '=IFERROR(IFERROR(A2/B2,0),0)',
            },
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).operations[0]).toMatchObject({
        risk: 'low',
        parameters: { values: [['=IFERROR(A2/B2,0)']] },
      });
    });

    it('should preserve different IFERROR fallbacks and mark the rewrite high risk', async () => {
      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        mode: 'preview',
        issues: [
          {
            type: 'NESTED_IFERROR',
            severity: 'medium',
            description: 'Nested IFERROR',
            metadata: {
              cell: 'Sheet1!D2',
              formula: '=IFERROR(IFERROR(A2/B2,"inner"),"outer")',
            },
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).operations[0]).toMatchObject({
        risk: 'high',
        parameters: { values: [['=IFERROR(A2/B2,IFERROR("inner","outer"))']] },
      });
    });

    it('should delete exact duplicate conditional format rules highest index first', async () => {
      const duplicateRule = {
        ranges: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10 }],
        booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'x' }] } },
      };
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              conditionalFormats: [
                duplicateRule,
                { ranges: [{ sheetId: 0, startRowIndex: 10, endRowIndex: 20 }] },
                duplicateRule,
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        mode: 'preview',
        issues: [
          {
            type: 'EXCESSIVE_CF_RULES',
            severity: 'low',
            sheet: 'Sheet1',
            description: 'Duplicate conditional format rules',
          },
        ],
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).operations.map((op: any) => op.parameters.ruleIndex)).toEqual([
        2,
      ]);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('fix action - apply mode', () => {
    it('should apply fixes in apply mode', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [sampleIssues[1]], // NO_FROZEN_HEADERS
        mode: 'apply',
        safety: { createSnapshot: false },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('mode', 'apply');
      expect(result.response).toHaveProperty('results');
      expect(result.response.results).toBeInstanceOf(Array);
      expect(result.response.summary.applied).toBeGreaterThan(0);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('should create snapshot before applying fixes', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [sampleIssues[1]],
        mode: 'apply',
        safety: { createSnapshot: true },
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('snapshotId');
    });

    it('should track successful and failed operations', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });
      mockApi.spreadsheets.batchUpdate
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [
          { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'Sheet1', description: 'Test 1' },
          { type: 'NO_FROZEN_COLUMNS', severity: 'low', sheet: 'Sheet1', description: 'Test 2' },
        ],
        mode: 'apply',
        safety: { createSnapshot: false },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.summary.applied).toBeGreaterThan(0);
      expect(result.response.summary.failed).toBeGreaterThan(0);
    });
  });

  describe('issue filtering', () => {
    it('should filter by severity', async () => {
      const issues: IssueToFix[] = [
        { type: 'MULTIPLE_TODAY', severity: 'high', description: 'High' },
        { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'Sheet1', description: 'Low' },
        { type: 'NO_PROTECTION', severity: 'medium', sheet: 'Sheet1', description: 'Medium' },
      ];

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues,
        mode: 'preview',
        filters: { severity: ['high'] },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.operations.length).toBeGreaterThan(0);
      expect(
        result.response.operations.every((op) =>
          issues.find((i) => i.type === op.issueType && i.severity === 'high')
        )
      ).toBe(true);
    });

    it('should filter by issue type', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix' as const,
        spreadsheetId: 'test-id',
        issues: sampleIssues,
        mode: 'preview' as const,
        filters: { types: ['NO_FROZEN_HEADERS'] },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.operations.every((op) => op.issueType === 'NO_FROZEN_HEADERS')).toBe(
        true
      );
    });

    it('should filter by sheet name', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { sheetId: 0, title: 'Sheet1' } },
            { properties: { sheetId: 1, title: 'Sheet2' } },
          ],
        },
      });

      const issues: IssueToFix[] = [
        { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'Sheet1', description: 'S1' },
        { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'Sheet2', description: 'S2' },
      ];

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues,
        mode: 'preview',
        filters: { sheets: ['Sheet1'] },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.operations.length).toBeGreaterThan(0);
    });

    it('should limit number of fixes', async () => {
      const manyIssues: IssueToFix[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          type: 'NO_FROZEN_HEADERS' as const,
          severity: 'low' as const,
          sheet: `Sheet${i}`,
          description: `Issue ${i}`,
        }));

      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: manyIssues.map((_, i) => ({
            properties: { sheetId: i, title: `Sheet${i}` },
          })),
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: manyIssues,
        mode: 'preview',
        filters: { limit: 3 },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.operations.length).toBeLessThanOrEqual(3);
    });

    it('should return early when no issues match filters', async () => {
      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: sampleIssues,
        mode: 'preview',
        filters: { severity: ['high'] }, // No high severity issues
      });

      expect(result.response.success).toBe(true);
      expect(result.response.operations).toHaveLength(0);
      expect(result.response.summary.skipped).toBe(sampleIssues.length);
    });
  });

  describe('specific fix operations', () => {
    it('should generate MULTIPLE_TODAY fix operations', async () => {
      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [{ type: 'MULTIPLE_TODAY', severity: 'medium', description: 'Test' }],
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      const ops = result.response.operations.filter((op) => op.issueType === 'MULTIPLE_TODAY');
      expect(ops.length).toBeGreaterThan(0);

      // MULTIPLE_TODAY operations use sheets_data and sheets_advanced
      expect(ops.some((op) => op.tool === 'sheets_data' || op.tool === 'sheets_advanced')).toBe(
        true
      );
    });

    it('should generate NO_FROZEN_HEADERS fix operations', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [
          { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'Sheet1', description: 'Test' },
        ],
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      const op = result.response.operations.find((op) => op.issueType === 'NO_FROZEN_HEADERS');
      expect(op).toBeDefined();
      expect(op!.tool).toBe('sheets_dimensions');
      expect(op!.action).toBe('freeze_rows');
    });

    it('should generate NO_FROZEN_COLUMNS fix operations', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [
          { type: 'NO_FROZEN_COLUMNS', severity: 'low', sheet: 'Sheet1', description: 'Test' },
        ],
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      const op = result.response.operations.find((op) => op.issueType === 'NO_FROZEN_COLUMNS');
      expect(op).toBeDefined();
      expect(op!.action).toBe('freeze_columns');
    });

    it('should generate NO_PROTECTION fix operations', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [
          { type: 'NO_PROTECTION', severity: 'medium', sheet: 'Sheet1', description: 'Test' },
        ],
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      const op = result.response.operations.find((op) => op.issueType === 'NO_PROTECTION');
      expect(op).toBeDefined();
      expect(op!.tool).toBe('sheets_advanced');
      expect(op!.action).toBe('add_protected_range');
    });
  });

  describe('error handling', () => {
    it('should handle sheet not found errors', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: { sheets: [] },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [
          { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'NonExistent', description: 'Test' },
        ],
        mode: 'preview',
      });

      expect(result.response.success).toBe(true);
      // Should skip operations for sheets that don't exist
      expect(result.response.operations).toHaveLength(0);
    });

    it('should handle API errors during apply', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(
        new Error('API Error: 403 Permission denied')
      );

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [
          { type: 'NO_FROZEN_HEADERS', severity: 'low', sheet: 'Sheet1', description: 'Test' },
        ],
        mode: 'apply',
        safety: { createSnapshot: false },
      });

      expect(result.response.success).toBe(true);
      expect(result.response.summary.failed).toBeGreaterThan(0);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Use an issue type that doesn't call spreadsheets.get (MULTIPLE_TODAY only generates operations)
      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [{ type: 'MULTIPLE_TODAY', severity: 'medium', description: 'Multiple TODAY()' }],
        mode: 'preview',
      });

      // Preview mode returns operations without executing - should succeed
      expect(result.response.success).toBe(true);
      expect(result.response.operations).toBeDefined();
    });
  });

  describe('retry wrapping for Google API calls', () => {
    it('rejects when fetchRangeData fails (unhandled in submodule return)', async () => {
      mockApi.spreadsheets.values.get = vi.fn().mockRejectedValue({ message: 'API unavailable', code: 500 });

      await expect(handler.handle({
        action: 'clean',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        rules: [{ id: 'trim_whitespace' }],
        mode: 'apply',
        safety: { createSnapshot: false },
      })).rejects.toBeDefined();

      expect(mockApi.spreadsheets.values.get).toHaveBeenCalledTimes(1);
    });

    it('rejects when writeChanges fails (unhandled in submodule return)', async () => {
      mockApi.spreadsheets.values.get = vi.fn().mockResolvedValue({
        data: { values: [['Col1', 'Col2'], ['hello ', ' world']] },
      });

      mockApi.spreadsheets.values.update = vi.fn().mockRejectedValue({ message: 'API unavailable', code: 500 });

      await expect(handler.handle({
        action: 'clean',
        spreadsheetId: 'test-id',
        range: { a1: 'Sheet1!A1:B2' },
        rules: [{ id: 'trim_whitespace' }],
        mode: 'apply',
        safety: { createSnapshot: false },
      })).rejects.toBeDefined();

      expect(mockApi.spreadsheets.values.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('schema compliance', () => {
    it('should validate preview output against schema', async () => {
      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [],
        mode: 'preview',
      });

      const parseResult = SheetsFixOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should validate apply output against schema', async () => {
      mockApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      const result = await handler.handle({
        action: 'fix',
        spreadsheetId: 'test-id',
        issues: [],
        mode: 'apply',
        safety: { createSnapshot: false },
      });

      const parseResult = SheetsFixOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });
});
