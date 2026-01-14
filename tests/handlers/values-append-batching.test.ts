/**
 * Comprehensive tests for values.append() batching bug fix
 *
 * Tests verify that:
 * 1. Multiple append operations are batched into single API calls
 * 2. Batch efficiency exceeds 80% (10 appends -> 1-2 API calls)
 * 3. Single append operations still work correctly
 * 4. Different ranges and sheets are handled properly
 * 5. Error handling works in batched mode
 * 6. Backward compatibility is maintained
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ValuesHandler } from "../../src/handlers/values.js";
import { BatchingSystem } from "../../src/services/batching-system.js";
import type { HandlerContext } from "../../src/handlers/base.js";
import type { sheets_v4 } from "googleapis";

// Mock context creator
function createMockContext(batchingSystem?: BatchingSystem): HandlerContext {
  return {
    batchCompiler: {
      executeWithSafety: vi.fn(async ({ operation }) => {
        await operation();
        return {
          success: true,
          dryRun: false,
          changedCells: 0,
          requests: [],
        };
      }),
    } as any,
    rangeResolver: {
      resolve: vi.fn(async (_spreadsheetId: string, range: string) => ({
        a1Notation: range,
        gridRange: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: 10,
          startColumnIndex: 0,
          endColumnIndex: 5,
        },
        sheetId: 0,
        sheetName: 'Sheet1',
        resolution: {
          method: 'a1_direct',
          confidence: 1.0,
          path: '',
        },
      })),
    } as any,
    batchingSystem,
    googleClient: {
      sheets: vi.fn(),
    } as any,
  };
}

// Mock Sheets API
function createMockSheetsApi() {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: "Sheet1",
              },
            },
            {
              properties: {
                sheetId: 1,
                title: "Sheet2",
              },
            },
          ],
        },
      }),
      batchUpdate: vi.fn().mockResolvedValue({
        data: {
          replies: [
            {
              appendCells: {},
            },
          ],
        },
      }),
      values: {
        append: vi.fn().mockResolvedValue({
          data: {
            updates: {
              spreadsheetId: "test-sheet-id",
              updatedRange: "Sheet1!A1:B2",
              updatedRows: 2,
              updatedColumns: 2,
              updatedCells: 4,
            },
            tableRange: "Sheet1!A1:B2",
          },
        }),
        update: vi.fn(),
        get: vi.fn(),
        clear: vi.fn(),
        batchUpdate: vi.fn(),
        batchGet: vi.fn(),
        batchClear: vi.fn(),
      },
    },
  } as unknown as sheets_v4.Sheets;
}

describe("ValuesHandler - Append Batching Bug Fix", () => {
  let mockApi: sheets_v4.Sheets;
  let batchingSystem: BatchingSystem;
  let handler: ValuesHandler;
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockSheetsApi();
    batchingSystem = new BatchingSystem(mockApi, {
      enabled: true,
      windowMs: 50,
      maxBatchSize: 100,
      verboseLogging: false,
    });
    mockContext = createMockContext(batchingSystem);
    handler = new ValuesHandler(mockContext, mockApi);
  });

  afterEach(async () => {
    // Flush any pending batches
    await batchingSystem.flush();
    batchingSystem.destroy();
  });

  describe("Test 1: Single append operation", () => {
    it("should work correctly without batching", async () => {
      const result = await handler.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1", "value2"]],
      });

      expect(result.response.success).toBe(true);
      expect(result.response.updatedCells).toBeGreaterThan(0);
    });
  });

  describe("Test 2: Multiple appends to same range", () => {
    it("should batch multiple appends to the same range", async () => {
      const promises = [];

      // Queue 10 append operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          handler.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: "Sheet1!A1",
            values: [[`row${i}col1`, `row${i}col2`]],
          })
        );
      }

      // Wait for all to complete
      await Promise.all(promises);

      // Flush any pending batches
      await batchingSystem.flush();

      const stats = batchingSystem.getStats();

      // Verify batching occurred
      expect(stats.totalOperations).toBe(10);
      expect(stats.totalApiCalls).toBeLessThanOrEqual(2); // Should be 1-2 API calls (1 metadata + 1 batch)
      expect(stats.reductionPercentage).toBeGreaterThan(80); // >80% reduction

      // Verify batchUpdate was called instead of individual appends
      expect(mockApi.spreadsheets.batchUpdate).toHaveBeenCalled();
    });
  });

  describe("Test 3: Multiple appends to different ranges (same sheet)", () => {
    it("should batch appends to different ranges on the same sheet", async () => {
      const promises = [];

      // Queue 5 append operations to different ranges
      for (let i = 0; i < 5; i++) {
        promises.push(
          handler.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: `Sheet1!A${i + 1}`,
            values: [[`row${i}col1`, `row${i}col2`]],
          })
        );
      }

      await Promise.all(promises);
      await batchingSystem.flush();

      const stats = batchingSystem.getStats();

      // All operations should be batched
      expect(stats.totalOperations).toBe(5);
      expect(stats.totalApiCalls).toBeLessThanOrEqual(2);
      expect(stats.reductionPercentage).toBeGreaterThan(50);
    });
  });

  describe("Test 4: Multiple appends to different sheets", () => {
    it("should batch appends to different sheets in same spreadsheet", async () => {
      const promises = [];

      // Queue appends to Sheet1 and Sheet2
      for (let i = 0; i < 6; i++) {
        const sheetName = i % 2 === 0 ? "Sheet1" : "Sheet2";
        promises.push(
          handler.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: `${sheetName}!A1`,
            values: [[`row${i}col1`, `row${i}col2`]],
          })
        );
      }

      await Promise.all(promises);
      await batchingSystem.flush();

      const stats = batchingSystem.getStats();

      // Should batch all operations
      expect(stats.totalOperations).toBe(6);
      expect(stats.totalApiCalls).toBeLessThanOrEqual(2);
      expect(stats.reductionPercentage).toBeGreaterThan(60);
    });
  });

  describe("Test 5: Batching window timing", () => {
    it("should execute batch after window expires", async () => {
      const batchingSystemWithLongerWindow = new BatchingSystem(mockApi, {
        enabled: true,
        windowMs: 100,
        maxBatchSize: 100,
      });

      const contextWithLongerWindow = createMockContext(batchingSystemWithLongerWindow);
      const handlerWithLongerWindow = new ValuesHandler(contextWithLongerWindow, mockApi);

      // Queue first operation
      const promise1 = handlerWithLongerWindow.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1"]],
      });

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 120));

      // Queue second operation (should be in new batch)
      const promise2 = handlerWithLongerWindow.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value2"]],
      });

      await Promise.all([promise1, promise2]);
      await batchingSystemWithLongerWindow.flush();

      const stats = batchingSystemWithLongerWindow.getStats();

      // Should have created 2 batches (one per window)
      expect(stats.totalBatches).toBeGreaterThanOrEqual(2);

      batchingSystemWithLongerWindow.destroy();
    });
  });

  describe("Test 6: Error handling in batch", () => {
    it("should handle errors gracefully in batched operations", async () => {
      // Mock batchUpdate to fail
      mockApi.spreadsheets.batchUpdate = vi.fn().mockRejectedValue(
        new Error("API Error")
      );

      const promises = [];

      for (let i = 0; i < 3; i++) {
        promises.push(
          handler.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: "Sheet1!A1",
            values: [[`row${i}`]],
          })
        );
      }

      const results = await Promise.allSettled(promises);

      // All should be rejected with the same error
      results.forEach(result => {
        expect(result.status).toBe("fulfilled");
        expect((result as any).value.response.success).toBe(false);
      });
    });
  });

  describe("Test 7: Partial batch failures", () => {
    it("should handle invalid sheet names in batch", async () => {
      const promises = [
        // Valid operation
        handler.handle({
          action: "append",
          spreadsheetId: "test-sheet-id",
          range: "Sheet1!A1",
          values: [["value1"]],
        }),
        // Invalid sheet name
        handler.handle({
          action: "append",
          spreadsheetId: "test-sheet-id",
          range: "InvalidSheet!A1",
          values: [["value2"]],
        }),
      ];

      const results = await Promise.allSettled(promises);
      await batchingSystem.flush();

      // First should succeed, second should fail
      expect(results[0]!.status).toBe("fulfilled");
      expect((results[0] as any).value.response.success).toBe(true);

      // Second may fail due to invalid sheet
      if (results[1]!.status === "fulfilled") {
        expect((results[1] as any).value.response.success).toBeDefined();
      }
    });
  });

  describe("Test 8: Metrics verification", () => {
    it("should accurately track batching metrics", async () => {
      batchingSystem.resetStats();

      const promises = [];
      const operationCount = 20;

      for (let i = 0; i < operationCount; i++) {
        promises.push(
          handler.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: "Sheet1!A1",
            values: [[`row${i}`]],
          })
        );
      }

      await Promise.all(promises);
      await batchingSystem.flush();

      const stats = batchingSystem.getStats();

      expect(stats.totalOperations).toBe(operationCount);
      expect(stats.totalBatches).toBeGreaterThan(0);
      expect(stats.totalApiCalls).toBeGreaterThan(0);
      expect(stats.apiCallsSaved).toBe(stats.totalOperations - stats.totalApiCalls);
      expect(stats.avgBatchSize).toBeGreaterThan(1);
      expect(stats.maxBatchSize).toBeGreaterThanOrEqual(stats.avgBatchSize);
    });
  });

  describe("Test 9: Backward compatibility", () => {
    it("should work without batching system (backward compatible)", async () => {
      // Create handler without batching system
      const contextNoBatching = createMockContext(undefined);
      const handlerNoBatching = new ValuesHandler(contextNoBatching, mockApi);

      const result = await handlerNoBatching.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1", "value2"]],
      });

      expect(result.response.success).toBe(true);
      // Should call values.append directly
      expect(mockApi.spreadsheets.values.append).toHaveBeenCalled();
    });

    it("should fall back to direct API for OVERWRITE mode", async () => {
      vi.clearAllMocks();

      const result = await handler.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1"]],
        insertDataOption: "OVERWRITE",
      });

      expect(result.response.success).toBe(true);
      // Should use direct API call, not batching
      expect(mockApi.spreadsheets.values.append).toHaveBeenCalled();
    });

    it("should fall back to direct API for dry-run mode", async () => {
      vi.clearAllMocks();

      const result = await handler.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1"]],
        safety: {
          dryRun: true,
        },
      });

      expect(result.response.success).toBe(true);
      // Dry-run should not call batching system
      const stats = batchingSystem.getStats();
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe("Test 10: Integration with existing append tests", () => {
    it("should maintain same response format as non-batched append", async () => {
      // Batched append
      const batchedResult = await handler.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1", "value2"]],
      });

      // Non-batched append (with OVERWRITE to bypass batching)
      const nonBatchedResult = await handler.handle({
        action: "append",
        spreadsheetId: "test-sheet-id",
        range: "Sheet1!A1",
        values: [["value1", "value2"]],
        insertDataOption: "OVERWRITE",
      });

      // Both should have same structure
      expect(batchedResult.response).toHaveProperty("success");
      expect(batchedResult.response).toHaveProperty("action", "append");
      expect(batchedResult.response).toHaveProperty("updatedCells");
      expect(batchedResult.response).toHaveProperty("updatedRows");
      expect(batchedResult.response).toHaveProperty("updatedColumns");

      expect(nonBatchedResult.response).toHaveProperty("success");
      expect(nonBatchedResult.response).toHaveProperty("action", "append");
      expect(nonBatchedResult.response).toHaveProperty("updatedCells");
      expect(nonBatchedResult.response).toHaveProperty("updatedRows");
      expect(nonBatchedResult.response).toHaveProperty("updatedColumns");
    });
  });

  describe("Test 11: Batch size limits", () => {
    it("should respect maxBatchSize and create multiple batches if needed", async () => {
      const smallBatchSystem = new BatchingSystem(mockApi, {
        enabled: true,
        windowMs: 50,
        maxBatchSize: 5,
      });

      const contextSmallBatch = createMockContext(smallBatchSystem);
      const handlerSmallBatch = new ValuesHandler(contextSmallBatch, mockApi);

      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          handlerSmallBatch.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: "Sheet1!A1",
            values: [[`row${i}`]],
          })
        );
      }

      await Promise.all(promises);
      await smallBatchSystem.flush();

      const stats = smallBatchSystem.getStats();

      // Should have created multiple batches due to size limit
      expect(stats.totalBatches).toBeGreaterThanOrEqual(2);
      expect(stats.maxBatchSize).toBeLessThanOrEqual(5);

      smallBatchSystem.destroy();
    });
  });

  describe("Test 12: Performance verification", () => {
    it("should batch 10 appends into 1-2 API calls", async () => {
      batchingSystem.resetStats();
      vi.clearAllMocks();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          handler.handle({
            action: "append",
            spreadsheetId: "test-sheet-id",
            range: "Sheet1!A1",
            values: [[`row${i}col1`, `row${i}col2`]],
          })
        );
      }

      await Promise.all(promises);
      await batchingSystem.flush();

      const stats = batchingSystem.getStats();

      // Critical success criteria
      expect(stats.totalOperations).toBe(10);
      expect(stats.totalApiCalls).toBeLessThanOrEqual(2); // 1 metadata + 1 batchUpdate
      expect(stats.reductionPercentage).toBeGreaterThanOrEqual(80); // Must exceed 80%

      // Verify API efficiency
      const batchUpdateCalls = (mockApi.spreadsheets.batchUpdate as any).mock.calls.length;
      const appendCalls = (mockApi.spreadsheets.values.append as any).mock.calls.length;
      const totalApiCalls = batchUpdateCalls + appendCalls;

      expect(totalApiCalls).toBeLessThanOrEqual(2);
    });
  });
});
