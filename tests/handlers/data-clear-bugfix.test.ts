/**
 * Data Handler - Clear Action Bug Fix Tests (Phase 0.7)
 *
 * Tests for bug: sheets_data.clear returns no result to client
 * Evidence from test log: "Returns NO RESULT from client-side tool execution"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SheetsDataHandler } from '../../src/handlers/data.js';
import { SheetsDataOutputSchema } from '../../src/schemas/data.js';
import type { HandlerContext } from '../../src/handlers/base.js';

describe('SheetsDataHandler - Clear Action (BUG FIX 0.7)', () => {
  let handler: SheetsDataHandler;
  let mockContext: HandlerContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock type
  let mockApi: any;

  beforeEach(() => {
    // Create mock API
    mockApi = {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: 'test-id',
            sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
          },
        }),
        values: {},
        batchUpdate: vi.fn().mockResolvedValue({
          data: {
            replies: [{}],
          },
        }),
      },
    };

    // Create mock context
    mockContext = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock client type
      googleClient: {} as any, // Required by requireAuth()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock auth type
      authClient: { credentials: { access_token: 'test-token' } } as any,
      authService: {
        isAuthenticated: vi.fn().mockReturnValue(true),
        getClient: vi.fn().mockResolvedValue({}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock service type
      } as any,
      rangeResolver: {
        resolve: vi.fn().mockResolvedValue({
          a1Notation: 'Sheet1!A1:B10',
          sheetId: 0,
          sheetName: 'Sheet1',
          gridRange: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 10,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          resolution: {
            method: 'a1_direct',
            confidence: 1.0,
            path: '',
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock resolver type
      } as any,
    } as unknown as HandlerContext;

    handler = new SheetsDataHandler(mockContext, mockApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('clear returns result (BUG FIX 0.7)', () => {
    it('should return result with updatedRange field', async () => {
      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B10',
        },
      } as any);

      // Verify result is defined (not null/undefined)
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();

      // Verify success response
      expect((result.response as any).success).toBe(true);
      expect((result.response as any).action).toBe('clear');

      // BUG FIX: Verify updatedRange is present in response
      expect(result.response).toHaveProperty('updatedRange');
      expect((result.response as any).updatedRange).toBe('Sheet1!A1:B10');

      // Verify API was called
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledTimes(1);
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-id',
          requestBody: {
            requests: [
              {
                updateCells: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 10,
                    startColumnIndex: 0,
                    endColumnIndex: 2,
                  },
                  fields: 'userEnteredValue',
                },
              },
            ],
          },
        })
      );

      // Verify schema validation passes
      const parseResult = SheetsDataOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should return updatedRange even when API returns no clearedRange', async () => {
      // Mock API returns empty response
      mockApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: {},
      });

      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B10',
        },
      } as any);

      // Should fallback to resolved range (from rangeResolver mock)
      expect((result.response as any).success).toBe(true);
      expect((result.response as any).updatedRange).toBe('Sheet1!A1:B10');
    });

    it('should handle errors and still return result', async () => {
      // Mock API error
      mockApi.spreadsheets.batchUpdate.mockRejectedValue(new Error('Permission denied'));

      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B10',
        },
      } as any);

      // Should return error response (not throw)
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect((result.response as any).success).toBe(false);
      expect((result.response as any).error).toBeDefined();
    });

    it('should return result in dryRun mode', async () => {
      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B10',
          safety: { dryRun: true },
        },
      } as any);

      // Should return result without calling API
      expect((result.response as any).success).toBe(true);
      expect((result.response as any).dryRun).toBe(true);
      expect((result.response as any).updatedRange).toBe('Sheet1!A1:B10');
      expect(mockApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should preserve updatedRange through verbosity filter', async () => {
      // Test with minimal verbosity
      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B10',
          verbosity: 'minimal',
        },
      } as any);

      // updatedRange should be preserved even in minimal mode
      expect((result.response as any).updatedRange).toBeDefined();
      expect(typeof (result.response as any).updatedRange).toBe('string');
    });

    it('should preserve updatedRange through response compactor', async () => {
      // Test with standard verbosity (response compaction enabled)
      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B10',
          verbosity: 'standard',
        },
      } as any);

      // updatedRange should survive response compaction
      expect((result.response as any).updatedRange).toBeDefined();
      expect((result.response as any).updatedRange).toBe('Sheet1!A1:B10');
    });
  });

  describe('regression tests', () => {
    it('should not break existing clear behavior', async () => {
      const result = await handler.handle({
        request: {
          action: 'clear',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:Z100',
        },
      } as any);

      expect((result.response as any).success).toBe(true);
      expect((result.response as any).action).toBe('clear');
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });
  });
});
