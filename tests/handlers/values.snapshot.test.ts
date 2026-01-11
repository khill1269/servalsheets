/**
 * ServalSheets - Values Handler Snapshot Tests
 *
 * Snapshot tests for handler output stability.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValuesHandler } from "../../src/handlers/values.js";
import type { HandlerContext } from "../../src/handlers/base.js";
import { cacheManager } from "../../src/utils/cache-manager.js";

const createMockSheetsApi = () => ({
  spreadsheets: {
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
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {
    compile: vi.fn(),
    execute: vi.fn(),
    executeAll: vi.fn(),
    executeWithSafety: vi.fn(async (options: any) => {
      await options.operation();
      return {
        success: true,
        spreadsheetId: options.spreadsheetId,
        responses: [],
        dryRun: false,
        diff: undefined,
      };
    }),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({
      a1Notation: "Sheet1!A1:B3",
      sheetId: 0,
      sheetName: "Sheet1",
      gridRange: { sheetId: 0 },
      resolution: { method: "a1_direct", confidence: 1.0, path: "" },
    }),
    clearCache: vi.fn(),
  } as any,
});

describe("ValuesHandler Snapshots", () => {
  let mockApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;
  let handler: ValuesHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheManager.clear();
    mockApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new ValuesHandler(mockContext, mockApi as any);
  });

  it("matches snapshot for read response", async () => {
    mockApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ["Name", "Age"],
          ["Alice", "30"],
          ["Bob", "25"],
        ],
        range: "Sheet1!A1:B3",
        majorDimension: "ROWS",
      },
    });

    const result = await handler.handle({
      action: "read",
      spreadsheetId: "test-sheet-id",
      range: { a1: "Sheet1!A1:B3" },
    });

    expect(result.response).toMatchSnapshot();
  });

  it("matches snapshot for write response", async () => {
    mockApi.spreadsheets.values.update.mockResolvedValue({
      data: {
        updatedCells: 6,
        updatedRows: 3,
        updatedColumns: 2,
        updatedRange: "Sheet1!A1:B3",
      },
    });

    const result = await handler.handle({
      action: "write",
      spreadsheetId: "test-sheet-id",
      range: { a1: "Sheet1!A1:B3" },
      values: [
        ["Name", "Age"],
        ["Alice", "30"],
        ["Bob", "25"],
      ],
    });

    expect(result.response).toMatchSnapshot();
  });

  it("matches snapshot for error response", async () => {
    mockApi.spreadsheets.values.get.mockRejectedValue(
      new Error("Sheet not found"),
    );

    const result = await handler.handle({
      action: "read",
      spreadsheetId: "missing-sheet-id",
      range: { a1: "Sheet1!A1:B3" },
    });

    expect(result.response).toMatchSnapshot();
  });
});
