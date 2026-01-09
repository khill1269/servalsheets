/**
 * ServalSheets v4 - Spreadsheet Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpreadsheetHandler } from '../../src/handlers/spreadsheet.js';
import { SheetsSpreadsheetOutputSchema } from '../../src/schemas/spreadsheet.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4, drive_v3 } from 'googleapis';

// Mock Sheets API
const createMockSheetsApi = () => ({
  spreadsheets: {
    get: vi.fn(),
    create: vi.fn(),
    batchUpdate: vi.fn(),
  },
});

// Mock Drive API
const createMockDriveApi = () => ({
  files: {
    copy: vi.fn(),
  },
});

// Mock context
const createMockContext = (): HandlerContext => ({
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue('Sheet1!A1:Z100'),
    clearCache: vi.fn(),
  } as any,
  policyEnforcer: {
    validateIntents: vi.fn().mockResolvedValue(undefined),
    validateEffectScope: vi.fn().mockResolvedValue(undefined),
  } as any,
  auth: {
    hasElevatedAccess: true,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  },
});

describe('SpreadsheetHandler', () => {
  let handler: SpreadsheetHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockDriveApi: ReturnType<typeof createMockDriveApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    mockSheetsApi = createMockSheetsApi();
    mockDriveApi = createMockDriveApi();
    mockContext = createMockContext();
    handler = new SpreadsheetHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets,
      mockDriveApi as unknown as drive_v3.Drive
    );
  });

  describe('get action', () => {
    it('should return response envelope matching schema', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          spreadsheetId: 'test-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-id',
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
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-id',
      });

      // Validate against schema
      const parsed = SheetsSpreadsheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      // Check response envelope
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success', true);
      expect(result.response).toHaveProperty('action', 'get');
      expect(result.response).toHaveProperty('spreadsheet');
      
      if (result.response.success) {
        expect(result.response.spreadsheet?.spreadsheetId).toBe('test-id');
        expect(result.response.spreadsheet?.title).toBe('Test Spreadsheet');
        expect(result.response.spreadsheet?.sheets).toHaveLength(1);
      }
    });

    it('should handle missing optional fields', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          spreadsheetId: 'test-id',
          properties: { title: 'Minimal' },
          sheets: [],
        },
      });

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(true);
      const parsed = SheetsSpreadsheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('create action', () => {
    it('should create spreadsheet and return response envelope', async () => {
      mockSheetsApi.spreadsheets.create.mockResolvedValue({
        data: {
          spreadsheetId: 'new-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-id',
          properties: { title: 'New Spreadsheet', locale: 'en_US' },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
                index: 0,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          ],
        },
      });

      const result = await handler.handle({
          action: 'create',
          title: 'New Spreadsheet',
      });

      const parsed = SheetsSpreadsheetOutputSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      
      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.newSpreadsheetId).toBe('new-id');
        expect(result.response.spreadsheet?.title).toBe('New Spreadsheet');
      }
    });

    it('should create with custom sheets config', async () => {
      mockSheetsApi.spreadsheets.create.mockResolvedValue({
        data: {
          spreadsheetId: 'new-id',
          properties: { title: 'Custom Sheets' },
          sheets: [
            { properties: { sheetId: 0, title: 'Data', index: 0, gridProperties: { rowCount: 500, columnCount: 10 } } },
            { properties: { sheetId: 1, title: 'Summary', index: 1, gridProperties: { rowCount: 100, columnCount: 5 } } },
          ],
        },
      });

      const result = await handler.handle({
          action: 'create',
          title: 'Custom Sheets',
          sheets: [
            { title: 'Data', rowCount: 500, columnCount: 10 },
            { title: 'Summary', rowCount: 100, columnCount: 5 },
          ],
      });

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            sheets: expect.arrayContaining([
              expect.objectContaining({ properties: expect.objectContaining({ title: 'Data' }) }),
            ]),
          }),
        })
      );
    });
  });

  describe('copy action', () => {
    it('should copy spreadsheet using Drive API', async () => {
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: { properties: { title: 'Original' } },
      });
      mockDriveApi.files.copy.mockResolvedValue({
        data: { id: 'copied-id', name: 'Copy of Original' },
      });

      const result = await handler.handle({
          action: 'copy',
          spreadsheetId: 'original-id',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.newSpreadsheetId).toBe('copied-id');
        expect(result.response.spreadsheet?.url).toContain('copied-id');
      }
    });

    it('should error when Drive API is unavailable', async () => {
      const handlerNoDrive = new SpreadsheetHandler(
        mockContext,
        mockSheetsApi as unknown as sheets_v4.Sheets,
        undefined
      );

      const result = await handlerNoDrive.handle({
        action: 'copy',
        spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toContain('Drive API');
      }
    });
  });

  describe('update_properties action', () => {
    it('should update title and return updated spreadsheet', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [] } });
      mockSheetsApi.spreadsheets.get.mockResolvedValue({
        data: {
          spreadsheetId: 'test-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-id',
          properties: { title: 'Updated Title' },
        },
      });

      const result = await handler.handle({
          action: 'update_properties',
          spreadsheetId: 'test-id',
          title: 'Updated Title',
      });

      expect(result.response.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-id',
          requestBody: {
            requests: [
              expect.objectContaining({
                updateSpreadsheetProperties: expect.objectContaining({
                  properties: { title: 'Updated Title' },
                  fields: 'title',
                }),
              }),
            ],
          },
        })
      );
    });

    it('should error when no properties provided', async () => {
      const result = await handler.handle({
          action: 'update_properties',
          spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INVALID_PARAMS');
      }
    });
  });

  describe('get_url action', () => {
    it('should return computed URL', async () => {
      const result = await handler.handle({
          action: 'get_url',
          spreadsheetId: 'test-id-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.url).toBe('https://docs.google.com/spreadsheets/d/test-id-123');
      }
    });
  });

  describe('batch_get action', () => {
    it('should fetch multiple spreadsheets', async () => {
      mockSheetsApi.spreadsheets.get
        .mockResolvedValueOnce({
          data: {
            spreadsheetId: 'id-1',
            properties: { title: 'Spreadsheet 1' },
            sheets: [],
          },
        })
        .mockResolvedValueOnce({
          data: {
            spreadsheetId: 'id-2',
            properties: { title: 'Spreadsheet 2' },
            sheets: [],
          },
        });

      const result = await handler.handle({
          action: 'batch_get',
          spreadsheetIds: ['id-1', 'id-2'],
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.spreadsheets).toHaveLength(2);
        expect(result.response.spreadsheets?.[0].title).toBe('Spreadsheet 1');
        expect(result.response.spreadsheets?.[1].title).toBe('Spreadsheet 2');
      }
    });

    it('should handle partial failures gracefully', async () => {
      mockSheetsApi.spreadsheets.get
        .mockResolvedValueOnce({
          data: { spreadsheetId: 'id-1', properties: { title: 'Good' }, sheets: [] },
        })
        .mockRejectedValueOnce(new Error('Not found'));

      const result = await handler.handle({
          action: 'batch_get',
          spreadsheetIds: ['id-1', 'id-2'],
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.spreadsheets).toHaveLength(2);
        expect(result.response.spreadsheets?.[0].title).toBe('Good');
        expect(result.response.spreadsheets?.[1].title).toBe('(error)');
      }
    });
  });

  describe('error handling', () => {
    it('should map 404 errors to SPREADSHEET_NOT_FOUND', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValue(
        new Error('404 Spreadsheet not found')
      );

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'nonexistent',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('SPREADSHEET_NOT_FOUND');
      }
    });

    it('should map 403 errors to PERMISSION_DENIED', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValue(
        new Error('403 Permission denied')
      );

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'forbidden',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('should map 429 errors to RATE_LIMITED', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValue(
        new Error('429 rate limit exceeded')
      );

      const result = await handler.handle({
          action: 'get',
          spreadsheetId: 'test-id',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('RATE_LIMITED');
        expect(result.response.error.retryable).toBe(true);
      }
    });
  });
});
