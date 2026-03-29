/**
 * ServalSheets - Test Data Usage Examples
 *
 * Demonstrates test data helpers and best practices.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAnalyzeComprehensiveInput,
  createFormatSetInput,
  createMockSheetsResponse,
  createValuesReadInput,
  createValuesWriteInput,
} from '../helpers/input-factories.js';

describe('Test Data Usage Examples', () => {
  it('uses input factories with overrides', () => {
    const input = createValuesReadInput({
      spreadsheetId: 'example-sheet',
      range: { a1: 'Sheet1!A1:B2' },
    });

    expect(input.action).toBe('read');
    expect(input.spreadsheetId).toBe('example-sheet');
    expect(input.range).toEqual({ a1: 'Sheet1!A1:B2' });
  });

  it('uses write factory defaults', () => {
    const input = createValuesWriteInput();

    expect(input.action).toBe('write');
    expect(input.values).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('uses formatting and analysis factories', () => {
    const formatInput = createFormatSetInput({
      range: { a1: 'Sheet1!C1:D2' },
      format: { backgroundColor: { red: 1, green: 1, blue: 0 } },
    });

    const analyzeInput = createAnalyzeComprehensiveInput({});

    expect(formatInput.action).toBe('set_format');
    expect(analyzeInput.action).toBe('comprehensive');
  });

  it('uses mock response factory', () => {
    const response = createMockSheetsResponse({
      values: [
        ['Name', 'Score'],
        ['Alice', 5],
      ],
    });

    expect(response.data.values).toHaveLength(2);
  });

  describe('cleanup between tests', () => {
    let state: string[];

    beforeEach(() => {
      vi.clearAllMocks();
      state = [];
    });

    it('starts clean', () => {
      expect(state).toHaveLength(0);
    });

    it('remains isolated', () => {
      state.push('item');
      expect(state).toHaveLength(1);
    });
  });
});
