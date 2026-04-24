/**
 * Tests for O-2 / O-5 fixes to compilePlanAI:
 *   - No more `context` leakage into step.params (was causing Zod validation failure)
 *   - Zero-state bootstrap: when description implies creation + no spreadsheetId,
 *     prepend a sheets_core.create step with a titled param
 *   - Downstream steps of a bootstrap plan reference the created sheet via
 *     the `{{steps[0].result.spreadsheetId}}` template
 *
 * These tests guard against the regression observed in the audit session where
 * a 13-step request returned 4 steps all failing schema validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  compilePlanAI,
  extractTitleFromDescription,
} from '../../src/services/agent/plan-compiler.js';
import { planStore } from '../../src/services/agent/plan-store.js';

describe('plan-compiler — zero-state bootstrap (O-2, O-5)', () => {
  beforeEach(() => {
    planStore.clear();
  });
</content>
  it('does NOT leak context into step.params (was Zod validation bug)', async () => {
    const plan = await compilePlanAI(
      'clean the data and sort by date',
      5,
      'sheet_abc',
      'Data is in columns A-E, 100 rows with header'
    );
    for (const step of plan.steps) {
      expect(step.params).not.toHaveProperty('context');
      expect(step.params).not.toHaveProperty('_stepIntent');
      expect(step.params).not.toHaveProperty('description');
    }
  });
</content>

  it('prepends a sheets_core.create step when description asks to build and no spreadsheetId', async () => {
    const plan = await compilePlanAI(
      'Build a "Q2 2026 Sales" dashboard sheet and analyze the data',
      10
    );
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.steps[0]?.tool).toBe('sheets_core');
    expect(plan.steps[0]?.action).toBe('create');
    expect(plan.steps[0]?.params['title']).toBe('Q2 2026 Sales');
  });

  it('downstream steps of a bootstrap plan reference the created sheet', async () => {
    const plan = await compilePlanAI(
      'Create a new workbook and analyze the numbers',
      10
    );
    expect(plan.steps[0]?.action).toBe('create');
    for (let i = 1; i < plan.steps.length; i++) {
      expect(plan.steps[i]?.params['spreadsheetId']).toBe(
        '{{steps[0].result.spreadsheetId}}'
      );
    }
  });
</content>

  it('does NOT prepend bootstrap when spreadsheetId is provided', async () => {
    const plan = await compilePlanAI(
      'Build a report by sorting the data',
      10,
      'existing_sheet_id'
    );
    expect(plan.steps[0]?.action).not.toBe('create');
    for (const step of plan.steps) {
      expect(step.params['spreadsheetId']).toBe('existing_sheet_id');
    }
  });

  it('does NOT prepend bootstrap for non-creation verbs', async () => {
    const plan = await compilePlanAI('analyze the data and find anomalies', 10);
    expect(plan.steps[0]?.action).not.toBe('create');
  });
});

describe('extractTitleFromDescription', () => {
  it('prefers quoted titles', () => {
    expect(extractTitleFromDescription('Build a "Q2 Sales" dashboard')).toBe('Q2 Sales');
    expect(extractTitleFromDescription("Create the 'annual review' sheet")).toBe('annual review');
  });

  it('falls back to the first clause, stripped of bootstrap verbs', () => {
    expect(extractTitleFromDescription('Create a Sales Tracker')).toBe('Sales Tracker');
  });

  it('caps title at 100 chars', () => {
    const huge = 'Create ' + 'x'.repeat(500);
    expect(extractTitleFromDescription(huge).length).toBeLessThanOrEqual(100);
  });

  it('handles empty input safely', () => {
    expect(extractTitleFromDescription('')).toBe('Untitled Spreadsheet');
    expect(extractTitleFromDescription('   ')).toBe('Untitled Spreadsheet');
  });
});
</content>
