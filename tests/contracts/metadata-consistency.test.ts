/**
 * Metadata Consistency Contract Test
 *
 * Ensures all metadata files (package.json, server.json, README.md) report
 * the same tool and action counts from the single source of truth.
 *
 * Source of truth: src/schemas/action-counts.ts (TOOL_COUNT, ACTION_COUNT)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { TOOL_COUNT, ACTION_COUNT } from '../../src/schemas/action-counts.js';

describe('Metadata Consistency Contract', () => {
  // Expected values from source of truth
  const expectedToolCount = 22;
  const expectedActionCount = 299;

  it('action-counts.ts is source of truth', () => {
    // Verify the constants match expected values
    expect(TOOL_COUNT).toBe(expectedToolCount);
    expect(ACTION_COUNT).toBe(expectedActionCount);
  });

  it('package.json has correct counts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

    // Expected format: "... 22 tools, 299 actions ..."
    const expectedPattern = new RegExp(
      `${TOOL_COUNT}\\s+tools,?\\s+${ACTION_COUNT}\\s+actions`,
      'i'
    );

    expect(pkg.description).toMatch(expectedPattern);
  });

  it('server.json has correct counts in description', () => {
    const serverJson = JSON.parse(readFileSync('server.json', 'utf-8'));

    // Expected format: "... 22 tools and 299 actions"
    const expectedPattern = new RegExp(
      `${TOOL_COUNT}\\s+tools\\s+and\\s+${ACTION_COUNT}\\s+actions`,
      'i'
    );

    expect(serverJson.description).toMatch(expectedPattern);
  });

  it('server.json has correct counts in metadata', () => {
    const serverJson = JSON.parse(readFileSync('server.json', 'utf-8'));

    // Verify metadata object has correct counts
    expect(serverJson.metadata.toolCount).toBe(TOOL_COUNT);
    expect(serverJson.metadata.actionCount).toBe(ACTION_COUNT);
  });

  it('server.json package description has correct counts', () => {
    const serverJson = JSON.parse(readFileSync('server.json', 'utf-8'));

    // Check package description in packages array
    const packageEntry = serverJson.packages?.[0];
    expect(packageEntry).toBeDefined();

    // Expected format: "... 22 tools, 299 actions ..."
    const expectedPattern = new RegExp(
      `${TOOL_COUNT}\\s+tools,?\\s+${ACTION_COUNT}\\s+actions`,
      'i'
    );

    expect(packageEntry.description).toMatch(expectedPattern);
  });

  it('README.md has correct counts', () => {
    const readme = readFileSync('README.md', 'utf-8');

    // Expected format: "22 tools, 299 actions" or "22 tools with 299 actions"
    const expectedPattern = new RegExp(
      `${TOOL_COUNT}\\s+tools[,\\s]+(with\\s+)?${ACTION_COUNT}\\s+actions`,
      'i'
    );

    expect(readme).toMatch(expectedPattern);
  });

  it('README.md tool summary has correct count', () => {
    const readme = readFileSync('README.md', 'utf-8');

    // Expected format: "### Tool Summary (22 tools, 299 actions)"
    const summaryPattern = new RegExp(
      `Tool Summary\\s*\\(${TOOL_COUNT}\\s+tools,\\s+${ACTION_COUNT}\\s+actions\\)`,
      'i'
    );

    expect(readme).toMatch(summaryPattern);
  });

  it('all metadata sources are synchronized', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const serverJson = JSON.parse(readFileSync('server.json', 'utf-8'));
    const readme = readFileSync('README.md', 'utf-8');

    // Extract counts from each source
    const pkgMatch = pkg.description.match(/(\d+)\s+tools,?\s+(\d+)\s+actions/i);
    const serverDescMatch = serverJson.description.match(/(\d+)\s+tools\s+and\s+(\d+)\s+actions/i);
    const readmeMatch = readme.match(/(\d+)\s+tools[,\s]+(with\s+)?(\d+)\s+actions/i);

    // Verify all sources report same counts
    expect(pkgMatch).toBeDefined();
    expect(pkgMatch?.[1]).toBe(TOOL_COUNT.toString());
    expect(pkgMatch?.[2]).toBe(ACTION_COUNT.toString());

    expect(serverDescMatch).toBeDefined();
    expect(serverDescMatch?.[1]).toBe(TOOL_COUNT.toString());
    expect(serverDescMatch?.[2]).toBe(ACTION_COUNT.toString());

    expect(readmeMatch).toBeDefined();
    expect(readmeMatch?.[1]).toBe(TOOL_COUNT.toString());
    expect(readmeMatch?.[3]).toBe(ACTION_COUNT.toString());

    // Verify server.json metadata object
    expect(serverJson.metadata.toolCount).toBe(TOOL_COUNT);
    expect(serverJson.metadata.actionCount).toBe(ACTION_COUNT);
  });
});
