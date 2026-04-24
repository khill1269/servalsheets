/**
 * ServalSheets — Live Test Coverage Guard
 *
 * Verifies structural coverage: every registered tool has a dedicated live test file
 * and appears in the action matrix fixture set.
 *
 * This test runs without live credentials (no API calls). It guards against newly-added
 * tools slipping through without corresponding live test files.
 *
 * Run: npx vitest run tests/audit/live-action-coverage.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';
import { generateAllFixtures } from './action-coverage-fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_API_DIR = path.resolve(__dirname, '../live-api/tools');

describe('live test coverage guard', () => {
  const registeredTools = Object.keys(TOOL_ACTIONS);

  it('every registered tool has a dedicated live test file', () => {
    const liveFiles = fs
      .readdirSync(LIVE_API_DIR)
      .filter((f) => f.endsWith('.live.test.ts'))
      .map((f) => f.replace(/\.live\.test\.ts$/, ''));

    const missing: string[] = [];
    for (const tool of registeredTools) {
      const slug = tool.replace('sheets_', 'sheets-').replace(/_/g, '-');
      const hasFile = liveFiles.some((f) => f === slug || f.startsWith(slug + '.'));
      if (!hasFile) missing.push(tool);
    }

    expect(missing, `Tools missing a live test file: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('every registered tool has at least one action in the fixture matrix', () => {
    const fixtures = generateAllFixtures();
    const coveredTools = new Set(fixtures.map((f) => f.tool));
    const missing = registeredTools.filter((t) => !coveredTools.has(t));

    expect(missing, `Tools missing from action matrix: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('total fixture count matches registered action count', () => {
    const fixtures = generateAllFixtures();
    const registeredActionCount = Object.values(TOOL_ACTIONS).reduce(
      (sum, actions) => sum + actions.length,
      0
    );
    expect(fixtures.length).toBe(registeredActionCount);
  });

  it('no tool in TOOL_ACTIONS has zero actions', () => {
    const empty = registeredTools.filter((t) => TOOL_ACTIONS[t]?.length === 0);
    expect(empty, `Tools with zero actions: ${empty.join(', ')}`).toHaveLength(0);
  });
});
