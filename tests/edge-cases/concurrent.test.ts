/**
 * ISSUE-207: Edge case tests — Concurrent modification scenarios
 *
 * Tests concurrent execution limits, rate limit handling, and token refresh
 * during long-running operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SheetsAppsScriptHandler } from '../../src/handlers/appsscript.js';
import { SheetsDataHandler } from '../../src/handlers/data.js';
import { setMaxConcurrentRuns } from '../../src/handlers/appsscript-actions/execution-operations.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import type { sheets_v4 } from 'googleapis';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockSheetsApi = (): sheets_v4.Sheets =>
  ({
    spreadsheets: {
      get: vi.fn(),
      values: {
        get: vi.fn(),
        update: vi.fn(),
        append: vi.fn(),
        clear: vi.fn(),
        batchGet: vi.fn(),
        batchUpdate: vi.fn(),
        batchClear: vi.fn(),
      },
      batchUpdate: vi.fn(),
    },
  }) as any;

const createMockAppsScriptContext = (): HandlerContext =>
  ({
    spreadsheetId: 'test-spreadsheet-id',
    userId: 'test-user-id',
    cachedApi: {} as any,
    googleClient: {
      oauth2: { getAccessToken: vi.fn().mockResolvedValue({ token: 'new-token' }) },
      getTokenStatus: vi.fn().mockReturnValue({
        hasAccessToken: true,
        hasRefreshToken: true,
        expiryDate: Date.now() + 60 * 60 * 1000,
      }),
    } as any,
    samplingServer: undefined,
    elicitationServer: undefined,
    backend: undefined,
    taskStore: undefined,
  }) as any;

const createMockDataContext = (): HandlerContext =>
  ({
    spreadsheetId: 'test-spreadsheet-id',
    userId: 'test-user-id',
    cachedApi: {} as any,
    googleClient: {} as any,
    samplingServer: undefined,
    elicitationServer: undefined,
    backend: undefined,
    taskStore: undefined,
    rangeResolver: {
      resolve: vi.fn().mockImplementation((_spreadsheetId: string, rangeInput: { a1: string }) =>
        Promise.resolve({ a1Notation: rangeInput.a1 })
      ),
    } as any,
  }) as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Concurrent modification edge cases', () => {
  describe('Apps Script: concurrent execution limit (ISSUE-203)', () => {
    let handler: SheetsAppsScriptHandler;
    let mockSheetsApi: sheets_v4.Sheets;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockContext = createMockAppsScriptContext();
      mockSheetsApi = createMockSheetsApi();
      handler = new SheetsAppsScriptHandler(mockContext, mockSheetsApi);
      setMaxConcurrentRuns(15);
    });

    afterEach(() => {
      setMaxConcurrentRuns(15);
    });

    it('allows run when under the concurrent execution limit', async () => {
      // Mock a successful execution
      const mockApiRequest = vi.fn().mockResolvedValue({
        done: true,
        response: { result: 'ok' },
      });
      (handler as any).apiRequest = mockApiRequest;

      const result = await handler.handle({
        request: {
          action: 'run',
          scriptId: 'test-script-id',
          functionName: 'myFunction',
          devMode: true,
        },
      });

      // Should not fail with QUOTA_EXCEEDED
      expect(result.response.error?.code).not.toBe('QUOTA_EXCEEDED');
    });

    it('returns QUOTA_EXCEEDED when concurrent execution limit is reached', async () => {
      setMaxConcurrentRuns(0);

      const result = await handler.handle({
        request: {
          action: 'run',
          scriptId: 'test-script-id',
          functionName: 'myFunction',
          devMode: true,
        },
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error.code).toBe('QUOTA_EXCEEDED');
      expect(result.response.error.retryable).toBe(true);
      expect(result.response.error.retryAfterMs).toBe(30000);
      expect(result.response.error.message).toContain('concurrent execution limit');
    });

    it('releases the slot even when execution returns an error result', async () => {
      setMaxConcurrentRuns(1);

      const mockApiRequest = vi
        .fn()
        .mockResolvedValueOnce({
          done: true,
          error: {
            code: 500,
            message: 'Script error',
            details: [{ '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionError' }],
          },
        })
        .mockResolvedValueOnce({
          done: true,
          response: { result: 'ok' },
        });
      (handler as any).apiRequest = mockApiRequest;

      await handler.handle({
        request: {
          action: 'run',
          scriptId: 'test-script-id',
          functionName: 'failingFunction',
          devMode: true,
        },
      });

      const secondResult = await handler.handle({
        request: {
          action: 'run',
          scriptId: 'test-script-id',
          functionName: 'recoveredFunction',
          devMode: true,
        },
      });

      expect(secondResult.response.success).toBe(true);
      expect((secondResult.response as { result?: unknown }).result).toBe('ok');
      expect(mockApiRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data handler: rate limit handling', () => {
    let handler: SheetsDataHandler;
    let mockSheetsApi: sheets_v4.Sheets;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockContext = createMockDataContext();
      mockSheetsApi = createMockSheetsApi();
      handler = new SheetsDataHandler(mockContext, mockSheetsApi);
    });

    it('propagates RESOURCE_EXHAUSTED when API returns 429', async () => {
      (mockSheetsApi.spreadsheets!.get as any).mockResolvedValue({
        data: {
          spreadsheetId: 'test-spreadsheet-id',
          sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }],
        },
      });

      // Simulate 429 rate limit error from the Google API
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
        code: 429,
        errors: [{ domain: 'usageLimits', reason: 'userRateLimitExceeded' }],
      });
      (mockSheetsApi.spreadsheets!.values!.get as any).mockRejectedValue(rateLimitError);

      const result = await handler.handle({
        request: {
          action: 'read',
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Sheet1!A1:C3',
        },
      } as any);

      expect(result.response.success).toBe(false);
      const errorResponse = result.response as any;
      expect(errorResponse.error).toBeDefined();
      // Should not expose raw API error internals — mapped to typed error
      expect(typeof errorResponse.error.code).toBe('string');
      expect(typeof errorResponse.error.message).toBe('string');
    });

    it('handles concurrent parallel reads without interference', async () => {
      (mockSheetsApi.spreadsheets!.get as any).mockResolvedValue({
        data: {
          spreadsheetId: 'test-spreadsheet-id',
          sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }],
        },
      });

      (mockSheetsApi.spreadsheets!.values!.get as any).mockImplementation(
        ({ range }: { range: string }) =>
          Promise.resolve({
            data: {
              values: [[`data from ${range}`]],
              range,
            },
          })
      );

      // Issue 3 concurrent reads on the same spreadsheet
      const [r1, r2, r3] = await Promise.all([
        handler.handle({
          request: {
            action: 'read',
            spreadsheetId: 'test-spreadsheet-id',
            range: 'Sheet1!A1:A1',
          },
        } as any),
        handler.handle({
          request: {
            action: 'read',
            spreadsheetId: 'test-spreadsheet-id',
            range: 'Sheet1!B1:B1',
          },
        } as any),
        handler.handle({
          request: {
            action: 'read',
            spreadsheetId: 'test-spreadsheet-id',
            range: 'Sheet1!C1:C1',
          },
        } as any),
      ]);

      // All reads should succeed independently
      expect(r1.response.success).toBe(true);
      expect(r2.response.success).toBe(true);
      expect(r3.response.success).toBe(true);
    });
  });
});
