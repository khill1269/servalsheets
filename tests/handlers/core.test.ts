/**
 * ServalSheets - Core Handler Tests
 *
 * Tests for core spreadsheet and sheet/tab operations.
 * Covers 15 actions: 8 spreadsheet operations + 7 sheet operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsCoreHandler } from '../../src/handlers/core.js';
import { SheetsCoreOutputSchema } from '../../src/schemas/core.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4, drive_v3 } from 'googleapis';

// Mock Google Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-spreadsheet-id',
        properties: {
          title: 'Test Spreadsheet',
          locale: 'en_US',
          timeZone: 'America/Los_Angeles',
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Sheet1',
              index: 0,
              gridProperties: {
                rowCount: 1000,
                columnCount: 26,
              },
            },
          },
        ],
      },
    }),
    create: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'new-spreadsheet-id',
        properties: {
          title: 'New Spreadsheet',
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Sheet1',
            },
          },
        ],
      },
    }),
    batchUpdate: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-spreadsheet-id',
        replies: [{}],
      },
    }),
  },
});

// Mock Google Drive API
const createMockDriveApi = () => ({
  files: {
    copy: vi.fn().mockResolvedValue({
      data: {
        id: 'copied-spreadsheet-id',
        name: 'Copy of Test Spreadsheet',
      },
    }),
    list: vi.fn().mockResolvedValue({
      data: {
        files: [
          {
            id: 'spreadsheet-1',
            name: 'Spreadsheet 1',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            createdTime: '2024-01-01T00:00:00Z',
            modifiedTime: '2024-01-02T00:00:00Z',
          },
          {
            id: 'spreadsheet-2',
            name: 'Spreadsheet 2',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            createdTime: '2024-01-03T00:00:00Z',
            modifiedTime: '2024-01-04T00:00:00Z',
          },
        ],
        nextPageToken: undefined,
      },
    }),
  },
});

// Mock handler context
const createMockContext = (): HandlerContext => ({
  requestId: 'test-request',
  timestamp: new Date(),
  session: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    keys: vi.fn(),
  },
  capabilities: {
    supports: vi.fn(() => true),
    requireCapability: vi.fn(),
    getCapability: vi.fn(),
  },
  googleClient: {
    sheets: vi.fn(),
    drive: vi.fn(),
  } as any,
  authService: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getClient: vi.fn().mockResolvedValue({}),
  } as any,
  elicitationServer: {
    request: vi.fn().mockResolvedValue({
      confirmed: true,
      reason: '',
    }),
  } as any,
  snapshotService: {
    createSnapshot: vi.fn().mockResolvedValue({
      snapshotId: 'snapshot-123',
      timestamp: new Date(),
    }),
  } as any,
  impactAnalyzer: {
    analyzeOperation: vi.fn().mockResolvedValue({
      severity: 'low',
      cellsAffected: 0,
      formulasAffected: [],
      chartsAffected: [],
      warnings: [],
    }),
  } as any,
  rangeResolver: {
    resolve: vi.fn(),
  } as any,
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
  } as any,
} as any);

describe('SheetsCoreHandler', () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;
  let handler: SheetsCoreHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new SheetsCoreHandler(
      mockContext,
      mockApi as any as sheets_v4.Sheets,
      mockDriveApi as any as drive_v3.Drive
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(SheetsCoreHandler);
    });
  });

  describe('Spreadsheet Operations', () => {
    describe('get action', () => {
      it('should get spreadsheet metadata', async () => {
        const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-spreadsheet-id',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'get');
        expect((result.response as any).spreadsheet).toBeDefined();
        expect((result.response as any).spreadsheet.spreadsheetId).toBe('test-spreadsheet-id');
        expect((result.response as any).spreadsheet.title).toBe('Test Spreadsheet');
        expect(mockApi.spreadsheets.get).toHaveBeenCalledWith(
          expect.objectContaining({
            spreadsheetId: 'test-spreadsheet-id',
          })
        );

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should include sheets in response', async () => {
        const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-spreadsheet-id',
          includeSheets: true,
        });

        expect(result.response.success).toBe(true);
        expect((result.response as any).sheets).toBeDefined();
        expect(Array.isArray((result.response as any).sheets)).toBe(true);
        expect((result.response as any).sheets.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle API errors gracefully', async () => {
        mockApi.spreadsheets.get.mockRejectedValueOnce(new Error('Spreadsheet not found'));

        const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'nonexistent-id',
        });

        expect(result.response.success).toBe(false);
        expect((result.response as any).error).toBeDefined();
      });
    });

    describe('create action', () => {
      it('should create a new spreadsheet', async () => {
        const result = await handler.handle({
          action: 'create',
          title: 'My New Spreadsheet',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'create');
        expect((result.response as any).spreadsheet).toBeDefined();
        expect((result.response as any).spreadsheet.spreadsheetId).toBe('new-spreadsheet-id');
        expect(mockApi.spreadsheets.create).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should create spreadsheet with custom properties', async () => {
        const result = await handler.handle({
          action: 'create',
          title: 'Custom Spreadsheet',
          locale: 'en_GB',
          timeZone: 'Europe/London',
        });

        expect(result.response.success).toBe(true);
        expect(mockApi.spreadsheets.create).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              properties: expect.objectContaining({
                title: 'Custom Spreadsheet',
                locale: 'en_GB',
                timeZone: 'Europe/London',
              }),
            }),
          })
        );
      });
    });

    describe('copy action', () => {
      it('should copy a spreadsheet', async () => {
        const result = await handler.handle({
          action: 'copy',
          spreadsheetId: 'test-spreadsheet-id',
          destinationTitle: 'Copy of Spreadsheet',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'copy');
        expect((result.response as any).spreadsheet).toBeDefined();
        expect((result.response as any).spreadsheet.spreadsheetId).toBe('copied-spreadsheet-id');
        expect((result.response as any).spreadsheet.title).toBe('Copy of Test Spreadsheet');
        expect(mockDriveApi.files.copy).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should handle copy errors', async () => {
        mockDriveApi.files.copy.mockRejectedValueOnce(new Error('Permission denied'));

        const result = await handler.handle({
          action: 'copy',
          spreadsheetId: 'test-spreadsheet-id',
          destinationTitle: 'Copy',
        });

        expect(result.response.success).toBe(false);
      });
    });

    describe('update_properties action', () => {
      it('should update spreadsheet properties', async () => {
        const result = await handler.handle({
          action: 'update_properties',
          spreadsheetId: 'test-spreadsheet-id',
          properties: {
            title: 'Updated Title',
            locale: 'fr_FR',
          },
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'update_properties');
        expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('get_url action', () => {
      it('should generate spreadsheet URL', async () => {
        const result = await handler.handle({
          action: 'get_url',
          spreadsheetId: 'test-spreadsheet-id',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'get_url');
        expect(result.response).toHaveProperty('url');
        expect((result.response as any).url).toContain('test-spreadsheet-id');

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should generate URL with sheet ID', async () => {
        const result = await handler.handle({
          action: 'get_url',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
        });

        expect(result.response.success).toBe(true);
        expect((result.response as any).url).toContain('gid=123');
      });
    });

    describe('batch_get action', () => {
      it('should get multiple spreadsheets', async () => {
        const result = await handler.handle({
          action: 'batch_get',
          spreadsheetIds: ['id1', 'id2'],
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'batch_get');
        expect((result.response as any).spreadsheets).toHaveLength(2);

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('get_comprehensive action', () => {
      it('should get comprehensive spreadsheet data', async () => {
        const result = await handler.handle({
          action: 'get_comprehensive',
          spreadsheetId: 'test-spreadsheet-id',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'get_comprehensive');
        expect((result.response as any).spreadsheet).toBeDefined();
        expect((result.response as any).spreadsheet.spreadsheetId).toBe('test-spreadsheet-id');

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('list action', () => {
      it('should list spreadsheets', async () => {
        const result = await handler.handle({
          action: 'list',
          maxResults: 10,
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'list');
        expect((result.response as any).spreadsheets).toHaveLength(2);
        expect(mockDriveApi.files.list).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should filter by query', async () => {
        const result = await handler.handle({
          action: 'list',
          query: 'name contains "Budget"',
        });

        expect(result.response.success).toBe(true);
        expect(mockDriveApi.files.list).toHaveBeenCalledWith(
          expect.objectContaining({
            q: expect.stringContaining('Budget'),
          })
        );
      });
    });
  });

  describe('Sheet/Tab Operations', () => {
    describe('add_sheet action', () => {
      it('should add a new sheet', async () => {
        const result = await handler.handle({
          action: 'add_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          title: 'New Sheet',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'add_sheet');
        expect((result.response as any).sheet).toBeDefined();
        expect((result.response as any).sheet.sheetId).toBeDefined();
        expect((result.response as any).sheet.title).toBe('New Sheet');
        expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should add sheet with custom properties', async () => {
        const result = await handler.handle({
          action: 'add_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          title: 'Custom Sheet',
          index: 1,
          rowCount: 500,
          columnCount: 20,
        });

        expect(result.response.success).toBe(true);
        expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            spreadsheetId: 'test-spreadsheet-id',
            requestBody: expect.objectContaining({
              requests: expect.arrayContaining([
                expect.objectContaining({
                  addSheet: expect.objectContaining({
                    properties: expect.objectContaining({
                      title: 'Custom Sheet',
                      index: 1,
                    }),
                  }),
                }),
              ]),
            }),
          })
        );
      });
    });

    describe('delete_sheet action', () => {
      it('should delete a sheet with confirmation', async () => {
        const result = await handler.handle({
          action: 'delete_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'delete_sheet');
        expect(mockContext.elicitationServer?.request).toHaveBeenCalled();
        expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should create snapshot before deletion', async () => {
        const result = await handler.handle({
          action: 'delete_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
          safety: {
            autoSnapshot: true,
          },
        });

        expect(result.response.success).toBe(true);
        expect(mockContext.snapshotService?.createSnapshot).toHaveBeenCalled();
        expect((result.response as any).snapshotId).toBe('snapshot-123');
      });

      it('should handle cancelled deletion', async () => {
        mockContext.elicitationServer = {
          request: vi.fn().mockResolvedValue({
            confirmed: false,
            reason: 'User cancelled',
          }),
        } as any;

        handler = new SheetsCoreHandler(
          mockContext,
          mockApi as any as sheets_v4.Sheets,
          mockDriveApi as any as drive_v3.Drive
        );

        const result = await handler.handle({
          action: 'delete_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
        });

        expect(result.response.success).toBe(false);
        expect((result.response as any).error.code).toBe('PRECONDITION_FAILED');
        expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
      });

      it('should support dryRun mode', async () => {
        const result = await handler.handle({
          action: 'delete_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
          safety: {
            dryRun: true,
          },
        });

        expect(result.response.success).toBe(true);
        expect((result.response as any).dryRun).toBe(true);
        expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
      });
    });

    describe('duplicate_sheet action', () => {
      it('should duplicate a sheet', async () => {
        mockApi.spreadsheets.batchUpdate.mockResolvedValueOnce({
          data: {
            spreadsheetId: 'test-spreadsheet-id',
            replies: [
              {
                duplicateSheet: {
                  properties: {
                    sheetId: 456,
                    title: 'Copy of Sheet1',
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

        const result = await handler.handle({
          action: 'duplicate_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
          newSheetName: 'Copy of Sheet1',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'duplicate_sheet');
        expect((result.response as any).sheet).toBeDefined();
        expect((result.response as any).sheet.sheetId).toBe(456);
        expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('update_sheet action', () => {
      it('should update sheet properties', async () => {
        const result = await handler.handle({
          action: 'update_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 123,
          properties: {
            title: 'Updated Sheet Name',
          },
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'update_sheet');
        expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('copy_sheet_to action', () => {
      it('should copy sheet to another spreadsheet', async () => {
        mockApi.spreadsheets.batchUpdate.mockResolvedValueOnce({
          data: {
            spreadsheetId: 'destination-spreadsheet-id',
            replies: [
              {
                addSheet: {
                  properties: {
                    sheetId: 789,
                    title: 'Sheet1',
                    index: 0,
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

        const result = await handler.handle({
          action: 'copy_sheet_to',
          sourceSpreadsheetId: 'source-id',
          sourceSheetId: 123,
          destinationSpreadsheetId: 'destination-id',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'copy_sheet_to');
        expect((result.response as any).sheet).toBeDefined();
        expect((result.response as any).sheet.sheetId).toBe(789);

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('list_sheets action', () => {
      it('should list all sheets in spreadsheet', async () => {
        const result = await handler.handle({
          action: 'list_sheets',
          spreadsheetId: 'test-spreadsheet-id',
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'list_sheets');
        expect((result.response as any).sheets).toHaveLength(1);
        expect((result.response as any).sheets[0]).toHaveProperty('sheetId', 0);

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    describe('get_sheet action', () => {
      it('should get sheet by ID', async () => {
        const result = await handler.handle({
          action: 'get_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetId: 0,
        });

        expect(result).toBeDefined();
        expect(result.response.success).toBe(true);
        expect(result.response).toHaveProperty('action', 'get_sheet');
        expect((result.response as any).sheet).toBeDefined();
        expect((result.response as any).sheet.sheetId).toBe(0);
        expect((result.response as any).sheet.title).toBe('Sheet1');

        const parseResult = SheetsCoreOutputSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });

      it('should get sheet by name', async () => {
        const result = await handler.handle({
          action: 'get_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetName: 'Sheet1',
        });

        expect(result.response.success).toBe(true);
        expect((result.response as any).sheet).toBeDefined();
        expect((result.response as any).sheet.sheetId).toBe(0);
        expect((result.response as any).sheet.title).toBe('Sheet1');
      });

      it('should handle sheet not found', async () => {
        const result = await handler.handle({
          action: 'get_sheet',
          spreadsheetId: 'test-spreadsheet-id',
          sheetName: 'NonexistentSheet',
        });

        expect(result.response.success).toBe(false);
        expect((result.response as any).error).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('should handle unknown actions', async () => {
      const result = await handler.handle({
        action: 'unknown_action' as any,
      } as any);

      expect(result.response.success).toBe(false);
      expect((result.response as any).error).toBeDefined();
    });

    it('should handle authentication errors', async () => {
      mockContext = createMockContext();
      mockContext.googleClient = undefined as any;

      handler = new SheetsCoreHandler(mockContext, mockApi as any, mockDriveApi as any);

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(false);
    });

    it('should handle API errors', async () => {
      mockApi.spreadsheets.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await handler.handle({
        action: 'get',
        spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(false);
      expect((result.response as any).error.message).toContain('API Error');
    });
  });
});
