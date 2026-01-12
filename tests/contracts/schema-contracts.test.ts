/**
 * Schema Contract Tests
 *
 * Ensures all tool schemas follow MCP best practices:
 * - Schemas are not empty (can validate inputs)
 * - Discriminated unions work correctly
 * - Required fields are enforced
 * - All actions are documented
 *
 * These tests focus on what matters: that schemas can actually validate inputs correctly.
 * We don't test zodToJsonSchema conversion since the MCP SDK handles that internally.
 */

import { describe, it, expect } from 'vitest';
import { type ZodType } from 'zod';
import {
  SheetSpreadsheetInputSchema,
  SheetsSheetInputSchema,
  SheetsValuesInputSchema,
  SheetsCellsInputSchema,
  SheetsFormatInputSchema,
  SheetsDimensionsInputSchema,
  SheetsRulesInputSchema,
  SheetsChartsInputSchema,
  SheetsPivotInputSchema,
  SheetsFilterSortInputSchema,
  SheetsSharingInputSchema,
  SheetsCommentsInputSchema,
  SheetsVersionsInputSchema,
  SheetsAnalysisInputSchema,
  SheetsAdvancedInputSchema,
  SheetsTransactionInputSchema,
  SheetsValidationInputSchema,
  SheetsConflictInputSchema,
  SheetsImpactInputSchema,
  SheetsHistoryInputSchema,
  SheetsConfirmInputSchema,
  SheetsAnalyzeInputSchema,
  SheetsFixInputSchema,
  CompositeInputSchema,
  TOOL_COUNT,
  ACTION_COUNT,
} from '../../src/schemas/index.js';
import { SheetsAuthInputSchema } from '../../src/schemas/auth.js';

// Sample valid inputs for each tool (using first action from each schema)
// NEW: After refactoring, inputs no longer wrapped in "request:"
const VALID_INPUTS: Record<string, unknown> = {
  sheets_auth: { action: 'status' },
  sheets_spreadsheet: { action: 'get', spreadsheetId: 'test123' },
  sheets_sheet: { action: 'add', spreadsheetId: 'test123', title: 'New Sheet' },
  sheets_values: { action: 'read', spreadsheetId: 'test123', range: { a1: 'Sheet1!A1:B10' } },
  sheets_cells: { action: 'add_note', spreadsheetId: 'test123', cell: 'A1', note: 'Test note' },
  sheets_format: { action: 'set_format', spreadsheetId: 'test123', range: { a1: 'Sheet1!A1' }, format: {} },
  sheets_dimensions: { action: 'insert_rows', spreadsheetId: 'test123', sheetId: 0, startIndex: 5 },
  sheets_rules: {
    action: 'add_conditional_format',
    spreadsheetId: 'test123',
    sheetId: 0,
    range: { a1: 'Sheet1!A1:A10' },
    rule: { type: 'boolean', condition: { type: 'BLANK' }, format: {} },
  },
  sheets_charts: {
    action: 'create',
    spreadsheetId: 'test123',
    sheetId: 0,
    chartType: 'BAR',
    data: { sourceRange: { a1: 'Sheet1!A1:C10' } },
    position: { anchorCell: 'E1' },
  },
  sheets_pivot: {
    action: 'create',
    spreadsheetId: 'test123',
    sourceRange: { a1: 'Sheet1!A1:C10' },
    values: [{ sourceColumnOffset: 0, summarizeFunction: 'SUM' }],
  },
  sheets_filter_sort: { action: 'set_basic_filter', spreadsheetId: 'test123', sheetId: 0 },
  sheets_sharing: { action: 'share', spreadsheetId: 'test123', type: 'anyone', role: 'reader' },
  sheets_comments: { action: 'add', spreadsheetId: 'test123', content: 'Test comment' },
  sheets_versions: { action: 'list_revisions', spreadsheetId: 'test123' },
  sheets_analysis: { action: 'data_quality', spreadsheetId: 'test123' },
  sheets_advanced: {
    action: 'add_named_range',
    spreadsheetId: 'test123',
    name: 'TestRange',
    range: { a1: 'Sheet1!A1:C10' },
  },
  sheets_transaction: { action: 'begin', spreadsheetId: 'test123' },
  sheets_validation: { action: 'validate', value: 'test-value' },
  sheets_conflict: { action: 'detect', spreadsheetId: 'test123' },
  sheets_impact: { action: 'analyze', spreadsheetId: 'test123', operation: { type: 'values_write', tool: 'sheets_values', action: 'write', params: { range: 'A1:B10', values: [[1, 2]] } } },
  sheets_history: { action: 'list' },
  sheets_confirm: { action: 'request', plan: { title: 'Test Plan', description: 'Test', steps: [{ stepNumber: 1, description: 'Test step', tool: 'sheets_values', action: 'read', risk: 'low', estimatedApiCalls: 1, isDestructive: false, canUndo: false }] } },
  sheets_analyze: { action: 'generate_formula', spreadsheetId: 'test123', description: 'Sum column A' },
  sheets_fix: { action: 'fix', spreadsheetId: 'test123', issues: [{ type: 'MULTIPLE_TODAY', severity: 'medium', sheet: 'Sheet1', description: 'Multiple TODAY() calls' }] },
  sheets_composite: { action: 'import_csv', spreadsheetId: 'test123', csvData: 'Name,Age\nAlice,30', mode: 'replace' },
};

// All tool input schemas
const TOOL_SCHEMAS = [
  { name: 'sheets_auth', schema: SheetsAuthInputSchema },
  { name: 'sheets_spreadsheet', schema: SheetSpreadsheetInputSchema },
  { name: 'sheets_sheet', schema: SheetsSheetInputSchema },
  { name: 'sheets_values', schema: SheetsValuesInputSchema },
  { name: 'sheets_cells', schema: SheetsCellsInputSchema },
  { name: 'sheets_format', schema: SheetsFormatInputSchema },
  { name: 'sheets_dimensions', schema: SheetsDimensionsInputSchema },
  { name: 'sheets_rules', schema: SheetsRulesInputSchema },
  { name: 'sheets_charts', schema: SheetsChartsInputSchema },
  { name: 'sheets_pivot', schema: SheetsPivotInputSchema },
  { name: 'sheets_filter_sort', schema: SheetsFilterSortInputSchema },
  { name: 'sheets_sharing', schema: SheetsSharingInputSchema },
  { name: 'sheets_comments', schema: SheetsCommentsInputSchema },
  { name: 'sheets_versions', schema: SheetsVersionsInputSchema },
  { name: 'sheets_analysis', schema: SheetsAnalysisInputSchema },
  { name: 'sheets_advanced', schema: SheetsAdvancedInputSchema },
  { name: 'sheets_transaction', schema: SheetsTransactionInputSchema },
  { name: 'sheets_validation', schema: SheetsValidationInputSchema },
  { name: 'sheets_conflict', schema: SheetsConflictInputSchema },
  { name: 'sheets_impact', schema: SheetsImpactInputSchema },
  { name: 'sheets_history', schema: SheetsHistoryInputSchema },
  { name: 'sheets_confirm', schema: SheetsConfirmInputSchema },
  { name: 'sheets_analyze', schema: SheetsAnalyzeInputSchema },
  { name: 'sheets_fix', schema: SheetsFixInputSchema },
  { name: 'sheets_composite', schema: CompositeInputSchema },
];

describe('Schema Contracts', () => {
  describe('Tool Registry Integrity', () => {
    it('should have exactly 26 tools', () => {
      expect(TOOL_COUNT).toBe(26);
      expect(TOOL_SCHEMAS).toHaveLength(25);
    });

    it('should have 70+ total actions across all tools', () => {
      expect(ACTION_COUNT).toBeGreaterThanOrEqual(70);
    });

    it('should not have duplicate tool names', () => {
      const names = TOOL_SCHEMAS.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Schema Validation (Not Empty)', () => {
    for (const tool of TOOL_SCHEMAS) {
      it(`${tool.name} can validate valid inputs`, () => {
        const validInput = VALID_INPUTS[tool.name];
        expect(validInput).toBeDefined();

        const result = tool.schema.safeParse(validInput);

        if (!result.success) {
          console.error(`${tool.name} validation failed:`, result.error.errors);
        }

        expect(result.success).toBe(true);
      });

      it(`${tool.name} rejects invalid inputs`, () => {
        // Test with invalid action
        const invalidAction = tool.schema.safeParse({
            action: 'invalid_action_name',
            spreadsheetId: 'test123',
        });
        expect(invalidAction.success).toBe(false);

        // Test with missing required field (spreadsheetId)
        const missingField = tool.schema.safeParse({
            action: 'get',
        });
        expect(missingField.success).toBe(false);
      });

      it(`${tool.name} schema is defined and is a Zod schema`, () => {
        expect(tool.schema).toBeDefined();
        expect(tool.schema._def).toBeDefined(); // Zod schemas have _def
        expect(typeof tool.schema.safeParse).toBe('function');
      });
    }
  });

  describe('Discriminated Union Behavior', () => {
    it('sheets_values accepts all expected actions', () => {
      const actions = ['read', 'write', 'append', 'clear'];

      for (const action of actions) {
        const result = SheetsValuesInputSchema.safeParse({
            action,
            spreadsheetId: 'test123',
            range: { a1: 'Sheet1!A1:B10' },
            ...(action === 'write' || action === 'append' ? { values: [[1, 2]] } : {}),
        });

        if (!result.success) {
          console.error(`sheets_values action "${action}" failed:`, result.error.errors);
        }

        expect(result.success).toBe(true);
      }
    });

    it('sheets_spreadsheet discriminates correctly', () => {
      // 'get' requires spreadsheetId
      const getValid = SheetSpreadsheetInputSchema.safeParse({
          action: 'get',
          spreadsheetId: 'test123',
      });
      expect(getValid.success).toBe(true);

      // 'create' requires title
      const createValid = SheetSpreadsheetInputSchema.safeParse({
          action: 'create',
          title: 'New Spreadsheet',
      });
      expect(createValid.success).toBe(true);
    });
  });

  describe('Required Fields Validation', () => {
    it('sheets_values requires spreadsheetId', () => {
      const result = SheetsValuesInputSchema.safeParse({
          action: 'read',
          range: { a1: 'Sheet1!A1' },
          // Missing spreadsheetId
      });
      expect(result.success).toBe(false);
    });

    it('sheets_values write action requires values', () => {
      const result = SheetsValuesInputSchema.safeParse({
          action: 'write',
          spreadsheetId: 'test123',
          range: { a1: 'Sheet1!A1' },
          // Missing values
      });
      expect(result.success).toBe(false);
    });

    it('sheets_sheet add action requires title', () => {
      const result = SheetsSheetInputSchema.safeParse({
          action: 'add',
          spreadsheetId: 'test123',
          // Missing title
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Completeness', () => {
    it('all tools have valid input examples', () => {
      // Ensure we have a valid input for every tool
      for (const tool of TOOL_SCHEMAS) {
        expect(VALID_INPUTS[tool.name]).toBeDefined();
      }
    });

    it('all tool schemas can be stringified', () => {
      // Ensure schemas don't have circular references
      for (const tool of TOOL_SCHEMAS) {
        expect(() => JSON.stringify(tool.schema._def)).not.toThrow();
      }
    });
  });
});
