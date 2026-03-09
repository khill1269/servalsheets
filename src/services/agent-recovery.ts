/**
 * Agent Recovery Advisor
 *
 * When an agent plan fails mid-execution, this service diagnoses the failure
 * and suggests resumption strategies. It classifies errors as transient vs
 * permanent and provides actionable guidance for the LLM.
 *
 * @module services/agent-recovery
 */

// ────────────────────────────────────────────
// Public Types
// ────────────────────────────────────────────

export type FailureCategory =
  | 'transient'
  | 'permanent'
  | 'data_issue'
  | 'configuration'
  | 'unknown';

export type ResumptionAction =
  | 'retry_same_step'
  | 'skip_step'
  | 'modify_params'
  | 'abort'
  | 'rollback_and_retry';

export interface FailureDiagnosis {
  /** The step that failed */
  failedStepId: string;
  /** The tool + action that failed */
  failedOperation: { tool: string; action: string };
  /** Classified failure category */
  category: FailureCategory;
  /** Human-readable explanation of what went wrong */
  explanation: string;
  /** Whether auto-retry is likely to succeed */
  isRetryable: boolean;
  /** Suggested wait time before retry (ms), 0 if not retryable */
  suggestedWaitMs: number;
  /** Steps that completed successfully before the failure */
  completedSteps: number;
  /** Steps remaining after the failed step */
  remainingSteps: number;
}

export interface ResumptionStrategy {
  /** Primary recommended action */
  recommended: ResumptionAction;
  /** Confidence in the recommendation (0-1) */
  confidence: number;
  /** Explanation of why this strategy was chosen */
  reasoning: string;
  /** Alternative strategies if the primary doesn't work */
  alternatives: Array<{
    action: ResumptionAction;
    description: string;
  }>;
  /** Modified params to use if recommended action is 'modify_params' */
  modifiedParams?: Record<string, unknown>;
  /** The step ID to resume from */
  resumeFromStepId: string;
}

export interface RecoveryAdvice {
  diagnosis: FailureDiagnosis;
  strategy: ResumptionStrategy;
}

// ────────────────────────────────────────────
// Minimal plan type (to avoid importing PlanState directly)
// ────────────────────────────────────────────

export interface PlanInfo {
  planId: string;
  status: string;
  steps: Array<{
    stepId: string;
    tool: string;
    action: string;
    params: Record<string, unknown>;
    description: string;
    dependsOn?: string[];
  }>;
  results: Array<{
    stepId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
  currentStepIndex: number;
  error?: string;
}

// ────────────────────────────────────────────
// Error Classification Patterns
// ────────────────────────────────────────────

const TRANSIENT_PATTERNS: Array<{ pattern: RegExp; waitMs: number; description: string }> = [
  { pattern: /quota/i, waitMs: 60_000, description: 'API quota exceeded — wait and retry' },
  { pattern: /rate.?limit/i, waitMs: 30_000, description: 'Rate limited — back off and retry' },
  {
    pattern: /timeout|deadline/i,
    waitMs: 5_000,
    description: 'Operation timed out — retry with longer timeout',
  },
  {
    pattern: /unavailable|503|502/i,
    waitMs: 10_000,
    description: 'Service temporarily unavailable',
  },
  {
    pattern: /ECONNRESET|ETIMEDOUT|ERR_HTTP2/i,
    waitMs: 5_000,
    description: 'Network connectivity issue — retry',
  },
  {
    pattern: /internal.?error|500/i,
    waitMs: 5_000,
    description: 'Server error — likely transient',
  },
];

const PERMANENT_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /permission|forbidden|403/i,
    description: 'Insufficient permissions to perform this operation',
  },
  {
    pattern: /not.?found|404/i,
    description: 'Resource not found — may have been deleted or renamed',
  },
  { pattern: /invalid.?request|400/i, description: 'Invalid parameters — step needs modification' },
  {
    pattern: /authentication|401|unauthenticated/i,
    description: 'Authentication failed — re-auth required',
  },
];

const DATA_ISSUE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /sheet.?not.?found/i, description: 'Target sheet does not exist' },
  {
    pattern: /range.?not.?found|invalid.?range/i,
    description: 'Range reference is invalid or out of bounds',
  },
  { pattern: /duplicate/i, description: 'Duplicate resource conflict' },
  { pattern: /protected/i, description: 'Target range or sheet is protected' },
  { pattern: /formula.?error|circular/i, description: 'Formula-related error in the data' },
];

// ────────────────────────────────────────────
// Main Functions
// ────────────────────────────────────────────

/**
 * Diagnose why a plan failed and suggest how to resume.
 */
export function diagnoseAndAdvise(plan: PlanInfo): RecoveryAdvice {
  const diagnosis = diagnoseFailure(plan);
  const strategy = suggestResumptionStrategy(plan, diagnosis);
  return { diagnosis, strategy };
}

/**
 * Diagnose the failure of a plan.
 */
export function diagnoseFailure(plan: PlanInfo): FailureDiagnosis {
  // Find the failed step
  const failedResult = plan.results.find((r) => !r.success);
  const failedStepIdx = failedResult
    ? plan.steps.findIndex((s) => s.stepId === failedResult.stepId)
    : plan.currentStepIndex;
  const failedStep = plan.steps[failedStepIdx];

  if (!failedStep || !failedResult) {
    // No failed step found — plan may have been paused manually
    return {
      failedStepId: plan.steps[plan.currentStepIndex]?.stepId ?? 'unknown',
      failedOperation: {
        tool: plan.steps[plan.currentStepIndex]?.tool ?? 'unknown',
        action: plan.steps[plan.currentStepIndex]?.action ?? 'unknown',
      },
      category: 'unknown',
      explanation: plan.error ?? 'Plan was paused without a specific step failure',
      isRetryable: true,
      suggestedWaitMs: 0,
      completedSteps: plan.results.filter((r) => r.success).length,
      remainingSteps: plan.steps.length - plan.currentStepIndex,
    };
  }

  const errorMessage = failedResult.error ?? plan.error ?? '';
  const { category, explanation, isRetryable, waitMs } = classifyError(errorMessage);

  return {
    failedStepId: failedStep.stepId,
    failedOperation: { tool: failedStep.tool, action: failedStep.action },
    category,
    explanation: `Step "${failedStep.description}" failed: ${explanation}`,
    isRetryable,
    suggestedWaitMs: waitMs,
    completedSteps: plan.results.filter((r) => r.success).length,
    remainingSteps: plan.steps.length - failedStepIdx - 1,
  };
}

/**
 * Suggest how to resume a failed plan.
 */
export function suggestResumptionStrategy(
  plan: PlanInfo,
  diagnosis: FailureDiagnosis
): ResumptionStrategy {
  const failedStep = plan.steps.find((s) => s.stepId === diagnosis.failedStepId);

  switch (diagnosis.category) {
    case 'transient': {
      return {
        recommended: 'retry_same_step',
        confidence: 0.85,
        reasoning: `The failure appears transient (${diagnosis.explanation}). Retrying after a brief wait should succeed.`,
        alternatives: [
          { action: 'skip_step', description: 'Skip this step if the result is not critical' },
          { action: 'abort', description: 'Abort the plan if the service remains unavailable' },
        ],
        resumeFromStepId: diagnosis.failedStepId,
      };
    }

    case 'permanent': {
      // Check if the step can be skipped (no dependents rely on it)
      const hasDependents = plan.steps.some((s) => s.dependsOn?.includes(diagnosis.failedStepId));

      if (hasDependents) {
        return {
          recommended: 'abort',
          confidence: 0.7,
          reasoning: `Permanent failure: ${diagnosis.explanation}. Other steps depend on this one, so skipping is not safe.`,
          alternatives: [
            {
              action: 'modify_params',
              description:
                'Fix the parameters and retry (e.g., correct permissions, use different resource)',
            },
            {
              action: 'rollback_and_retry',
              description: 'Rollback completed steps and restart with corrected plan',
            },
          ],
          resumeFromStepId: diagnosis.failedStepId,
        };
      }

      return {
        recommended: 'skip_step',
        confidence: 0.6,
        reasoning: `Permanent failure: ${diagnosis.explanation}. No other steps depend on this one, so it can be safely skipped.`,
        alternatives: [
          { action: 'modify_params', description: 'Fix the parameters and retry' },
          { action: 'abort', description: 'Abort the plan entirely' },
        ],
        resumeFromStepId: getNextStepId(plan, diagnosis.failedStepId),
      };
    }

    case 'data_issue': {
      // Data issues often need param modifications
      const modifiedParams = suggestParamFixes(diagnosis, failedStep);
      return {
        recommended: 'modify_params',
        confidence: 0.65,
        reasoning: `Data issue: ${diagnosis.explanation}. The step parameters likely need adjustment.`,
        alternatives: [
          { action: 'skip_step', description: 'Skip this step if the data can be fixed later' },
          { action: 'retry_same_step', description: 'Retry if the data issue was just corrected' },
        ],
        modifiedParams: modifiedParams ?? undefined,
        resumeFromStepId: diagnosis.failedStepId,
      };
    }

    case 'configuration': {
      return {
        recommended: 'abort',
        confidence: 0.75,
        reasoning: `Configuration issue: ${diagnosis.explanation}. The plan needs reconfiguration before it can proceed.`,
        alternatives: [{ action: 'modify_params', description: 'Update configuration and retry' }],
        resumeFromStepId: diagnosis.failedStepId,
      };
    }

    default: {
      return {
        recommended: diagnosis.isRetryable ? 'retry_same_step' : 'abort',
        confidence: 0.4,
        reasoning: `Unable to classify the failure precisely. ${diagnosis.isRetryable ? 'A retry may succeed.' : 'Manual investigation recommended.'}`,
        alternatives: [
          { action: 'skip_step', description: 'Skip this step and continue with remaining steps' },
          { action: 'rollback_and_retry', description: 'Rollback all changes and start fresh' },
        ],
        resumeFromStepId: diagnosis.failedStepId,
      };
    }
  }
}

// ────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────

function classifyError(errorMessage: string): {
  category: FailureCategory;
  explanation: string;
  isRetryable: boolean;
  waitMs: number;
} {
  // Check transient patterns first (these are retryable)
  for (const { pattern, waitMs, description } of TRANSIENT_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category: 'transient', explanation: description, isRetryable: true, waitMs };
    }
  }

  // Check data issues (sometimes fixable)
  for (const { pattern, description } of DATA_ISSUE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category: 'data_issue', explanation: description, isRetryable: false, waitMs: 0 };
    }
  }

  // Check permanent issues (not retryable as-is)
  for (const { pattern, description } of PERMANENT_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category: 'permanent', explanation: description, isRetryable: false, waitMs: 0 };
    }
  }

  // Default: unknown
  return {
    category: 'unknown',
    explanation: errorMessage || 'Unknown error occurred',
    isRetryable: true,
    waitMs: 0,
  };
}

function getNextStepId(plan: PlanInfo, currentStepId: string): string {
  const idx = plan.steps.findIndex((s) => s.stepId === currentStepId);
  if (idx >= 0 && idx + 1 < plan.steps.length) {
    return plan.steps[idx + 1]!.stepId;
  }
  return currentStepId; // fallback to current if no next step
}

function suggestParamFixes(
  diagnosis: FailureDiagnosis,
  step?: PlanInfo['steps'][number]
): Record<string, unknown> | null {
  if (!step) return null;

  const errorText = diagnosis.explanation.toLowerCase();

  // Sheet not found → suggest listing sheets first
  if (errorText.includes('sheet') && errorText.includes('not found')) {
    return {
      _suggestion: 'Verify sheet name exists using sheets_core.list_sheets before retrying',
      _verifyWith: { tool: 'sheets_core', action: 'list_sheets' },
    };
  }

  // Range issues → suggest validating range
  if (errorText.includes('range')) {
    return {
      _suggestion: 'Verify range bounds using sheets_analyze.scout before retrying',
      _verifyWith: { tool: 'sheets_analyze', action: 'scout' },
    };
  }

  // Protected → suggest checking protection
  if (errorText.includes('protected')) {
    return {
      _suggestion: 'Check protected ranges using sheets_advanced.list_protected_ranges',
      _verifyWith: { tool: 'sheets_advanced', action: 'list_protected_ranges' },
    };
  }

  return null;
}
