/**
 * Dry-run now Zod-validates every step's params against its tool input
 * schema. This test drives a plan with one valid step and one step with
 * malformed params, then asserts:
 *
 *   - the valid step returns { success: true, dryRunPreview: true }
 *   - the malformed step returns { success: false, dryRunPreview: true,
 *     error: 'VALIDATION_ERROR', issues: [...] }
 *   - validation failures do NOT short-circuit — both results are present
 *   - the plan is marked 'paused' (not 'completed') when any step fails
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllPlans,
  compilePlan,
  executePlan,
  registerToolInputSchemas,
  type ExecuteHandlerFn,
  type PlanState,
} from '../../../src/services/agent-engine.js';
import { TOOL_DEFINITIONS } from '../../../src/mcp/registration/tool-definitions.js';

const SPREADSHEET_ID = 'test-spreadsheet-dryrun';

const neverCalledHandler: ExecuteHandlerFn = async () => {
  throw new Error('executeHandler must not be called during dryRun');
};

beforeEach(async () => {
  registerToolInputSchemas(new Map(TOOL_DEFINITIONS.map((t) => [t.name, t.inputSchema] as const)));
  await clearAllPlans();
});

afterEach(async () => {
  await clearAllPlans();
});

describe('executePlan dry-run Zod validation', () => {
  it('good step returns success:true dryRunPreview:true without calling handler', async () => {
    const plan: PlanState = compilePlan('read data from spreadsheet', 5, SPREADSHEET_ID);
    // Patch in valid params.
    plan.steps = [
      {
        stepId: 'valid-read',
        tool: 'sheets_data',
        action: 'read',
        params: { spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:B5' },
        description: 'read a range',
        dependsOn: [],
      },
    ];

    const result = await executePlan(plan.planId, true, neverCalledHandler);

    expect(result.status).toBe('completed');
    expect(result.results).toHaveLength(1);
    const res = result.results[0];
    expect(res?.success).toBe(true);
    const payload = res?.result as Record<string, unknown>;
    expect(payload.dryRunPreview).toBe(true);
    expect(payload.action).toBe('read');
  });

  it('bad step returns success:false with VALIDATION_ERROR and issues; valid sibling still runs', async () => {
    const plan: PlanState = compilePlan('read data from spreadsheet', 5, SPREADSHEET_ID);
    plan.steps = [
      {
        stepId: 'good-step',
        tool: 'sheets_data',
        action: 'read',
        params: { spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:B5' },
        description: 'valid read',
        dependsOn: [],
      },
      {
        stepId: 'bad-step',
        tool: 'sheets_data',
        action: 'write',
        // `values` is required for write and `range` is missing — both should
        // surface as Zod issues in dry-run.
        params: { spreadsheetId: SPREADSHEET_ID },
        description: 'invalid write',
        dependsOn: [],
      },
    ];

    const result = await executePlan(plan.planId, true, neverCalledHandler);

    // Plan should be paused because one step failed validation.
    expect(result.status).toBe('paused');
    expect(result.results).toHaveLength(2);

    const [good, bad] = result.results;
    expect(good?.success).toBe(true);
    expect((good?.result as Record<string, unknown>).dryRunPreview).toBe(true);

    expect(bad?.success).toBe(false);
    const badPayload = bad?.result as Record<string, unknown>;
    expect(badPayload.dryRunPreview).toBe(true);
    expect(badPayload.error).toBe('VALIDATION_ERROR');
    expect(Array.isArray(badPayload.issues)).toBe(true);
    expect((badPayload.issues as unknown[]).length).toBeGreaterThan(0);
    // Each issue has a structured shape the caller can render.
    for (const issue of badPayload.issues as Array<Record<string, unknown>>) {
      expect(typeof issue.message).toBe('string');
      expect(Array.isArray(issue.path)).toBe(true);
    }
  });

  it('continues validating all steps rather than short-circuiting after the first failure', async () => {
    const plan: PlanState = compilePlan('read data from spreadsheet', 5, SPREADSHEET_ID);
    plan.steps = [
      {
        stepId: 'bad-1',
        tool: 'sheets_data',
        action: 'write',
        params: { spreadsheetId: SPREADSHEET_ID }, // missing range + values
        description: 'invalid write 1',
        dependsOn: [],
      },
      {
        stepId: 'bad-2',
        tool: 'sheets_data',
        action: 'append',
        params: { spreadsheetId: SPREADSHEET_ID }, // missing range + values
        description: 'invalid append',
        dependsOn: [],
      },
    ];

    const result = await executePlan(plan.planId, true, neverCalledHandler);

    expect(result.status).toBe('paused');
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.success === false)).toBe(true);
    expect(result.results.every((r) => (r.result as Record<string, unknown>).error === 'VALIDATION_ERROR')).toBe(true);
  });
});
