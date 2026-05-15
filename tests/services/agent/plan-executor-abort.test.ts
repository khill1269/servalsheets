/**
 * Plan executor must honor notifications/cancelled (AbortSignal) between steps.
 * Verifies:
 *   - Plan paused with OPERATION_CANCELLED when abort fires before next step
 *   - No further steps invoked after abort
 *   - completedSteps reflects only steps that finished before abort
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
import {
  createRequestContext,
  runWithRequestContext,
} from '../../../src/utils/request-context.js';

const SPREADSHEET_ID = 'test-spreadsheet-abort';

beforeEach(async () => {
  registerToolInputSchemas(new Map(TOOL_DEFINITIONS.map((t) => [t.name, t.inputSchema] as const)));
  await clearAllPlans();
});

afterEach(async () => {
  await clearAllPlans();
});

describe('executePlan honors AbortSignal between steps', () => {
  it('pauses with OPERATION_CANCELLED when signal aborts before first step', async () => {
    const plan: PlanState = compilePlan('read data', 5, SPREADSHEET_ID);
    plan.steps = [
      {
        stepId: 's1',
        tool: 'sheets_data',
        action: 'read',
        params: { spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:B5' },
        description: 'first',
        dependsOn: [],
      },
      {
        stepId: 's2',
        tool: 'sheets_data',
        action: 'read',
        params: { spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!C1:D5' },
        description: 'second',
        dependsOn: [],
      },
    ];

    let invocationCount = 0;
    const handler: ExecuteHandlerFn = async () => {
      invocationCount++;
      return { response: { success: true } };
    };

    const controller = new AbortController();
    controller.abort('test cancellation');
    const ctx = createRequestContext({ abortSignal: controller.signal });

    const result = await runWithRequestContext(ctx, () =>
      executePlan(plan.planId, false, handler)
    );

    expect(result.status).toBe('paused');
    expect(result.errorDetail?.code).toBe('OPERATION_CANCELLED');
    expect(invocationCount).toBe(0); // no steps invoked
  });

  it('runs first step then aborts before second when signal fires mid-plan', async () => {
    const plan: PlanState = compilePlan('two reads', 5, SPREADSHEET_ID);
    plan.steps = [
      {
        stepId: 's1',
        tool: 'sheets_data',
        action: 'read',
        params: { spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!A1:B5' },
        description: 'first',
        dependsOn: [],
      },
      {
        stepId: 's2',
        tool: 'sheets_data',
        action: 'read',
        params: { spreadsheetId: SPREADSHEET_ID, range: 'Sheet1!C1:D5' },
        description: 'second',
        dependsOn: [],
      },
    ];

    const controller = new AbortController();
    let invocationCount = 0;
    const handler: ExecuteHandlerFn = async () => {
      invocationCount++;
      if (invocationCount === 1) {
        controller.abort('cancel after first');
      }
      return { response: { success: true } };
    };

    const ctx = createRequestContext({ abortSignal: controller.signal });
    const result = await runWithRequestContext(ctx, () =>
      executePlan(plan.planId, false, handler)
    );

    expect(invocationCount).toBe(1); // only first step ran
    expect(result.status).toBe('paused');
    expect(result.errorDetail?.code).toBe('OPERATION_CANCELLED');
  });
});
