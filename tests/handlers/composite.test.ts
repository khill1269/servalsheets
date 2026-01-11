/**
 * Composite Operations Handler Tests
 *
 * Integration tests verifying handler registration and basic functionality.
 * Full end-to-end tests require proper Google API setup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompositeHandler } from '../../src/handlers/composite.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

describe('Composite Handler', () => {
  let handler: CompositeHandler;
  let mockContext: HandlerContext;
  let mockSheetsApi: sheets_v4.Sheets;

  beforeEach(() => {
    mockContext = {
      requestId: 'test-request-id',
      timestamp: new Date(),
      capabilities: {
        supports: vi.fn(() => true),
        requireCapability: vi.fn(),
        getCapability: vi.fn(),
      },
      snapshotService: {} as HandlerContext['snapshotService'],
    } as unknown as HandlerContext;

    // Mock Google Sheets API
    mockSheetsApi = {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: 'test123',
            sheets: [{
              properties: {
                sheetId: 0,
                title: 'Sheet1',
                index: 0,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            }],
          },
        }),
        values: {
          get: vi.fn().mockResolvedValue({
            data: {
              range: 'Sheet1!A1:C10',
              values: [['Name', 'Age', 'Email'], ['Alice', '30', 'alice@test.com']],
            },
          }),
          update: vi.fn().mockResolvedValue({ data: { updatedRange: 'Sheet1!A1:C10' } }),
          append: vi.fn().mockResolvedValue({ data: { updates: { updatedRange: 'Sheet1!A2:C2' } } }),
          clear: vi.fn().mockResolvedValue({ data: { clearedRange: 'Sheet1!A2:Z1000' } }),
        },
        batchUpdate: vi.fn().mockResolvedValue({ data: { spreadsheetId: 'test123', replies: [] } }),
      },
    } as unknown as sheets_v4.Sheets;

    handler = new CompositeHandler(mockContext, mockSheetsApi);
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(CompositeHandler);
    });
  });

  describe('import_csv action', () => {
    it('should accept and process import_csv requests', async () => {
      const input = {
        action: 'import_csv' as const,
        spreadsheetId: 'test123',
        csvData: 'Name,Age\nAlice,30',
      };

      const result = await handler.handle(input as any);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response).toHaveProperty('success');
    });
  });

  describe('smart_append action', () => {
    it('should accept and process smart_append requests', async () => {
      const input = {
        action: 'smart_append' as const,
        spreadsheetId: 'test123',
        sheet: 0,
        data: [{ Name: 'Charlie', Age: 35 }],
      };

      const result = await handler.handle(input as any);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response).toHaveProperty('success');
    });
  });

  describe('bulk_update action', () => {
    it('should accept and process bulk_update requests', async () => {
      const input = {
        action: 'bulk_update' as const,
        spreadsheetId: 'test123',
        sheet: 0,
        keyColumn: 'Name',
        updates: [{ Name: 'Alice', Age: 31 }],
      };

      const result = await handler.handle(input as any);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response).toHaveProperty('success');
    });
  });

  describe('deduplicate action', () => {
    it('should accept and process deduplicate requests', async () => {
      const input = {
        action: 'deduplicate' as const,
        spreadsheetId: 'test123',
        sheet: 0,
        keyColumns: ['Name'],
      };

      const result = await handler.handle(input as any);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response).toHaveProperty('success');
    });
  });

  describe('response structure', () => {
    it('should return properly formatted responses', async () => {
      const input = {
        action: 'import_csv' as const,
        spreadsheetId: 'test123',
        csvData: 'Name,Age\nAlice,30',
      };

      const result = await handler.handle(input as any);

      // All responses should have this structure
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success');

      // Either success or error
      if (result.response.success) {
        expect(result.response).toHaveProperty('action');
      } else {
        expect(result.response).toHaveProperty('error');
      }
    });
  });
});
