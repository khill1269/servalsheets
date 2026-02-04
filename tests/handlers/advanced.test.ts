/**
 * ServalSheets v4 - Advanced Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdvancedHandler } from '../../src/handlers/advanced.js';
import { SheetsAdvancedOutputSchema } from '../../src/schemas/advanced.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
    values: {
      get: vi.fn(),
    },
    developerMetadata: {
      search: vi.fn(),
    },
  },
});

const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {} as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B2' }),
  } as any,
  auth: {
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  } as any,
});

describe('AdvancedHandler', () => {
  let handler: AdvancedHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new AdvancedHandler(mockContext, mockSheetsApi as unknown as sheets_v4.Sheets);

    mockSheetsApi.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }], namedRanges: [] },
    });
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [] } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('adds a named range', async () => {
    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: {
        replies: [
          {
            addNamedRange: {
              namedRange: { namedRangeId: 'nr1', name: 'Range1', range: { sheetId: 0 } },
            },
          },
        ],
      },
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

  it('creates a table', async () => {
    // Mock header row for table creation
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [['Header1', 'Header2']],
      },
    });

    mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
      data: {
        replies: [
          {
            addTable: {
              table: {
                tableId: 'table-1',
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 3,
                  startColumnIndex: 0,
                  endColumnIndex: 2,
                },
              },
            },
          },
        ],
      },
    });

    const result = await handler.handle({
      action: 'create_table',
      spreadsheetId: 'sheet-id',
      range: { a1: 'Sheet1!A1:B2' },
    });

    const parsed = SheetsAdvancedOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.table).toBeDefined();
      expect(result.response.table?.tableId).toBe('table-1');
    }
  });

  describe('smart chips', () => {
    it('adds a person chip', async () => {
      const result = await handler.handle({
        action: 'add_person_chip',
        spreadsheetId: 'sheet-id',
        range: { a1: 'Sheet1!A1' },
        email: 'alice@example.com',
        displayFormat: 'SHORT',
      });

      const parsed = SheetsAdvancedOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.chip?.type).toBe('person');
        expect(result.response.chip?.email).toBe('alice@example.com');
      }
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('adds a drive chip', async () => {
      const result = await handler.handle({
        action: 'add_drive_chip',
        spreadsheetId: 'sheet-id',
        range: { a1: 'Sheet1!B1' },
        fileId: 'abcdef1234567890',
      });

      const parsed = SheetsAdvancedOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.chip?.type).toBe('drive');
        expect(result.response.chip?.fileId).toBe('abcdef1234567890');
      }
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('adds a rich link chip', async () => {
      // Per Google API docs: Only Drive links can be written as rich link chips
      const result = await handler.handle({
        action: 'add_rich_link_chip',
        spreadsheetId: 'sheet-id',
        range: { a1: 'Sheet1!C1' },
        uri: 'https://drive.google.com/file/d/ABC123/view',
      });

      const parsed = SheetsAdvancedOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.chip?.type).toBe('rich_link');
        expect(result.response.chip?.uri).toBe('https://drive.google.com/file/d/ABC123/view');
      }
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('rejects non-Drive URIs for rich link chips', async () => {
      // Per Google API docs: Only Drive links can be written as rich link chips
      const result = await handler.handle({
        action: 'add_rich_link_chip',
        spreadsheetId: 'sheet-id',
        range: { a1: 'Sheet1!C1' },
        uri: 'https://example.com/docs',
      });

      const parsed = SheetsAdvancedOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        // Error message should indicate Drive-only restriction
        const errorMsg = JSON.stringify(result.response);
        expect(errorMsg).toContain('Google Drive');
      }
    });

    it('lists chips in a range', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: 'Sheet1' },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: [
                        {
                          userEnteredValue: { stringValue: '@alice@example.com' },
                          formattedValue: 'Alice',
                          chipRuns: [
                            {
                              chip: {
                                personProperties: {
                                  email: 'alice@example.com',
                                },
                              },
                            },
                          ],
                        },
                        {
                          userEnteredValue: { stringValue: 'File' },
                          formattedValue: 'File',
                          chipRuns: [
                            {
                              chip: {
                                richLinkProperties: {
                                  uri: 'https://drive.google.com/file/d/FILE123/view',
                                },
                              },
                            },
                          ],
                        },
                        {
                          userEnteredValue: { stringValue: 'Example' },
                          formattedValue: 'Example',
                          chipRuns: [
                            {
                              chip: {
                                richLinkProperties: {
                                  uri: 'https://example.com',
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const result = await handler.handle({
        action: 'list_chips',
        spreadsheetId: 'sheet-id',
        chipType: 'all',
      });

      const parsed = SheetsAdvancedOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.chips?.length).toBe(3);
      }
    });
  });
});
