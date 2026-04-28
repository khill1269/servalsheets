/**
 * ServalSheets - Category 7 Advanced Features Tests (Simulation)
 *
 * Tests for advanced sheet configuration and management
 * Note: These are integration tests verifying action dispatch, not full E2E tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdvancedHandler } from '../../src/handlers/advanced.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-sheet-id',
        properties: { title: 'Test Sheet' },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Sheet1',
              gridProperties: { rowCount: 100, columnCount: 26 },
            },
          },
        ],
        namedRanges: [{ namedRangeId: 'nr-1', name: 'SalesRange' }],
        protectedRanges: [],
        banding: [],
      },
    }),
    batchUpdate: vi.fn().mockResolvedValue({ data: { replies: [{}] } }),
    developerMetadata: {
      get: vi.fn().mockResolvedValue({ data: {} }),
      search: vi.fn().mockResolvedValue({
        data: { matchedDeveloperMetadata: [] },
      }),
    },
    values: {
      get: vi.fn().mockResolvedValue({ data: { values: [['Column A', 'Column B', 'Column C']] } }),
    },
  },
});

const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {} as any,
  rangeResolver: { resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B10' }) } as any,
  auth: { scopes: ['https://www.googleapis.com/auth/spreadsheets'] } as any,
  samplingServer: undefined,
  snapshotService: {} as any,
  sessionContext: {} as any,
  confirmDestructiveAction: vi.fn().mockResolvedValue(undefined),
  createSnapshotIfNeeded: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
  sendProgress: vi.fn(),
  cachedApi: {} as any,
});

describe('Category 7: Advanced Features', () => {
  let handler: AdvancedHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new AdvancedHandler(mockContext, mockSheetsApi as unknown as sheets_v4.Sheets);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('7.1 add_named_range dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ addNamedRange: { namedRange: { namedRangeId: 'nr-new' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'add_named_range',
        spreadsheetId: 'test-sheet-id',
        name: 'RevenueRange',
        range: { a1: 'Sheet1!A1:B5' },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.2 list_named_ranges dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'list_named_ranges', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.3 get_named_range dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'get_named_range', spreadsheetId: 'test-sheet-id', name: 'SalesRange' },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.4 update_named_range dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ updateNamedRange: { namedRange: { namedRangeId: 'nr-1' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'update_named_range',
        spreadsheetId: 'test-sheet-id',
        namedRangeId: 'nr-1',
        name: 'UpdatedRange',
        range: { a1: 'Sheet1!A1:C10' },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.5 delete_named_range dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ deleteNamedRange: {} }] },
    });
    const result = await handler.handle({
      request: {
        action: 'delete_named_range',
        spreadsheetId: 'test-sheet-id',
        namedRangeId: 'nr-1',
        safety: { confirmed: true },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.6 add_protected_range dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ addProtectedRange: { protectedRange: { protectedRangeId: 'pr-1' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'add_protected_range',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:B5' },
        warningOnly: true,
        safety: { dryRun: true },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.7 list_protected_ranges dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'list_protected_ranges', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.8 set_metadata dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ createDeveloperMetadata: { developerMetadata: { metadataId: 'm1' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'set_metadata',
        spreadsheetId: 'test-sheet-id',
        metadataKey: 'dataSource',
        metadataValue: 'api',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.9 get_metadata dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'get_metadata',
        spreadsheetId: 'test-sheet-id',
        metadataKey: 'dataSource',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.10 add_banding dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ addBanding: { banding: { bandedRangeId: 'b1' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'add_banding',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:C10' },
        rowProperties: {
          headerColor: { red: 0.2, green: 0.4, blue: 0.8 },
          firstBandColor: { red: 1, green: 1, blue: 1 },
          secondBandColor: { red: 0.9, green: 0.9, blue: 0.9 },
        },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.11 list_banding dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'list_banding', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.12 create_table dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ createTable: { table: { tableId: 't1' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'create_table',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:C10' },
        tableProperties: { displayName: 'SalesData' },
        hasHeaders: false,
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.13 update_table dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ updateTable: { table: { tableId: 't1' } } }] },
    });
    const result = await handler.handle({
      request: {
        action: 'update_table',
        spreadsheetId: 'test-sheet-id',
        tableId: 't1',
        tableProperties: { displayName: 'UpdatedSales' },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.14 list_tables dispatches', async () => {
    const result = await handler.handle({
      request: { action: 'list_tables', spreadsheetId: 'test-sheet-id' },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.15 add_person_chip dispatches', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ updateCells: {} }] },
    });
    const result = await handler.handle({
      request: {
        action: 'add_person_chip',
        spreadsheetId: 'test-sheet-id',
        cell: { a1: 'A1' },
        email: 'user@example.com',
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.16 list_chips dispatches', async () => {
    const result = await handler.handle({
      request: {
        action: 'list_chips',
        spreadsheetId: 'test-sheet-id',
        range: { a1: 'Sheet1!A1:Z100' },
      },
    });
    expect(result.response.success).toBe(true);
  });

  it('7.17 create_named_function returns unavailable (API not supported)', async () => {
    const result = await handler.handle({
      request: {
        action: 'create_named_function',
        spreadsheetId: 'test-sheet-id',
        functionName: 'CALCULATE_PROFIT',
        functionBody: '=revenue - cost',
      },
    });
    // Named function management is permanently unsupported via Google Sheets API v4
    expect(result.response.success).toBe(false);
  });

  it('7.18 list_named_functions returns unavailable (API not supported)', async () => {
    const result = await handler.handle({
      request: { action: 'list_named_functions', spreadsheetId: 'test-sheet-id' },
    });
    // Named function management is permanently unsupported via Google Sheets API v4
    expect(result.response.success).toBe(false);
  });

  it('7.19 delete_named_function returns unavailable (API not supported)', async () => {
    const result = await handler.handle({
      request: {
        action: 'delete_named_function',
        spreadsheetId: 'test-sheet-id',
        functionName: 'CALCULATE_PROFIT',
      },
    });
    // Named function management is permanently unsupported via Google Sheets API v4
    expect(result.response.success).toBe(false);
  });

  it('7.20 create_template returns invalid (action not supported)', async () => {
    const result = await handler.handle({
      request: {
        action: 'create_template' as any,
        spreadsheetId: 'test-sheet-id',
        name: 'Budget Template',
      },
    });
    // create_template is not a valid sheets_advanced action
    expect(result.response.success).toBe(false);
  });
});
