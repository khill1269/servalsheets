import { describe, expect, it } from 'vitest';
import { RangeInputSchema } from '../../src/schemas/shared.js';

describe('RangeInputSchema description (LLM discovery contract)', () => {
  it('has a description that surfaces all four accepted shapes', () => {
    const description = RangeInputSchema.description;
    expect(description).toBeDefined();
    expect(typeof description).toBe('string');
    const desc = description as string;
    // Must mention all four variant keys so LLMs can pick a durable shape.
    expect(desc).toMatch(/a1/);
    expect(desc).toMatch(/namedRange/);
    expect(desc).toMatch(/semantic/);
    expect(desc).toMatch(/grid/);
  });

  it('still accepts a plain A1 string (preprocessor wraps to {a1})', () => {
    const parsed = RangeInputSchema.parse('Sheet1!A1:B10');
    expect(parsed).toEqual({ a1: 'Sheet1!A1:B10' });
  });

  it('accepts a namedRange object', () => {
    const parsed = RangeInputSchema.parse({ namedRange: 'MyRange' });
    expect(parsed).toEqual({ namedRange: 'MyRange' });
  });

  it('accepts a semantic object', () => {
    const parsed = RangeInputSchema.parse({
      semantic: { sheet: 'Sheet1', column: 'Name' },
    });
    expect(parsed.semantic).toBeDefined();
  });
});
