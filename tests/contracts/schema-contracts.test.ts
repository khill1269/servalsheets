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
  SheetsCoreInputSchema,
  SheetsDataInputSchema,
  SheetsFormatInputSchema,
  SheetsDimensionsInputSchema,
  SheetsVisualizeInputSchema,
  SheetsCollaborateInputSchema,
  SheetsAnalysisInputSchema,
  SheetsAdvancedInputSchema,
  SheetsTransactionInputSchema,
  SheetsQualityInputSchema,
  SheetsHistoryInputSchema,
  SheetsConfirmInputSchema,
  SheetsAnalyzeInputSchema,
  SheetsFixInputSchema,
  CompositeInputSchema,
  SheetsSessionInputSchema,
  TOOL_COUNT,
  ACTION_COUNT,
} from '../../src/schemas/index.js';
import { SheetsAuthInputSchema } from '../../src/schemas/auth.js';

// Sample valid inputs for each tool (using first action from each schema)
// NEW: After refactoring, inputs no longer wrapped in "request:"
const VALID_INPUTS: Record<string, unknown> = {
  sheets_auth: { action: 'status' },
  sheets_core: { action: 'get', spreadsheetId: 'test123' },
  sheets_data: { action: 'read', spreadsheetId: 'test123', range: { a1: 'Sheet1!A1:B10' } },
  sheets_format: { action: 'set_format', spreadsheetId: 'test123', range: { a1: 'Sheet1!A1' }, format: {} },
  sheets_dimensions: { action: 'insert_rows', spreadsheetId: 'test123', sheetId: 0, startIndex: 5 },
  sheets_visualize: {
    action: 'chart_create',
    spreadsheetId: 'test123',
    sheetId: 0,
    chartType: 'BAR',
    data: { sourceRange: { a1: 'Sheet1!A1:C10' } },
    position: { anchorCell: 'E1' },
  },
  sheets_collaborate: { action: 'share_add', spreadsheetId: 'test123', type: 'anyone', role: 'reader' },
  sheets_analysis: { action: 'data_quality', spreadsheetId: 'test123' },
  sheets_advanced: {
    action: 'add_named_range',
    spreadsheetId: 'test123',
    name: 'TestRange',
    range: { a1: 'Sheet1!A1:C10' },
  },
  sheets_transaction: { action: 'begin', spreadsheetId: 'test123' },
  sheets_quality: { action: 'validate', value: 'test-value' },
  sheets_history: { action: 'list' },
  sheets_confirm: { action: 'request', plan: { title: 'Test Plan', description: 'Test', steps: [{ stepNumber: 1, description: 'Test step', tool: 'sheets_values', action: 'read', risk: 'low', estimatedApiCalls: 1, isDestructive: false, canUndo: false }] } },
  sheets_analyze: { action: 'generate_formula', spreadsheetId: 'test123', description: 'Sum column A' },
  sheets_fix: { action: 'fix', spreadsheetId: 'test123', issues: [{ type: 'MULTIPLE_TODAY', severity: 'medium', sheet: 'Sheet1', description: 'Multiple TODAY() calls' }] },
  sheets_composite: { action: 'import_csv', spreadsheetId: 'test123', csvData: 'Name,Age\nAlice,30', mode: 'replace' },
  sheets_session: { action: 'get_active' },
};

// All tool input schemas (17 tools after Wave 5 consolidation)
const TOOL_SCHEMAS = [
  { name: 'sheets_auth', schema: SheetsAuthInputSchema },
  { name: 'sheets_core', schema: SheetsCoreInputSchema },
  { name: 'sheets_data', schema: SheetsDataInputSchema },
  { name: 'sheets_format', schema: SheetsFormatInputSchema },
  { name: 'sheets_dimensions', schema: SheetsDimensionsInputSchema },
  { name: 'sheets_visualize', schema: SheetsVisualizeInputSchema },
  { name: 'sheets_collaborate', schema: SheetsCollaborateInputSchema },
  { name: 'sheets_analysis', schema: SheetsAnalysisInputSchema },
  { name: 'sheets_advanced', schema: SheetsAdvancedInputSchema },
  { name: 'sheets_transaction', schema: SheetsTransactionInputSchema },
  { name: 'sheets_quality', schema: SheetsQualityInputSchema },
  { name: 'sheets_history', schema: SheetsHistoryInputSchema },
  { name: 'sheets_confirm', schema: SheetsConfirmInputSchema },
  { name: 'sheets_analyze', schema: SheetsAnalyzeInputSchema },
  { name: 'sheets_fix', schema: SheetsFixInputSchema },
  { name: 'sheets_composite', schema: CompositeInputSchema },
  { name: 'sheets_session', schema: SheetsSessionInputSchema },
];

describe('Schema Contracts', () => {
  describe('Tool Registry Integrity', () => {
    it('should have exactly 17 tools (after Wave 5 consolidation)', () => {
      expect(TOOL_COUNT).toBe(17);
      expect(TOOL_SCHEMAS).toHaveLength(17);
    });

    it('should have 226 total actions across all tools', () => {
      expect(ACTION_COUNT).toBe(226);
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
    it('sheets_data accepts all expected actions', () => {
      const actions = ['read', 'write', 'append', 'clear'];

      for (const action of actions) {
        const result = SheetsDataInputSchema.safeParse({
            action,
            spreadsheetId: 'test123',
            range: { a1: 'Sheet1!A1:B10' },
            ...(action === 'write' || action === 'append' ? { values: [[1, 2]] } : {}),
        });

        if (!result.success) {
          console.error(`sheets_data action "${action}" failed:`, result.error.errors);
        }

        expect(result.success).toBe(true);
      }
    });

    it('sheets_core discriminates correctly', () => {
      // 'get' requires spreadsheetId
      const getValid = SheetsCoreInputSchema.safeParse({
          action: 'get',
          spreadsheetId: 'test123',
      });
      expect(getValid.success).toBe(true);

      // 'create' requires title
      const createValid = SheetsCoreInputSchema.safeParse({
          action: 'create',
          title: 'New Spreadsheet',
      });
      expect(createValid.success).toBe(true);

      // 'add_sheet' requires spreadsheetId and title
      const addSheetValid = SheetsCoreInputSchema.safeParse({
          action: 'add_sheet',
          spreadsheetId: 'test123',
          title: 'New Sheet',
      });
      expect(addSheetValid.success).toBe(true);
    });
  });

  describe('Required Fields Validation', () => {
    it('sheets_data requires spreadsheetId', () => {
      const result = SheetsDataInputSchema.safeParse({
          action: 'read',
          range: { a1: 'Sheet1!A1' },
          // Missing spreadsheetId
      });
      expect(result.success).toBe(false);
    });

    it('sheets_data write action requires values', () => {
      const result = SheetsDataInputSchema.safeParse({
          action: 'write',
          spreadsheetId: 'test123',
          range: { a1: 'Sheet1!A1' },
          // Missing values
      });
      expect(result.success).toBe(false);
    });

    it('sheets_core add_sheet action requires title', () => {
      const result = SheetsCoreInputSchema.safeParse({
          action: 'add_sheet',
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
