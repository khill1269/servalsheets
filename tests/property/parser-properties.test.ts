import { describe, it, expect } from 'vitest';
import { parseA1Range } from '../../src/utils/validation-helpers';

describe('A1 Parser Properties', () => {
  describe('Basic Range Parsing', () => {
    it('should parse ranges with sheet prefix', () => {
      const range = 'Sheet1!A1:B10';
      const result = parseA1Range(range);
      expect(result.startRow).toBe(1);
      expect(result.endRow).toBe(10);
      expect(result.startCol).toBe('A');
      expect(result.endCol).toBe('B');
      expect(result.sheetPrefix).toBe('Sheet1');
    });

    it('should parse ranges with large row numbers', () => {
      const range = 'Data!A100:Z1000';
      const result = parseA1Range(range);
      expect(result.startRow).toBe(100);
      expect(result.endRow).toBe(1000);
    });

    it('should parse multi-column ranges', () => {
      const range = 'Sales!D5:G25';
      const result = parseA1Range(range);
      expect(result.startCol).toBe('D');
      expect(result.endCol).toBe('G');
      expect(result.startRow).toBe(5);
      expect(result.endRow).toBe(25);
    });
  });

  describe('Idempotence', () => {
    it('parsing identical ranges should produce identical results', () => {
      const range = 'Report!C5:E15';
      const result1 = parseA1Range(range);
      const result2 = parseA1Range(range);
      expect(result1).toEqual(result2);
    });

    it('multiple identical parses should yield consistent output', () => {
      const range = 'Budget!M10:P20';
      const results = [parseA1Range(range), parseA1Range(range), parseA1Range(range)];
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });

  describe('Range Ordering', () => {
    it('start row should not exceed end row for valid ranges', () => {
      const testCases = ['Sheet1!A1:A100', 'Sheet2!B5:Z50', 'Data!M10:P20'];
      testCases.forEach((range) => {
        const result = parseA1Range(range);
        expect(result.startRow).toBeLessThanOrEqual(result.endRow);
      });
    });

    it('ranges with various column pairs', () => {
      const testCases = ['Quarterly!A1:Z100', 'Monthly!B2:Y50', 'Weekly!C10:X30'];
      testCases.forEach((range) => {
        const result = parseA1Range(range);
        expect(result.startRow).toBeLessThanOrEqual(result.endRow);
        expect(result.startCol.length).toBeGreaterThan(0);
        expect(result.endCol.length).toBeGreaterThan(0);
      });
    });
  });
});
