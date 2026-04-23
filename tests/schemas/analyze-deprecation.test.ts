/**
 * Analyze Deprecation Warning Tests
 *
 * Asserts that the sheets_analyze.comprehensive action's tool-level description
 * flags the deprecated `quickScan` and `forceFullData` params so LLMs see the
 * warning before selecting those legacy options.
 */

import { describe, test, expect } from 'vitest';
import { SheetsAnalyzeInputSchema } from '../../src/schemas/analyze.js';
import { z } from 'zod';

// Narrow the discriminated union to the comprehensive branch and read the
// `action` literal's `.describe()` text.
function getComprehensiveActionDescription(): string {
  const requestSchema = (SheetsAnalyzeInputSchema.shape as Record<string, z.ZodTypeAny>).request;
  // Zod v4 discriminated union stores options in `.options`.
  const union = requestSchema as z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>;
  const options = (union as unknown as { options: z.ZodObject<z.ZodRawShape>[] }).options;
  const comprehensive = options.find((option) => {
    const actionField = option.shape.action as z.ZodLiteral<string>;
    // ZodLiteral's value is exposed via `.value`.
    return (actionField as unknown as { value: string }).value === 'comprehensive';
  });
  if (!comprehensive) {
    throw new Error('comprehensive action not found in SheetsAnalyzeInputSchema union');
  }
  const actionField = comprehensive.shape.action as z.ZodLiteral<string>;
  const description = (actionField as unknown as { description?: string }).description;
  if (!description) {
    throw new Error('comprehensive action literal has no description');
  }
  return description;
}

describe('sheets_analyze.comprehensive deprecation warning', () => {
  test('description mentions intent="quick" as replacement for quickScan', () => {
    const description = getComprehensiveActionDescription();
    expect(description).toContain('intent="quick"');
  });

  test('description mentions depth="full" as replacement for forceFullData', () => {
    const description = getComprehensiveActionDescription();
    expect(description).toContain('depth="full"');
  });

  test('description mentions both legacy param names explicitly', () => {
    const description = getComprehensiveActionDescription();
    expect(description).toContain('quickScan');
    expect(description).toContain('forceFullData');
  });
});
