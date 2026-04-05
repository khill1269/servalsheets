import { describe, it, expect } from 'vitest';
import { SpreadsheetIdSchema, SheetNameSchema, A1RangeSchema } from '../../src/schemas/shared.js';

type SpreadsheetId = string & { readonly __brand: 'SpreadsheetId' };
type SheetName = string & { readonly __brand: 'SheetName' };
type A1Range = string & { readonly __brand: 'A1Range' };

function createSpreadsheetId(id: string): SpreadsheetId {
  if (!id || id.length === 0) throw new Error('Invalid SpreadsheetId');
  return id as SpreadsheetId;
}

function createSheetName(name: string): SheetName {
  if (!name || name.length === 0) throw new Error('Invalid SheetName');
  return name as SheetName;
}

function createA1Range(range: string): A1Range {
  // Basic A1 validation
  if (!/^[A-Z]+\d+(:([A-Z]+\d+))?$/i.test(range)) throw new Error('Invalid A1Range');
  return range as A1Range;
}

describe('Branded Domain Types', () => {
  describe('SpreadsheetId', () => {
    it('creates valid SpreadsheetId', () => {
      const id = createSpreadsheetId('1234567890');
      expect(id).toBe('1234567890');
    });

    it('rejects empty SpreadsheetId', () => {
      expect(() => createSpreadsheetId('')).toThrow();
    });

    it('validates with Zod schema', () => {
      const result = SpreadsheetIdSchema.safeParse('123');
      expect(result.success).toBe(true);
    });

    it('Zod rejects empty string', () => {
      const result = SpreadsheetIdSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('SheetName', () => {
    it('creates valid SheetName', () => {
      const name = createSheetName('Sheet1');
      expect(name).toBe('Sheet1');
    });

    it('rejects empty SheetName', () => {
      expect(() => createSheetName('')).toThrow();
    });

    it('validates with Zod schema', () => {
      const result = SheetNameSchema.safeParse('Data');
      expect(result.success).toBe(true);
    });
  });

  describe('A1Range', () => {
    it('creates valid A1Range', () => {
      const range = createA1Range('A1');
      expect(range).toBe('A1');
    });

    it('creates valid A1Range with bounds', () => {
      const range = createA1Range('A1:B10');
      expect(range).toBe('A1:B10');
    });

    it('rejects invalid A1Range', () => {
      expect(() => createA1Range('invalid')).toThrow();
    });

    it('validates with Zod schema', () => {
      const result = A1RangeSchema.safeParse('A1');
      expect(result.success).toBe(true);
    });

    it('Zod rejects invalid A1Range', () => {
      const result = A1RangeSchema.safeParse('not a range');
      expect(result.success).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('SpreadsheetId and SheetName are distinct types at compile time', () => {
      const id: SpreadsheetId = createSpreadsheetId('123');
      const name: SheetName = createSheetName('Sheet1');
      // Compile-time check: these should be type-incompatible
      // const x: SheetName = id; // Type error
      expect(id).not.toBe(name);
    });
  });
});
