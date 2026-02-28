/**
 * ServalSheets - Agent Execution Engine
 *
 * Autonomous execution of multi-step plans for spreadsheet operations.
 *
 * Converts natural language descriptions into executable plans, manages
 * plan state (DRAFT → EXECUTING → COMPLETED/PAUSED/FAILED), creates
 * checkpoints for observability, and supports resumable execution.
 *
 * Design: Stateless module-level functions with in-memory plan store.
 * Max capacity: 100 plans (evicts oldest when full).
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type PlanStatus = 'draft' | 'executing' | 'completed' | 'paused' | 'failed';

export interface ExecutionStep {
  stepId: string;
  tool: string;
  action: string;
  params: Record<string, unknown>;
  description: string;
  dependsOn?: string[];
}

export interface StepResult {
  stepId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  startedAt: string;
  completedAt: string;
}

export interface Checkpoint {
  checkpointId: string;
  planId: string;
  stepIndex: number;
  context?: string;
  timestamp: string;
  snapshotId?: string;
}

export interface PlanState {
  planId: string;
  description: string;
  steps: ExecutionStep[];
  status: PlanStatus;
  results: StepResult[];
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
  currentStepIndex: number;
  error?: string;
}

export type ExecuteHandlerFn = (
  tool: string,
  action: string,
  params: Record<string, unknown>
) => Promise<unknown>;

// ============================================================================
// Plan Store
// ============================================================================

const planStore = new Map<string, PlanState>();
const MAX_PLANS = 100;

function evictOldestPlan(): void {
  if (planStore.size >= MAX_PLANS) {
    let oldest: { key: string; time: string } | null = null;
    for (const [key, plan] of planStore) {
      if (!oldest || plan.createdAt < oldest.time) {
        oldest = { key, time: plan.createdAt };
      }
    }
    if (oldest) {
      planStore.delete(oldest.key);
    }
  }
}

// ============================================================================
// Plan Compilation
// ============================================================================

/**
 * Parse natural language description into execution steps.
 * Supports common patterns like "read", "write", "format", "sort", etc.
 */
function parseDescription(
  description: string
): Array<{ tool: string; action: string; label: string }> {
  const lower = description.toLowerCase();
  const steps: Array<{ tool: string; action: string; label: string }> = [];

  // Pattern matching for common operations
  const patterns: Array<{
    regex: RegExp;
    tool: string;
    action: string;
    label: string;
  }> = [
    {
      regex: /\b(read|get|fetch)\b/i,
      tool: 'sheets_data',
      action: 'read',
      label: 'Read data',
    },
    {
      regex: /\b(write|update|set|put)\b/i,
      tool: 'sheets_data',
      action: 'write',
      label: 'Write data',
    },
    {
      regex: /\b(format|style|color|bold|italic)\b/i,
      tool: 'sheets_format',
      action: 'set_format',
      label: 'Apply formatting',
    },
    {
      regex: /\b(sort|order|rank)\b/i,
      tool: 'sheets_dimensions',
      action: 'sort_range',
      label: 'Sort data',
    },
    {
      regex: /\b(chart|graph|plot|visualize)\b/i,
      tool: 'sheets_visualize',
      action: 'chart_create',
      label: 'Create chart',
    },
    {
      regex: /\b(delete|remove)\b/i,
      tool: 'sheets_dimensions',
      action: 'delete',
      label: 'Delete rows/columns',
    },
    {
      regex: /\b(freeze|pin)\b/i,
      tool: 'sheets_dimensions',
      action: 'freeze',
      label: 'Freeze rows/columns',
    },
    {
      regex: /\b(merge)\b/i,
      tool: 'sheets_data',
      action: 'merge_cells',
      label: 'Merge cells',
    },
    {
      regex: /\b(filter|filter view)\b/i,
      tool: 'sheets_dimensions',
      action: 'set_basic_filter',
      label: 'Apply filter',
    },
    {
      regex: /\b(analyze|summarize|summary)\b/i,
      tool: 'sheets_analyze',
      action: 'comprehensive',
      label: 'Analyze data',
    },
    {
      regex: /\b(compute|calculate|aggregate)\b/i,
      tool: 'sheets_analyze',
      action: 'analyze_data',
      label: 'Compute metrics',
    },
    {
      regex: /\b(clean|fix|repair|standardize)\b/i,
      tool: 'sheets_fix',
      action: 'clean',
      label: 'Clean data',
    },
  ];

  // Detect multiple operations
  for (const pattern of patterns) {
    if (pattern.regex.test(lower)) {
      steps.push(pattern);
    }
  }

  // Fallback: if no patterns matched, use comprehensive analysis
  if (steps.length === 0) {
    steps.push({
      tool: 'sheets_analyze',
      action: 'comprehensive',
      label: 'Analyze data',
    });
  }

  return steps;
}

/**
 * Compile a natural language description into a plan.
 * Returns PlanState in 'draft' status with generated steps.
 */
export function compilePlan(
  description: string,
  maxSteps: number = 10,
  spreadsheetId?: string,
  context?: string
): PlanState {
  const planId = randomUUID();
  const now = new Date().toISOString();

  const parsedSteps = parseDescription(description).slice(0, maxSteps);

  const steps: ExecutionStep[] = parsedSteps.map((step, idx) => ({
    stepId: `${planId}-step-${idx}`,
    tool: step.tool,
    action: step.action,
    description: step.label,
    params: {
      ...(spreadsheetId && { spreadsheetId }),
      ...(context && { context }),
    },
  }));

  const plan: PlanState = {
    planId,
    description,
    steps,
    status: 'draft',
    results: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    currentStepIndex: 0,
  };

  evictOldestPlan();
  planStore.set(planId, plan);

  return plan;
}

// ============================================================================
// Plan Execution
// ============================================================================

/**
 * Execute all steps in a plan sequentially.
 * Creates checkpoints before each step, records results.
 * On error: pauses execution, records error.
 */
export async function executePlan(
  planId: string,
  dryRun: boolean,
  executeHandler: ExecuteHandlerFn
): Promise<PlanState> {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (dryRun) {
    // Preview execution without actual tool calls
    const now = new Date().toISOString();
    const previewResults: StepResult[] = plan.steps.map((step) => ({
      stepId: step.stepId,
      success: true,
      result: { dryRunPreview: true, action: step.action },
      startedAt: now,
      completedAt: now,
    }));

    plan.status = 'completed';
    plan.results = previewResults;
    plan.updatedAt = now;
    planStore.set(planId, plan);
    return plan;
  }

  // Real execution
  const now = new Date().toISOString();
  plan.status = 'executing';
  plan.updatedAt = now;

  for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step) continue; // Safety: skip if step is undefined
    const startTime = new Date().toISOString();

    // Create checkpoint before step
    createCheckpoint(planId, `Before step: ${step.description}`);

    try {
      const result = await executeHandler(step.tool, step.action, step.params);

      const stepResult: StepResult = {
        stepId: step.stepId,
        success: true,
        result,
        startedAt: startTime,
        completedAt: new Date().toISOString(),
      };

      plan.results.push(stepResult);
      plan.currentStepIndex = i + 1;
      plan.updatedAt = new Date().toISOString();
      planStore.set(planId, plan);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      const stepResult: StepResult = {
        stepId: step.stepId,
        success: false,
        error,
        startedAt: startTime,
        completedAt: new Date().toISOString(),
      };

      plan.results.push(stepResult);
      plan.status = 'paused';
      plan.error = error;
      plan.updatedAt = new Date().toISOString();
      planStore.set(planId, plan);
      return plan;
    }
  }

  plan.status = 'completed';
  plan.updatedAt = new Date().toISOString();
  planStore.set(planId, plan);
  return plan;
}

/**
 * Execute a single step from an existing plan.
 */
export async function executeStep(
  planId: string,
  stepId: string,
  executeHandler: ExecuteHandlerFn
): Promise<StepResult> {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const step = plan.steps.find((s) => s.stepId === stepId);
  if (!step) {
    throw new Error(`Step ${stepId} not found in plan ${planId}`);
  }

  const startTime = new Date().toISOString();
  createCheckpoint(planId, `Execute step: ${step.description}`);

  try {
    const result = await executeHandler(step.tool, step.action, step.params);

    const stepResult: StepResult = {
      stepId,
      success: true,
      result,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
    };

    // Update plan results
    const existingIdx = plan.results.findIndex((r) => r.stepId === stepId);
    if (existingIdx >= 0) {
      plan.results[existingIdx] = stepResult;
    } else {
      plan.results.push(stepResult);
    }
    plan.updatedAt = new Date().toISOString();
    planStore.set(planId, plan);

    return stepResult;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    const stepResult: StepResult = {
      stepId,
      success: false,
      error,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
    };

    plan.error = error;
    plan.updatedAt = new Date().toISOString();
    planStore.set(planId, plan);

    return stepResult;
  }
}

// ============================================================================
// Checkpoints
// ============================================================================

/**
 * Create an observation checkpoint at current plan state.
 */
export function createCheckpoint(
  planId: string,
  context?: string,
  snapshotId?: string
): Checkpoint {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const checkpoint: Checkpoint = {
    checkpointId: randomUUID(),
    planId,
    stepIndex: plan.currentStepIndex,
    context,
    timestamp: new Date().toISOString(),
    snapshotId,
  };

  plan.checkpoints.push(checkpoint);
  plan.updatedAt = new Date().toISOString();
  planStore.set(planId, plan);

  return checkpoint;
}

/**
 * Revert plan state to a specific checkpoint.
 * Removes results after checkpoint and sets status to 'paused'.
 */
export function rollbackToPlan(planId: string, checkpointId: string): PlanState {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const checkpoint = plan.checkpoints.find((c) => c.checkpointId === checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found in plan ${planId}`);
  }

  // Remove results after checkpoint
  const resultsToKeep = plan.results.filter((r) => {
    const stepIdx = plan.steps.findIndex((s) => s.stepId === r.stepId);
    return stepIdx < checkpoint.stepIndex;
  });

  plan.results = resultsToKeep;
  plan.currentStepIndex = checkpoint.stepIndex;
  plan.status = 'paused';
  plan.error = undefined;
  plan.updatedAt = new Date().toISOString();
  planStore.set(planId, plan);

  return plan;
}

// ============================================================================
// Plan Queries
// ============================================================================

/**
 * Get status of a specific plan.
 */
export function getPlanStatus(planId: string): PlanState | undefined {
  return planStore.get(planId);
}

/**
 * List all plans with optional filtering.
 */
export function listPlans(limit: number = 50, statusFilter?: PlanStatus): PlanState[] {
  const plans = Array.from(planStore.values());

  if (statusFilter) {
    return plans
      .filter((p) => p.status === statusFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  return plans
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Resume execution from a paused plan.
 * If fromStepId provided, resume from that step.
 * Otherwise resume from where it paused.
 */
export async function resumePlan(
  planId: string,
  fromStepId: string | undefined,
  executeHandler: ExecuteHandlerFn
): Promise<PlanState> {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (plan.status !== 'paused') {
    throw new Error(`Plan ${planId} is not paused (status: ${plan.status})`);
  }

  // Determine resume position
  if (fromStepId) {
    const stepIdx = plan.steps.findIndex((s) => s.stepId === fromStepId);
    if (stepIdx < 0) {
      throw new Error(`Step ${fromStepId} not found in plan ${planId}`);
    }
    plan.currentStepIndex = stepIdx;
  }

  // Resume execution
  return executePlan(planId, false, executeHandler);
}

// ============================================================================
// Plan Deletion
// ============================================================================

/**
 * Delete a plan from the store.
 */
export function deletePlan(planId: string): boolean {
  return planStore.delete(planId);
}

/**
 * Clear all plans from the store.
 */
export function clearAllPlans(): void {
  planStore.clear();
}
