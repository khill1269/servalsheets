/**
 * ServalSheets v4 - Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TOOL_COUNT,
  ACTION_COUNT,
  SheetSpreadsheetInputSchema,
  SheetsValuesInputSchema,
  SheetsDimensionsInputSchema,
  SafetyOptionsSchema,
  ColorSchema,
} from '../src/schemas/index.js';

describe('ServalSheets v4', () => {
  describe('Tool Registry', () => {
    it('should have 26 tools', () => {
      expect(TOOL_COUNT).toBe(26);
    });

    it('should have 70+ actions', () => {
      expect(ACTION_COUNT).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Schema Validation', () => {
    describe('SheetSpreadsheetInputSchema', () => {
      it('should validate get action', () => {
        const result = SheetSpreadsheetInputSchema.safeParse({
          action: 'get',
          spreadsheetId: 'abc123',
        });
        expect(result.success).toBe(true);
      });

      it('should validate create action', () => {
        const result = SheetSpreadsheetInputSchema.safeParse({
          action: 'create',
          title: 'New Spreadsheet',
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid action', () => {
        const result = SheetSpreadsheetInputSchema.safeParse({
          action: 'invalid',
          spreadsheetId: 'abc123',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('SheetsValuesInputSchema', () => {
      it('should validate read action with A1 range', () => {
        const result = SheetsValuesInputSchema.safeParse({
          action: 'read',
          spreadsheetId: 'abc123',
          range: { a1: 'Sheet1!A1:C10' },
        });
        expect(result.success).toBe(true);
      });

      it('should validate write action with safety options', () => {
        const result = SheetsValuesInputSchema.safeParse({
          action: 'write',
          spreadsheetId: 'abc123',
          range: { a1: 'Sheet1!A1' },
          values: [['Hello', 'World']],
          safety: {
            dryRun: true,
            effectScope: {
              maxCellsAffected: 1000,
            },
          },
        });
        expect(result.success).toBe(true);
      });

      it('should validate semantic range', () => {
        const result = SheetsValuesInputSchema.safeParse({
          action: 'read',
          spreadsheetId: 'abc123',
          range: {
            semantic: {
              sheet: 'Sales',
              column: 'Revenue',
            },
          },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('SheetsDimensionsInputSchema', () => {
      it('should validate insert_rows action', () => {
        const result = SheetsDimensionsInputSchema.safeParse({
          action: 'insert_rows',
          spreadsheetId: 'abc123',
          sheetId: 0,
          startIndex: 5,
          count: 10,
        });
        expect(result.success).toBe(true);
      });

      it('should validate delete_rows with safety', () => {
        const result = SheetsDimensionsInputSchema.safeParse({
          action: 'delete_rows',
          spreadsheetId: 'abc123',
          sheetId: 0,
          startIndex: 0,
          endIndex: 5,
          safety: {
            dryRun: true,
            expectedState: {
              rowCount: 100,
            },
          },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('SafetyOptionsSchema', () => {
      it('should validate complete safety options', () => {
        const result = SafetyOptionsSchema.safeParse({
          dryRun: true,
          expectedState: {
            rowCount: 100,
            checksum: 'abc123',
          },
          transactionId: '550e8400-e29b-41d4-a716-446655440000',
          autoSnapshot: true,
          effectScope: {
            maxCellsAffected: 5000,
            requireExplicitRange: true,
          },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('ColorSchema', () => {
      it('should validate 0-1 scale colors', () => {
        const result = ColorSchema.safeParse({
          red: 0.5,
          green: 0.75,
          blue: 1,
          alpha: 0.9,
        });
        expect(result.success).toBe(true);
      });

      it('should reject 0-255 scale colors', () => {
        const result = ColorSchema.safeParse({
          red: 255,
          green: 128,
          blue: 0,
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
