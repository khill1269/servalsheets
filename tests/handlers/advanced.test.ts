/**
 * ServalSheets v4 - Advanced Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdvancedHandler } from '../../src/handlers/advanced.js';
import { SheetsAdvancedOutputSchema } from '../../src/schemas/advanced.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
    developerMetadata: {
      search: vi.fn(),
    },
  },
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B2' }),
  } as any,
});

describe('AdvancedHandler', () => {
  let handler: AdvancedHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new AdvancedHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets
    );

    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }], namedRanges: [] },
    });
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [] } });
  });

  it('adds a named range', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: { replies: [{ addNamedRange: { namedRange: { namedRangeId: 'nr1', name: 'Range1', range: { sheetId: 0 } } } }] },
    });

    const result = await handler.handle({
        action: 'add_named_range',
        spreadsheetId: 'sheet-id',
        name: 'Range1',
        range: { a1: 'Sheet1!A1:B2' },
    });

    const parsed = SheetsAdvancedOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.namedRange?.name).toBe('Range1');
    }
  });

  it('returns feature unavailable for create_table', async () => {
    const result = await handler.handle({
      action: 'create_table' as const,
      spreadsheetId: 'sheet-id',
      range: { a1: 'Sheet1!A1:B2' },
    } as any);

    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error.code).toBe('FEATURE_UNAVAILABLE');
    }
  });
});
