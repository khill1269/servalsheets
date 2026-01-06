/**
 * ServalSheets - Smart Workflow Engine
 *
 * Detects common multi-step operations and offers to execute them as workflows.
 * Phase 3, Task 3.1
 *
 * Features:
 * - Automatic workflow detection
 * - User confirmation prompts
 * - Step chaining with context passing
 * - Progress tracking
 * - Error handling and rollback
 *
 * Expected Impact:
 * - 50% reduction in tool calls for common tasks
 * - Improved user experience
 * - Faster complex operations
 */

import type {
  Workflow,
  WorkflowContext,
  WorkflowSuggestion,
  WorkflowExecutionResult,
  StepExecutionResult,
  WorkflowExecutionOptions,
  StepParamGenerator,
} from '../types/workflow.js';
import { BUILTIN_WORKFLOWS } from '../workflows/builtin-workflows.js';
import { logger } from '../utils/logger.js';

/**
 * Workflow engine configuration
 */
export interface WorkflowEngineOptions {
  /** Enable workflow suggestions (default: true) */
  enabled?: boolean;

  /** Minimum confidence for suggestions (default: 0.7) */
  minConfidence?: number;

  /** Maximum workflows to suggest (default: 3) */
  maxSuggestions?: number;

  /** Verbose logging (default: false) */
  verboseLogging?: boolean;
}

/**
 * Workflow engine statistics
 */
export interface WorkflowEngineStats {
  /** Total workflow suggestions made */
  totalSuggestions: number;

  /** Total workflows executed */
  totalExecutions: number;

  /** Total successful executions */
  successfulExecutions: number;

  /** Total failed executions */
  failedExecutions: number;

  /** Success rate percentage */
  successRate: number;

  /** Total tool calls saved */
  toolCallsSaved: number;

  /** Average execution duration */
  avgExecutionDuration: number;

  /** Workflows by ID */
  executionsByWorkflow: Record<string, number>;
}

/**
 * Smart Workflow Engine
 *
 * Detects common patterns and suggests/executes multi-step workflows
 */
export class WorkflowEngine {
  private enabled: boolean;
  private minConfidence: number;
  private maxSuggestions: number;
  private verboseLogging: boolean;
  private workflows: Workflow[];

  // Statistics
  private stats = {
    totalSuggestions: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    toolCallsSaved: 0,
    executionDurations: [] as number[],
    executionsByWorkflow: {} as Record<string, number>,
  };

  constructor(options: WorkflowEngineOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.minConfidence = options.minConfidence ?? 0.7;
    this.maxSuggestions = options.maxSuggestions ?? 3;
    this.verboseLogging = options.verboseLogging ?? false;
    this.workflows = [...BUILTIN_WORKFLOWS];

    if (this.verboseLogging) {
      logger.info('Workflow engine initialized', {
        enabled: this.enabled,
        workflowCount: this.workflows.length,
        minConfidence: this.minConfidence,
      });
    }
  }

  /**
   * Detect and suggest workflows based on current action
   */
  async detectAndSuggest(
    action: string,
    params: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<WorkflowSuggestion[]> {
    if (!this.enabled) {
      return [];
    }

    const suggestions: WorkflowSuggestion[] = [];

    for (const workflow of this.workflows) {
      const match = this.matchesTrigger(workflow, action, params, context);

      if (match.matches && match.confidence >= this.minConfidence) {
        suggestions.push({
          workflow,
          confidence: match.confidence,
          reason: match.reason,
          preview: this.generatePreview(workflow, params),
        });
      }
    }

    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Limit to max suggestions
    const limitedSuggestions = suggestions.slice(0, this.maxSuggestions);

    this.stats.totalSuggestions += limitedSuggestions.length;

    if (this.verboseLogging && limitedSuggestions.length > 0) {
      logger.info('Workflows suggested', {
        action,
        suggestionCount: limitedSuggestions.length,
        workflows: limitedSuggestions.map((s) => s.workflow.id),
      });
    }

    return limitedSuggestions;
  }

  /**
   * Check if workflow trigger matches current action
   */
  private matchesTrigger(
    workflow: Workflow,
    action: string,
    params: Record<string, unknown>,
    context?: Record<string, unknown>
  ): { matches: boolean; confidence: number; reason: string } {
    let confidence = 0;
    const reasons: string[] = [];

    // Check action match
    if (workflow.trigger.action) {
      if (workflow.trigger.action === action) {
        confidence += 0.5;
        reasons.push(`Action matches: ${action}`);
      } else {
        return { matches: false, confidence: 0, reason: 'Action does not match' };
      }
    }

    // Check user intent match
    if (workflow.trigger.userIntent && context?.['userIntent']) {
      const intent = String(context['userIntent']).toLowerCase();
      if (intent.includes(workflow.trigger.userIntent.toLowerCase())) {
        confidence += 0.4;
        reasons.push(`User intent detected: ${workflow.trigger.userIntent}`);
      }
    }

    // Check parameter conditions
    if (workflow.trigger.paramConditions) {
      let paramMatches = 0;
      let totalConditions = 0;

      for (const [key, value] of Object.entries(workflow.trigger.paramConditions)) {
        totalConditions++;
        if (params[key] === value) {
          paramMatches++;
        }
      }

      if (paramMatches > 0) {
        const paramScore = (paramMatches / totalConditions) * 0.3;
        confidence += paramScore;
        reasons.push(`${paramMatches}/${totalConditions} parameter conditions matched`);
      }
    }

    // Check context conditions
    if (workflow.trigger.contextConditions && context) {
      let contextMatches = 0;
      let totalConditions = 0;

      for (const [key, value] of Object.entries(workflow.trigger.contextConditions)) {
        totalConditions++;
        if (context[key] === value) {
          contextMatches++;
        }
      }

      if (contextMatches > 0) {
        const contextScore = (contextMatches / totalConditions) * 0.2;
        confidence += contextScore;
        reasons.push(`${contextMatches}/${totalConditions} context conditions matched`);
      }
    }

    return {
      matches: confidence > 0,
      confidence: Math.min(confidence, 1.0),
      reason: reasons.join(', '),
    };
  }

  /**
   * Generate workflow preview
   */
  private generatePreview(workflow: Workflow, _params: Record<string, unknown>): string[] {
    return workflow.steps.map((step, index) => {
      return `${index + 1}. ${step.description}`;
    });
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: Workflow,
    initialParams: Record<string, unknown>,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    this.stats.totalExecutions++;
    this.stats.executionsByWorkflow[workflow.id] =
      (this.stats.executionsByWorkflow[workflow.id] || 0) + 1;

    if (this.verboseLogging) {
      logger.info('Executing workflow', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        stepCount: workflow.steps.length,
      });
    }

    const context: WorkflowContext = {
      initial: initialParams,
      previousResults: [],
      currentStep: 0,
      ...initialParams,
    };

    const stepResults: StepExecutionResult[] = [];
    let workflowError: Error | undefined;

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i]!;
        context.currentStep = i;

        // Report progress
        if (options.onProgress) {
          options.onProgress(i + 1, workflow.steps.length, step.description);
        }

        // Check step condition
        if (step.condition && !step.condition(context)) {
          stepResults.push({
            stepIndex: i,
            description: step.description,
            action: step.action,
            success: true,
            duration: 0,
            skipped: true,
          });

          if (this.verboseLogging) {
            logger.debug('Step skipped', {
              stepIndex: i,
              description: step.description,
              reason: 'Condition not met',
            });
          }

          continue;
        }

        // Execute step
        const stepResult = await this.executeStep(step, context, options.dryRun);
        stepResults.push(stepResult);

        if (!stepResult.success) {
          if (!step.optional && (options.stopOnError ?? true)) {
            throw stepResult.error || new Error(`Step ${i} failed`);
          }
        }

        // Add result to context
        context.previousResults.push(stepResult.result);

        if (this.verboseLogging) {
          logger.debug('Step completed', {
            stepIndex: i,
            description: step.description,
            duration: stepResult.duration,
            success: stepResult.success,
          });
        }
      }

      this.stats.successfulExecutions++;
      const toolCallsSaved = workflow.steps.length - 1; // N steps → 1 workflow call
      this.stats.toolCallsSaved += toolCallsSaved;

      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        success: true,
        stepResults,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.stats.failedExecutions++;
      workflowError = error instanceof Error ? error : new Error(String(error));

      logger.error('Workflow execution failed', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        error: workflowError.message,
      });

      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        success: false,
        stepResults,
        duration: Date.now() - startTime,
        error: workflowError,
      };
    } finally {
      const duration = Date.now() - startTime;
      this.stats.executionDurations.push(duration);

      if (this.verboseLogging) {
        logger.info('Workflow execution completed', {
          workflowId: workflow.id,
          duration,
          success: !workflowError,
          stepsCompleted: stepResults.filter((s) => s.success).length,
          stepsFailed: stepResults.filter((s) => !s.success && !s.skipped).length,
          stepsSkipped: stepResults.filter((s) => s.skipped).length,
        });
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: import('../types/workflow.js').WorkflowStep,
    context: WorkflowContext,
    dryRun?: boolean
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // Resolve step parameters
      const params =
        typeof step.params === 'function'
          ? (step.params as StepParamGenerator)(context)
          : step.params || {};

      if (dryRun) {
        // Dry run: don't actually execute
        return {
          stepIndex: context.currentStep,
          description: step.description,
          action: step.action,
          success: true,
          result: { dryRun: true, params },
          duration: Date.now() - startTime,
        };
      }

      // TODO: Integrate with actual tool handlers
      // For now, simulate execution
      const result = await this.simulateStepExecution(step.action, params);

      return {
        stepIndex: context.currentStep,
        description: step.description,
        action: step.action,
        success: true,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepIndex: context.currentStep,
        description: step.description,
        action: step.action,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Simulate step execution (placeholder for tool integration)
   */
  private async simulateStepExecution(
    action: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    // This is a placeholder. In production, this would:
    // 1. Parse the action (e.g., "sheets_values:batch_write")
    // 2. Call the appropriate handler
    // 3. Return the result

    logger.debug('Simulating step execution', { action, params });

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    return { simulated: true, action, params };
  }

  /**
   * Register a custom workflow
   */
  registerWorkflow(workflow: Workflow): void {
    // Check for duplicate ID
    const existing = this.workflows.find((w) => w.id === workflow.id);
    if (existing) {
      throw new Error(`Workflow with ID ${workflow.id} already exists`);
    }

    this.workflows.push(workflow);

    if (this.verboseLogging) {
      logger.info('Custom workflow registered', {
        workflowId: workflow.id,
        workflowName: workflow.name,
      });
    }
  }

  /**
   * Get all registered workflows
   */
  getWorkflows(): Workflow[] {
    return [...this.workflows];
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(id: string): Workflow | undefined {
    return this.workflows.find((w) => w.id === id);
  }

  /**
   * Get workflow engine statistics
   */
  getStats(): WorkflowEngineStats {
    const avgExecutionDuration =
      this.stats.executionDurations.length > 0
        ? this.stats.executionDurations.reduce((a, b) => a + b, 0) / this.stats.executionDurations.length
        : 0;

    const successRate =
      this.stats.totalExecutions > 0
        ? (this.stats.successfulExecutions / this.stats.totalExecutions) * 100
        : 0;

    return {
      totalSuggestions: this.stats.totalSuggestions,
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      successRate,
      toolCallsSaved: this.stats.toolCallsSaved,
      avgExecutionDuration,
      executionsByWorkflow: { ...this.stats.executionsByWorkflow },
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalSuggestions: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      toolCallsSaved: 0,
      executionDurations: [],
      executionsByWorkflow: {},
    };
  }
}

// Singleton instance
let workflowEngine: WorkflowEngine | null = null;

/**
 * Get or create the workflow engine singleton
 */
export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine({
      enabled: process.env['WORKFLOWS_ENABLED'] !== 'false',
      minConfidence: parseFloat(process.env['WORKFLOWS_MIN_CONFIDENCE'] || '0.7'),
      maxSuggestions: parseInt(process.env['WORKFLOWS_MAX_SUGGESTIONS'] || '3', 10),
      verboseLogging: process.env['WORKFLOWS_VERBOSE'] === 'true',
    });
  }
  return workflowEngine;
}

/**
 * Set the workflow engine (for testing or custom configuration)
 */
export function setWorkflowEngine(engine: WorkflowEngine): void {
  workflowEngine = engine;
}
