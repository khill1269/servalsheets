import { describe, it, expect, vi } from 'vitest';
import type { HandlerContext } from '../../src/handlers/base.js';
import { SheetsCoreHandler } from '../../src/handlers/core.js';
import { SheetsDataHandler } from '../../src/handlers/data.js';
import { FormatHandler } from '../../src/handlers/format.js';
import {
  createMockSheetsApi,
  createMockContext,
  createMockDriveApi,
} from '../helpers/google-api-mocks.js';

function createAuthenticatedContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return createMockContext({
    googleClient: {},
    auth: {
      hasElevatedAccess: false,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    },
    ...overrides,
  }) as HandlerContext;
}

describe('Handler Chain Integration', () => {
  it('executes create -> add_sheet through the real SheetsCoreHandler', async () => {
    const mockSheetsApi = createMockSheetsApi();
    mockSheetsApi.spreadsheets.batchUpdate = vi.fn().mockResolvedValue({
      data: {
        replies: [
          {
            addSheet: {
              properties: {
                sheetId: 7,
                title: 'Expenses',
                index: 1,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 26,
                },
              },
            },
          },
        ],
      },
    });

    const handler = new SheetsCoreHandler(
      createAuthenticatedContext(),
      mockSheetsApi,
      createMockDriveApi()
    );

    const createResult = await handler.handle({
      action: 'create',
      title: 'Quarterly Ops',
    });

    expect(createResult.response.success).toBe(true);
    if (!createResult.response.success) {
      throw new Error('Expected create to succeed');
    }

    const spreadsheetId = createResult.response.newSpreadsheetId;

    const addSheetResult = await handler.handle({
      action: 'add_sheet',
      spreadsheetId,
      title: 'Expenses',
    });

    expect(addSheetResult.response.success).toBe(true);
    if (!addSheetResult.response.success) {
      throw new Error('Expected add_sheet to succeed');
    }

    expect(addSheetResult.response.sheet.title).toBe('Expenses');
    expect(mockSheetsApi.spreadsheets.create).toHaveBeenCalledTimes(1);
    expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId,
      })
    );
  });

  it('executes read -> set_background across real handlers with shared mocks', async () => {
    const mockSheetsApi = createMockSheetsApi();
    const rangeResolver = {
      resolve: vi.fn().mockResolvedValue({
        a1Notation: 'Sheet1!A1:B2',
        sheetId: 0,
        sheetName: 'Sheet1',
        gridRange: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        resolution: {
          method: 'a1_direct',
          confidence: 1,
          path: '',
        },
      }),
      clearCache: vi.fn(),
    };

    const context = createAuthenticatedContext({ rangeResolver });
    const dataHandler = new SheetsDataHandler(context, mockSheetsApi);
    const formatHandler = new FormatHandler(context, mockSheetsApi);

    const readResult = await dataHandler.handle({
      action: 'read',
      spreadsheetId: 'test-spreadsheet-id',
      range: { a1: 'Sheet1!A1:B2' },
    });

    expect(readResult.response.success).toBe(true);
    if (!readResult.response.success) {
      throw new Error('Expected read to succeed');
    }

    const formatResult = await formatHandler.handle({
      action: 'set_background',
      spreadsheetId: 'test-spreadsheet-id',
      range: { a1: 'Sheet1!A1:B2' },
      color: { red: 1, green: 0, blue: 0 },
    });

    expect(formatResult.response.success).toBe(true);
    if (!formatResult.response.success) {
      throw new Error('Expected set_background to succeed');
    }

    expect(readResult.response.values).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]);
    expect(formatResult.response.cellsFormatted).toBe(4);
    expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Sheet1!A1:B2',
      })
    );
    expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'test-spreadsheet-id',
      })
    );
  });

  it('rejects with a structured auth error before handler execution', async () => {
    const mockSheetsApi = createMockSheetsApi();
    const handler = new SheetsDataHandler(createMockContext() as HandlerContext, mockSheetsApi);

    await expect(
      handler.handle({
        action: 'read',
        spreadsheetId: 'test-spreadsheet-id',
        range: { a1: 'Sheet1!A1:B2' },
      })
    ).rejects.toMatchObject({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
      },
    });
  });

  it('maps downstream API failures into structured handler errors', async () => {
    const mockSheetsApi = createMockSheetsApi();
    mockSheetsApi.spreadsheets.values.get = vi.fn().mockRejectedValue({
      code: 429,
      message: 'Too many requests',
    });

    const handler = new SheetsDataHandler(createAuthenticatedContext(), mockSheetsApi);

    const result = await handler.handle({
      action: 'read',
      spreadsheetId: 'test-spreadsheet-id',
      range: { a1: 'Sheet1!A1:B2' },
    });

    expect(result.response.success).toBe(false);
    if (result.response.success) {
      throw new Error('Expected rate-limit error');
    }

    expect(result.response.error.code.length).toBeGreaterThan(0);
    expect(result.response.error.message.length).toBeGreaterThan(0);
    expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledTimes(1);
  });
});
