/**
 * ServalSheets - Analysis Handler Snapshot Tests
 *
 * Snapshot tests for handler output stability.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalysisHandler } from "../../src/handlers/analysis.js";
import type { HandlerContext } from "../../src/handlers/base.js";
import { cacheManager } from "../../src/utils/cache-manager.js";
import type { sheets_v4 } from "googleapis";

const createMockSheetsApi = () => ({
  spreadsheets: {
    values: {
      get: vi.fn(),
    },
  },
});

const createMockContext = (): HandlerContext => ({
  batchCompiler: {} as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({ a1Notation: "Sheet1!A1:B4" }),
  } as any,
});

describe("AnalysisHandler Snapshots", () => {
  let handler: AnalysisHandler;
  let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheManager.clear();
    mockSheetsApi = createMockSheetsApi();
    mockContext = createMockContext();
    handler = new AnalysisHandler(
      mockContext,
      mockSheetsApi as unknown as sheets_v4.Sheets,
    );
  });

  it("matches snapshot for statistics response", async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ["Name", "Score"],
          ["Alice", 5],
          ["Bob", 5],
          ["Cara", 5],
        ],
      },
    });

    const result = await handler.handle({
      action: "statistics",
      spreadsheetId: "test-sheet-id",
      range: { a1: "Sheet1!A1:B4" },
    });

    expect(result.response).toMatchSnapshot();
  });
});
