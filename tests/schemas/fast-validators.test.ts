/**
 * ServalSheets - Fast Validators Tests
 *
 * Tests for the pre-compiled fast validators (17 tools after consolidation).
 */

import { describe, it, expect } from "vitest";
import {
  fastValidateAuth,
  fastValidateCore,
  fastValidateData,
  fastValidateFormat,
  fastValidateDimensions,
  fastValidateVisualize,
  fastValidateCollaborate,
  fastValidateTransaction,
  fastValidateQuality,
  fastValidateAnalyze,
  FastValidationError,
  getFastValidator,
  fastValidate,
  hasFastValidator,
} from "../../src/schemas/fast-validators.js";

const VALID_SPREADSHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";

describe("FastValidationError", () => {
  it("should create error with code and message", () => {
    const error = new FastValidationError("TEST_CODE", "Test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.message).toBe("Test message");
    expect(error.name).toBe("FastValidationError");
  });

  it("should include details when provided", () => {
    const error = new FastValidationError("TEST_CODE", "Test message", { hint: "test hint" });
    expect(error.details).toEqual({ hint: "test hint" });
  });

  it("should convert to error detail", () => {
    const error = new FastValidationError("TEST_CODE", "Test message", { extra: "data" });
    const detail = error.toErrorDetail();
    expect(detail.code).toBe("INVALID_PARAMS");
    expect(detail.message).toBe("Test message");
    expect(detail.details?.validationCode).toBe("TEST_CODE");
    expect(detail.details?.extra).toBe("data");
  });
});

describe("fastValidateAuth", () => {
  it("should accept valid status action", () => {
    expect(() => fastValidateAuth({ action: "status" })).not.toThrow();
  });

  it("should accept valid login action", () => {
    expect(() => fastValidateAuth({ action: "login" })).not.toThrow();
  });

  it("should accept valid callback action with code", () => {
    expect(() => fastValidateAuth({ action: "callback", code: "auth_code_123" })).not.toThrow();
  });

  it("should reject callback without code", () => {
    expect(() => fastValidateAuth({ action: "callback" })).toThrow(FastValidationError);
  });

  it("should reject invalid action", () => {
    expect(() => fastValidateAuth({ action: "invalid" })).toThrow(FastValidationError);
  });

  it("should reject missing action", () => {
    expect(() => fastValidateAuth({})).toThrow(FastValidationError);
  });
});

describe("fastValidateCore", () => {
  it("should accept valid get action", () => {
    expect(() => fastValidateCore({
      action: "get",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });

  it("should accept create without spreadsheetId", () => {
    expect(() => fastValidateCore({
      action: "create",
      title: "New Spreadsheet",
    })).not.toThrow();
  });

  it("should accept list without spreadsheetId", () => {
    expect(() => fastValidateCore({ action: "list" })).not.toThrow();
  });

  it("should accept valid add_sheet action", () => {
    expect(() => fastValidateCore({
      action: "add_sheet",
      spreadsheetId: VALID_SPREADSHEET_ID,
      title: "New Sheet",
    })).not.toThrow();
  });

  it("should require spreadsheetId for delete_sheet", () => {
    expect(() => fastValidateCore({
      action: "delete_sheet",
      sheetId: 0,
    })).toThrow(FastValidationError);
  });
});

describe("fastValidateData", () => {
  it("should accept valid read action", () => {
    expect(() => fastValidateData({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:D10",
    })).not.toThrow();
  });

  it("should accept action with object range format (a1)", () => {
    expect(() => fastValidateData({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "Sheet1!A1:D10" },
    })).not.toThrow();
  });

  it("should accept action with object range format (namedRange)", () => {
    expect(() => fastValidateData({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { namedRange: "MyNamedRange" },
    })).not.toThrow();
  });

  it("should accept write action", () => {
    expect(() => fastValidateData({
      action: "write",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:B2",
      values: [["A", "B"], [1, 2]],
    })).not.toThrow();
  });

  it("should accept add_note action", () => {
    expect(() => fastValidateData({
      action: "add_note",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "A1",
      note: "Test note",
    })).not.toThrow();
  });

  it("should accept merge action", () => {
    expect(() => fastValidateData({
      action: "merge",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "A1:C1" },
    })).not.toThrow();
  });

  it("should accept get_merges without range", () => {
    expect(() => fastValidateData({
      action: "get_merges",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });
});

describe("fastValidateFormat", () => {
  it("should accept valid set_format action", () => {
    expect(() => fastValidateFormat({
      action: "set_format",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:B2",
      format: { bold: true },
    })).not.toThrow();
  });

  it("should accept set_format with object range format", () => {
    expect(() => fastValidateFormat({
      action: "set_format",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "Sheet1!A1:B2" },
      format: { bold: true },
    })).not.toThrow();
  });

  it("should accept apply_preset action", () => {
    expect(() => fastValidateFormat({
      action: "apply_preset",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "A1:A10",
      preset: "header",
    })).not.toThrow();
  });

  it("should require range", () => {
    expect(() => fastValidateFormat({
      action: "set_format",
      spreadsheetId: VALID_SPREADSHEET_ID,
      format: { bold: true },
    })).toThrow(FastValidationError);
  });
});

describe("fastValidateDimensions", () => {
  it("should accept valid insert_rows action", () => {
    expect(() => fastValidateDimensions({
      action: "insert_rows",
      spreadsheetId: VALID_SPREADSHEET_ID,
      sheetId: 0,
      startIndex: 0,
      count: 5,
    })).not.toThrow();
  });

  it("should accept freeze_rows action", () => {
    expect(() => fastValidateDimensions({
      action: "freeze_rows",
      spreadsheetId: VALID_SPREADSHEET_ID,
      sheetId: 0,
      count: 1,
    })).not.toThrow();
  });

  it("should require sheetId", () => {
    expect(() => fastValidateDimensions({
      action: "insert_rows",
      spreadsheetId: VALID_SPREADSHEET_ID,
      startIndex: 0,
      count: 5,
    })).toThrow(FastValidationError);
  });
});

describe("fastValidateVisualize", () => {
  it("should accept chart_create action", () => {
    expect(() => fastValidateVisualize({
      action: "chart_create",
      spreadsheetId: VALID_SPREADSHEET_ID,
      sheetId: 0,
      chartType: "line",
      spec: { title: "Test Chart" },
    })).not.toThrow();
  });

  it("should accept pivot_create action", () => {
    expect(() => fastValidateVisualize({
      action: "pivot_create",
      spreadsheetId: VALID_SPREADSHEET_ID,
      source: { sheetId: 0, startRowIndex: 0, endRowIndex: 10 },
      rows: [{ sourceColumnOffset: 0 }],
      values: [{ summarizeFunction: "SUM", sourceColumnOffset: 1 }],
    })).not.toThrow();
  });

  it("should accept suggest_chart action", () => {
    expect(() => fastValidateVisualize({
      action: "suggest_chart",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:D10",
    })).not.toThrow();
  });
});

describe("fastValidateCollaborate", () => {
  it("should accept share_add action", () => {
    expect(() => fastValidateCollaborate({
      action: "share_add",
      spreadsheetId: VALID_SPREADSHEET_ID,
      email: "user@example.com",
      role: "reader",
      type: "user",
    })).not.toThrow();
  });

  it("should accept comment_add action", () => {
    expect(() => fastValidateCollaborate({
      action: "comment_add",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1",
      content: "Test comment",
    })).not.toThrow();
  });

  it("should accept version_list_revisions action", () => {
    expect(() => fastValidateCollaborate({
      action: "version_list_revisions",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });
});

describe("fastValidateTransaction", () => {
  it("should accept valid begin action", () => {
    expect(() => fastValidateTransaction({
      action: "begin",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });

  it("should accept list without spreadsheetId", () => {
    expect(() => fastValidateTransaction({ action: "list" })).not.toThrow();
  });

  it("should require transactionId for commit", () => {
    expect(() => fastValidateTransaction({
      action: "commit",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).toThrow(FastValidationError);
  });

  it("should accept commit with transactionId", () => {
    expect(() => fastValidateTransaction({
      action: "commit",
      spreadsheetId: VALID_SPREADSHEET_ID,
      transactionId: "txn_123",
    })).not.toThrow();
  });
});

describe("fastValidateQuality", () => {
  it("should accept validate action", () => {
    expect(() => fastValidateQuality({
      action: "validate",
      value: "test",
    })).not.toThrow();
  });

  it("should accept detect_conflicts action", () => {
    expect(() => fastValidateQuality({
      action: "detect_conflicts",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });

  it("should accept analyze_impact action", () => {
    expect(() => fastValidateQuality({
      action: "analyze_impact",
      spreadsheetId: VALID_SPREADSHEET_ID,
      operation: { type: "update_cell", range: "A1", value: "test" },
    })).not.toThrow();
  });
});

describe("fastValidateAnalyze", () => {
  it("should accept comprehensive action", () => {
    expect(() => fastValidateAnalyze({
      action: "comprehensive",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });

  it("should accept analyze_data action", () => {
    expect(() => fastValidateAnalyze({
      action: "analyze_data",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:D10",
    })).not.toThrow();
  });

  it("should accept generate_formula action", () => {
    expect(() => fastValidateAnalyze({
      action: "generate_formula",
      spreadsheetId: VALID_SPREADSHEET_ID,
      description: "Calculate sum",
    })).not.toThrow();
  });

  it("should accept detect_patterns action", () => {
    expect(() => fastValidateAnalyze({
      action: "detect_patterns",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:D10",
    })).not.toThrow();
  });
});

describe("Validator Registry", () => {
  it("should have validator for all 17 tools", () => {
    const tools = [
      "sheets_auth",
      "sheets_core",
      "sheets_data",
      "sheets_format",
      "sheets_dimensions",
      "sheets_visualize",
      "sheets_collaborate",
      "sheets_analysis",
      "sheets_advanced",
      "sheets_transaction",
      "sheets_quality",
      "sheets_history",
      "sheets_confirm",
      "sheets_analyze",
      "sheets_fix",
      "sheets_composite",
      "sheets_session",
    ];

    for (const tool of tools) {
      expect(hasFastValidator(tool)).toBe(true);
      expect(getFastValidator(tool)).toBeDefined();
    }
  });

  it("should return undefined for unknown tool", () => {
    expect(getFastValidator("unknown_tool")).toBeUndefined();
    expect(hasFastValidator("unknown_tool")).toBe(false);
  });

  it("should validate using fastValidate helper", () => {
    expect(() => fastValidate("sheets_auth", { action: "status" })).not.toThrow();
    expect(() => fastValidate("sheets_auth", {})).toThrow(FastValidationError);
  });

  it("should throw for unknown tool in fastValidate", () => {
    expect(() => fastValidate("unknown", {})).toThrow(FastValidationError);
  });
});
