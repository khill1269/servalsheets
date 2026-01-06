/**
 * ServalSheets - Workflow Types
 *
 * Type definitions for the Smart Workflow Engine.
 * Phase 3, Task 3.1
 */

/**
 * Workflow trigger conditions
 */
export interface WorkflowTrigger {
  /** Tool action that triggers this workflow (e.g., "sheets_analysis:data_quality") */
  action?: string;

  /** User intent keywords that trigger this workflow */
  userIntent?: string;

  /** Parameter conditions (e.g., { hasHeaders: true }) */
  paramConditions?: Record<string, unknown>;

  /** Context conditions (e.g., spreadsheet has data quality issues) */
  contextConditions?: {
    hasDataQualityIssues?: boolean;
    hasEmptySpreadsheet?: boolean;
    hasUnformattedData?: boolean;
    requiresDashboard?: boolean;
  };
}

/**
 * Workflow step parameter generator
 */
export type StepParamGenerator = (context: WorkflowContext) => Record<string, unknown>;

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step description */
  description: string;

  /** Tool action to execute (e.g., "sheets_values:batch_write") */
  action: string;

  /** Static parameters or parameter generator function */
  params?: Record<string, unknown> | StepParamGenerator;

  /** Optional condition to execute this step */
  condition?: (context: WorkflowContext) => boolean;

  /** Skip this step on error (default: false) */
  optional?: boolean;
}

/**
 * Workflow context passed between steps
 */
export interface WorkflowContext {
  /** Initial parameters */
  initial: Record<string, unknown>;

  /** Results from previous steps */
  previousResults: unknown[];

  /** Current step index */
  currentStep: number;

  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Workflow definition
 */
export interface Workflow {
  /** Unique workflow ID */
  id: string;

  /** Human-readable workflow name */
  name: string;

  /** Workflow description */
  description: string;

  /** Trigger conditions */
  trigger: WorkflowTrigger;

  /** Workflow steps */
  steps: WorkflowStep[];

  /** Auto-execute without confirmation (default: false) */
  autoExecute?: boolean;

  /** Expected impact description */
  expectedImpact?: string;

  /** Estimated execution time in seconds */
  estimatedDuration?: number;

  /** Tags for categorization */
  tags?: string[];
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Workflow ID */
  workflowId: string;

  /** Workflow name */
  workflowName: string;

  /** Execution success */
  success: boolean;

  /** Results from each step */
  stepResults: StepExecutionResult[];

  /** Total execution duration in ms */
  duration: number;

  /** Error if execution failed */
  error?: Error;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  /** Step index */
  stepIndex: number;

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
}

/**
 * Workflow suggestion for user
 */
export interface WorkflowSuggestion {
  /** Workflow being suggested */
  workflow: Workflow;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reason for suggestion */
  reason: string;

  /** Preview of what will happen */
  preview: string[];
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /** Skip user confirmation (use workflow.autoExecute default) */
  skipConfirmation?: boolean;

  /** Dry run mode (don't actually execute) */
  dryRun?: boolean;

  /** Stop on first error (default: true) */
  stopOnError?: boolean;

  /** Callback for progress updates */
  onProgress?: (step: number, total: number, description: string) => void;
}
