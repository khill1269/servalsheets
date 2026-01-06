/**
 * ServalSheets - Operation Plan Types
 *
 * Type definitions for the Operation Planning Agent.
 * Phase 3, Task 3.2
 */

/**
 * Risk level for an operation
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Risk assessment for an operation or step
 */
export interface Risk {
  /** Risk level */
  level: RiskLevel;

  /** Risk description */
  description: string;

  /** Mitigation strategy */
  mitigation?: string;

  /** Affected resources (ranges, sheets, etc.) */
  affectedResources?: string[];
}

/**
 * Resource estimation for an operation
 */
export interface ResourceEstimate {
  /** Estimated API calls */
  apiCalls: number;

  /** Estimated quota impact (0-100) */
  quotaImpact: number;

  /** Estimated memory usage in MB */
  memoryUsage?: number;

  /** Estimated cells affected */
  cellsAffected?: number;
}

/**
 * Planned operation step
 */
export interface PlannedStep {
  /** Step number (1-indexed) */
  stepNumber: number;

  /** Step description */
  description: string;

  /** Tool action to execute */
  action: string;

  /** Parameters for the action */
  params: Record<string, unknown>;

  /** Step rationale */
  rationale?: string;

  /** Expected outcome */
  expectedOutcome?: string;

  /** Step-specific risks */
  risks?: Risk[];

  /** Estimated duration in seconds */
  estimatedDuration?: number;

  /** Whether this step can be skipped on error */
  optional?: boolean;

  /** Dependencies on previous steps */
  dependsOn?: number[];
}

/**
 * Operation plan
 */
export interface OperationPlan {
  /** Plan ID */
  id: string;

  /** User's original intent */
  intent: string;

  /** Plan title */
  title: string;

  /** Plan description */
  description: string;

  /** Planned steps */
  steps: PlannedStep[];

  /** Overall risks */
  risks: Risk[];

  /** Resource estimates */
  cost: ResourceEstimate;

  /** Estimated total duration in seconds */
  estimatedTime: number;

  /** Success criteria */
  successCriteria?: string[];

  /** Rollback strategy */
  rollbackStrategy?: string;

  /** Alternative approaches considered */
  alternatives?: {
    description: string;
    reason: string;
  }[];

  /** Tags for categorization */
  tags?: string[];

  /** Timestamp when plan was created */
  createdAt: number;
}

/**
 * Plan execution progress
 */
export interface PlanExecutionProgress {
  /** Plan ID */
  planId: string;

  /** Current step number (1-indexed) */
  currentStep: number;

  /** Total steps */
  totalSteps: number;

  /** Percentage complete (0-100) */
  percentComplete: number;

  /** Current step description */
  currentStepDescription: string;

  /** Steps completed */
  completedSteps: number;

  /** Steps failed */
  failedSteps: number;

  /** Steps skipped */
  skippedSteps: number;

  /** Elapsed time in ms */
  elapsedTime: number;

  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;
}

/**
 * Plan execution result
 */
export interface PlanExecutionResult {
  /** Plan ID */
  planId: string;

  /** Plan title */
  planTitle: string;

  /** Execution success */
  success: boolean;

  /** Results from each step */
  stepResults: PlannedStepResult[];

  /** Total execution duration in ms */
  duration: number;

  /** Snapshot ID (for rollback) */
  snapshotId?: string;

  /** Whether rollback was performed */
  rolledBack?: boolean;

  /** Final outcome description */
  outcome?: string;

  /** Error if execution failed */
  error?: Error;
}

/**
 * Planned step execution result
 */
export interface PlannedStepResult {
  /** Step number */
  stepNumber: number;

  /** Step description */
  description: string;

  /** Step action */
  action: string;

  /** Step success */
  success: boolean;

  /** Step result data */
  result?: unknown;

  /** Step duration in ms */
  duration: number;

  /** Error if step failed */
  error?: Error;

  /** Whether step was skipped */
  skipped?: boolean;

  /** Actual outcome */
  actualOutcome?: string;
}

/**
 * Plan modification request
 */
export interface PlanModification {
  /** Type of modification */
  type: 'add_step' | 'remove_step' | 'modify_step' | 'reorder_steps';

  /** Step number to modify (if applicable) */
  stepNumber?: number;

  /** New step data (for add/modify) */
  newStep?: Partial<PlannedStep>;

  /** New order (for reorder) */
  newOrder?: number[];

  /** Modification reason */
  reason: string;
}

/**
 * Planning agent configuration
 */
export interface PlanningAgentOptions {
  /** Enable planning agent (default: true) */
  enabled?: boolean;

  /** Maximum steps per plan (default: 10) */
  maxSteps?: number;

  /** Maximum API calls per plan (default: 50) */
  maxApiCalls?: number;

  /** Require user confirmation (default: true) */
  requireConfirmation?: boolean;

  /** Auto-create snapshots before execution (default: true) */
  autoSnapshot?: boolean;

  /** Auto-rollback on failure (default: true) */
  autoRollback?: boolean;

  /** Verbose logging (default: false) */
  verboseLogging?: boolean;
}

/**
 * Planning agent statistics
 */
export interface PlanningAgentStats {
  /** Total plans generated */
  totalPlans: number;

  /** Total plans executed */
  totalExecutions: number;

  /** Successful executions */
  successfulExecutions: number;

  /** Failed executions */
  failedExecutions: number;

  /** Plans rolled back */
  rollbackCount: number;

  /** Success rate percentage */
  successRate: number;

  /** Average plan complexity (steps per plan) */
  avgPlanComplexity: number;

  /** Average execution duration */
  avgExecutionDuration: number;

  /** Total API calls saved (via planning) */
  apiCallsSaved: number;

  /** User acceptance rate (plans executed / plans generated) */
  acceptanceRate: number;
}
