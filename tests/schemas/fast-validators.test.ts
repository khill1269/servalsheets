/**
 * ServalSheets - Fast Validators Tests
 *
 * Tests for the pre-compiled fast validators.
 */

import { describe, it, expect } from "vitest";
import {
  fastValidateAuth,
  fastValidateSpreadsheet,
  fastValidateSheet,
  fastValidateValues,
  fastValidateCells,
  fastValidateFormat,
  fastValidateDimensions,
  fastValidateTransaction,
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

describe("fastValidateSpreadsheet", () => {
  it("should accept valid get action", () => {
    expect(() => fastValidateSpreadsheet({
      action: "get",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });

  it("should accept create without spreadsheetId", () => {
    expect(() => fastValidateSpreadsheet({
      action: "create",
      title: "New Spreadsheet",
    })).not.toThrow();
  });

  it("should accept list without spreadsheetId", () => {
    expect(() => fastValidateSpreadsheet({ action: "list" })).not.toThrow();
  });

  it("should reject get without spreadsheetId", () => {
    expect(() => fastValidateSpreadsheet({ action: "get" })).toThrow(FastValidationError);
  });

  it("should reject invalid spreadsheetId format", () => {
    expect(() => fastValidateSpreadsheet({
      action: "get",
      spreadsheetId: "too-short",
    })).toThrow(FastValidationError);
  });
});

describe("fastValidateSheet", () => {
  it("should accept valid list action", () => {
    expect(() => fastValidateSheet({
      action: "list",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).not.toThrow();
  });

  it("should accept valid add action", () => {
    expect(() => fastValidateSheet({
      action: "add",
      spreadsheetId: VALID_SPREADSHEET_ID,
      title: "New Sheet",
    })).not.toThrow();
  });

  it("should require sheetId for delete action", () => {
    expect(() => fastValidateSheet({
      action: "delete",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).toThrow(FastValidationError);
  });

  it("should accept delete with sheetId", () => {
    expect(() => fastValidateSheet({
      action: "delete",
      spreadsheetId: VALID_SPREADSHEET_ID,
      sheetId: 0,
    })).not.toThrow();
  });
});

describe("fastValidateValues", () => {
  it("should accept valid read action", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:D10",
    })).not.toThrow();
  });

  it("should accept read action with object range format (a1)", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "Sheet1!A1:D10" },
    })).not.toThrow();
  });

  it("should accept read action with object range format (namedRange)", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { namedRange: "MyNamedRange" },
    })).not.toThrow();
  });

  it("should accept read action with object range format (semantic)", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { semantic: { sheet: "Sheet1", column: "A" } },
    })).not.toThrow();
  });

  it("should accept read action with object range format (grid)", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { grid: { sheetId: 0, startRowIndex: 0, endRowIndex: 10 } },
    })).not.toThrow();
  });

  it("should reject read action with invalid object range (no valid key)", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { invalid: "test" },
    })).toThrow(FastValidationError);
  });

  it("should accept valid write action", () => {
    expect(() => fastValidateValues({
      action: "write",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1:B2",
      values: [["A", "B"], [1, 2]],
    })).not.toThrow();
  });

  it("should accept write action with object range format", () => {
    expect(() => fastValidateValues({
      action: "write",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "Sheet1!A1:B2" },
      values: [["A", "B"], [1, 2]],
    })).not.toThrow();
  });

  it("should require range for read action", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).toThrow(FastValidationError);
  });

  it("should reject empty string range", () => {
    expect(() => fastValidateValues({
      action: "read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "",
    })).toThrow(FastValidationError);
  });

  it("should require values for write action", () => {
    expect(() => fastValidateValues({
      action: "write",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "Sheet1!A1",
    })).toThrow(FastValidationError);
  });

  it("should accept valid batch_read action", () => {
    expect(() => fastValidateValues({
      action: "batch_read",
      spreadsheetId: VALID_SPREADSHEET_ID,
      ranges: ["Sheet1!A1:A10", "Sheet1!B1:B10"],
    })).not.toThrow();
  });

  it("should accept valid find action", () => {
    expect(() => fastValidateValues({
      action: "find",
      spreadsheetId: VALID_SPREADSHEET_ID,
      query: "search term",
    })).not.toThrow();
  });

  it("should accept valid replace action", () => {
    expect(() => fastValidateValues({
      action: "replace",
      spreadsheetId: VALID_SPREADSHEET_ID,
      find: "old",
      replacement: "new",
    })).not.toThrow();
  });
});

describe("fastValidateCells", () => {
  it("should accept valid add_note action", () => {
    expect(() => fastValidateCells({
      action: "add_note",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: "A1",
      note: "Test note",
    })).not.toThrow();
  });

  it("should accept add_note with object range format", () => {
    expect(() => fastValidateCells({
      action: "add_note",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "A1" },
      note: "Test note",
    })).not.toThrow();
  });

  it("should accept merge with object range format", () => {
    expect(() => fastValidateCells({
      action: "merge",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "A1:C1" },
    })).not.toThrow();
  });

  it("should not require range for get_merges", () => {
    expect(() => fastValidateCells({
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
      range: "A1:B10",
    })).not.toThrow();
  });

  it("should accept set_format with object range format", () => {
    expect(() => fastValidateFormat({
      action: "set_format",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { a1: "A1:B10" },
    })).not.toThrow();
  });

  it("should accept apply_preset with object range format (namedRange)", () => {
    expect(() => fastValidateFormat({
      action: "apply_preset",
      spreadsheetId: VALID_SPREADSHEET_ID,
      range: { namedRange: "HeaderRow" },
    })).not.toThrow();
  });

  it("should require range", () => {
    expect(() => fastValidateFormat({
      action: "set_format",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).toThrow(FastValidationError);
  });
});

describe("fastValidateDimensions", () => {
  it("should accept valid insert_rows action", () => {
    expect(() => fastValidateDimensions({
      action: "insert_rows",
      spreadsheetId: VALID_SPREADSHEET_ID,
      sheetId: 0,
      startIndex: 5,
      count: 10,
    })).not.toThrow();
  });

  it("should require sheetId", () => {
    expect(() => fastValidateDimensions({
      action: "insert_rows",
      spreadsheetId: VALID_SPREADSHEET_ID,
    })).toThrow(FastValidationError);
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
    expect(() => fastValidateTransaction({ action: "commit" })).toThrow(FastValidationError);
  });

  it("should accept commit with transactionId", () => {
    expect(() => fastValidateTransaction({
      action: "commit",
      transactionId: "tx_123",
    })).not.toThrow();
  });
});

describe("Validator Registry", () => {
  it("should have validator for all tools", () => {
    const tools = [
      "sheets_auth", "sheets_spreadsheet", "sheets_sheet", "sheets_values",
      "sheets_cells", "sheets_format", "sheets_dimensions", "sheets_rules",
      "sheets_charts", "sheets_pivot", "sheets_filter_sort", "sheets_sharing",
      "sheets_comments", "sheets_versions", "sheets_analysis", "sheets_advanced",
      "sheets_transaction", "sheets_validation", "sheets_conflict", "sheets_impact",
      "sheets_history", "sheets_confirm", "sheets_analyze", "sheets_fix", "sheets_composite",
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
