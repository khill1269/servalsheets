/**
 * F2: Multi-Spreadsheet Federation Tests
 *
 * Tests for cross_read, cross_query, cross_write, cross_compare actions
 * added to the sheets_data tool.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsDataHandler } from '../../src/handlers/data.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

// Standard mock data: headers + 2 data rows
const MOCK_SHEET_A = [
  ['Name', 'Revenue', 'Region'],
  ['Alice', 50000, 'West'],
  ['Bob', 30000, 'East'],
];

const MOCK_SHEET_B = [
  ['Name', 'Cost', 'Region'],
  ['Alice', 20000, 'West'],
  ['Charlie', 15000, 'North'],
];

const createMockSheetsApi = (overrides?: {
  getValues?: ReturnType<typeof vi.fn>;
  updateValues?: ReturnType<typeof vi.fn>;
}) => ({
  spreadsheets: {
    get: vi.fn().mockResolvedValue({ data: { spreadsheetId: 'src-id' } }),
    values: {
      get: overrides?.getValues ?? vi.fn().mockResolvedValue({ data: { values: MOCK_SHEET_A } }),
      update: overrides?.updateValues ?? vi.fn().mockResolvedValue({
        data: { updatedRange: 'Sheet1!A1:C3', updatedRows: 3, updatedColumns: 3, updatedCells: 9 },
      }),
      batchGet: vi.fn().mockResolvedValue({ data: { valueRanges: [] } }),
      batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
      batchGetByDataFilter: vi.fn().mockResolvedValue({ data: { valueRanges: [] } }),
      batchUpdateByDataFilter: vi.fn().mockResolvedValue({ data: {} }),
      batchClearByDataFilter: vi.fn().mockResolvedValue({ data: {} }),
      clear: vi.fn().mockResolvedValue({ data: {} }),
      append: vi.fn().mockResolvedValue({ data: { updates: {} } }),
    },
    batchUpdate: vi.fn().mockResolvedValue({ data: { replies: [] } }),
  },
}) as unknown as sheets_v4.Sheets;

const createMockContext = (): HandlerContext =>
  ({
    requestId: 'test-request',
    timestamp: new Date(),
    session: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), clear: vi.fn(), has: vi.fn(), keys: vi.fn() },
    capabilities: { supports: vi.fn(() => true), requireCapability: vi.fn(), getCapability: vi.fn() },
    googleClient: {} as never,
    authService: {
      isAuthenticated: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockResolvedValue({}),
    } as never,
    elicitationServer: {
      getClientCapabilities: vi.fn().mockReturnValue({ elicitation: { form: true } }),
      elicit: vi.fn().mockResolvedValue({ action: 'accept', data: {} }),
    } as never,
    samplingServer: null,
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never,
  }) as unknown as HandlerContext;

describe('F2: Cross-Spreadsheet Federation', () => {
  let handler: SheetsDataHandler;
  let mockSheetsApi: sheets_v4.Sheets;
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
    mockSheetsApi = createMockSheetsApi();
    handler = new SheetsDataHandler(mockContext, mockSheetsApi);
  });

  // ==========================================================================
  // cross_read
  // ==========================================================================

  describe('cross_read', () => {
    it('should concatenate rows from two sources with _source column', async () => {
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { values: callCount === 1 ? MOCK_SHEET_A : MOCK_SHEET_B },
        });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_read',
          sources: [
            { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3', label: 'Sales' },
            { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3', label: 'Costs' },
          ],
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.action).toBe('cross_read');
      expect(result.response.mergedHeaders).toContain('_source');
      expect(result.response.sourcesRead).toBe(2);
      // 2 data rows from each source = 4 merged rows
      expect(result.response.rows).toHaveLength(4);
      // First row should have 'Sales' as _source
      expect(result.response.rows?.[0]?.[0]).toBe('Sales');
    });

    it('should join on key column when joinKey is provided', async () => {
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { values: callCount === 1 ? MOCK_SHEET_A : MOCK_SHEET_B },
        });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_read',
          sources: [
            { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3', label: 'A' },
            { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3', label: 'B' },
          ],
          joinKey: 'Name',
          joinType: 'left',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.mergedHeaders).not.toContain('_source');
      expect(result.response.mergedHeaders).toContain('Name');
      // Left join: Alice (in both) + Bob (only in A) = 2 rows
      expect(result.response.rows).toHaveLength(2);
    });

    it('should include only matching rows for inner join', async () => {
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { values: callCount === 1 ? MOCK_SHEET_A : MOCK_SHEET_B },
        });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_read',
          sources: [
            { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3' },
            { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3' },
          ],
          joinKey: 'Name',
          joinType: 'inner',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      // Inner join: only Alice appears in both sources
      expect(result.response.rows).toHaveLength(1);
    });

    it('should return error when joinKey not found in first source', async () => {
      const result = await handler.handle({
        request: {
          action: 'cross_read',
          sources: [
            { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3' },
            { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3' },
          ],
          joinKey: 'NonExistentColumn',
        },
      });

      expect(result.response.success).toBe(false);
    });

    it('should fetch sources in parallel', async () => {
      const getValues = vi.fn().mockResolvedValue({ data: { values: MOCK_SHEET_A } });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      await handler.handle({
        request: {
          action: 'cross_read',
          sources: [
            { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3' },
            { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3' },
            { spreadsheetId: 'ss3', range: 'Sheet1!A1:C3' },
          ],
        },
      });

      // One API call per source
      expect(getValues).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // cross_query
  // ==========================================================================

  describe('cross_query', () => {
    it('should return matching rows containing the query string', async () => {
      const result = await handler.handle({
        request: {
          action: 'cross_query',
          sources: [{ spreadsheetId: 'ss1', range: 'Sheet1!A1:C3', label: 'Sales' }],
          query: 'alice',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.action).toBe('cross_query');
      expect(result.response.queryMatches).toHaveLength(1);
      expect(result.response.queryMatches?.[0]?.matchedValues).toContain('Alice');
      expect(result.response.queryMatches?.[0]?.label).toBe('Sales');
      expect(result.response.totalSearched).toBe(2); // 2 data rows
    });

    it('should return empty matches when no rows match query', async () => {
      const result = await handler.handle({
        request: {
          action: 'cross_query',
          sources: [{ spreadsheetId: 'ss1', range: 'Sheet1!A1:C3' }],
          query: 'zzz_no_match',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.queryMatches).toHaveLength(0);
    });

    it('should search across all sources and aggregate matches', async () => {
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { values: callCount === 1 ? MOCK_SHEET_A : MOCK_SHEET_B },
        });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_query',
          sources: [
            { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3' },
            { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3' },
          ],
          query: 'Alice',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      // Alice appears in both sources
      expect(result.response.queryMatches).toHaveLength(2);
      expect(result.response.totalSearched).toBe(4); // 2 rows from each source
    });

    it('should respect maxResults limit', async () => {
      const manyRows = [
        ['Name'],
        ...Array.from({ length: 20 }, (_, i) => [`Alice_${i}`]),
      ];
      const getValues = vi.fn().mockResolvedValue({ data: { values: manyRows } });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_query',
          sources: [{ spreadsheetId: 'ss1', range: 'Sheet1!A1:A21' }],
          query: 'Alice',
          maxResults: 5,
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.queryMatches?.length).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // cross_write
  // ==========================================================================

  describe('cross_write', () => {
    it('should copy data from source to destination spreadsheet', async () => {
      const result = await handler.handle({
        request: {
          action: 'cross_write',
          source: { spreadsheetId: 'src-ss', range: 'Sheet1!A1:C3' },
          destination: { spreadsheetId: 'dst-ss', range: 'Sheet1!A1' },
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.action).toBe('cross_write');
      expect(typeof result.response.cellsCopied).toBe('number');
      expect(result.response.updatedRange).toBe('Sheet1!A1:C3');
    });

    it('should call values.get on source and values.update on destination', async () => {
      const getValues = vi.fn().mockResolvedValue({ data: { values: MOCK_SHEET_A } });
      const updateValues = vi.fn().mockResolvedValue({
        data: { updatedRange: 'DestSheet!A1:C3', updatedRows: 3, updatedColumns: 3, updatedCells: 9 },
      });
      mockSheetsApi = createMockSheetsApi({ getValues, updateValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      await handler.handle({
        request: {
          action: 'cross_write',
          source: { spreadsheetId: 'src-ss', range: 'Sheet1!A1:C3' },
          destination: { spreadsheetId: 'dst-ss', range: 'DestSheet!A1' },
        },
      });

      expect(getValues).toHaveBeenCalledWith(
        expect.objectContaining({ spreadsheetId: 'src-ss', range: 'Sheet1!A1:C3' })
      );
      expect(updateValues).toHaveBeenCalledWith(
        expect.objectContaining({ spreadsheetId: 'dst-ss', range: 'DestSheet!A1' })
      );
    });

    it('should count non-null cells as cellsCopied', async () => {
      // MOCK_SHEET_A has 3 rows × 3 cols = 9 cells but first is header
      // Headers + 2 data rows = 9 total cells (all non-null)
      const result = await handler.handle({
        request: {
          action: 'cross_write',
          source: { spreadsheetId: 'src-ss', range: 'Sheet1!A1:C3' },
          destination: { spreadsheetId: 'dst-ss', range: 'Sheet1!A1' },
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.cellsCopied).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // cross_compare
  // ==========================================================================

  describe('cross_compare', () => {
    it('should detect rows present in source2 but not source1 (added)', async () => {
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        // source1: Alice + Bob; source2: Alice + Charlie
        return Promise.resolve({
          data: { values: callCount === 1 ? MOCK_SHEET_A : MOCK_SHEET_B },
        });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_compare',
          source1: { spreadsheetId: 'ss1', range: 'Sheet1!A1:C3' },
          source2: { spreadsheetId: 'ss2', range: 'Sheet1!A1:C3' },
          keyColumn: 'Name',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      expect(result.response.action).toBe('cross_compare');
      const diff = result.response.diff!;
      // Charlie is in ss2 but not ss1 → added
      expect(diff.added).toHaveLength(1);
      // Bob is in ss1 but not ss2 → removed
      expect(diff.removed).toHaveLength(1);
      expect(diff.summary.addedRows).toBe(1);
      expect(diff.summary.removedRows).toBe(1);
    });

    it('should detect changed cell values between sources', async () => {
      const src1 = [['Name', 'Value'], ['Alice', 100]];
      const src2 = [['Name', 'Value'], ['Alice', 999]]; // Alice changed
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { values: callCount === 1 ? src1 : src2 } });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_compare',
          source1: { spreadsheetId: 'ss1', range: 'Sheet1!A1:B2' },
          source2: { spreadsheetId: 'ss2', range: 'Sheet1!A1:B2' },
          keyColumn: 'Name',
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      const diff = result.response.diff!;
      expect(diff.summary.changedCells).toBe(1);
      expect(diff.changed?.[0]?.key).toBe('Alice');
      expect(diff.changed?.[0]?.column).toBe('Value');
      expect(diff.changed?.[0]?.source1Value).toBe(100);
      expect(diff.changed?.[0]?.source2Value).toBe(999);
    });

    it('should do row-by-row comparison when no keyColumn is specified', async () => {
      const src1 = [['A', 'B'], [1, 2], [3, 4]];
      const src2 = [['A', 'B'], [1, 2]]; // src2 has one fewer row
      let callCount = 0;
      const getValues = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { values: callCount === 1 ? src1 : src2 } });
      });
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_compare',
          source1: { spreadsheetId: 'ss1', range: 'Sheet1!A1:B3' },
          source2: { spreadsheetId: 'ss2', range: 'Sheet1!A1:B2' },
        },
      });

      expect(result.response.success).toBe(true);
      if (!result.response.success) return;
      const diff = result.response.diff!;
      // Row [3,4] is in src1 but not src2 → removed
      expect(diff.summary.removedRows).toBe(1);
      expect(diff.summary.addedRows).toBe(0);
    });

    it('should handle fetch error for a source gracefully', async () => {
      const getValues = vi.fn().mockRejectedValue(new Error('Forbidden'));
      mockSheetsApi = createMockSheetsApi({ getValues });
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);

      const result = await handler.handle({
        request: {
          action: 'cross_compare',
          source1: { spreadsheetId: 'ss1', range: 'Sheet1!A1:B3' },
          source2: { spreadsheetId: 'ss2', range: 'Sheet1!A1:B2' },
        },
      });

      // Should return error response since both sources failed
      expect(result.response.success).toBe(false);
    });
  });
});
