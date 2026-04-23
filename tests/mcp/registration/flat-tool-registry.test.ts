/**
 * Flat tool registry description tests
 *
 * Verifies that buildFlatDescription (via getFlatToolRegistry) surfaces
 * the first commonMistakes entry as a "Pitfall: ..." suffix so LLMs can
 * see the top foot-gun without a separate annotation lookup.
 */

import { describe, it, expect } from 'vitest';
import { getFlatToolRegistry } from '../../../src/mcp/registration/flat-tool-registry.js';

describe('flat-tool-registry description surfacing', () => {
  it('sheets_data.read description includes the first commonMistakes pitfall', () => {
    const registry = getFlatToolRegistry();
    const entry = registry.find((t) => t.parentTool === 'sheets_data' && t.action === 'read');
    expect(entry).toBeDefined();

    const description = entry!.description;
    expect(typeof description).toBe('string');
    // First pitfall in annotations.ts is "Using hard-coded A1 ranges in production ..."
    expect(description).toContain('hard-coded A1');
  });

  it('all flat tool descriptions stay within the 200-character cap', () => {
    const registry = getFlatToolRegistry();
    for (const entry of registry) {
      expect(
        entry.description.length,
        `description too long for ${entry.parentTool}.${entry.action}: ${entry.description.length} chars`,
      ).toBeLessThanOrEqual(200);
    }
  });

  it('descriptions with a pitfall include the "Pitfall:" marker', () => {
    const registry = getFlatToolRegistry();
    const entry = registry.find((t) => t.parentTool === 'sheets_data' && t.action === 'read');
    expect(entry!.description).toContain('Pitfall:');
  });
});
