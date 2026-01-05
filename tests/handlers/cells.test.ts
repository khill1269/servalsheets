/**
 * ServalSheets v4 - Cells Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CellsHandler } from '../../src/handlers/cells.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {} as any,
});

const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
    values: {
      get: vi.fn(),
    },
  },
});

describe('CellsHandler', () => {
  let mockContext: HandlerContext;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let handler: CellsHandler;

  beforeEach(() => {
    mockContext = createMockContext();
    mockSheetsApi = createMockSheetsApi();
    handler = new CellsHandler(mockContext, mockSheetsApi as unknown as sheets_v4.Sheets);
  });

  it('rejects non-http hyperlinks', async () => {
    const result = await handler.handle({
      request: {
        action: 'set_hyperlink',
        spreadsheetId: 'sheet-id',
        cell: 'Sheet1!A1',
        url: 'javascript:alert(1)',
      },
    });

    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error.code).toBe('INVALID_PARAMS');
    }
    expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('escapes hyperlink formula inputs', async () => {
    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
    });
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

    const result = await handler.handle({
      request: {
        action: 'set_hyperlink',
        spreadsheetId: 'sheet-id',
        cell: 'Sheet1!A1',
        url: 'https://example.com?q="x"',
        label: 'He said "hi"',
      },
    });

    expect(result.response.success).toBe(true);
    const call = mockSheetsApi.spreadsheets.batchUpdate.mock.calls[0]?.[0];
    const formula = call?.requestBody?.requests?.[0]?.updateCells?.rows?.[0]?.values?.[0]?.userEnteredValue?.formulaValue;
    expect(formula).toContain('He said ""hi""');
    expect(formula).toContain('https://example.com/?q=%22x%22');
  });
});
