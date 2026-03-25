import type { ExecutionStep, PlanState } from './types.js';
import { getToolInputSchemas } from './types.js';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getEffectiveStepParams(
  step: ExecutionStep,
  plan: Pick<PlanState, 'spreadsheetId'>
): Record<string, unknown> {
  return {
    ...(plan.spreadsheetId && step.params['spreadsheetId'] === undefined
      ? { spreadsheetId: plan.spreadsheetId }
      : {}),
    ...step.params,
  };
}

function formatIssuePath(pathSegments: Array<string | number>): string {
  const normalized = pathSegments[0] === 'request' ? pathSegments.slice(1) : pathSegments;
  return normalized.length > 0 ? normalized.join('.') : 'request';
}

export function validateDraftPlanStep(
  step: ExecutionStep,
  plan: Pick<PlanState, 'spreadsheetId'>
): ExecutionStep {
  const params = getEffectiveStepParams(step, plan);

  if (step.type === 'inject_cross_sheet_lookup' || step.tool === '__internal__') {
    return {
      ...step,
      params,
      validation: undefined,
    };
  }

  const inputSchema = getToolInputSchemas().get(step.tool);
  if (!inputSchema) {
    return {
      ...step,
      params,
      validation: {
        valid: false,
        issues: [
          {
            field: 'tool',
            message: `Unknown tool "${step.tool}"`,
          },
        ],
        suggestedFix: 'Use a registered ServalSheets tool name before returning the plan.',
      },
    };
  }

  const parseResult = inputSchema.safeParse({
    request: {
      action: step.action,
      ...params,
    },
  });

  if (parseResult.success) {
    const parsedData = parseResult.data as Record<string, unknown>;
    const parsedRequest = parsedData['request'];
    if (isPlainRecord(parsedRequest)) {
      const { action: _action, ...normalizedParams } = parsedRequest;
      return {
        ...step,
        params: normalizedParams,
        validation: undefined,
      };
    }

    return {
      ...step,
      params,
      validation: undefined,
    };
  }

  const issues = parseResult.error.issues.map((issue) => ({
    field: formatIssuePath(
      issue.path.filter((pathSegment): pathSegment is string | number => typeof pathSegment !== 'symbol')
    ),
    message: issue.message,
  }));

  return {
    ...step,
    params,
    validation: {
      valid: false,
      issues,
      suggestedFix: 'Correct the step parameters so they match the tool input schema.',
    },
  };
}

export function annotateAIGeneratedDraftPlan(plan: PlanState): PlanState {
  plan.steps = plan.steps.map((step) => validateDraftPlanStep(step, plan));
  return plan;
}
